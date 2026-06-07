import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class CollectionSummaryResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsBoolean()
  isPublic: boolean;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer' })
  itemCount: number;

  /** Title resolved to the default locale (light list card). */
  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

export class CollectionListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: CollectionSummaryResponse, isArray: true })
  collections: CollectionSummaryResponse[];
}
