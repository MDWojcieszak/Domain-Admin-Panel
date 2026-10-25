import { ApiProperty } from '@nestjs/swagger';
import { DocumentKind } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { DocumentVariant, DOCUMENT_VARIANTS } from '../document-rules';

/** Multipart fields beside the file. A target pins the document as it lands. */
export class UploadDocumentDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: unknown;

  /** From the file name when omitted. */
  @IsString({ optional: true, maxLength: 200 })
  title?: string;

  @IsString({ optional: true, maxLength: 5000 })
  description?: string;

  /** Pin to this project as well; you need to be able to edit it. */
  @IsString({ optional: true })
  projectId?: string;

  /** Or to this task. */
  @IsString({ optional: true })
  taskId?: string;

  /** Or to a part of a build's bill of materials. */
  @IsString({ optional: true })
  bomItemId?: string;

  /** Or to a journal entry. */
  @IsString({ optional: true })
  journalEntryId?: string;
}

export class UpdateDocumentDto {
  @IsString({ optional: true, minLength: 1, maxLength: 200 })
  title?: string;

  @IsString({ optional: true, nullable: true, maxLength: 5000 })
  description?: string | null;
}

export class ListDocumentsQueryDto {
  /** Pinned to this project or any of its tasks. */
  @IsString({ optional: true })
  projectId?: string;

  /** Pinned to this task. Without a target: your own library. */
  @IsString({ optional: true })
  taskId?: string;

  @IsString({ optional: true })
  bomItemId?: string;

  @IsString({ optional: true })
  journalEntryId?: string;

  @IsString({ optional: true, maxLength: 200 })
  q?: string;

  @IsEnum({ enum: { DocumentKind }, optional: true })
  kind?: DocumentKind;
}

/** Exactly one target. */
export class CreateDocumentLinkDto {
  @IsString({ optional: true })
  projectId?: string;

  @IsString({ optional: true })
  taskId?: string;

  @IsString({ optional: true })
  bomItemId?: string;

  @IsString({ optional: true })
  journalEntryId?: string;
}

/** Issued with the document; never built by hand. */
export class DocumentFileQueryDto {
  @IsEnum({
    enum: {
      DocumentVariant: Object.fromEntries(DOCUMENT_VARIANTS.map((v) => [v, v])),
    },
  })
  variant: DocumentVariant;

  @IsString({ pattern: { regex: /^\d+$/ } })
  exp: string;

  @IsString()
  sig: string;

  /** `1` forces a download even for an image or a PDF. */
  @IsString({ optional: true })
  download?: string;
}
