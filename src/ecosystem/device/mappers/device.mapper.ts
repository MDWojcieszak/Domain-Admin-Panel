import { AppDevice } from '@prisma/client';

import { DeviceResponse } from '../responses';

export class DeviceMapper {
  /** Maps a device WITHOUT userId (responses are always the caller's own). */
  static toResponse(device: AppDevice): DeviceResponse {
    return {
      id: device.id,
      installationId: device.installationId,
      platform: device.platform,
      name: device.name,
      activatedAt: device.activatedAt,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      licenseExpiresAt: device.licenseExpiresAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
