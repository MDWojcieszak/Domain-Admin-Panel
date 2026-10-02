import { IsDate, IsNested, IsString } from 'nestjs-swagger-dto';

import { GearItemResponse } from './gear-item.response';

export class GearKitResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsNested({ type: GearItemResponse, isArray: true })
  items: GearItemResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}
