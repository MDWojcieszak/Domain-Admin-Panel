import { IsString } from 'nestjs-swagger-dto';

export class PatchUserDto {
  @IsString({ optional: true })
  firstName?: string;

  @IsString({ optional: true })
  lastName?: string;
}
