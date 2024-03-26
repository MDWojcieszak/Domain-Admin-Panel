import { IsString } from 'nestjs-swagger-dto';

export class GetServerCommandsDto {
  @IsString()
  categoryId: string;
}
