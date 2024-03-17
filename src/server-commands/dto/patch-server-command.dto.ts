import { IsString } from 'nestjs-swagger-dto';

export class PatchServerCommandDto {
  @IsString()
  name: string;
}
