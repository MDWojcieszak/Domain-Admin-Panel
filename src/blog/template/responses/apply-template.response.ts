import { IsNested } from 'nestjs-swagger-dto';

import { SectionResponse } from '../../section/responses';

/** Sections created on the draft by applying a template. */
export class ApplyTemplateResponse {
  @IsNested({ type: SectionResponse, isArray: true })
  created: SectionResponse[];
}
