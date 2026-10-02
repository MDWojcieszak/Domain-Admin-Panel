import {
  MediaStatus,
  PhotoEntryPostStage,
  PhotoEntryStatus,
  PhotoEntryType,
} from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class PhotoEntryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { PhotoEntryType } })
  type: PhotoEntryType;

  /** The shoot itself. SHOT is a resting state, not "unfinished" (D1). */
  @IsEnum({ enum: { PhotoEntryStatus } })
  status: PhotoEntryStatus;

  /** What was done with the material. NONE is a valid final answer (D1). */
  @IsEnum({ enum: { PhotoEntryPostStage } })
  postStage: PhotoEntryPostStage;

  /**
   * Derived from the dates, never stored (D2) — a stored flag is exactly what
   * went stale in the old model.
   */
  @IsBoolean()
  isHappeningNow: boolean;

  /** Derived: postStage !== NONE. The "was edited" label from D3. */
  @IsBoolean()
  wasEdited: boolean;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  firstEditedAt: Date | null;

  /**
   * Null means the gear has not been declared yet, which is what makes the panel
   * ask (§5). It is not the same as "no gear was used".
   */
  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  gearConfirmedAt: Date | null;

  /** Nullable throughout: absent means "unknown", never zero (§7). */
  @IsNumber({ optional: true, nullable: true })
  photoCount: number | null;

  @IsNumber({ optional: true, nullable: true })
  selectedCount: number | null;

  @IsNumber({ optional: true, nullable: true })
  editedCount: number | null;

  /** Derived: selectedCount - editedCount, or null if either is unknown. */
  @IsNumber({ optional: true, nullable: true })
  remainingToEdit: number | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  startDate: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  endDate: Date | null;

  @IsString({ optional: true, nullable: true })
  rootPath: string | null;

  @IsBoolean()
  foldersCreated: boolean;

  @IsEnum({ enum: { MediaStatus } })
  uploadStatus?: MediaStatus;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  foldersCreatedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
