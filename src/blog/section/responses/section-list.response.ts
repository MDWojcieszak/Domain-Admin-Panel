import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { SectionResponse } from './section.response';

export class SectionListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: SectionResponse, isArray: true })
  sections: SectionResponse[];
}
