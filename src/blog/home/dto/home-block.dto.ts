import { HomeBlockType } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateHomeBlockDto {
  @IsEnum({ enum: { HomeBlockType } })
  type: HomeBlockType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsString({
    optional: true,
    description: 'Required for CATEGORY_ROW; must be kind=POST.',
  })
  categoryId?: string;

  @IsString({ optional: true })
  imageId?: string;

  @IsNumber({ type: 'integer', min: 1, max: 50, optional: true })
  limit?: number;
}

export class PatchHomeBlockDto {
  @IsEnum({ enum: { HomeBlockType }, optional: true })
  type?: HomeBlockType;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsString({ optional: true, nullable: true })
  categoryId?: string | null;

  @IsString({ optional: true, nullable: true })
  imageId?: string | null;

  @IsNumber({
    type: 'integer',
    min: 1,
    max: 50,
    optional: true,
    nullable: true,
  })
  limit?: number | null;
}

export class ReorderHomeBlockItemDto {
  @IsString()
  blockId: string;

  @IsNumber({ type: 'integer' })
  order: number;
}

export class ReorderHomeBlocksDto {
  @IsNested({ type: ReorderHomeBlockItemDto, isArray: true })
  blocks: ReorderHomeBlockItemDto[];
}

export class UpsertHomeBlockTranslationDto {
  @IsString({ optional: true, nullable: true })
  title?: string | null;

  @IsString({ optional: true, nullable: true })
  body?: string | null;
}
