import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { HomeBlockResponse } from './home-block.response';

export class HomeLayoutSummaryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  isActive: boolean;

  @IsNumber({ type: 'integer' })
  blockCount: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class HomeLayoutListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: HomeLayoutSummaryResponse, isArray: true })
  layouts: HomeLayoutSummaryResponse[];
}

export class HomeLayoutResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  isActive: boolean;

  @IsNested({ type: HomeBlockResponse, isArray: true })
  blocks: HomeBlockResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
