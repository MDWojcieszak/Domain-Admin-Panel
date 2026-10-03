import { InquiryStatus, InquiryTopic } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PaginationDto } from '../common/dto/pagination.dto';

/** The public contact form. */
export class CreateInquiryDto {
  @IsString({ minLength: 1, maxLength: 120 })
  name: string;

  @IsString({ isEmail: true, maxLength: 254 })
  email: string;

  @IsString({
    optional: true,
    maxLength: 40,
    pattern: { regex: /^[+0-9 ()-]*$/ },
  })
  phone?: string;

  @IsEnum({ enum: { InquiryTopic } })
  topic: InquiryTopic;

  @IsString({ minLength: 10, maxLength: 5000 })
  message: string;

  /** The gallery the visitor asks about (optional). */
  @IsString({ optional: true })
  galleryId?: string;

  /** The photo the visitor asks about (optional). */
  @IsString({ optional: true })
  imageId?: string;

  /**
   * "I have read the privacy notice" — must be true. Not a consent: the data
   * is processed to answer the inquiry; this records the information duty.
   */
  @IsBoolean()
  acknowledgedPrivacyNotice: boolean;

  /** Language of the page (e.g. "en"); unknown or missing = the default one. */
  @IsString({ optional: true, maxLength: 16 })
  locale?: string;

  /**
   * Honeypot: render it hidden (off-screen, `tabindex=-1`, `autocomplete=off`)
   * and always send it empty. People never fill it; bots do.
   */
  @IsString({ optional: true, maxLength: 500 })
  website?: string;
}

export class GetInquiriesQueryDto extends PaginationDto {
  /** Omit for the inbox: everything except ARCHIVED and SPAM. */
  @IsEnum({ enum: { InquiryStatus }, optional: true })
  status?: InquiryStatus;

  @IsEnum({ enum: { InquiryTopic }, optional: true })
  topic?: InquiryTopic;

  /** Matches name, email or message. */
  @IsString({ optional: true, maxLength: 200 })
  search?: string;
}

export class PatchInquiryDto {
  /** NEW = mark as unread; READ, ANSWERED, ARCHIVED, SPAM. */
  @IsEnum({ enum: { InquiryStatus }, optional: true })
  status?: InquiryStatus;

  /** Owner's own note; null clears it. */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @IsString({ optional: true, nullable: true, maxLength: 5000 })
  internalNote?: string | null;
}

/** Texts of the form in one language. */
export class ContactTextDto {
  /** A language of the site (BlogLocale), e.g. "pl", "en". */
  @IsString({ maxLength: 16 })
  locale: string;

  @IsString({ optional: true, nullable: true, maxLength: 2000 })
  intro?: string | null;

  /** Markdown. A real change bumps this language's privacyNoticeVersion. */
  @IsString({ optional: true, nullable: true, maxLength: 20000 })
  privacyNotice?: string | null;
}

/** Contact form configuration; omitted fields stay, null clears a text. */
export class UpdateContactSettingsDto {
  /** Refused while the administrator or the privacy notice is missing. */
  @IsBoolean({ optional: true })
  enabled?: boolean;

  @IsString({ optional: true, nullable: true, maxLength: 200 })
  administratorName?: string | null;

  @IsString({ optional: true, nullable: true, isEmail: true, maxLength: 254 })
  administratorEmail?: string | null;

  @IsString({ optional: true, nullable: true, maxLength: 500 })
  administratorAddress?: string | null;

  /**
   * Per-language texts to set; languages not listed stay as they are. Clearing
   * both texts of a language removes it (it falls back to the default one).
   */
  @IsNested({ type: ContactTextDto, isArray: true, optional: true })
  translations?: ContactTextDto[];

  /** Topics offered on the form, in order; empty = all. */
  @IsEnum({ enum: { InquiryTopic }, isArray: true, optional: true })
  topics?: InquiryTopic[];

  /** 30–3650: days after the last change an inquiry is deleted. */
  @IsNumber({ type: 'integer', optional: true })
  retentionDays?: number;

  /** 1–365: days after arrival spam is deleted. */
  @IsNumber({ type: 'integer', optional: true })
  spamRetentionDays?: number;
}
