import { Injectable, Logger } from '@nestjs/common';
import { DepartmentsRepository } from './repository/departments.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { handleRepositoryError } from 'src/common/error-handlers';
import { AuditMetadata } from 'src/audit/entities/auditMetadata';
import { SessionUser } from 'src/types/session-user.interface';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { AuditContext } from 'src/audit/entities/AuditContext';
import { PaginationResult } from 'src/common/result';
import { Department } from './entities/department';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly departmentsRepository: DepartmentsRepository) {}

  async create(
    createDepartmentDto: CreateDepartmentDto,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<DepartmentResponseDto> {
    this.logger.log(
      'Creating department. createDepartmentDto',
      createDepartmentDto,
    );

    const auditContext: AuditContext = {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    };

    const result = await this.departmentsRepository.create(
      createDepartmentDto,
      auditContext,
    );
    if (!result.Success) {
      handleRepositoryError(result);
    }
    if (!result.Success) {
      handleRepositoryError(result);
    }
    // Return the department directly from the create operation to avoid read-after-write consistency issues
    // The repository now returns the full department object, ensuring we read from the master
    const created = result.ReturnedObject as DepartmentResponseDto;
    return created;
  }

  async findOne(id: number): Promise<DepartmentResponseDto> {
    const result = await this.departmentsRepository.findOne(id);
    if (!result.Success) {
      handleRepositoryError(result);
    }
    return result.ReturnedObject as DepartmentResponseDto;
  }

  async findAll(
    page?: number,
    pageSize?: number,
    searchName?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaginationResult<DepartmentResponseDto[]>> {
    const result = await this.departmentsRepository.findAll(
      page,
      pageSize,
      searchName,
      sortBy,
      sortOrder,
    );

    if (!result.Success) {
      handleRepositoryError(result);
    }

    // Convert Employee[] to EmployeeResponseDto[] and return PaginationResult
    const employees = result.ReturnedObject as Department[];
    const employeeDtos = employees || [];

    return new PaginationResult<DepartmentResponseDto[]>(
      result.Success,
      result.Message,
      result.Page,
      result.PageSize,
      result.Total,
      result.TotalPages,
      employeeDtos as DepartmentResponseDto[],
      result.ErrorCode,
    );
  }

  async update(
    id: number,
    updateDepartmentDto: UpdateDepartmentDto,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<DepartmentResponseDto> {
    // Check if department exists
    const result = await this.departmentsRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }
    const before = result.ReturnedObject as Department;

    const resultUpdate = await this.departmentsRepository.update(
      id,
      updateDepartmentDto,
      {
        actorUserId: actor.id,
        actorType: actor.type,
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        data: { before, changes: updateDepartmentDto },
      },
    );

    if (!resultUpdate.Success) {
      handleRepositoryError(resultUpdate);
    }

    const updated = await this.findOne(id);
    return updated;
  }

  async remove(
    id: number,
    actor: SessionUser,
    meta: AuditMetadata,
  ): Promise<DepartmentResponseDto> {
    const result = await this.departmentsRepository.findOneMaster(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const departmentDto = result.ReturnedObject as DepartmentResponseDto;
    const resultDelete = await this.departmentsRepository.delete(id, {
      actorUserId: actor.id,
      actorType: actor.type,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      data: { before: departmentDto },
    });

    if (!resultDelete.Success) {
      handleRepositoryError(resultDelete);
    }

    return departmentDto;
  }
}
