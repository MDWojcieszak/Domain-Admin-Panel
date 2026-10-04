import { AuditSource } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsObject,
  IsString,
} from 'nestjs-swagger-dto';

export class AuditActorResponse {
  @IsString()
  id: string;

  @IsString()
  email: string;

  @IsString({ optional: true, nullable: true })
  firstName: string | null;

  @IsString({ optional: true, nullable: true })
  lastName: string | null;
}

export class AuditEntryResponse {
  @IsString()
  id: string;

  @IsNested({ type: AuditActorResponse, optional: true, nullable: true })
  actor: AuditActorResponse | null;

  @IsEnum({ enum: { AuditSource } })
  source: AuditSource;

  /** e.g. application.update, variable.delete, release.deploy */
  @IsString()
  action: string;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  /** Stays readable after the entity is deleted. */
  @IsString({ optional: true, nullable: true })
  entityName: string | null;

  /** `{ field: { from, to } }`, secrets already redacted (I12). */
  @IsObject({ optional: true, nullable: true })
  diff: Record<string, unknown> | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}
