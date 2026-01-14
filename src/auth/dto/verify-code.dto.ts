import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiProperty({
    description: 'The email address of the user',
    example: 'john.doe@example.com',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'The verification code sent to the email',
    example: '123456',
    minLength: 4,
    maxLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 8)
  code: string;
}
