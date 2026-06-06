import { OcrOptionsDto } from './ocr-options.dto';
import { IsNested } from 'nestjs-swagger-dto';

export class OcrRequestDto {
  @IsNested({ type: OcrOptionsDto, optional: true })
  options?: OcrOptionsDto;
}
