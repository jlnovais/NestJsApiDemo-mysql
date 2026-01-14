import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

interface VerificationCodeData {
  code: string;
  email: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class VerificationCodeStore {
  private codes: Map<string, VerificationCodeData> = new Map();
  private readonly CODE_EXPIRY_MINUTES: number;
  private readonly REDIS_PREFIX = 'code:'; // Prefix for verification codes in Redis

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.CODE_EXPIRY_MINUTES = this.configService.get<number>(
      'CODE_EXPIRY_MINUTES',
      10,
    );
  }

  generateCode(): string {
    // Generate a 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async storeCode(email: string, userId: string, code: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES);

    const data: VerificationCodeData = {
      code,
      email,
      userId,
      expiresAt,
    };

    // Try Redis first, fallback to memory
    if (this.redisService.isAvailable()) {
      const redisKey = `${this.REDIS_PREFIX}${email}`;
      const ttlSeconds = this.CODE_EXPIRY_MINUTES * 60;
      const value = JSON.stringify(data);

      const success = await this.redisService.set(redisKey, value, ttlSeconds);
      if (success) {
        return; // Successfully stored in Redis
      }
      // If Redis fails, fall through to memory storage
    }

    // Fallback to memory storage
    this.codes.set(email, data);
    // Clean up expired codes periodically
    this.cleanupExpiredCodes();
  }

  async verifyCode(
    email: string,
    code: string,
  ): Promise<{ valid: boolean; userId?: string }> {
    let stored: VerificationCodeData | null = null;

    // Try Redis first, fallback to memory
    if (this.redisService.isAvailable()) {
      const redisKey = `${this.REDIS_PREFIX}${email}`;
      const value = await this.redisService.get(redisKey);

      if (value) {
        try {
          stored = JSON.parse(value) as VerificationCodeData;
        } catch {
          // Invalid JSON, treat as not found
          await this.redisService.del(redisKey);
          return { valid: false };
        }
      }
    } else {
      // Fallback to memory storage
      stored = this.codes.get(email) || null;
    }

    if (!stored) {
      return { valid: false };
    }

    // Check if code has expired
    if (new Date() > new Date(stored.expiresAt)) {
      // Remove from storage
      if (this.redisService.isAvailable()) {
        await this.redisService.del(`${this.REDIS_PREFIX}${email}`);
      } else {
        this.codes.delete(email);
      }
      return { valid: false };
    }

    // Check if code matches
    if (stored.code !== code) {
      return { valid: false };
    }

    // Code is valid, remove it and return userId
    const userId = stored.userId;

    // Remove from storage
    if (this.redisService.isAvailable()) {
      await this.redisService.del(`${this.REDIS_PREFIX}${email}`);
    } else {
      this.codes.delete(email);
    }

    return { valid: true, userId };
  }

  private cleanupExpiredCodes(): void {
    // Only cleanup memory store (Redis handles expiration automatically)
    if (!this.redisService.isAvailable()) {
      const now = new Date();
      for (const [email, data] of this.codes.entries()) {
        if (now > data.expiresAt) {
          this.codes.delete(email);
        }
      }
    }
  }
}
