import { ApiProperty } from '@nestjs/swagger';
import { UserType } from '../entities/user';

export class UserResponseDto {
  @ApiProperty({
    description: 'The unique identifier of the user (GUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'The full name of the user',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'The username of the user',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  email: string;

  @ApiProperty({
    description: 'The type of the user',
    enum: UserType,
    example: UserType.USER,
  })
  type: UserType;

  @ApiProperty({
    description: 'The date and time when the user was created',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'The date and time when the user was last updated',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  updatedAt: Date;
}
