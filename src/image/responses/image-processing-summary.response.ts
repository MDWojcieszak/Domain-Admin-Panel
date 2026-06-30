import { IsNumber } from 'nestjs-swagger-dto';

export class ImageProcessingSummaryResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  done: number;

  /** Never processed yet. */
  @IsNumber({ type: 'integer' })
  pending: number;

  @IsNumber({ type: 'integer' })
  processing: number;

  @IsNumber({ type: 'integer' })
  failed: number;
}
