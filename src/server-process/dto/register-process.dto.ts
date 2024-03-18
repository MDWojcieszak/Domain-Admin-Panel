import { IsString } from 'nestjs-swagger-dto';

export class RegisterProcessDto {
  @IsString()
  categoryId: string;

  @IsString()
  userId: string;

  @IsString()
  name: string;
}
