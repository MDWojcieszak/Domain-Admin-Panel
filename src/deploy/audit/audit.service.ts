import { Injectable, Logger } from '@nestjs/common';
import { AuditSource, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Records every configuration change in the deploy module (§13.1).
 *
 * Release history already answers "what was deployed"; this answers "who
 * changed the settings that produced it", which nothing else in the system
 * captures.
 */

export const REDACTED = '***';

export interface FieldChange {
  from: unknown;
  to: unknown;
  changed?: true;
}

export type AuditDiff = Record<string, FieldChange>;

export interface AuditEntry {
  actorId?: string | null;
  source?: AuditSource;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string | null;
  diff?: AuditDiff | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an audit row. Deliberately never throws: losing an audit row is bad,
   * but failing the user's action because the audit write failed is worse, and
   * the caller has usually already committed the change.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          source: entry.source ?? AuditSource.PANEL,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityName: entry.entityName ?? null,
          // FieldChange holds `unknown` values, which TypeScript cannot prove
          // are JSON — they always are, since they come from JSON columns and
          // scalar model fields.
          diff: entry.diff
            ? (entry.diff as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry ${entry.action} for ${entry.entityType}:${entry.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Builds a field-level diff, returning null when nothing changed so callers
   * can skip writing a no-op entry.
   *
   * I12 — a field named in `secretFields` never has its value recorded, only
   * the fact that it changed.
   */
  buildDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    secretFields: string[] = [],
  ): Record<string, FieldChange> | null {
    const secrets = new Set(secretFields);
    const diff: Record<string, FieldChange> = {};

    for (const key of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const from = before[key];
      const to = after[key];

      if (!(key in after)) continue;
      if (this.equal(from, to)) continue;

      diff[key] = secrets.has(key)
        ? { from: REDACTED, to: REDACTED, changed: true }
        : { from: from ?? null, to: to ?? null };
    }

    return Object.keys(diff).length ? diff : null;
  }

  list(entityType: string, entityId: string, take = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Structural comparison good enough for spec/config values, which are JSON
   * scalars, arrays and plain objects. Key order is not significant.
   */
  private equal(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) {
      return (a ?? null) === (b ?? null);
    }
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    return JSON.stringify(this.sorted(a)) === JSON.stringify(this.sorted(b));
  }

  private sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((v) => this.sorted(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, v]) => [key, this.sorted(v)]),
      );
    }
    return value;
  }
}
