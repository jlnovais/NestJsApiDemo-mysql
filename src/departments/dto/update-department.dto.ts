import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDepartmentDto {
  @ApiProperty({
    description: 'The name of the department',
    example: 'Sales',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
