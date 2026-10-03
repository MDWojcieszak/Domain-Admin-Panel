import { InquiryStatus, InquiryTopic } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

const n = { optional: true, nullable: true } as const;

/** What the visitor gets back — the same whether it was spam or not. */
export class InquiryReceivedResponse {
  @IsBoolean()
  received: boolean;
}

export class InquiryGalleryRefResponse {
  @IsString() id: string;
  @IsString() title: string;
  @IsString() slug: string;
}

export class InquiryImageRefResponse {
  @IsString() id: string;
  @IsString() thumbUrl: string;
  @IsString() coverUrl: string;
}

export class InquiryResponse {
  @IsString() id: string;
  @IsString() name: string;
  @IsString() email: string;
  @IsString(n) phone: string | null;

  @IsEnum({ enum: { InquiryTopic } })
  topic: InquiryTopic;

  @IsString() message: string;

  @IsEnum({ enum: { InquiryStatus } })
  status: InquiryStatus;

  @IsNested({ type: InquiryGalleryRefResponse, ...n })
  gallery: InquiryGalleryRefResponse | null;

  @IsNested({ type: InquiryImageRefResponse, ...n })
  image: InquiryImageRefResponse | null;

  @IsString(n) internalNote: string | null;

  /** Opens the owner's mail client with the address and subject filled in. */
  @IsString() replyMailto: string;

  @IsDate({ format: 'date-time', ...n }) readAt: Date | null;
  @IsDate({ format: 'date-time', ...n }) answeredAt: Date | null;
  /** When the sender confirmed the privacy notice, and which version. */
  @IsDate({ format: 'date-time' }) noticeAcknowledgedAt: Date;
  @IsString() privacyNoticeLocale: string;
  @IsNumber({ type: 'integer' }) privacyNoticeVersion: number;

  /** Language of the form the visitor used — answer in it. */
  @IsString() locale: string;
  @IsDate({ format: 'date-time' }) createdAt: Date;
}

export class InquiryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: InquiryResponse, isArray: true })
  inquiries: InquiryResponse[];
}

/** For the badge in the panel navigation. */
export class InquirySummaryResponse {
  @IsNumber({ type: 'integer' })
  new: number;

  /** NEW + READ — not answered, archived or spam yet. */
  @IsNumber({ type: 'integer' })
  open: number;

  @IsNumber({ type: 'integer' })
  spam: number;
}

export class ContactAdministratorResponse {
  @IsString() name: string;
  @IsString() email: string;
  @IsString(n) address: string | null;
}

/** What the public page needs to render the form and its privacy notice. */
export class PublicContactResponse {
  /** Hide the form when false. */
  @IsBoolean() enabled: boolean;

  /** The language these texts were resolved for. */
  @IsString() locale: string;

  @IsString(n) intro: string | null;

  @IsEnum({ enum: { InquiryTopic }, isArray: true })
  topics: InquiryTopic[];

  /** Markdown — render it next to the acknowledgement checkbox. */
  @IsString(n) privacyNotice: string | null;
  @IsString(n) privacyNoticeLocale: string | null;
  @IsNumber({ type: 'integer', ...n }) privacyNoticeVersion: number | null;

  /** True when the notice is in the default language, not the requested one. */
  @IsBoolean() privacyNoticeFallback: boolean;

  @IsNested({ type: ContactAdministratorResponse, ...n })
  administrator: ContactAdministratorResponse | null;
}

export class ContactTextResponse {
  @IsString() locale: string;
  @IsString(n) intro: string | null;

  /** As written, with placeholders like {{administratorEmail}}. */
  @IsString(n) privacyNotice: string | null;

  /** Preview: what visitors read, placeholders filled from the settings. */
  @IsString(n) privacyNoticeRendered: string | null;

  @IsNumber({ type: 'integer' }) privacyNoticeVersion: number;
  @IsDate({ format: 'date-time', ...n }) privacyNoticeUpdatedAt: Date | null;
}

export class ContactSettingsResponse {
  @IsBoolean() enabled: boolean;

  /** Language whose notice is required and used as the fallback. */
  @IsString() defaultLocale: string;

  /** Fields still blocking `enabled: true`. */
  @IsString({ isArray: true }) missingForEnable: string[];

  /** Site languages still showing the default-language notice. */
  @IsString({ isArray: true }) localesWithoutNotice: string[];

  @IsString(n) administratorName: string | null;
  @IsString(n) administratorEmail: string | null;
  @IsString(n) administratorAddress: string | null;

  @IsNested({ type: ContactTextResponse, isArray: true })
  translations: ContactTextResponse[];

  @IsEnum({ enum: { InquiryTopic }, isArray: true })
  topics: InquiryTopic[];

  @IsNumber({ type: 'integer' }) retentionDays: number;
  @IsNumber({ type: 'integer' }) spamRetentionDays: number;
  @IsDate({ format: 'date-time' }) updatedAt: Date;
}
