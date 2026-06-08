import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle:config';

export interface ThrottleConfig {
  /** Max requests allowed within the window. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
}

/**
 * Rate-limits a route to `limit` requests per `windowMs`, keyed per user (or IP
 * when anonymous). Requires `@UseGuards(ThrottleGuard)` on the route/controller.
 */
export const Throttle = (limit: number, windowMs: number) =>
  SetMetadata(THROTTLE_KEY, { limit, windowMs } satisfies ThrottleConfig);
