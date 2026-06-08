import { IsNested, IsNumber } from 'nestjs-swagger-dto';

import { TemplateResponse } from './template.response';

export class TemplateListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: TemplateResponse, isArray: true })
  templates: TemplateResponse[];
}
