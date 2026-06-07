import { CategoryKind } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class CategoryTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  label: string | null;
}

/** Admin category shape (all locales + isSystem + audit). */
export class CategoryResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { CategoryKind } })
  kind: CategoryKind;

  @IsString()
  key: string;

  @IsString({ optional: true, nullable: true })
  icon: string | null;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsBoolean()
  isSystem: boolean;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;

  @IsNested({ type: CategoryTranslationResponse, isArray: true })
  translations: CategoryTranslationResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
