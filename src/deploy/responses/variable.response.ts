import { IsBoolean, IsDate, IsString } from 'nestjs-swagger-dto';

export class VariableResponse {
  @IsString()
  id: string;

  @IsString()
  key: string;

  @IsBoolean()
  isSecret: boolean;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  /** Present only for non-secret variables. */
  @IsString({ optional: true })
  value?: string;

  @IsBoolean()
  isSet: boolean;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
