import { ApiProperty } from '@nestjs/swagger';

export class DepartmentResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the department',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'The name of the department',
    example: 'Sales',
  })
  name: string;

  @ApiProperty({
    description: 'The date and time when the department was created',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The date and time when the department was last updated',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
