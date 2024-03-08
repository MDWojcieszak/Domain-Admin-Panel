import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerTheme } from 'swagger-themes';
import { SwaggerThemeNameEnum } from 'swagger-themes/build/enums/swagger-theme-name';
import { Transport } from '@nestjs/microservices';
import { config } from './config/config';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.connectMicroservice(
    {
      transport: Transport.RMQ,
      options: config().rabbitMQConfig,
    },
    { inheritAppConfig: true },
  );
  app.startAllMicroservices();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, { customCss: darkStyle });
  await app.listen(3000);
}
bootstrap();
