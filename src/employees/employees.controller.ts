import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ValidationPipe,
  BadRequestException,
  UseGuards,
  UnauthorizedException,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { MyLoggerService } from 'src/my-logger/my-logger.service';
import { Role } from './entities/employee';
import { SessionGuard } from 'src/auth/guards/session.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionUser } from 'src/types/session-user.interface';
import { AllowedUserTypes } from 'src/auth/decorators/allowed-user-types.decorator';
import { StorageService } from 'src/storage/storage.service';
import { AuditMetaParam } from 'src/audit/decorators/audit-meta.decorator';
import type { AuditMetadata } from 'src/audit/entities/auditMetadata';

@ApiTags('employees')
@SkipThrottle()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly storageService: StorageService,
  ) {}

  private readonly logger = new MyLoggerService(EmployeesController.name);

  @Post()
  @ApiOperation({
    summary: 'Create a new employee',
    description:
      'Create a new employee record in the database with name, email, and role',
  })
  @ApiBody({
    type: CreateEmployeeDto,
    description: 'Employee data to create',
  })
  @ApiResponse({
    status: 201,
    description: 'Employee created successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @Throttle({ short: { ttl: 1000, limit: 1 } })

  // authenticated user
  @UseGuards(SessionGuard)
  create(
    @Body(ValidationPipe) createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: SessionUser | null,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    console.log('EmployeesController.create. user', user);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    console.log(
      'EmployeesController.create. createEmployeeDto',
      createEmployeeDto,
    );
    console.log('EmployeesController.create. user', user);

    return this.employeesService.create(createEmployeeDto, user, auditMeta);
  }

  @SkipThrottle({ default: false })
  @Get()
  @ApiOperation({
    summary: 'Get all employees',
    description:
      'Retrieve a list of all employees from the database. Supports filtering by role, searching by name/email, and sorting by createdAt or name.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: Role,
    description: 'Filter employees by role',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Number of items per page (default: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'searchName',
    required: false,
    type: String,
    description: 'Search employees by name (partial match)',
    example: 'John',
  })
  @ApiQuery({
    name: 'searchEmail',
    required: false,
    type: String,
    description: 'Search employees by email (partial match)',
    example: 'john@example.com',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'name'],
    description: 'Column to sort by (default: id)',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort order (default: ASC)',
    example: 'ASC',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of employees retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        Success: { type: 'boolean', example: true },
        Message: {
          type: 'string',
          example: 'Employees retrieved successfully',
        },
        ErrorCode: { type: 'number', example: 0 },
        Page: { type: 'number', example: 1 },
        PageSize: { type: 'number', example: 10 },
        Total: { type: 'number', example: 25 },
        TotalPages: { type: 'number', example: 3 },
        ReturnedObject: {
          type: 'array',
          items: { $ref: '#/components/schemas/EmployeeResponseDto' },
        },
      },
    },
  })
  @UseGuards(SessionGuard)
  @AllowedUserTypes('user')
  async findAll(
    @CurrentUser() user: SessionUser | null,
    @AuditMetaParam() auditMeta: AuditMetadata,
    @Res({ passthrough: true }) res: Response,
    @Query('role') role?: Role,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('searchName') searchName?: string,
    @Query('searchEmail') searchEmail?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'name',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    console.log('EmployeesController.findAll. user', user);
    console.log('EmployeesController.findAll. role', role);
    console.log('EmployeesController.findAll. ip', auditMeta.ip);

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    this.logger.log(`Request for all Employees\t ip: ${auditMeta.ip}`);

    const result = await this.employeesService.findAll(
      role,
      page,
      pageSize,
      searchName,
      searchEmail,
      sortBy,
      sortOrder,
    );

    const hasNextPage = result.Page < result.TotalPages;
    const hasPreviousPage = result.Page > 1;
    // Add custom headers
    res.setHeader('X-Total-Count', result.Total.toString());
    res.setHeader('X-Page', result.Page.toString());
    res.setHeader('X-Page-Size', result.PageSize.toString());
    res.setHeader('X-Total-Pages', result.TotalPages.toString());
    res.setHeader('X-Has-Next-Page', hasNextPage.toString());
    res.setHeader('X-Has-Previous-Page', hasPreviousPage.toString());

    return result.ReturnedObject;
  }

  @Throttle({ short: { ttl: 1000, limit: 1 } })
  @Get(':id')
  @ApiOperation({
    summary: 'Get employee by ID',
    description:
      'Retrieve a specific employee by their unique identifier from the database',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Employee ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee retrieved successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @UseGuards(SessionGuard)
  findOne(@CurrentUser() user: SessionUser | null, @Param('id') id: string) {
    console.log('EmployeesController.findOne. user', user);
    console.log('EmployeesController.findOne. id', id);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.employeesService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update employee',
    description:
      'Update an existing employee record. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Employee ID',
    example: '1',
  })
  @ApiBody({
    type: UpdateEmployeeDto,
    description: 'Employee data to update (partial)',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee updated successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @UseGuards(SessionGuard)
  update(
    @CurrentUser() user: SessionUser | null,
    @Param('id') id: string,
    @Body(ValidationPipe) updateEmployeeDto: UpdateEmployeeDto,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    console.log('EmployeesController.update. user', user);
    console.log('EmployeesController.update. id', id);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!updateEmployeeDto) {
      throw new BadRequestException('Body is required');
    }

    return this.employeesService.update(
      +id,
      updateEmployeeDto,
      user,
      auditMeta,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete employee',
    description:
      'Delete an employee record from the database by their unique identifier',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Employee ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee deleted successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  remove(
    @CurrentUser() user: SessionUser | null,
    @Param('id') id: string,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    console.log('EmployeesController.remove. user', user);
    console.log('EmployeesController.remove. id', id);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.employeesService.remove(+id, user, auditMeta);
  }

  @Post(':id/photo')
  @ApiOperation({
    summary: 'Upload employee photo',
    description:
      'Upload a profile photo for an employee. Accepts JPEG, PNG, or WebP images up to 5MB.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Employee ID',
    example: '1',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, or WebP, max 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo uploaded successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(SessionGuard)
  async uploadPhoto(
    @CurrentUser() user: SessionUser | null,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    console.log('EmployeesController.uploadPhoto. user', user);
    console.log('EmployeesController.uploadPhoto. id', id);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    return this.employeesService.uploadPhoto(+id, file, user, auditMeta);
  }

  @Delete(':id/photo')
  @ApiOperation({
    summary: 'Delete employee photo',
    description: 'Remove the profile photo for an employee',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Employee ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Photo deleted successfully',
    type: EmployeeResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
  })
  @UseGuards(SessionGuard)
  async deletePhoto(
    @CurrentUser() user: SessionUser | null,
    @Param('id') id: string,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    console.log('EmployeesController.deletePhoto. user', user);
    console.log('EmployeesController.deletePhoto. id', id);
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.employeesService.deletePhoto(+id, user, auditMeta);
  }
}
