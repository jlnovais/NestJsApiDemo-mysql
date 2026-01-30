import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmployeesRepository } from './repository/employees.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee, Role } from './entities/employee';
import { handleRepositoryError } from 'src/common/error-handlers';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { PaginationResult } from 'src/common/result';
import { StorageService } from 'src/storage/storage.service';
import { SessionUser } from 'src/types/session-user.interface';
import { AuditContext } from 'src/audit/entities/AuditContext';
import { AuditMetadata } from 'src/audit/entities/auditMetadata';
import { RabbitMqSenderService } from 'src/rabbiMQ/sender/rabbitMqSender.service';
import { DepartmentsRepository } from 'src/departments/repository/departments.repository';
import { csvEscape } from 'src/common/tools';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  private CACHE_TTL_SECONDS = 60;
  private CACHE_ENABLED = false;

  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly storageService: StorageService,
    private readonly rabbitSender: RabbitMqSenderService,
    private readonly configService: ConfigService,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly redisService: RedisService,
  ) {
    this.CACHE_TTL_SECONDS = this.configService.get<number>(
      'CACHE_TTL_SECONDS',
      60,
    );
    this.CACHE_ENABLED = this.configService.get<boolean>(
      'CACHE_ENABLED',
      false,
    );

    this.logger.log(
      `EmployeesService.constructor. CACHE_ENABLED: ${this.CACHE_ENABLED}, CACHE_TTL_SECONDS: ${this.CACHE_TTL_SECONDS}`,
    );
  }

  public employeesToCsv(rows: EmployeeResponseDto[]): string {
    const columns: Array<keyof EmployeeResponseDto> = [
      'id',
      'name',
      'email',
      'role',
      'departmentId',
      'photoUrl',
      'createdAt',
      'updatedAt',
    ];

    const header = columns.join(',');
    const lines = rows.map((r) =>
      columns.map((c) => csvEscape(r?.[c])).join(','),
    );

    return [header, ...lines].join('\r\n');
  }

  private async publishEmployeeEvent(
    eventType: 'create' | 'update' | 'delete' | 'photo_upload' | 'photo_delete',
    content: EmployeeResponseDto,
  ): Promise<void> {
    // Publishing is controlled by env var:
    // - if set (non-empty) -> publish
    // - if missing/empty -> skip
    const queueOrRoutingKey = this.configService.get<string>(
      'RABBITMQ_EMPLOYEE_EVENTS_QUEUE_OR_ROUTINGKEY',
    );

    if (!queueOrRoutingKey || queueOrRoutingKey.trim().length === 0) {
      this.logger.warn(
        `Employee event publish skipped: RABBITMQ_EMPLOYEE_EVENTS_QUEUE_OR_ROUTINGKEY is empty`,
      );
      return;
    }

    const payload = {
      eventType,
      content,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.rabbitSender.connect();
      const ok = await this.rabbitSender.sendMessageQueue(
        queueOrRoutingKey.trim(),
        payload,
      );
      if (!ok) {
        this.logger.warn(
          `Failed to publish employee event to RabbitMQ destination "${queueOrRoutingKey}"`,
        );
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Error publishing employee event to RabbitMQ destination "${queueOrRoutingKey}": ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async create(
    createEmployeeDto: CreateEmployeeDto,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<EmployeeResponseDto> {
    console.log('Creating Emproyee. createEmployeeDto', createEmployeeDto);

    const auditContext: AuditContext = {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    };

    const departmentResult = await this.departmentsRepository.findOne(
      createEmployeeDto.departmentId,
    );
    if (!departmentResult.Success) {
      if (departmentResult.ErrorCode === 404) {
        throw new BadRequestException('Invalid departmentId');
      } else {
        handleRepositoryError(departmentResult);
      }
    }

    const result = await this.employeesRepository.create(
      createEmployeeDto,
      auditContext,
    );

    if (!result.Success) {
      handleRepositoryError(result);
    }
    // Return the employee directly from the create operation to avoid read-after-write consistency issues
    // The repository now returns the full employee object, ensuring we read from the master
    const created = result.ReturnedObject as EmployeeResponseDto;
    await this.publishEmployeeEvent('create', created);
    return created;
  }

  async findOne(id: number): Promise<EmployeeResponseDto> {
    const result = await this.employeesRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    return result.ReturnedObject as EmployeeResponseDto;
  }

  private getCacheKey(
    role?: Role,
    page?: number,
    pageSize?: number,
    searchName?: string,
    searchEmail?: string,
    departmentId?: number,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): string {
    return `employees:${role}:${page}:${pageSize}:${searchName}:${searchEmail}:${departmentId}:${sortBy}:${sortOrder}`;
  }

  async findAll(
    role?: Role,
    page?: number,
    pageSize?: number,
    searchName?: string,
    searchEmail?: string,
    departmentId?: number,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaginationResult<EmployeeResponseDto[]>> {
    const cacheKey = this.getCacheKey(
      role,
      page,
      pageSize,
      searchName,
      searchEmail,
      departmentId,
      sortBy,
      sortOrder,
    );

    if (this.CACHE_ENABLED) {
      const cachedResult = await this.redisService.get(cacheKey);
      if (cachedResult) {
        this.logger.log(
          `EmployeesService.findAll. Cache hit for key: ${cacheKey}`,
        );
        return JSON.parse(cachedResult) as PaginationResult<
          EmployeeResponseDto[]
        >;
      }
      this.logger.warn(
        `EmployeesService.findAll. Cache miss for key: ${cacheKey}`,
      );
    }

    const result = await this.employeesRepository.findAll(
      role,
      page,
      pageSize,
      searchName,
      searchEmail,
      departmentId,
      sortBy,
      sortOrder,
    );

    if (!result.Success) {
      handleRepositoryError(result);
    }

    // Convert Employee[] to EmployeeResponseDto[] and return PaginationResult
    const employees = result.ReturnedObject as Employee[];
    const employeeDtos = employees || [];

    const resultObject = new PaginationResult<EmployeeResponseDto[]>(
      result.Success,
      result.Message,
      result.Page,
      result.PageSize,
      result.Total,
      result.TotalPages,
      employeeDtos as EmployeeResponseDto[],
      result.ErrorCode,
    );

    if (this.CACHE_ENABLED) {
      await this.redisService.set(
        cacheKey,
        JSON.stringify(resultObject),
        this.CACHE_TTL_SECONDS,
      );
    }

    return resultObject;
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }
    const before = result.ReturnedObject as Employee;

    if (updateEmployeeDto.departmentId !== undefined) {
      const departmentResult = await this.departmentsRepository.findOne(
        updateEmployeeDto.departmentId,
      );
      if (!departmentResult.Success) {
        if (departmentResult.ErrorCode === 404) {
          throw new BadRequestException('Invalid departmentId');
        } else {
          handleRepositoryError(departmentResult);
        }
      }
    }

    const auditContext: AuditContext = {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      data: { before, changes: updateEmployeeDto },
    };

    const resultUpdate = await this.employeesRepository.update(
      id,
      updateEmployeeDto,
      auditContext,
    );

    if (!resultUpdate.Success) {
      handleRepositoryError(resultUpdate);
    }

    const updated = await this.findOne(id);
    await this.publishEmployeeEvent('update', updated);
    return updated;
  }

  async remove(
    id: number,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<EmployeeResponseDto> {
    const result = await this.employeesRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const employeeDto = result.ReturnedObject as EmployeeResponseDto;
    const resultDelete = await this.employeesRepository.delete(id, {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      data: { before: employeeDto },
    });

    if (!resultDelete.Success) {
      handleRepositoryError(resultDelete);
    }

    await this.publishEmployeeEvent('delete', employeeDto);
    return employeeDto;
  }

  async uploadPhoto(
    id: number,
    file: Express.Multer.File,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const employee = result.ReturnedObject as Employee;

    // Delete old photo if exists
    if (employee.photoUrl) {
      try {
        await this.storageService.deleteFile(employee.photoUrl);
      } catch (error) {
        console.error('Error deleting old photo:', error);
        // Continue even if deletion fails
      }
    }

    // Upload new photo
    const photoUrl = await this.storageService.uploadFile(file, 'employees');

    // Update employee with new photo URL
    const updateDto: UpdateEmployeeDto = { photoUrl };
    const updateResult = await this.employeesRepository.update(id, updateDto, {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      data: { before: employee, changes: updateDto },
    });

    if (!updateResult.Success) {
      handleRepositoryError(updateResult);
    }

    const updated = await this.findOne(id);
    await this.publishEmployeeEvent('photo_upload', updated);
    return updated;
  }

  async deletePhoto(
    id: number,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const employee = result.ReturnedObject as Employee;

    // Delete photo from storage if exists
    if (employee.photoUrl) {
      try {
        await this.storageService.deleteFile(employee.photoUrl);
      } catch (error) {
        console.error('Error deleting photo from storage:', error);
        // Continue even if deletion fails
      }
    }

    // Update employee to remove photo URL
    const updateDto: UpdateEmployeeDto = { photoUrl: '' };

    console.log('EmployeesService.deletePhoto. updateDto', updateDto);

    const updateResultWithAudit = await this.employeesRepository.update(
      id,
      updateDto,
      {
        actorUserId: actor.id,
        actorType: actor.type,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        data: { before: employee, changes: updateDto },
      },
    );

    if (!updateResultWithAudit.Success) {
      handleRepositoryError(updateResultWithAudit);
    }

    const updated = await this.findOne(id);
    await this.publishEmployeeEvent('photo_delete', updated);
    return updated;
  }
}
