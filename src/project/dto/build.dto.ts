import { BomPartKind, BomStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

// — bill of materials —

export class CreateBomItemDto {
  @IsString({ minLength: 1, maxLength: 300 })
  name: string;

  /** What the part is (screw, enclosure, sensor…); OTHER when not said. */
  @IsEnum({ enum: { BomPartKind }, optional: true })
  kind?: BomPartKind;

  @IsNumber({ optional: true, min: 0 })
  quantity?: number;

  @IsString({ optional: true, nullable: true, maxLength: 30 })
  unit?: string | null;

  @IsEnum({ enum: { BomStatus }, optional: true })
  status?: BomStatus;

  @IsNumber({ optional: true, nullable: true, min: 0 })
  unitPrice?: number | null;

  /** ISO 4217, e.g. PLN, EUR. */
  @IsString({
    optional: true,
    nullable: true,
    pattern: { regex: /^[A-Z]{3}$/ },
  })
  currency?: string | null;

  @IsString({ optional: true, nullable: true, maxLength: 200 })
  supplier?: string | null;

  /** http(s) only: it becomes a link other members click. */
  @IsString({
    optional: true,
    nullable: true,
    maxLength: 2000,
    pattern: { regex: /^https?:\/\/\S+$/i },
  })
  url?: string | null;

  @IsString({ optional: true, nullable: true, maxLength: 5000 })
  note?: string | null;

  /** A piece of gear this part is, or becomes. */
  @IsString({ optional: true, nullable: true })
  gearItemId?: string | null;
}

export class UpdateBomItemDto {
  @IsString({ optional: true, minLength: 1, maxLength: 300 })
  name?: string;

  /** What the part is (screw, enclosure, sensor…); OTHER when not said. */
  @IsEnum({ enum: { BomPartKind }, optional: true })
  kind?: BomPartKind;

  @IsNumber({ optional: true, min: 0 })
  quantity?: number;

  @IsString({ optional: true, nullable: true, maxLength: 30 })
  unit?: string | null;

  @IsEnum({ enum: { BomStatus }, optional: true })
  status?: BomStatus;

  @IsNumber({ optional: true, nullable: true, min: 0 })
  unitPrice?: number | null;

  @IsString({
    optional: true,
    nullable: true,
    pattern: { regex: /^[A-Z]{3}$/ },
  })
  currency?: string | null;

  @IsString({ optional: true, nullable: true, maxLength: 200 })
  supplier?: string | null;

  /** http(s) only: it becomes a link other members click. */
  @IsString({
    optional: true,
    nullable: true,
    maxLength: 2000,
    pattern: { regex: /^https?:\/\/\S+$/i },
  })
  url?: string | null;

  @IsString({ optional: true, nullable: true, maxLength: 5000 })
  note?: string | null;

  @IsString({ optional: true, nullable: true })
  gearItemId?: string | null;
}

/** One of the part's own pinned images, as its photo. */
export class SetBomPhotoDto {
  @IsString()
  documentId: string;
}

/** Ordered, have, used: a viewer may do this when the project lets them tick. */
export class SetBomStatusDto {
  @IsEnum({ enum: { BomStatus } })
  status: BomStatus;
}

// — work journal —

export class CreateJournalEntryDto {
  @IsString({ optional: true, nullable: true, maxLength: 200 })
  title?: string | null;

  /** Markdown. */
  @IsString({ minLength: 1, maxLength: 50000 })
  body: string;

  /** When the work happened; now when omitted. */
  @IsString({ isDate: { format: 'date-time' }, optional: true })
  happenedAt?: string;
}

export class UpdateJournalEntryDto {
  @IsString({ optional: true, nullable: true, maxLength: 200 })
  title?: string | null;

  @IsString({ optional: true, minLength: 1, maxLength: 50000 })
  body?: string;

  @IsString({ isDate: { format: 'date-time' }, optional: true })
  happenedAt?: string;
}

// — comments (D10) —

/** Exactly one of the four. */
export class ProjectCommentTargetDto {
  @IsString({ optional: true })
  projectId?: string;

  @IsString({ optional: true })
  taskId?: string;

  @IsString({ optional: true })
  bomItemId?: string;

  @IsString({ optional: true })
  journalEntryId?: string;
}

export class CreateProjectCommentDto extends ProjectCommentTargetDto {
  /** Markdown. */
  @IsString({ minLength: 1, maxLength: 10000 })
  body: string;
}

export class UpdateProjectCommentDto {
  @IsString({ minLength: 1, maxLength: 10000 })
  body: string;
}
