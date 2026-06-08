import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppDevice } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AccessTierResolver } from '../access/access-tier-resolver.service';
import { LicenseService } from '../license/license.service';
import { GetDevicesQueryDto, RegisterDeviceDto } from './dto';
import {
  DeviceListResponse,
  DeviceResponse,
  DeviceWithLicenseResponse,
  LicenseResponse,
} from './responses';
import { DeviceMapper } from './mappers';

const MAX_ACTIVE_DEVICES = 2;

@Injectable()
export class DeviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessTierResolver: AccessTierResolver,
    private readonly licenseService: LicenseService,
  ) {}

  /** Activate (new) or renew (same installation) a device, then issue a license. */
  async register(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceWithLicenseResponse> {
    const now = new Date();
    const licenseExpiresAt = new Date(
      now.getTime() + this.licenseService.ttlDays * 86_400_000,
    );

    const device = await this.prisma.$transaction(async (tx) => {
      // Serialize this user's registrations so the count-then-create below is
      // atomic (no DB unique on the active-count). Released on commit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext('blog-device'))`;

      const existing = await tx.appDevice.findUnique({
        where: {
          userId_installationId: {
            userId,
            installationId: dto.installationId,
          },
        },
      });

      if (existing) {
        // Renew the same installation — does NOT count as a new device.
        return tx.appDevice.update({
          where: { id: existing.id },
          data: {
            platform: dto.platform,
            name: dto.name ?? existing.name,
            activatedAt: now,
            lastSeenAt: now,
            revokedAt: null,
            licenseExpiresAt,
          },
        });
      }

      const activeCount = await tx.appDevice.count({
        where: { userId, revokedAt: null },
      });
      if (activeCount >= MAX_ACTIVE_DEVICES) {
        throw new ConflictException(
          `Active device limit reached (max ${MAX_ACTIVE_DEVICES})`,
        );
      }

      return tx.appDevice.create({
        data: {
          userId,
          installationId: dto.installationId,
          platform: dto.platform,
          name: dto.name ?? null,
          activatedAt: now,
          lastSeenAt: now,
          licenseExpiresAt,
        },
      });
    });

    const license = await this.issueLicense(userId, device, licenseExpiresAt);
    return { device: DeviceMapper.toResponse(device), license };
  }

  async listMine(
    userId: string,
    query: GetDevicesQueryDto,
  ): Promise<DeviceListResponse> {
    const [devices, total] = await this.prisma.$transaction([
      this.prisma.appDevice.findMany({
        where: { userId },
        orderBy: { activatedAt: 'desc' },
        take: query.take,
        skip: query.skip,
      }),
      this.prisma.appDevice.count({ where: { userId } }),
    ]);
    return { total, devices: devices.map((d) => DeviceMapper.toResponse(d)) };
  }

  async getMine(userId: string, id: string): Promise<DeviceResponse> {
    return DeviceMapper.toResponse(await this.getOwnDeviceOrThrow(userId, id));
  }

  async revoke(userId: string, id: string): Promise<DeviceResponse> {
    const device = await this.getOwnDeviceOrThrow(userId, id);
    const updated = await this.prisma.appDevice.update({
      where: { id },
      data: { revokedAt: device.revokedAt ?? new Date() },
    });
    return DeviceMapper.toResponse(updated);
  }

  /** Online renewal: extend the offline window and re-sign (active devices only). */
  async fetchLicense(userId: string, id: string): Promise<LicenseResponse> {
    const device = await this.getOwnDeviceOrThrow(userId, id);
    if (device.revokedAt) {
      throw new NotFoundException(
        'Device is revoked; re-register to reactivate',
      );
    }
    const now = new Date();
    const licenseExpiresAt = new Date(
      now.getTime() + this.licenseService.ttlDays * 86_400_000,
    );
    const updated = await this.prisma.appDevice.update({
      where: { id },
      data: { lastSeenAt: now, licenseExpiresAt },
    });
    return this.issueLicense(userId, updated, licenseExpiresAt);
  }

  // ----- helpers -----

  private async issueLicense(
    userId: string,
    device: AppDevice,
    licenseExpiresAt: Date,
  ): Promise<LicenseResponse> {
    const tier = await this.accessTierResolver.effectiveTier(userId);
    const signed = this.licenseService.signLicense({
      userId,
      deviceId: device.id,
      installationId: device.installationId,
      tier,
      expiresAt: licenseExpiresAt,
    });
    return { license: signed.license, expiresAt: signed.expiresAt };
  }

  /** Loads a device and asserts ownership; 404 (not 403) on mismatch — no oracle. */
  private async getOwnDeviceOrThrow(
    userId: string,
    id: string,
  ): Promise<AppDevice> {
    const device = await this.prisma.appDevice.findUnique({ where: { id } });
    if (!device || device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }
    return device;
  }
}
