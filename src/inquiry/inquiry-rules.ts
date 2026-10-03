import { createHmac } from 'crypto';
import { InquiryStatus, InquiryTopic } from '@prisma/client';

/**
 * Rules for contact inquiries from the public portfolio. Pure, so spam
 * detection and status stamping are tested without a database.
 */

export const TOPIC_LABEL: Record<InquiryTopic, string> = {
  [InquiryTopic.SESSION]: 'Photo session',
  [InquiryTopic.PRINT]: 'Print',
  [InquiryTopic.LICENSE]: 'Licensing',
  [InquiryTopic.COLLABORATION]: 'Collaboration',
  [InquiryTopic.OTHER]: 'Other',
};

/** More links than this in a contact message is what bots send, not people. */
const MAX_LINKS = 3;

/**
 * Why a submission is spam, or null. Spam is still stored (as SPAM, no email)
 * so a false positive can be rescued from the panel; the visitor always gets
 * the same answer, so a bot learns nothing.
 */
export const spamReason = (input: {
  honeypot?: string | null;
  message: string;
}): string | null => {
  // A field hidden from people; only form-filling bots put anything in it.
  if (input.honeypot && input.honeypot.trim()) return 'honeypot';
  const links = input.message.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (links > MAX_LINKS) return 'too many links';
  return null;
};

/**
 * Salted hash of the sender's IP: enough to recognise a flood from one source,
 * useless for anything else — the raw address is never stored.
 */
export const ipHash = (
  ip: string | undefined,
  secret: string,
): string | null =>
  ip
    ? createHmac('sha256', secret).update(`inquiry-ip:${ip}`).digest('hex')
    : null;

/**
 * Timestamps that follow a status change. Opening (any move off NEW) marks it
 * read, ANSWERED marks it answered; moving back to NEW is "mark as unread".
 * Existing stamps are kept — the first time is the meaningful one.
 */
export const statusStamps = (
  current: { readAt: Date | null; answeredAt: Date | null },
  next: InquiryStatus,
  now: Date = new Date(),
): { readAt?: Date | null; answeredAt?: Date | null } => {
  if (next === InquiryStatus.NEW) return { readAt: null };
  return {
    ...(current.readAt ? {} : { readAt: now }),
    ...(next === InquiryStatus.ANSWERED && !current.answeredAt
      ? { answeredAt: now }
      : {}),
  };
};

export const excerpt = (text: string, max = 200): string => {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

/** mailto link for "reply" in the panel — the answer goes from the owner's mailbox. */
export const replyMailto = (
  email: string,
  topic: InquiryTopic,
  context: string | null,
): string => {
  const subject = `Re: ${TOPIC_LABEL[topic]}${context ? ` — ${context}` : ''}`;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
};
