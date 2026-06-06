import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

class DailyPointDto {
  @IsString()
  date: string; // YYYY-MM-DD (UTC)

  @IsNumber()
  count: number;
}

class MonthlyPointDto {
  @IsString()
  period: string; // YYYY-MM (UTC)

  @IsNumber()
  count: number;
}

class ProcessPointDto {
  @IsString()
  date: string; // YYYY-MM-DD (UTC)

  @IsNumber()
  total: number;

  @IsNumber()
  failed: number;
}

class TrendsSeriesDto {
  @IsNested({ type: DailyPointDto, isArray: true })
  imagesAdded: DailyPointDto[];

  @IsNested({ type: MonthlyPointDto, isArray: true })
  photosByTaken: MonthlyPointDto[];

  @IsNested({ type: DailyPointDto, isArray: true })
  photoEntriesCreated: DailyPointDto[];

  @IsNested({ type: ProcessPointDto, isArray: true })
  processes: ProcessPointDto[];

  @IsNested({ type: DailyPointDto, isArray: true })
  newUsers: DailyPointDto[];
}

export class DashboardTrendsResponseDto {
  @IsString()
  range: string; // '7d' | '30d'

  @IsNested({ type: TrendsSeriesDto })
  series: TrendsSeriesDto;
}
