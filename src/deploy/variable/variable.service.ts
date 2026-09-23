import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';
import { UpsertVariableDto } from '../dto';

/**
 * Global variables available to every application as `[[KEY]]` (§10).
 *
 * A secret's value never leaves the backend through this service — callers get
 * the key and `isSet` only, which is what makes changing a shared password a
 * single edit rather than a hunt through a dozen applications.
 */

export interface VariableView {
  id: string;
  key: string;
  isSecret: boolean;
  description: string | null;
  /** Present only for non-secret variables. */
  value?: string;
  isSet: boolean;
  updatedAt: Date;
}

@Injectable()
export class VariableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<VariableView[]> {
    const variables = await this.prisma.variable.findMany({
      orderBy: { key: 'asc' },
    });

    return variables.map((variable) => this.toView(variable));
  }

  async upsert(
    dto: UpsertVariableDto,
    actorId?: string,
  ): Promise<VariableView> {
    const isSecret = dto.isSecret === true;
    const existing = await this.prisma.variable.findUnique({
      where: { key: dto.key },
    });

    const value = isSecret ? this.crypto.encrypt(dto.value) : dto.value;

    const variable = await this.prisma.variable.upsert({
      where: { key: dto.key },
      create: {
        key: dto.key,
        value,
        isSecret,
        description: dto.description ?? null,
      },
      update: { value, isSecret, description: dto.description ?? null },
    });

    const diff = this.audit.buildDiff(
      existing
        ? {
            value: existing.value,
            isSecret: existing.isSecret,
            description: existing.description,
          }
        : {},
      {
        value: variable.value,
        isSecret: variable.isSecret,
        description: variable.description,
      },
      // The value column is redacted whenever either side is a secret.
      isSecret || existing?.isSecret ? ['value'] : [],
    );

    await this.audit.record({
      actorId,
      action: existing ? 'variable.update' : 'variable.create',
      entityType: 'Variable',
      entityId: variable.id,
      entityName: variable.key,
      diff,
    });

    return this.toView(variable);
  }

  async remove(id: string, actorId?: string): Promise<void> {
    const variable = await this.prisma.variable.findUnique({ where: { id } });
    if (!variable) throw new NotFoundException('Variable not found');

    await this.prisma.variable.delete({ where: { id } });

    await this.audit.record({
      actorId,
      action: 'variable.delete',
      entityType: 'Variable',
      entityId: id,
      entityName: variable.key,
    });
  }

  private toView(variable: {
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
    description: string | null;
    updatedAt: Date;
  }): VariableView {
    return {
      id: variable.id,
      key: variable.key,
      isSecret: variable.isSecret,
      description: variable.description,
      // §10.4 — a secret value is never returned, for any caller.
      value: variable.isSecret ? undefined : variable.value,
      isSet: variable.value.length > 0,
      updatedAt: variable.updatedAt,
    };
  }
}
