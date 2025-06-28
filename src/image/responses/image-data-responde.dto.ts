import { IsDate, IsNested, IsString } from 'nestjs-swagger-dto';
import { AuthorDto } from '../dto';

export class ImageDataResponseDto {
  @IsString()
  id: string;

  @IsNested({ type: AuthorDto })
  author: AuthorDto;

  @IsDate({ format: 'date-time' })
  dateTaken: Date;

  @IsString()
  imageId: string;

  @IsString({ optional: true })
  localization?: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ optional: true })
  title?: string;
}
