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
  StreamableFile,
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
  ApiCookieAuth,
  ApiHeader,
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
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { AcceptsFormat } from 'src/auth/decorators/accept-format.decorator';

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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., duplicate entry)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @Throttle({ short: { ttl: 1000, limit: 1 } })

  // authenticated user
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
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
    name: 'departmentId',
    required: false,
    type: Number,
    description: 'Filter employees by department ID',
    example: 1,
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
  @ApiHeader({
    name: 'X-Total-Count',
    description: 'Total number of matching records',
  })
  @ApiHeader({
    name: 'X-Page',
    description: 'Current page number',
  })
  @ApiHeader({
    name: 'X-Page-Size',
    description: 'Number of items per page',
  })
  @ApiHeader({
    name: 'X-Total-Pages',
    description: 'Total pages available for the current query',
  })
  @ApiHeader({
    name: 'X-Has-Next-Page',
    description: 'Whether there is a next page (true/false)',
  })
  @ApiHeader({
    name: 'X-Has-Previous-Page',
    description: 'Whether there is a previous page (true/false)',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json', 'csv'],
    description:
      'Response format. "json" returns the normal JSON payload; "csv" returns a CSV file download. Default: json.',
    example: 'json',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of employees for the current page. Pagination metadata is returned via response headers.',
    type: [EmployeeResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  @AllowedUserTypes('user')
  async findAll(
    @CurrentUser() user: SessionUser | null,
    @AcceptsFormat() format: 'json' | 'csv' | 'pdf',
    @AuditMetaParam() auditMeta: AuditMetadata,
    @Res({ passthrough: true }) res: Response,
    @Query('role') role?: Role,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('searchName') searchName?: string,
    @Query('searchEmail') searchEmail?: string,
    @Query('departmentId') departmentId?: number,
    @Query('sortBy') sortBy?: 'createdAt' | 'name',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    console.log('EmployeesController.findAll. user', user);
    console.log('EmployeesController.findAll. role', role);
    console.log('EmployeesController.findAll. ip', auditMeta.ip);

    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    this.logger.log(
      `Request for all Employees\t from ip: ${auditMeta.ip} | accept format: ${format}`,
    );

    const result = await this.employeesService.findAll(
      role,
      page,
      pageSize,
      searchName,
      searchEmail,
      departmentId,
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

    if (format === 'csv') {
      const employees = result.ReturnedObject ?? [];
      const csv = this.employeesService.employeesToCsv(employees);

      // Prefix with UTF-8 BOM to improve Excel compatibility
      const payload = Buffer.from(`\uFEFF${csv}`, 'utf8');
      return new StreamableFile(payload, {
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment; filename="employees.csv"',
      });
    }

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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict (e.g., duplicate entry)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., storage/database error)',
    type: ErrorResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
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
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., storage/database error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
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
