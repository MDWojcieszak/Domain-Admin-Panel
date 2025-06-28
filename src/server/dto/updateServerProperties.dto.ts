import { IsNested, IsString } from 'nestjs-swagger-dto';
import { ServerPropertiesDto } from './server-properties.dto';

export class UpdateServerPropertiesDto {
  @IsString()
  name: string;

  @IsNested({ type: ServerPropertiesDto })
  properties: ServerPropertiesDto;
}
