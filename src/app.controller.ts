import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { MysqlDatabaseService } from './database/mysql-database.service';
import { HealthResponseDto } from './app/dto/health-response.dto';
import { ErrorResponseDto } from './common/dto/error-response.dto';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: MysqlDatabaseService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Returns a simple greeting message to verify the API is running',
  })
  @ApiResponse({
    status: 200,
    description: 'API is running successfully',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Health check with database status',
    description:
      'Returns application and database health status. This endpoint verifies that both the API server and MySQL database are accessible. Returns HTTP 200 if healthy, HTTP 503 if the database is unavailable.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application and database are healthy and operational',
    type: HealthResponseDto,
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2024-01-15T10:30:00.000Z',
        database: 'connected',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description:
      'Service unavailable - The database connection failed or is unreachable. The application server is running but cannot connect to the database.',
    schema: {
      example: {
        statusCode: 503,
        timestamp: '2024-01-15T10:30:00.000Z',
        path: '/api/health',
        response: {
          status: 'unhealthy',
          timestamp: '2024-01-15T10:30:00.000Z',
          database: 'disconnected',
        },
      },
    },
    type: ErrorResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    const dbHealthy = await this.databaseService.healthCheck();

    const healthStatus: HealthResponseDto = {
      status: dbHealthy ? ('healthy' as const) : ('unhealthy' as const),
      timestamp: new Date().toISOString(),
      database: dbHealthy ? ('connected' as const) : ('disconnected' as const),
    };

    if (!dbHealthy) {
      throw new HttpException(healthStatus, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return healthStatus;
  }
}
