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

  /**
   * Who or what is behind the call, shown in the panel as "started by" —
   * e.g. "GitHub Actions · alice · abc1234". Free text from the caller:
   * displayed, never trusted. The secret is what authenticates.
   */
  @IsString({ optional: true, maxLength: 120 })
  triggeredBy?: string;
}
