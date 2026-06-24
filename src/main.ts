import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerTheme } from 'swagger-themes';
import { SwaggerThemeNameEnum } from 'swagger-themes/build/enums/swagger-theme-name';
import { Transport } from '@nestjs/microservices';
import { config } from './config/config';
import { validateEnv } from './config/validate-env';
import { writeFileSync } from 'fs';
import { ServerResponse } from 'http';
import { join } from 'path';
import { MessagingDocsService } from './api-docs/messaging-docs.service';

const theme = new SwaggerTheme();
const darkStyle = theme.getBuffer(SwaggerThemeNameEnum.DARK);

const swaggerConfig = new DocumentBuilder()
  .setTitle('WHCP Backend')

  .setDescription('XD')
  .setVersion('1.0')
  .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    name: 'JWT',
    description: 'Enter JWT token',
    in: 'header',
  })
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT refresh',
      description: 'Enter JWT refresh token',
      in: 'header',
    },
    'JWT-refresh',
  )
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT reset password',
      description: 'Enter JWT reset password token',
      in: 'header',
    },
    'JWT-reset-password',
  )
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT register user',
      description: 'Enter JWT register user',
      in: 'header',
    },
    'JWT-register-user',
  )
  .build();

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);

  // Security headers (dependency-free; covers helmet's core set for a JSON API).
  // CORP is `cross-origin` so the frontend can embed backend-served images.
  app.use((_req: unknown, res: ServerResponse, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=15552000; includeSubDomains',
      );
    }
    next();
  });

  // Flush RMQ/Prisma connections + run OnModuleDestroy cleanly on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.connectMicroservice(
    {
      transport: Transport.RMQ,
      options: config().rabbitMQConfig,
    },
    { inheritAppConfig: true },
  );
  app.startAllMicroservices();
  // Explicit origin allow-list (comma-separated ALLOWED_ORIGINS). No credentials:
  // auth is Bearer-header-only, there are no cookies to protect. (audit H1)
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : ['http://localhost:3000'],
  });

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('js-yaml');
  const yamlContent = yaml.dump(document);
  writeFileSync(
    join(process.cwd(), 'src', 'api', 'api.yaml'),
    yamlContent,
    'utf8',
  );

  app.get(MessagingDocsService).generate({
    title: 'WHCP Server Messaging API',
    version: '1.0',
    description:
      'RabbitMQ message contract between the backend and remote servers (agents). ' +
      'publish = Server → Backend, subscribe = Backend → Server.',
  });

  SwaggerModule.setup('docs', app, document, { customCss: darkStyle });
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000);
}
bootstrap();
