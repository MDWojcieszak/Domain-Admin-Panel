import { IsString } from 'nestjs-swagger-dto';

export class GetServerDto {
  @IsString()
  id: string;
}
