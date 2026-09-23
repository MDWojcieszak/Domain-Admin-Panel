import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class UpsertApplicationEnvDto {
  /** Value may reference global variables as [[KEY]]. */
  @IsString()
  value: string;

  /**
   * Secret values are encrypted at rest and never returned by the API — not
   * even to an OWNER (§10.4).
   */
  @IsBoolean({ optional: true })
  isSecret?: boolean;
}
