import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../app.module';
import { swaggerConfig, writeOpenApiYaml } from './openapi';

/**
 * Writes src/api/api.yaml without starting the application. Preview mode
 * builds the module graph but instantiates no provider, so nothing connects to
 * Postgres or RabbitMQ — a running dev instance keeps its queue messages.
 *
 *   npm run docs:openapi
 */
async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error', 'warn'],
  });
  writeOpenApiYaml(SwaggerModule.createDocument(app, swaggerConfig));
  await app.close();
}

void generate();
