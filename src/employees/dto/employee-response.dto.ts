import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '../entities/employee';

export class EmployeeResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the employee',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The full name of the employee',
    example: 'Jane Smith',
  })
  name: string;

  @ApiProperty({
    description: 'The email address of the employee',
    example: 'jane.smith@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'The role of the employee',
    enum: Role,
    example: Role.ENGINEER,
  })
  role: Role;

  @ApiPropertyOptional({
    description: 'The URL of the employee profile photo',
    example:
      'https://namespace.compat.objectstorage.region.oraclecloud.com/bucket/employees/photo.jpg',
    nullable: true,
  })
  photoUrl?: string | null;

  @ApiProperty({
    description: 'The date and time when the employee was created',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The date and time when the employee was last updated',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
