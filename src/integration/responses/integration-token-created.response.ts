import { IsDate, IsString } from 'nestjs-swagger-dto';

/**
 * Returned exactly once, when the token is minted. The raw value is never
 * stored, so it cannot be shown again — the UI must offer "copy" here or the
 * user has to revoke and re-issue.
 */
export class IntegrationTokenCreatedResponse {
  @IsString()
  id: string;

  @IsString({ example: 'whcp_7f3a9c2e1b4d6a80_9b1d…' })
  token: string;

  @IsString({ isArray: true })
  scopes: string[];

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  expiresAt: Date | null;
}
