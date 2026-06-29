import { IsString } from 'nestjs-swagger-dto';

export class SaveImmichConfigDto {
  @IsString({
    minLength: 1,
    example: 'https://photo.whcp.pl/api',
  })
  baseUrl: string;

  @IsString({
    minLength: 1,
    example: 'aBcD3f-IMMICH-API-KEY',
  })
  apiKey: string;

  /**
   * Root path of the external library on the Immich server (the prefix before
   * the module's `YEAR/<entry>/...` structure). Required for album creation.
   * Falls back to the IMMICH_LIBRARY_PATH env var when omitted.
   */
  @IsString({
    optional: true,
    example: '/media/vault',
  })
  libraryPath?: string;

  @IsString({
    maxLength: 128,
    optional: true,
    example: 'Immich',
  })
  name?: string;
}
