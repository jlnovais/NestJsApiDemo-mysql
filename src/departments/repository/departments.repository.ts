import { Injectable } from '@nestjs/common';
import { MysqlDatabaseService } from 'src/database/mysql-database.service';
import { handleDatabaseError } from 'src/common/error-handlers';
import {
  PaginationResult,
  ResultNoData,
  ResultWithData,
} from 'src/common/result';
import { Department, DepartmentWithTotalCount } from '../entities/department';
import { AuditContext } from 'src/audit/entities/AuditContext';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { AuditRepository } from 'src/audit/audit.repository';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@Injectable()
export class DepartmentsRepository {
  constructor(
    private readonly databaseService: MysqlDatabaseService,
    private readonly auditRepository: AuditRepository,
  ) {}

  async findOneMaster(id: number): Promise<ResultWithData<Department | null>> {
    const result = new ResultWithData<Department | null>();
    try {
      const sql = 'SELECT * FROM Department WHERE id = ?';
      const department = await this.databaseService.queryOneMaster<Department>(
        sql,
        [id],
      );

      if (department) {
        result.Success = true;
        result.Message = 'Department retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = department;
        return result;
      }

      result.Success = false;
      result.Message = `Department with id ${id} not found`;
      result.ErrorCode = 404;
      result.ReturnedObject = null;
      return result;
    } catch (error) {
      console.log('DepartmentsRepository.findOneMaster. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve Department',
      );
      return new ResultWithData<Department | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async findAll(
    page?: number,
    pageSize?: number,
    searchName?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaginationResult<Department[]>> {
    const result = new PaginationResult<Department[]>();
    try {
      const currentPage = page && page > 0 ? page : 1;
      const currentPageSize = pageSize && pageSize > 0 ? pageSize : 10;

      const sql = 'CALL Departments_List(?, ?, ?, ?, ?)';
      const rows = await this.databaseService.query<DepartmentWithTotalCount>(
        sql,
        [
          currentPage,
          currentPageSize,
          searchName || null,
          sortBy || null,
          sortOrder || null,
        ],
      );

      let departments: Department[] = [];
      let totalCount = 0;

      if (rows && rows.length > 0) {
        const resultRows = Array.isArray(rows[0])
          ? (rows[0] as DepartmentWithTotalCount[])
          : rows;

        if (resultRows.length > 0) {
          totalCount = resultRows[0].TotalCount || 0;

          departments = resultRows.map((row) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { TotalCount, ...department } = row;
            return department as Department;
          });
        }
      }

      const totalPages = Math.ceil(totalCount / currentPageSize);

      result.Success = true;
      result.Message = 'Departments retrieved successfully';
      result.ErrorCode = 0;
      result.Page = currentPage;
      result.PageSize = currentPageSize;
      result.Total = totalCount;
      result.TotalPages = totalPages;
      result.ReturnedObject = departments;
      return result;
    } catch (error) {
      console.log('DepartmentsRepository.findAll. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve departments',
      );
      return new PaginationResult<Department[]>(
        errorResult.Success,
        errorResult.Message,
        page && page > 0 ? page : 1,
        pageSize && pageSize > 0 ? pageSize : 10,
        0,
        0,
        [],
        errorResult.ErrorCode,
      );
    }
  }

  async findOne(id: number): Promise<ResultWithData<Department | null>> {
    const result = new ResultWithData<Department | null>();
    try {
      const sql = 'SELECT * FROM Department WHERE id = ?';
      const department = await this.databaseService.queryOne<Department>(sql, [
        id,
      ]);

      if (department) {
        result.Success = true;
        result.Message = 'Department retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = department;
        return result;
      } else {
        result.Success = false;
        result.Message = `Department with id ${id} not found`;
        result.ErrorCode = 404;
        result.ReturnedObject = null;
        return result;
      }
    } catch (error) {
      console.log('DepartmentsRepository.findOne. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve department',
      );
      return new ResultWithData<Department | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async create(
    createEmployeeDto: CreateDepartmentDto,
    audit?: AuditContext,
  ): Promise<ResultWithData<Department>> {
    const result = new ResultWithData<Department>();

    try {
      const sql = `
        INSERT INTO Department (name, createdAt, updatedAt)
        VALUES (?, NOW(), NOW())
      `;

      // execute() automatically handles sticky session - it marks a write and stores the connection
      // Subsequent query() calls in the same request will use the same connection (master)
      const resultDb = (await this.databaseService.execute(sql, [
        createEmployeeDto.name,
      ])) as [{ insertId: number }, unknown];

      // resultDb from execute() is [ResultSetHeader, FieldPacket[]]
      // ResultSetHeader has insertId property
      const resultHeader = resultDb[0] as { insertId: number };
      const insertId = resultHeader.insertId;

      if (!insertId) {
        result.Success = false;
        result.Message = 'Department created but insertId is missing';
        result.ErrorCode = 500;
        result.ReturnedObject = null as unknown as Department;
        return result;
      }

      // Fetch the employee using the stored connection (sticky session)
      // Both INSERT and SELECT use execute() (prepared statements) on the same connection
      // This ensures read-after-write consistency
      const department = await this.databaseService.queryOne<Department>(
        'SELECT * FROM Department WHERE id = ?',
        [insertId],
      );

      if (!department) {
        result.Success = false;
        result.Message = 'Department created but could not be retrieved';
        result.ErrorCode = 500;
        result.ReturnedObject = null as unknown as Department;
        return result;
      }

      await this.auditRepository.insert({
        eventType: 'department.created',
        entityType: 'Department',
        entityId: String(department.id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? { department },
      });

      result.Success = true;
      result.Message = 'Department created successfully';
      result.ErrorCode = 0;
      result.ReturnedObject = department;

      return result;
    } catch (error) {
      console.log('DepartmentsRepository.create. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to create department',
      );
      return new ResultWithData<Department>(
        errorResult.Success,
        errorResult.Message,
        null as unknown as Department,
        errorResult.ErrorCode,
      );
    }
  }

  async update(
    id: number,
    updateDepartmentDto: UpdateDepartmentDto,
    audit?: AuditContext,
  ): Promise<ResultNoData> {
    const result = new ResultNoData();
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (updateDepartmentDto.name !== undefined) {
        updates.push('name = ?');
        values.push(updateDepartmentDto.name);
      }

      if (updates.length === 0) {
        result.Success = false;
        result.Message = 'No fields to update';
        result.ErrorCode = 400;
        return result;
      }

      updates.push('updatedAt = NOW()');
      values.push(id);

      const sql = `UPDATE Department SET ${updates.join(', ')} WHERE id = ?`;
      await this.databaseService.execute(sql, values);

      await this.auditRepository.insert({
        eventType: 'department.updated',
        entityType: 'Department',
        entityId: String(id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? { changes: updateDepartmentDto },
      });

      result.Success = true;
      result.Message = 'Department updated successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('DepartmentsRepository.update. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to update department',
      );
      return new ResultNoData(
        errorResult.Success,
        errorResult.Message,
        errorResult.ErrorCode,
      );
    }
  }

  async delete(id: number, audit?: AuditContext): Promise<ResultNoData> {
    const result = new ResultNoData();
    try {
      const sql = 'DELETE FROM Department WHERE id = ?';
      await this.databaseService.execute(sql, [id]);

      await this.auditRepository.insert({
        eventType: 'department.deleted',
        entityType: 'Department',
        entityId: String(id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? null,
      });
      result.Success = true;
      result.Message = 'Department deleted successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('DepartmentsRepository.delete. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to delete department',
      );
      return new ResultNoData(
        errorResult.Success,
        errorResult.Message,
        errorResult.ErrorCode,
      );
    }
  }
}
