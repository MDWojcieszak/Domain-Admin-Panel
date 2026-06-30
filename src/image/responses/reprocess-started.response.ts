import { IsBoolean, IsNumber } from 'nestjs-swagger-dto';

export class ReprocessStartedResponse {
  @IsBoolean()
  started: boolean;

  /** How many images were queued for (re)processing. */
  @IsNumber({ type: 'integer' })
  total: number;
}
