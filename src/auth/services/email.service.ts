import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // Configure email transporter
    // For development, you can use a service like Ethereal Email or configure SMTP
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'localhost');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);

    // Only include auth if credentials are provided
    const transportConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
    } = {
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
    };

    // Only add auth if both user and pass are provided
    if (smtpUser && smtpPass) {
      transportConfig.auth = {
        user: smtpUser,
        pass: smtpPass,
      };
    }

    this.transporter = nodemailer.createTransport(transportConfig);
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    // In development mode without SMTP configured, just log the code
    if (
      process.env.NODE_ENV === 'development' &&
      !this.configService.get<string>('SMTP_HOST')
    ) {
      console.log(`[DEV MODE] Verification code for ${email}: ${code}`);
      console.log(
        `[DEV MODE] To enable email sending, configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables`,
      );
      return;
    }

    const mailOptions = {
      from: this.configService.get<string>('SMTP_FROM', 'noreply@example.com'),

      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verification Code</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification code sent to ${email}`);
    } catch (error) {
      console.error('Error sending email:', error);
      // In development, log the code as fallback
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV FALLBACK] Verification code for ${email}: ${code}`);
        return;
      }
      throw new Error('Failed to send verification email');
    }
  }
}
