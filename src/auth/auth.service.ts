import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersRepository } from '../users/repository/users.repository';
import { EmailService } from './services/email.service';
import { VerificationCodeStore } from './services/verification-code.store';
import { LoginDto } from './dto/login.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import * as bcrypt from 'bcrypt';
import { Session, SessionData } from 'express-session';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailService: EmailService,
    private readonly verificationCodeStore: VerificationCodeStore,
  ) {}

  async initiateLogin(loginDto: LoginDto): Promise<{ message: string }> {
    // Find user by username
    const userResult = await this.usersRepository.findByUsername(
      loginDto.username,
    );

    if (!userResult.Success || !userResult.ReturnedObject) {
      // Don't reveal if user exists or not for security
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = userResult.ReturnedObject;

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate verification code
    const code = this.verificationCodeStore.generateCode();

    // Store code with user info
    await this.verificationCodeStore.storeCode(user.email, user.id, code);

    // Send email with code
    try {
      await this.emailService.sendVerificationCode(user.email, code);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email. Please try again.');
    }

    return {
      message: 'Verification code sent to your email',
    };
  }

  async verifyCode(
    verifyCodeDto: VerifyCodeDto,
    session: Session & SessionData,
  ): Promise<{
    message: string;
    user: { id: string; username: string; email: string; type: string };
  }> {
    // Verify the code
    const verification = await this.verificationCodeStore.verifyCode(
      verifyCodeDto.email,
      verifyCodeDto.code,
    );

    if (!verification.valid || !verification.userId) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // Get user to verify email matches
    const userResult = await this.usersRepository.findOne(verification.userId);

    if (!userResult.Success || !userResult.ReturnedObject) {
      throw new UnauthorizedException('User not found');
    }

    const user = userResult.ReturnedObject;

    // Verify email matches
    if (user.email !== verifyCodeDto.email) {
      throw new UnauthorizedException('Email does not match');
    }

    // Create session
    session.userId = user.id;
    session.username = user.username;
    session.email = user.email;
    session.type = user.type;

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        type: user.type,
      },
    };
  }

  async logout(session: Session & SessionData): Promise<{ message: string }> {
    return new Promise((resolve) => {
      session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        resolve({ message: 'Logged out successfully' });
      });
    });
  }

  getCurrentUser(session: Session & SessionData): {
    id: string;
    username: string;
    email: string;
    type: string;
  } | null {
    if (
      !session.userId ||
      !session.username ||
      !session.email ||
      !session.type
    ) {
      return null;
    }

    return {
      id: session.userId,
      username: session.username,
      email: session.email,
      type: session.type,
    };
  }
}
