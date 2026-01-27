import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AuditMetaParam } from 'src/audit/decorators/audit-meta.decorator';
import type { AuditMetadata } from 'src/audit/entities/auditMetadata';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SessionGuard } from 'src/auth/guards/session.guard';
import { SessionUser } from 'src/types/session-user.interface';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentResponseDto } from './dto/department-response.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('departments')
@SkipThrottle()
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new department',
    description: 'Create a new department record in the database',
  })
  @ApiBody({
    type: CreateDepartmentDto,
    description: 'Department data to create',
  })
  @ApiResponse({
    status: 201,
    description: 'Department created successfully',
    type: DepartmentResponseDto,
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
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  create(
    @Body(ValidationPipe) createDepartmentDto: CreateDepartmentDto,
    @CurrentUser() user: SessionUser | null,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.departmentsService.create(createDepartmentDto, user, auditMeta);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all departments',
    description:
      'Retrieve a paginated list of departments. Supports searching by name and sorting.',
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
    description: 'Search departments by name (partial match)',
    example: 'Sales',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Column to sort by (default: id)',
    example: 'name',
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
  @ApiResponse({
    status: 200,
    description:
      'List of departments for the current page. Pagination metadata is returned via response headers.',
    type: [DepartmentResponseDto],
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
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  async findAll(
    @CurrentUser() user: SessionUser | null,
    @AuditMetaParam() auditMeta: AuditMetadata,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('searchName') searchName?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.departmentsService.findAll(
      page,
      pageSize,
      searchName,
      sortBy,
      sortOrder,
    );

    const hasNextPage = result.Page < result.TotalPages;
    const hasPreviousPage = result.Page > 1;

    res.setHeader('X-Total-Count', result.Total.toString());
    res.setHeader('X-Page', result.Page.toString());
    res.setHeader('X-Page-Size', result.PageSize.toString());
    res.setHeader('X-Total-Pages', result.TotalPages.toString());
    res.setHeader('X-Has-Next-Page', hasNextPage.toString());
    res.setHeader('X-Has-Previous-Page', hasPreviousPage.toString());

    return result.ReturnedObject;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get department by ID',
    description:
      'Retrieve a specific department by its unique identifier from the database',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Department ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Department retrieved successfully',
    type: DepartmentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Department not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
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
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.departmentsService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update department',
    description:
      'Update an existing department record. Only provided fields will be updated.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Department ID',
    example: '1',
  })
  @ApiBody({
    type: UpdateDepartmentDto,
    description: 'Department data to update (partial)',
  })
  @ApiResponse({
    status: 200,
    description: 'Department updated successfully',
    type: DepartmentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Department not found',
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
    @Body(ValidationPipe) updateDepartmentDto: UpdateDepartmentDto,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!updateDepartmentDto) {
      throw new BadRequestException('Body is required');
    }

    return this.departmentsService.update(
      +id,
      updateDepartmentDto,
      user,
      auditMeta,
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete department',
    description:
      'Delete a department record from the database by its unique identifier',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Department ID',
    example: '1',
  })
  @ApiResponse({
    status: 200,
    description: 'Department deleted successfully',
    type: DepartmentResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Department not found',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable (e.g., database connection error)',
    type: ErrorResponseDto,
  })
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  remove(
    @CurrentUser() user: SessionUser | null,
    @Param('id') id: string,
    @AuditMetaParam() auditMeta: AuditMetadata,
  ) {
    if (!user) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.departmentsService.remove(+id, user, auditMeta);
  }
}
