import { RedeemCode } from '@prisma/client';

import { RedeemCodeResponse } from '../responses';

export class CodeMapper {
  static toResponse(code: RedeemCode): RedeemCodeResponse {
    return {
      id: code.id,
      code: code.code,
      tier: code.tier,
      durationDays: code.durationDays,
      expiresAt: code.expiresAt,
      redeemedById: code.redeemedById,
      redeemedAt: code.redeemedAt,
      revokedAt: code.revokedAt,
      createdAt: code.createdAt,
      updatedAt: code.updatedAt,
    };
  }
}
