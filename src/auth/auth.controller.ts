import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  UseGuards,
  Get,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { SessionGuard } from './guards/session.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { SessionUser } from '../types/session-user.interface';
import { ErrorResponseDto } from 'src/common/dto/error-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Initiate login',
    description:
      'Submit username and password to receive a verification code via email',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent to email',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Verification code sent to your email',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
    type: ErrorResponseDto,
  })
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    return this.authService.initiateLogin(loginDto);
  }

  @Post('verify')
  @ApiOperation({
    summary: 'Verify code and complete login',
    description:
      'Submit email and verification code to complete login and receive session cookie',
  })
  @ApiBody({ type: VerifyCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, session cookie set',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Login successful' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            type: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
    type: ErrorResponseDto,
  })
  async verify(
    @Body(ValidationPipe) verifyCodeDto: VerifyCodeDto,
    @Req() request: Request,
  ) {
    return this.authService.verifyCode(verifyCodeDto, request.session);
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  @ApiOperation({
    summary: 'Logout',
    description: 'Destroy the current session',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Logged out successfully' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  async logout(@Req() request: Request) {
    return this.authService.logout(request.session);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth('session-id')
  @ApiOperation({
    summary: 'Get current user',
    description: 'Get information about the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        email: { type: 'string' },
        type: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Not authenticated',
    type: ErrorResponseDto,
  })
  getCurrentUser(@CurrentUser() user: SessionUser | null) {
    return user;
  }
}
