import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class UpsertVariableDto {
  @IsString({ pattern: { regex: /^[A-Za-z_][A-Za-z0-9_]*$/ } })
  key: string;

  @IsString()
  value: string;

  @IsBoolean({ optional: true })
  isSecret?: boolean;

  @IsString({ optional: true })
  description?: string;
}
