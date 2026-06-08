import { AccessGrant } from '@prisma/client';

import { GrantResponse } from '../responses';

export class GrantMapper {
  static toResponse(grant: AccessGrant): GrantResponse {
    return {
      id: grant.id,
      userId: grant.userId,
      tier: grant.tier,
      source: grant.source,
      startedAt: grant.startedAt,
      expiresAt: grant.expiresAt,
      reference: grant.reference,
      createdAt: grant.createdAt,
      updatedAt: grant.updatedAt,
    };
  }
}
