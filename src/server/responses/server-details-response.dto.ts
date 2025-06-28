import { IsDate, IsNested, IsString } from 'nestjs-swagger-dto';
import { ServerPropertiesDto } from '../dto';
import { ServerCategoriesDto } from '../dto/server-categories.dto';

export class ServerDetailsResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsString({ optional: true })
  location?: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time', optional: true })
  updatedAt?: Date;

  @IsNested({ type: ServerPropertiesDto, optional: true })
  properties?: ServerPropertiesDto;

  @IsNested({ type: ServerCategoriesDto, isArray: true, optional: true })
  categories?: ServerCategoriesDto[];
}
