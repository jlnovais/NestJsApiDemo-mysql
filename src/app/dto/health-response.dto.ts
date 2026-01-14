import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'Overall health status of the application',
    example: 'healthy',
    enum: ['healthy', 'unhealthy'],
  })
  status: 'healthy' | 'unhealthy';

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the health check was performed',
    example: '2024-01-15T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Database connection status',
    example: 'connected',
    enum: ['connected', 'disconnected'],
  })
  database: 'connected' | 'disconnected';
}
