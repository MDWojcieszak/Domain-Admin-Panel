import { ApiProperty } from '@nestjs/swagger';
import { OcrLang, OcrOEM, OcrPSM } from '../enums';
import { IsString } from 'nestjs-swagger-dto';

export class OcrUsedDto {
  @IsString()
  lang!: string;

  @ApiProperty({ enum: OcrPSM, enumName: 'OcrPSM' })
  psm!: OcrPSM;

  @ApiProperty({ enum: OcrOEM, enumName: 'OcrOEM' })
  oem!: OcrOEM;

  @ApiProperty()
  rotate!: number;

  @ApiProperty()
  width!: number;

  @ApiProperty()
  threshold!: boolean;
}

export class OcrResponseDto {
  @ApiProperty()
  text!: string;

  @ApiProperty()
  durationMs!: number;

  @ApiProperty({ type: () => OcrUsedDto })
  used!: OcrUsedDto;

  @ApiProperty({ required: false })
  shotDate?: string;
}
