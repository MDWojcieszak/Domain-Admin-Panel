import { IsBoolean, IsNested, IsString } from 'nestjs-swagger-dto';

import { SectionResponse } from '../../section/responses';

/** Maps a client-supplied block key to the section id the backend created. */
export class CreatedBlockRefResponse {
  @IsString({
    description:
      'clientKey of a new block, or the previous sectionId of a block whose type changed.',
  })
  clientKey: string;

  @IsString()
  sectionId: string;
}

export class SaveDocumentResponse {
  /** The refreshed draft sections (all locales), ordered. */
  @IsNested({ type: SectionResponse, isArray: true })
  sections: SectionResponse[];

  /** New section ids for blocks the client could not yet know about. */
  @IsNested({ type: CreatedBlockRefResponse, isArray: true })
  created: CreatedBlockRefResponse[];

  @IsBoolean()
  hasUnpublishedChanges: boolean;

  @IsString()
  versionId: string;
}
