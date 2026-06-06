import { IsEnum } from 'nestjs-swagger-dto';

export enum TrendsRange {
  WEEK = '7d',
  MONTH = '30d',
}

export class DashboardTrendsQueryDto {
  @IsEnum({ enum: { TrendsRange }, optional: true })
  range?: TrendsRange;
}
