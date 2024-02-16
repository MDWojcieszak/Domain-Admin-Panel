import { IsString } from 'nestjs-swagger-dto';

export class FileDto {
  @IsString()
  id: string;
}
