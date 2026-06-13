import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class HomeConfigResponse {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  postCount: number;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class HomePinResponse {
  @IsString()
  postId: string;

  @IsString()
  slug: string;

  @IsNumber({ type: 'integer' })
  position: number;
}

export class HomePinsResponse {
  @IsNested({ type: HomePinResponse, isArray: true })
  pins: HomePinResponse[];
}
