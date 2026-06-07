import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class PatchCollectionDto {
  @IsString({ optional: true })
  slug?: string;

  @IsString({ optional: true, nullable: true })
  country?: string | null;

  @IsString({ optional: true, nullable: true })
  region?: string | null;

  @IsBoolean({ optional: true })
  isPublic?: boolean;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;
}
