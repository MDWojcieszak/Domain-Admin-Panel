import { IsString } from 'nestjs-swagger-dto';

export class TagDetailResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  color?: string;
}
