import { IsBoolean, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateGearSystemDto {
  /** System name, e.g. "Fujifilm X". */
  @IsString()
  name: string;

  /** Short format tag, e.g. "APS-C", "Medium Format". */
  @IsString({ optional: true, nullable: true })
  label?: string | null;

  /** Why this system (rationale). */
  @IsString({ optional: true, nullable: true })
  description?: string | null;

  /** Optional gallery image used as the system thumbnail. */
  @IsString({ optional: true, nullable: true })
  imageId?: string | null;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsBoolean({ optional: true })
  visible?: boolean;
}
