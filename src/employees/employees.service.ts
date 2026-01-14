import { Injectable } from '@nestjs/common';
import { EmployeesRepository } from './repository/employees.repository';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee, Role } from './entities/employee';
import { handleRepositoryError } from 'src/common/error-handlers';
import { EmployeeResponseDto } from './dto/employee-response.dto';
import { PaginationResult } from 'src/common/result';
import { StorageService } from 'src/storage/storage.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly storageService: StorageService,
  ) {}

  async create(
    createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    console.log('Creating Emproyee. createEmployeeDto', createEmployeeDto);

    const result = await this.employeesRepository.create(createEmployeeDto);

    if (!result.Success) {
      handleRepositoryError(result);
    }
    // Return the employee directly from the create operation to avoid read-after-write consistency issues
    // The repository now returns the full employee object, ensuring we read from the master
    return result.ReturnedObject as EmployeeResponseDto;
  }

  async findOne(id: number): Promise<EmployeeResponseDto> {
    const result = await this.employeesRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    return result.ReturnedObject as EmployeeResponseDto;
  }

  async findAll(
    role?: Role,
    page?: number,
    pageSize?: number,
    searchName?: string,
    searchEmail?: string,
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Promise<PaginationResult<EmployeeResponseDto[]>> {
    const result = await this.employeesRepository.findAll(
      role,
      page,
      pageSize,
      searchName,
      searchEmail,
      sortBy,
      sortOrder,
    );

    if (!result.Success) {
      handleRepositoryError(result);
    }

    // Convert Employee[] to EmployeeResponseDto[] and return PaginationResult
    const employees = result.ReturnedObject as Employee[];
    const employeeDtos = employees || [];

    return new PaginationResult<EmployeeResponseDto[]>(
      result.Success,
      result.Message,
      result.Page,
      result.PageSize,
      result.Total,
      result.TotalPages,
      employeeDtos as EmployeeResponseDto[],
      result.ErrorCode,
    );
  }

  async update(
    id: number,
    updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const resultUpdate = await this.employeesRepository.update(
      id,
      updateEmployeeDto,
    );

    if (!resultUpdate.Success) {
      handleRepositoryError(resultUpdate);
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<EmployeeResponseDto> {
    const result = await this.employeesRepository.findOne(id);

    if (!result.Success) {
      handleRepositoryError(result);
    }

    const employeeDto = result.ReturnedObject as EmployeeResponseDto;
    const resultDelete = await this.employeesRepository.delete(id);

    if (!resultDelete.Success) {
      handleRepositoryError(resultDelete);
    }

    return employeeDto;
  }

  async uploadPhoto(
    id: number,
    file: Express.Multer.File,
  ): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOne(id);

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
    const updateResult = await this.employeesRepository.update(id, updateDto);

    if (!updateResult.Success) {
      handleRepositoryError(updateResult);
    }

    return this.findOne(id);
  }

  async deletePhoto(id: number): Promise<EmployeeResponseDto> {
    // Check if employee exists
    const result = await this.employeesRepository.findOne(id);

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

    const updateResult = await this.employeesRepository.update(id, updateDto);

    if (!updateResult.Success) {
      handleRepositoryError(updateResult);
    }

    return this.findOne(id);
  }
}
