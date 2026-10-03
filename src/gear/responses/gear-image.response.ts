import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export enum GearImageUserKind {
  ITEM = 'ITEM',
  SYSTEM = 'SYSTEM',
}

/** A gear item or system that already shows this photo. */
export class GearImageUserResponse {
  @IsEnum({ enum: { GearImageUserKind } })
  kind: GearImageUserKind;

  @IsString()
  id: string;

  /** "Fujifilm NP-W235 #1", or the system name. */
  @IsString()
  name: string;
}

export class GearImageResponse {
  @IsString()
  id: string;

  @IsString()
  coverUrl: string;

  @IsString()
  lowResUrl: string;

  /** ~640 px — use this for the picker grid. */
  @IsString()
  thumbUrl: string;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  width: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  height: number | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  /** Empty for a photo uploaded but not attached yet. */
  @IsNested({ type: GearImageUserResponse, isArray: true })
  usedBy: GearImageUserResponse[];
}

export class GearImageListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: GearImageResponse, isArray: true })
  images: GearImageResponse[];
}
