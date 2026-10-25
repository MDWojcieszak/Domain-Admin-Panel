import { BomPartKind, BomStatus, GearCategory } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { ProjectUserResponse } from './project.response';

// — bill of materials —

/** Just which piece of gear: the catalog itself stays behind gallery.manage. */
export class BomGearResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { GearCategory } })
  category: GearCategory;

  @IsString()
  brand: string;

  @IsString()
  model: string;
}

/** A part's photo, through signed short-lived URLs like any document's. */
export class BomPhotoResponse {
  @IsString()
  documentId: string;

  @IsString()
  thumbUrl: string;

  @IsString()
  previewUrl: string;
}

export class BomItemResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum({ enum: { BomPartKind } })
  kind: BomPartKind;

  @IsNumber()
  quantity: number;

  @IsString({ optional: true, nullable: true })
  unit: string | null;

  @IsEnum({ enum: { BomStatus } })
  status: BomStatus;

  @IsNumber({ optional: true, nullable: true })
  unitPrice: number | null;

  @IsString({ optional: true, nullable: true })
  currency: string | null;

  /** quantity × unitPrice, when there is a price. */
  @IsNumber({ optional: true, nullable: true })
  cost: number | null;

  @IsString({ optional: true, nullable: true })
  supplier: string | null;

  @IsString({ optional: true, nullable: true })
  url: string | null;

  @IsString({ optional: true, nullable: true })
  note: string | null;

  @IsNested({ type: BomGearResponse, optional: true, nullable: true })
  gearItem: BomGearResponse | null;

  @IsNested({ type: BomPhotoResponse, optional: true, nullable: true })
  photo: BomPhotoResponse | null;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsNumber({ type: 'integer' })
  commentCount: number;

  @IsNumber({ type: 'integer' })
  documentCount: number;
}

/** What a currency's parts cost, and what is still to buy (NEEDED). */
export class BomCostResponse {
  @IsString({ optional: true, nullable: true })
  currency: string | null;

  @IsNumber()
  total: number;

  @IsNumber()
  toBuy: number;
}

/** Computed, never stored (I5). */
export class BomSummaryResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  needed: number;

  @IsNumber({ type: 'integer' })
  ordered: number;

  @IsNumber({ type: 'integer' })
  have: number;

  @IsNumber({ type: 'integer' })
  used: number;

  @IsNested({ type: BomCostResponse, isArray: true })
  costs: BomCostResponse[];
}

export class BomResponse {
  @IsNested({ type: BomItemResponse, isArray: true })
  items: BomItemResponse[];

  @IsNested({ type: BomSummaryResponse })
  summary: BomSummaryResponse;
}

// — work journal —

export class JournalEntryResponse {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString()
  body: string;

  @IsDate({ format: 'date-time' })
  happenedAt: Date;

  @IsNested({ type: ProjectUserResponse })
  author: ProjectUserResponse;

  /** The author and the project's owner may change or delete it. */
  @IsBoolean()
  canEdit: boolean;

  @IsNumber({ type: 'integer' })
  commentCount: number;

  @IsNumber({ type: 'integer' })
  documentCount: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

// — comments —

export class ProjectCommentResponse {
  @IsString()
  id: string;

  @IsString()
  body: string;

  @IsNested({ type: ProjectUserResponse })
  author: ProjectUserResponse;

  /** Only the author edits. */
  @IsBoolean()
  canEdit: boolean;

  /** The author, or the project's owner tidying up. */
  @IsBoolean()
  canDelete: boolean;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  editedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}
