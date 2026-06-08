import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { CreateTemplateBlockDto } from './template-block.dto';

export class CreateTemplateDto {
  @IsString({ description: 'Stable key (normalized server-side); unique.' })
  key: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsString({ optional: true, nullable: true })
  group?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;

  @IsNested({ type: CreateTemplateBlockDto, isArray: true, optional: true })
  blocks?: CreateTemplateBlockDto[];
}

export class PatchTemplateDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsString({ optional: true, nullable: true })
  group?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;
}
