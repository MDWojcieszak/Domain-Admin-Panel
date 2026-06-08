import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessGrantSource, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { GrantMapper } from '../grant/mappers';
import { CreateCodeDto, GetCodesQueryDto, RedeemCodeDto } from './dto';
import {
  CodeListResponse,
  RedeemCodeResponse,
  RedeemResultResponse,
} from './responses';
import { CodeMapper } from './mappers';

const DAY_MS = 86_400_000;

@Injectable()
export class RedeemService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- admin code management -----

  async createCode(dto: CreateCodeDto): Promise<RedeemCodeResponse> {
    const code = dto.code ? this.normalizeCode(dto.code) : this.generateCode();
    try {
      const created = await this.prisma.redeemCode.create({
        data: {
          code,
          tier: dto.tier,
          durationDays: dto.durationDays,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
      return CodeMapper.toResponse(created);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Code already exists');
      }
      throw err;
    }
  }

  async listCodes(query: GetCodesQueryDto): Promise<CodeListResponse> {
    const [codes, total] = await this.prisma.$transaction([
      this.prisma.redeemCode.findMany({
        orderBy: { createdAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.redeemCode.count(),
    ]);
    return { total, codes: codes.map((c) => CodeMapper.toResponse(c)) };
  }

  async revokeCode(id: string): Promise<RedeemCodeResponse> {
    const code = await this.prisma.redeemCode.findUnique({ where: { id } });
    if (!code) {
      throw new NotFoundException('Code not found');
    }
    const updated = await this.prisma.redeemCode.update({
      where: { id },
      data: { revokedAt: code.revokedAt ?? new Date() },
    });
    return CodeMapper.toResponse(updated);
  }

  // ----- user redeem -----

  async redeem(
    userId: string,
    dto: RedeemCodeDto,
  ): Promise<RedeemResultResponse> {
    const now = new Date();
    const codeValue = this.normalizeCode(dto.code);

    const grant = await this.prisma.$transaction(async (tx) => {
      const code = await tx.redeemCode.findUnique({
        where: { code: codeValue },
      });
      // Generic message — same for missing / redeemed / revoked / expired
      // (no existence oracle).
      if (
        !code ||
        code.redeemedAt !== null ||
        code.revokedAt !== null ||
        (code.expiresAt !== null && code.expiresAt <= now)
      ) {
        throw new BadRequestException('Invalid or unusable code');
      }

      // Atomic claim: only succeeds while still unredeemed/unrevoked. A losing
      // concurrent redeem matches 0 rows and never creates a second grant.
      const claimed = await tx.redeemCode.updateMany({
        where: { id: code.id, redeemedAt: null, revokedAt: null },
        data: { redeemedById: userId, redeemedAt: now },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Code already redeemed');
      }

      return tx.accessGrant.create({
        data: {
          userId,
          tier: code.tier,
          source: AccessGrantSource.REDEEM_CODE,
          startedAt: now,
          expiresAt: code.durationDays
            ? new Date(now.getTime() + code.durationDays * DAY_MS)
            : null,
          reference: code.id,
        },
      });
    });

    return {
      message: 'Code redeemed',
      grant: GrantMapper.toResponse(grant),
    };
  }

  // ----- helpers -----

  private normalizeCode(value: string): string {
    const code = value.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Code cannot be empty');
    }
    return code;
  }

  private generateCode(): string {
    // 16 hex chars, uppercased (e.g. "9F3A1C0B7E2D4A6F").
    return randomBytes(8).toString('hex').toUpperCase();
  }
}
