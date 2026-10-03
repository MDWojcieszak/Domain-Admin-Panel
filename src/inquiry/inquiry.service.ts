import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  GalleryStatus,
  ImageScope,
  InquiryStatus,
  Prisma,
} from '@prisma/client';

import { PERMISSIONS } from '../common/acl/permissions';
import { NotificationService } from '../notification/notification.service';
import { offeredTopics } from './contact-settings-rules';
import { ContactSettingsService } from './contact-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInquiryDto, GetInquiriesQueryDto, PatchInquiryDto } from './dto';
import {
  excerpt,
  ipHash,
  replyMailto,
  spamReason,
  statusStamps,
  TOPIC_LABEL,
} from './inquiry-rules';
import {
  InquiryListResponse,
  InquiryReceivedResponse,
  InquiryResponse,
  InquirySummaryResponse,
} from './responses';

const INCLUDE = {
  gallery: { select: { id: true, title: true, slug: true } },
  image: { select: { id: true } },
} satisfies Prisma.InquiryInclude;

type InquiryRow = Prisma.InquiryGetPayload<{ include: typeof INCLUDE }>;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class InquiryService {
  private readonly logger = new Logger(InquiryService.name);
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly settings: ContactSettingsService,
    config: ConfigService,
  ) {
    this.secret = config.get<string>('JWT_SECRET') || 'inquiry-dev-secret';
  }

  // ------------------------------------------------------------- public

  async create(
    dto: CreateInquiryDto,
    meta: { ip?: string },
  ): Promise<InquiryReceivedResponse> {
    const settings = await this.settings.row();
    const notice = await this.settings.noticeFor(dto.locale);
    if (!settings.enabled || !notice) {
      throw new ForbiddenException('The contact form is not available');
    }
    if (dto.acknowledgedPrivacyNotice !== true) {
      throw new BadRequestException(
        'Confirm you have read the privacy notice to send the message',
      );
    }
    if (!offeredTopics(settings.topics).includes(dto.topic)) {
      throw new BadRequestException('This topic is not offered');
    }
    await this.assertPublicContext(dto.galleryId, dto.imageId);

    const spam = spamReason({ honeypot: dto.website, message: dto.message });
    const inquiry = await this.prisma.inquiry.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        topic: dto.topic,
        message: dto.message.trim(),
        galleryId: dto.galleryId ?? null,
        imageId: dto.imageId ?? null,
        status: spam ? InquiryStatus.SPAM : InquiryStatus.NEW,
        internalNote: spam ? `Marked as spam automatically: ${spam}` : null,
        // The version shown on the page now is the one the sender confirmed.
        noticeAcknowledgedAt: new Date(),
        privacyNoticeLocale: notice.noticeLocale,
        privacyNoticeVersion: notice.version,
        locale: notice.locale,
        ipHash: ipHash(meta.ip, this.secret),
      },
      include: INCLUDE,
    });

    // Fire and forget: a mail outage must not fail the visitor's submission.
    if (!spam) void this.notifyOwner(inquiry);

    return { received: true };
  }

  // -------------------------------------------------------------- panel

  async list(query: GetInquiriesQueryDto): Promise<InquiryListResponse> {
    const search = query.search?.trim();
    const where: Prisma.InquiryWhereInput = {
      status: query.status ?? {
        notIn: [InquiryStatus.ARCHIVED, InquiryStatus.SPAM],
      },
      ...(query.topic ? { topic: query.topic } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { message: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inquiry.count({ where }),
      this.prisma.inquiry.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: query.take ?? 20,
        skip: query.skip,
      }),
    ]);
    return { total, inquiries: rows.map(toResponse) };
  }

  async summary(): Promise<InquirySummaryResponse> {
    const [fresh, read, spam] = await this.prisma.$transaction([
      this.prisma.inquiry.count({ where: { status: InquiryStatus.NEW } }),
      this.prisma.inquiry.count({ where: { status: InquiryStatus.READ } }),
      this.prisma.inquiry.count({ where: { status: InquiryStatus.SPAM } }),
    ]);
    return { new: fresh, open: fresh + read, spam };
  }

  async get(id: string): Promise<InquiryResponse> {
    return toResponse(await this.getOrThrow(id));
  }

  async patch(id: string, dto: PatchInquiryDto): Promise<InquiryResponse> {
    const existing = await this.getOrThrow(id);
    const updated = await this.prisma.inquiry.update({
      where: { id },
      data: {
        ...(dto.status
          ? { status: dto.status, ...statusStamps(existing, dto.status) }
          : {}),
        internalNote: dto.internalNote,
      },
      include: INCLUDE,
    });
    return toResponse(updated);
  }

  async remove(id: string): Promise<{ id: string }> {
    await this.getOrThrow(id);
    await this.prisma.inquiry.delete({ where: { id } });
    return { id };
  }

  /**
   * GDPR retention, from the panel settings: every inquiry goes a set time
   * after its last change, whatever its status — an answered conversation
   * lives on in the owner's mailbox, not here. Spam goes much sooner.
   */
  @Cron('30 3 * * *')
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { retentionDays, spamRetentionDays } = await this.settings.row();
    const before = (days: number) => new Date(now.getTime() - days * DAY_MS);
    const { count } = await this.prisma.inquiry.deleteMany({
      where: {
        OR: [
          {
            status: InquiryStatus.SPAM,
            createdAt: { lt: before(spamRetentionDays) },
          },
          {
            status: { not: InquiryStatus.SPAM },
            updatedAt: { lt: before(retentionDays) },
          },
        ],
      },
    });
    if (count > 0) this.logger.log(`Purged ${count} expired inquiry(ies)`);
    return count;
  }

  // ------------------------------------------------------------ helpers

  /**
   * A visitor can only point at what is public: a PUBLISHED gallery, a photo
   * in one. The same vague error for every miss — no probing of drafts.
   */
  private async assertPublicContext(galleryId?: string, imageId?: string) {
    if (galleryId) {
      const ok = await this.prisma.gallery.count({
        where: { id: galleryId, status: GalleryStatus.PUBLISHED },
      });
      if (!ok) throw new BadRequestException('Unknown gallery or photo');
    }
    if (imageId) {
      const ok = await this.prisma.image.count({
        where: {
          id: imageId,
          scope: ImageScope.GALLERY,
          galleryItems: {
            some: {
              gallery: { status: GalleryStatus.PUBLISHED },
              ...(galleryId ? { galleryId } : {}),
            },
          },
        },
      });
      if (!ok) throw new BadRequestException('Unknown gallery or photo');
    }
  }

  private async getOrThrow(id: string): Promise<InquiryRow> {
    const row = await this.prisma.inquiry.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!row) throw new NotFoundException('Inquiry not found');
    return row;
  }

  private async notifyOwner(inquiry: InquiryRow): Promise<void> {
    const about = inquiry.gallery
      ? ` about "${inquiry.gallery.title}"${inquiry.imageId ? ' (a photo)' : ''}`
      : inquiry.imageId
        ? ' about a photo'
        : '';
    const phone = inquiry.phone ? `, ${inquiry.phone}` : '';
    await this.notifications.emailUsers({
      setting: 'inquiryEmailNotifications',
      permission: PERMISSIONS.INQUIRY_READ,
      logType: 'INQUIRY_NEW',
      subject: `New inquiry [${inquiry.locale.toUpperCase()}]: ${TOPIC_LABEL[inquiry.topic]} from ${inquiry.name}`,
      subjectName: inquiry.name,
      headline: `sent an inquiry${about}`,
      detail:
        `${TOPIC_LABEL[inquiry.topic]} · ${inquiry.email}${phone} — ` +
        excerpt(inquiry.message),
      meta: { inquiryId: inquiry.id },
    });
  }
}

const toResponse = (row: InquiryRow): InquiryResponse => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  topic: row.topic,
  message: row.message,
  status: row.status,
  gallery: row.gallery,
  image: row.image
    ? {
        id: row.image.id,
        thumbUrl: `/image/thumb?id=${row.image.id}`,
        coverUrl: `/image/cover?id=${row.image.id}`,
      }
    : null,
  internalNote: row.internalNote,
  replyMailto: replyMailto(row.email, row.topic, row.gallery?.title ?? null),
  readAt: row.readAt,
  answeredAt: row.answeredAt,
  noticeAcknowledgedAt: row.noticeAcknowledgedAt,
  privacyNoticeLocale: row.privacyNoticeLocale,
  privacyNoticeVersion: row.privacyNoticeVersion,
  locale: row.locale,
  createdAt: row.createdAt,
});
