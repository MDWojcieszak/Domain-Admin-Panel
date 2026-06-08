import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { TemplateBlockResponse } from './template-block.response';

export class TemplateResponse {
  @IsString()
  id: string;

  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsString({ optional: true, nullable: true })
  icon: string | null;

  @IsString({ optional: true, nullable: true })
  group: string | null;

  @IsBoolean()
  isSystem: boolean;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;

  @IsNested({ type: TemplateBlockResponse, isArray: true })
  blocks: TemplateBlockResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
