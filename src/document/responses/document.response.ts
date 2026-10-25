import { DocumentKind } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { ProjectUserResponse } from '../../project/responses';

export class DocumentLinkProjectResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  key: string;
}

export class DocumentLinkTaskResponse {
  @IsString()
  id: string;

  @IsString()
  key: string;

  @IsString()
  title: string;
}

export class DocumentLinkBomItemResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;
}

export class DocumentLinkJournalEntryResponse {
  @IsString()
  id: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsDate({ format: 'date-time' })
  happenedAt: Date;
}

/**
 * Where a document is pinned: a project, or something in it (a task, a part,
 * a journal entry), always with that project.
 */
export class DocumentLinkResponse {
  @IsString()
  id: string;

  @IsNested({ type: DocumentLinkProjectResponse })
  project: DocumentLinkProjectResponse;

  @IsNested({ type: DocumentLinkTaskResponse, optional: true, nullable: true })
  task: DocumentLinkTaskResponse | null;

  @IsNested({
    type: DocumentLinkBomItemResponse,
    optional: true,
    nullable: true,
  })
  bomItem: DocumentLinkBomItemResponse | null;

  @IsNested({
    type: DocumentLinkJournalEntryResponse,
    optional: true,
    nullable: true,
  })
  journalEntry: DocumentLinkJournalEntryResponse | null;

  @IsNested({ type: ProjectUserResponse })
  addedBy: ProjectUserResponse;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

export class DocumentResponse {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsString()
  originalName: string;

  @IsString()
  mimeType: string;

  @IsEnum({ enum: { DocumentKind } })
  kind: DocumentKind;

  @IsNumber({ type: 'integer' })
  sizeBytes: number;

  @IsString({ optional: true, nullable: true })
  extension: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  width: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  height: number | null;

  @IsNested({ type: ProjectUserResponse })
  owner: ProjectUserResponse;

  /** Only the owner renames, describes or deletes it. */
  @IsBoolean()
  isMine: boolean;

  /** Shown in the browser (verified image or PDF); anything else downloads. */
  @IsBoolean()
  inline: boolean;

  /** Signed, short-lived; for `<img>`. Null when there is no preview. */
  @IsString({ optional: true, nullable: true })
  thumbUrl: string | null;

  @IsString({ optional: true, nullable: true })
  previewUrl: string | null;

  /** Signed, short-lived: opens the file (inline when safe). */
  @IsString()
  fileUrl: string;

  /** Signed, short-lived: always a download, under the original name. */
  @IsString()
  downloadUrl: string;

  /** Places you can see it pinned. */
  @IsNested({ type: DocumentLinkResponse, isArray: true })
  links: DocumentLinkResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class UploadDocumentResponse {
  @IsNested({ type: DocumentResponse })
  document: DocumentResponse;

  /** You already had this exact file: nothing new was stored, this is the one you have. */
  @IsBoolean()
  duplicate: boolean;
}
