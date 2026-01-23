import { Injectable } from '@nestjs/common';
import { MysqlDatabaseService } from 'src/database/mysql-database.service';
import { Employee, EmployeeWithTotalCount, Role } from '../entities/employee';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import {
  ResultWithData,
  ResultNoData,
  PaginationResult,
} from 'src/common/result';
import { handleDatabaseError } from 'src/common/error-handlers';
import { AuditRepository } from 'src/audit/audit.repository';
import { AuditContext } from 'src/audit/entities/AuditContext';

@Injectable()
export class EmployeesRepository {
  constructor(
    private readonly databaseService: MysqlDatabaseService,
    private readonly auditRepository: AuditRepository,
  ) {}

  async findOneMaster(id: number): Promise<ResultWithData<Employee | null>> {
    const result = new ResultWithData<Employee | null>();
    try {
      const sql = 'SELECT * FROM Employee WHERE id = ?';
      const employee = await this.databaseService.queryOneMaster<Employee>(
        sql,
        [id],
      );

      if (employee) {
        result.Success = true;
        result.Message = 'Employee retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = employee;
        return result;
      } else {
        result.Success = false;
        result.Message = `Employee with id ${id} not found`;
        result.ErrorCode = 404;
        result.ReturnedObject = null;
        return result;
      }
    } catch (error) {
      console.log('EmployeesRepository.findOneMaster. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve employee',
      );
      return new ResultWithData<Employee | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async findAll(
    role?: Role,
    page?: number,
    pageSize?: number,
    searchName?: string,
    searchEmail?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaginationResult<Employee[]>> {
    const result = new PaginationResult<Employee[]>();
    try {
      // Set default values for pagination
      const currentPage = page && page > 0 ? page : 1;
      const currentPageSize = pageSize && pageSize > 0 ? pageSize : 10;

      // Call stored procedure
      const sql = 'CALL Employees_List(?, ?, ?, ?, ?, ?, ?)';
      const rows = await this.databaseService.query<EmployeeWithTotalCount>(
        sql,
        [
          currentPage,
          currentPageSize,
          role || null,
          searchName || null,
          searchEmail || null,
          sortBy || null,
          sortOrder || null,
        ],
      );

      // The stored procedure returns rows with Employee data and TotalCount
      // Extract employees and total count from the first row
      let employees: Employee[] = [];
      let totalCount = 0;

      if (rows && rows.length > 0) {
        // The stored procedure returns an array of arrays (MySQL2 behavior with CALL)
        // The first element contains the actual result rows
        const resultRows = Array.isArray(rows[0])
          ? (rows[0] as EmployeeWithTotalCount[])
          : rows;

        if (resultRows.length > 0) {
          // Extract TotalCount from the first row
          totalCount = resultRows[0].TotalCount || 0;

          // Extract employee data (exclude TotalCount from each row)
          employees = resultRows.map((row) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { TotalCount, ...employee } = row;
            return employee as Employee;
          });
        }
      }

      const totalPages = Math.ceil(totalCount / currentPageSize);

      result.Success = true;
      result.Message = 'Employees retrieved successfully';
      result.ErrorCode = 0;
      result.Page = currentPage;
      result.PageSize = currentPageSize;
      result.Total = totalCount;
      result.TotalPages = totalPages;
      result.ReturnedObject = employees;
      return result;
    } catch (error) {
      console.log('EmployeesRepository.findAll. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve employees',
      );
      return new PaginationResult<Employee[]>(
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

  async create(
    createEmployeeDto: CreateEmployeeDto,
    audit?: AuditContext,
  ): Promise<ResultWithData<Employee>> {
    const result = new ResultWithData<Employee>();

    try {
      const sql = `
        INSERT INTO Employee (name, email, role, photoUrl, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `;

      // execute() automatically handles sticky session - it marks a write and stores the connection
      // Subsequent query() calls in the same request will use the same connection (master)
      const resultDb = (await this.databaseService.execute(sql, [
        createEmployeeDto.name,
        createEmployeeDto.email,
        createEmployeeDto.role,
        createEmployeeDto.photoUrl || null,
      ])) as [{ insertId: number }, unknown];

      // resultDb from execute() is [ResultSetHeader, FieldPacket[]]
      // ResultSetHeader has insertId property
      const resultHeader = resultDb[0] as { insertId: number };
      const insertId = resultHeader.insertId;

      if (!insertId) {
        result.Success = false;
        result.Message = 'Employee created but insertId is missing';
        result.ErrorCode = 500;
        result.ReturnedObject = null as unknown as Employee;
        return result;
      }

      // Fetch the employee using the stored connection (sticky session)
      // Both INSERT and SELECT use execute() (prepared statements) on the same connection
      // This ensures read-after-write consistency
      const employee = await this.databaseService.queryOne<Employee>(
        'SELECT * FROM Employee WHERE id = ?',
        [insertId],
      );

      if (!employee) {
        result.Success = false;
        result.Message = 'Employee created but could not be retrieved';
        result.ErrorCode = 500;
        result.ReturnedObject = null as unknown as Employee;
        return result;
      }

      await this.auditRepository.insert({
        eventType: 'employee.created',
        entityType: 'Employee',
        entityId: String(employee.id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? { employee },
      });

      result.Success = true;
      result.Message = 'Employee created successfully';
      result.ErrorCode = 0;
      result.ReturnedObject = employee;

      return result;
    } catch (error) {
      console.log('EmployeesRepository.create. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to create employee',
      );
      return new ResultWithData<Employee>(
        errorResult.Success,
        errorResult.Message,
        null as unknown as Employee,
        errorResult.ErrorCode,
      );
    }
  }

  async findOne(id: number): Promise<ResultWithData<Employee | null>> {
    const result = new ResultWithData<Employee | null>();
    try {
      const sql = 'SELECT * FROM Employee WHERE id = ?';
      const employee = await this.databaseService.queryOne<Employee>(sql, [id]);

      if (employee) {
        result.Success = true;
        result.Message = 'Employee retrieved successfully';
        result.ErrorCode = 0;
        result.ReturnedObject = employee;
        return result;
      } else {
        result.Success = false;
        result.Message = `Employee with id ${id} not found`;
        result.ErrorCode = 404;
        result.ReturnedObject = null;
        return result;
      }
    } catch (error) {
      console.log('EmployeesRepository.findOne. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to retrieve employee',
      );
      return new ResultWithData<Employee | null>(
        errorResult.Success,
        errorResult.Message,
        null,
        errorResult.ErrorCode,
      );
    }
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
    audit?: AuditContext,
  ): Promise<ResultNoData> {
    const result = new ResultNoData();
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (updateEmployeeDto.name !== undefined) {
        updates.push('name = ?');
        values.push(updateEmployeeDto.name);
      }

      if (updateEmployeeDto.email !== undefined) {
        updates.push('email = ?');
        values.push(updateEmployeeDto.email);
      }

      if (updateEmployeeDto.role !== undefined) {
        updates.push('role = ?');
        values.push(updateEmployeeDto.role);
      }

      if (updateEmployeeDto.photoUrl !== undefined) {
        updates.push('photoUrl = ?');
        values.push(updateEmployeeDto.photoUrl);
      }

      if (updates.length === 0) {
        result.Success = false;
        result.Message = 'No fields to update';
        result.ErrorCode = 400;
        return result;
      }

      updates.push('updatedAt = NOW()');
      values.push(id);

      const sql = `UPDATE Employee SET ${updates.join(', ')} WHERE id = ?`;
      await this.databaseService.execute(sql, values);

      await this.auditRepository.insert({
        eventType: 'employee.updated',
        entityType: 'Employee',
        entityId: String(id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? { changes: updateEmployeeDto },
      });

      result.Success = true;
      result.Message = 'Employee updated successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('EmployeesRepository.update. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to update employee',
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
      const sql = 'DELETE FROM Employee WHERE id = ?';
      await this.databaseService.execute(sql, [id]);

      await this.auditRepository.insert({
        eventType: 'employee.deleted',
        entityType: 'Employee',
        entityId: String(id),
        actorUserId: audit?.actorUserId ?? null,
        actorType: audit?.actorType ?? null,
        ip: audit?.ip ?? null,
        userAgent: audit?.userAgent ?? null,
        data: audit?.data ?? null,
      });
      result.Success = true;
      result.Message = 'Employee deleted successfully';
      result.ErrorCode = 0;
      return result;
    } catch (error) {
      console.log('EmployeesRepository.delete. error', error);

      const errorResult = handleDatabaseError(
        error,
        'Failed to delete employee',
      );
      return new ResultNoData(
        errorResult.Success,
        errorResult.Message,
        errorResult.ErrorCode,
      );
    }
  }
}
