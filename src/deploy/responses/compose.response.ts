import { BuildMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

export class ComposeVariableResponse {
  @IsString()
  key: string;

  /** A `${KEY:-default}` form covers a missing value. */
  @IsBoolean()
  hasDefault: boolean;
}

/** What saving a compose file would store. No secret value is returned. */
export class ComposeCheckResponse {
  /** The file as it would be stored: inline secrets replaced by ${KEY}. */
  @IsString()
  compose: string;

  /** Keys whose inline values would move into encrypted env entries. */
  @IsString({ isArray: true })
  movedSecrets: string[];

  @IsString({ isArray: true })
  notes: string[];

  @IsEnum({ enum: { BuildMode } })
  buildMode: BuildMode;

  /** Variables the file reads from the env file. */
  @IsNested({ type: ComposeVariableResponse, isArray: true })
  variables: ComposeVariableResponse[];
}

/** Taking over an adopted stack's own compose file. Writes nothing. */
export class ComposeTakeoverPreviewResponse {
  /** The file as it would be stored. */
  @IsString()
  compose: string;

  /** The file on the host, secret values masked. */
  @IsString()
  currentCompose: string;

  @IsString({ isArray: true })
  movedSecrets: string[];

  /** Read by the file with no value anywhere — fill them in before deploying. */
  @IsString({ isArray: true })
  variablesToFill: string[];

  /** What was changed: resolved paths, moved secrets. */
  @IsString({ isArray: true })
  notes: string[];

  @IsString({ optional: true, nullable: true })
  workingDir: string | null;

  /** Kept as it is, so the running containers are updated, not duplicated. */
  @IsString()
  projectName: string;
}
