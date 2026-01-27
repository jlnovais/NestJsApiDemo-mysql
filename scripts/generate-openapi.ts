/// <reference path="../src/types/express-session.d.ts" />

import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import { AppModule } from '../src/app.module';

async function generateOpenApiSpec() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Nest API Demo')
    .setDescription(
      'A comprehensive REST API built with NestJS and MySQL. This API provides endpoints for managing users, employees, and departments with role-based access control.',
    )
    .setVersion('1.0')
    .addTag('users', 'User management endpoints')
    .addTag('employees', 'Employee management endpoints')
    .addTag('departments', 'Department management endpoints')
    .addTag('app', 'Application endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addCookieAuth('session-id')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const yamlString = stringify(document, {
    indent: 2,
    lineWidth: -1,
  });

  const outputPath = join(process.cwd(), 'openapi.yaml');
  writeFileSync(outputPath, yamlString, 'utf8');

  console.log(`✅ OpenAPI spec generated successfully at: ${outputPath}`);

  await app.close();
}

generateOpenApiSpec().catch((error) => {
  console.error('❌ Error generating OpenAPI spec:', error);
  process.exit(1);
});
