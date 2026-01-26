import { IsString, IsEmail, IsEnum, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../entities/employee';

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'The full name of the employee',
    example: 'Jane Smith',
    minLength: 1,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'The email address of the employee',
    example: 'jane.smith@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The department of the employee',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  departmentId: number;

  @ApiProperty({
    description: 'The role of the employee',
    enum: Role,
    example: Role.ENGINEER,
  })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({
    description: 'The URL of the employee profile photo',
    example:
      'https://namespace.compat.objectstorage.region.oraclecloud.com/bucket/employees/photo.jpg',
    nullable: true,
  })
  photoUrl?: string | null;
}
