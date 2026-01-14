import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './services/email.service';
import { VerificationCodeStore } from './services/verification-code.store';
import { SessionGuard } from './guards/session.guard';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [UsersModule, DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, EmailService, VerificationCodeStore, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
