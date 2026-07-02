import { IsBoolean, IsNumber, IsString } from 'nestjs-swagger-dto';

export class UpdateGearSystemDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true, nullable: true })
  label?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** Optional gallery image used as the system thumbnail (null clears it). */
  @IsString({ optional: true, nullable: true })
  imageId?: string | null;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsBoolean({ optional: true })
  visible?: boolean;
}
