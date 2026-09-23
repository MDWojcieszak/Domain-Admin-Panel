import { IsString } from 'nestjs-swagger-dto';

/**
 * Payload a CI pipeline posts once it has pushed a new image.
 *
 * Both fields are optional so the simplest possible workflow — "something
 * changed, redeploy" — still works; when CI knows the digest it should send it,
 * because that is the only unambiguous identity of what will run (D10).
 */
export class DeployWebhookDto {
  @IsString({ optional: true })
  version?: string;

  @IsString({ optional: true })
  digest?: string;
}
