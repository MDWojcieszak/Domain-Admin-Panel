import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from './types';
import { omitObj } from '../common/helpers';
import { SessionDto } from './dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async getCurrent(sessionId: string) {
    const session = await this.get(sessionId);
    delete session.refreshToken;
    return session;
  }

  async getAllForUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        browser: true,
        os: true,
        platform: true,
        updatedAt: true,
        id: true,
      },
    });
  }

  async get(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new ForbiddenException();
    return session;
  }

  async removeSession(dto: SessionDto) {
    return this.delete(dto.sessionId);
  }

  async findMatching(
    sessionData: Omit<Session, 'id' | 'refreshToken'>,
  ): Promise<string | false> {
    const session = await this.prisma.session.findFirst({
      where: {
        AND: [
          { platform: sessionData.platform },
          { browser: sessionData.browser },
          { os: sessionData.os },
        ],
      },
      select: { id: true },
    });
    if (!session) return false;
    return session.id;
  }

  async create(sessionData: Session): Promise<boolean> {
    try {
      await this.prisma.session.create({
        data: {
          ...omitObj(sessionData, 'userId'),
          user: { connect: { id: sessionData.userId } },
        },
      });
    } catch (e) {
      Logger.error(e);
      throw new InternalServerErrorException();
    }
    return true;
  }

  async update(
    sessionData: Pick<Session, 'id' | 'refreshToken'>,
  ): Promise<boolean> {
    try {
      await this.prisma.session.update({
        data: { refreshToken: sessionData.refreshToken },
        where: { id: sessionData.id },
      });
    } catch (e) {
      Logger.error(e);
      throw new UnprocessableEntityException();
    }
    return true;
  }

  async delete(sessionId: string) {
    try {
      await this.prisma.session.delete({
        where: {
          id: sessionId,
        },
      });
    } catch (e) {
      throw new ForbiddenException();
    }
  }
}
