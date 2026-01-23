import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code of the error response',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 timestamp of when the error occurred',
    example: '2024-01-15T10:30:00.000Z',
    format: 'date-time',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Request path that produced the error',
    example: '/api/employees/123',
  })
  path: string;

  @ApiProperty({
    description:
      'Error response payload (string message or an object returned by Nest exceptions)',
    oneOf: [
      { type: 'string', example: 'Unauthorized' },
      {
        type: 'object',
        additionalProperties: true,
        example: { message: 'Unauthorized', statusCode: 401 },
      },
    ],
  })
  response: string | Record<string, any>;
}
