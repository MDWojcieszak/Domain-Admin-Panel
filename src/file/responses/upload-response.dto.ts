import { IsString } from 'nestjs-swagger-dto';

export class UploadResponseDto {
  @IsString({ description: 'Uploaded image ID' })
  id: string;

  @IsString({ description: 'URL to the cover image', optional: true })
  coverUrl?: string;

  @IsString({ description: 'URL to the low-res image', optional: true })
  lowResUrl?: string;
}
