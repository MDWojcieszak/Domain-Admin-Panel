import { IsDate, IsString } from 'nestjs-swagger-dto';

/** Handed to the desktop app on the poll that follows approval. Once. */
export class DeviceTokenResponse {
  @IsString({ example: 'whcp_7f3a9c2e1b4d6a80_9b1d…' })
  token: string;

  @IsString({ isArray: true })
  scopes: string[];

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  expiresAt: Date | null;
}
