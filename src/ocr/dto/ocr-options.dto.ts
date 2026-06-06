import { ApiPropertyOptional } from '@nestjs/swagger';
import { OcrLang, OcrOEM, OcrPSM } from '../enums';
import { IsBoolean, IsEnum, IsNumber } from 'nestjs-swagger-dto';

export class OcrOptionsDto {
  @IsEnum({ enum: { OcrLang }, optional: true, default: OcrLang.POLISH })
  lang?: OcrLang = OcrLang.POLISH;

  @IsEnum({ enum: { OcrPSM }, optional: true, default: OcrPSM.SINGLE_BLOCK })
  psm?: OcrPSM = OcrPSM.SINGLE_BLOCK;

  @IsEnum({ enum: { OcrOEM }, optional: true, default: OcrOEM.LSTM_ONLY })
  oem?: OcrOEM = OcrOEM.LSTM_ONLY;

  @IsNumber({ default: 0, type: 'integer' })
  rotate?: 0 | 90 | 180 | 270 = 0;

  @ApiPropertyOptional({
    description: 'Max image width after resize',
    minimum: 200,
    maximum: 4000,
    default: 1800,
  })
  @IsNumber({ default: 1800, type: 'integer' })
  maxWidth?: number = 1800;

  @IsNumber({ default: 15000, type: 'integer' })
  timeoutMs?: number = 15000;

  @IsBoolean({ default: false, optional: true })
  threshold?: boolean = false;
}
