import { IsNumber } from 'nestjs-swagger-dto';

export class PaginationDto {
  @IsNumber({ min: 1, max: 20 })
  take: number;

  @IsNumber({ optional: true, default: 0, min: 1 })
  skip?: number;
}
