import { BadRequestException, Injectable } from '@nestjs/common';
import { Server } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves which registered server the deploy agent is speaking for.
 *
 * Today the homelab is a single host, but the model already carries several
 * (`Server` predates this module), so the ambiguity is refused rather than
 * guessed: picking "the first one" would silently act on the wrong machine the
 * day a second agent appears.
 */
@Injectable()
export class AgentServerService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(serverId?: string): Promise<Server> {
    if (serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: serverId, isDeleted: false },
      });
      if (!server) throw new BadRequestException('Server not found');
      return server;
    }

    const servers = await this.prisma.server.findMany({
      where: { isDeleted: false },
      take: 2,
      orderBy: { createdAt: 'asc' },
    });

    if (servers.length === 0) {
      throw new BadRequestException(
        'No server is registered; the deploy agent has to register first.',
      );
    }
    if (servers.length > 1) {
      throw new BadRequestException(
        'Several servers are registered — pass serverId to say which host to act on.',
      );
    }

    return servers[0];
  }

  /** Resolves the server backing an application, via its server category. */
  async forApplication(applicationId: string): Promise<Server> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      select: { serverCategory: { select: { server: true } } },
    });

    if (!application) throw new BadRequestException('Application not found');

    return application.serverCategory.server;
  }
}
