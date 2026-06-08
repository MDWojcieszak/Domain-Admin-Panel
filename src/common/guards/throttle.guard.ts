import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { THROTTLE_KEY, ThrottleConfig } from '../decorators/throttle.decorator';

/**
 * Dependency-free in-memory rate limiter (sliding window). Applied per-route via
 * `@Throttle(limit, windowMs)` + `@UseGuards(ThrottleGuard)`. Keyed by the
 * authenticated user id (set by the global AuthorizationGuard, which runs first)
 * and falls back to the request IP. Single-instance only — swap for a shared
 * store (Redis / @nestjs/throttler) if the API is ever horizontally scaled.
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const cfg = this.reflector.get<ThrottleConfig>(
      THROTTLE_KEY,
      context.getHandler(),
    );
    if (!cfg) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const id = req.user?.sub ?? req.ip ?? 'anonymous';
    const key = `${context.getClass().name}.${context.getHandler().name}:${id}`;

    const now = Date.now();
    const windowStart = now - cfg.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= cfg.limit) {
      throw new HttpException(
        'Too many requests, please slow down',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.hits.set(key, recent);

    if (this.hits.size > 10_000) {
      this.sweep(windowStart);
    }
    return true;
  }

  /** Drops empty/expired buckets to bound memory under key churn. */
  private sweep(cutoff: number): void {
    for (const [key, times] of this.hits) {
      const live = times.filter((t) => t > cutoff);
      if (live.length) {
        this.hits.set(key, live);
      } else {
        this.hits.delete(key);
      }
    }
  }
}
