import { IsBoolean, IsNested, IsObject, IsString } from 'nestjs-swagger-dto';

/** What a deployment would write, with every secret value masked (I3). */
export class RenderPreviewResponse {
  /** Null when `missingKeys` is non-empty: rendering cannot complete. */
  @IsString({ optional: true, nullable: true })
  compose: string | null;

  /** sha256 of `compose`; echo it back when creating the release (I5). */
  @IsString({ optional: true, nullable: true })
  composeHash: string | null;

  /** The env file, secret values replaced with ***. */
  @IsString({ optional: true, nullable: true })
  env: string | null;

  @IsString({ isArray: true })
  envKeys: string[];

  /** Variables referenced but undefined — fill them in before deploying (I6). */
  @IsString({ isArray: true })
  missingKeys: string[];

  /** Compose of the active release, for the diff view. */
  @IsString({ optional: true, nullable: true })
  previousCompose: string | null;

  @IsBoolean()
  changed: boolean;
}

export class ImportedEnvResponse {
  @IsString()
  key: string;

  /** Null for anything that looks like a secret — those are never imported. */
  @IsString({ optional: true, nullable: true })
  value: string | null;

  @IsBoolean()
  isSecret: boolean;
}

/** What converting an adopted stack would keep and lose. Writes nothing. */
export class ImportPreviewResponse {
  @IsString()
  serviceName: string;

  @IsString({ optional: true, nullable: true })
  image: string | null;

  /** The AppSpec conversion would store. */
  @IsObject()
  spec: Record<string, unknown>;

  @IsNested({ type: ImportedEnvResponse, isArray: true })
  env: ImportedEnvResponse[];

  /** Everything to look at before converting. */
  @IsString({ isArray: true })
  warnings: string[];

  /** The compose on disk, secret values replaced with ***. */
  @IsString()
  currentCompose: string;

  /** Keys whose values must be supplied before the first deployment. */
  @IsString({ isArray: true })
  secretKeysToFill: string[];

  /** False when the warnings describe losses that make conversion a bad idea. */
  @IsBoolean()
  recommended: boolean;
}

/** Returned once, when the secret is issued; it cannot be shown again. */
export class WebhookSecretResponse {
  @IsString()
  secret: string;

  /** Header the CI must send the secret in. */
  @IsString()
  header: string;

  @IsString()
  note: string;
}
