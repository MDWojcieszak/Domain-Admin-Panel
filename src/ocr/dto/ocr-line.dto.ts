import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class OcrLineDto {
  @IsString({ description: 'Recognized text for a line/box' })
  text!: string;

  @IsNumber({ description: '[x0,y0,x1,y1] box in pixels', isArray: true })
  box!: [number, number, number, number]; // left, top, right, bottom
}
