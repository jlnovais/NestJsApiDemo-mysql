import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private isEnabled: boolean = false;
  private isConnected: boolean = false;
  private readyPromise: Promise<void> | null = null;
  private readyResolve: (() => void) | null = null;

  private readyReject: ((err: Error) => void) | null = null;

  constructor(private readonly configService: ConfigService) {
    // Create readyPromise in constructor if Redis is enabled
    // This ensures it exists before onModuleInit() is called
    const redisEnabled =
      this.configService.get<string>('REDIS_ENABLED', 'false').toLowerCase() ===
      'true';

    if (redisEnabled) {
      this.readyPromise = new Promise<void>((resolve, reject) => {
        this.readyResolve = resolve;
        this.readyReject = reject;
      });
    }
  }

  /**
   * Manually initialize Redis connection
   * Can be called before onModuleInit() to ensure Redis is ready early
   */
  async initialize(): Promise<void> {
    const redisEnabled =
      this.configService.get<string>('REDIS_ENABLED', 'false').toLowerCase() ===
      'true';

    if (!redisEnabled) {
      this.logger.log('Redis is disabled. Using in-memory storage.');
      return;
    }

    // If already initialized, return
    if (this.client && this.isConnected) {
      return;
    }

    // If already initializing, wait for it
    if (this.client && !this.isConnected && this.readyPromise) {
      await this.readyPromise;
      return;
    }

    await this.connectToRedis();
  }

  private async connectToRedis(): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD', '');
      const db = this.configService.get<number>('REDIS_DB', 0);

      this.client = createClient({
        socket: {
          host,
          port,
        },
        password: password || undefined,
        database: db,
      });

      // Handle connection events
      this.client.on('connect', () => {
        this.logger.log('Connecting to Redis...');
      });

      this.client.once('ready', () => {
        this.isConnected = true;
        this.isEnabled = true;
        this.logger.log(`Redis connected successfully to ${host}:${port}`);
        if (this.readyResolve) {
          this.readyResolve();
        }
      });

      this.client.on('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Redis connection error: ${message}`);
        this.isConnected = false;
        this.isEnabled = false;
        if (this.readyReject) {
          this.readyReject(new Error(message));
        }
      });

      this.client.on('end', () => {
        this.logger.warn('Redis connection ended');
        this.isConnected = false;
      });

      // Attempt to connect and wait for ready event
      await this.client.connect();

      // Wait for the 'ready' event to ensure Redis is fully ready
      const timeout = setTimeout(() => {
        if (this.readyReject) {
          this.readyReject(
            new Error('Redis ready event timeout after 10 seconds'),
          );
        }
      }, 10000);

      try {
        await this.readyPromise;
        clearTimeout(timeout);
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize Redis: ${message}`);
      this.logger.warn('Falling back to in-memory storage');
      this.isEnabled = false;
      this.isConnected = false;
      if (this.client) {
        await this.client.quit().catch(() => {});
        this.client = null;
      }
    }
  }

  async onModuleInit() {
    // If not already initialized, initialize now
    if (!this.isConnected) {
      await this.initialize();
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.client = null;
    }
  }

  /**
   * Check if Redis is enabled and connected
   */
  isAvailable(): boolean {
    return this.isEnabled && this.isConnected && this.client !== null;
  }

  /**
   * Wait for Redis to be ready
   * Returns a promise that resolves when Redis is ready, or rejects if Redis is disabled or fails
   */
  async waitForReady(timeoutMs: number = 15000): Promise<void> {
    if (this.isAvailable()) {
      return; // Already ready
    }

    if (!this.readyPromise) {
      // Redis is not enabled (promise wasn't created in constructor)
      const redisEnabled =
        this.configService
          .get<string>('REDIS_ENABLED', 'false')
          .toLowerCase() === 'true';
      if (!redisEnabled) {
        throw new Error('Redis is not enabled');
      }
      throw new Error('Redis ready promise not initialized');
    }

    // Wait for ready with timeout
    return Promise.race([
      this.readyPromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Redis ready timeout')), timeoutMs),
      ),
    ]);
  }

  /**
   * Get Redis client (returns null if not available)
   */
  getClient(): RedisClientType | null {
    return this.isAvailable() ? this.client : null;
  }

  /**
   * Set a key-value pair with optional expiration (in seconds)
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis SET error for key ${key}: ${message}`);
      return false;
    }
  }

  /**
   * Get a value by key
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      return await this.client!.get(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis GET error for key ${key}: ${message}`);
      return null;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.del(key);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis DEL error for key ${key}: ${message}`);
      return false;
    }
  }

  /**
   * Set expiration on a key (in seconds)
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client!.expire(key, seconds);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis EXPIRE error for key ${key}: ${message}`);
      return false;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis EXISTS error for key ${key}: ${message}`);
      return false;
    }
  }
}
