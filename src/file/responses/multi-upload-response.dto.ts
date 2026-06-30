import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { UploadResponseDto } from './upload-response.dto';

export class MultiUploadResponseDto {
  @IsNested({ type: UploadResponseDto, isArray: true })
  images: UploadResponseDto[];

  @IsNumber({ type: 'integer', description: 'Successfully uploaded count' })
  uploaded: number;

  @IsNumber({ type: 'integer', description: 'Failed count' })
  failed: number;
}
