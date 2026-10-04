import { DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';

export const swaggerConfig = new DocumentBuilder()
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

/** The spec the admin panel's client is generated from. */
export function writeOpenApiYaml(document: OpenAPIObject): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('js-yaml');
  writeFileSync(
    join(process.cwd(), 'src', 'api', 'api.yaml'),
    yaml.dump(document),
    'utf8',
  );
}
