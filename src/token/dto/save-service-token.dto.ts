import { ConnectedServiceType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class SaveServiceTokenDto {
  @IsEnum({
    enum: { ConnectedServiceType },
    example: ConnectedServiceType.TELEGRAM,
  })
  service: ConnectedServiceType;

  @IsString({
    minLength: 1,
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  value: string;

  @IsString({
    maxLength: 128,
    optional: true,
    example: 'Oliwia Telegram Token',
  })
  name?: string;
}
