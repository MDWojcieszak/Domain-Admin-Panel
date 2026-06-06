import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Session } from './types';
import { omitObj } from '../common/helpers';
import { PaginationDto } from '../common/dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  private static readonly LIST_SELECT = {
    id: true,
    browser: true,
    os: true,
    platform: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async getCurrent(sessionId: string) {
    const session = await this.get(sessionId);
    delete session.refreshToken;
    return { ...session, isCurrent: true };
  }

  async getAll(dto: PaginationDto) {
    const total = await this.prisma.session.count();
    const sessions = await this.prisma.session.findMany({
      take: dto.take,
      skip: dto.skip,
      select: SessionService.LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return { sessions, total, params: { ...dto } };
  }

  async getAllForUser(
    dto: PaginationDto,
    userId: string,
    currentSessionId?: string,
  ) {
    const total = await this.prisma.session.count({
      where: { userId },
    });
    const sessions = await this.prisma.session.findMany({
      where: { userId },
      take: dto.take,
      skip: dto.skip,
      select: SessionService.LIST_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
    return {
      sessions: sessions.map((session) => ({
        ...session,
        isCurrent: currentSessionId ? session.id === currentSessionId : false,
      })),
      total,
      params: { ...dto },
    };
  }

  async get(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new ForbiddenException();
    return session;
  }

  /** Revoke one of the caller's OWN sessions (ownership enforced). */
  async revokeOwn(sessionId: string, userId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.delete(session.id);
    return { id: session.id };
  }

  /** Log out everywhere except the caller's current session. */
  async revokeOthers(userId: string, currentSessionId: string) {
    const { count } = await this.prisma.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });
    return { revoked: count };
  }

  /** Admin: revoke any session by id (requires session.manage). */
  async revokeByAdmin(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.delete(session.id);
    return { id: session.id };
  }

  async findMatching(
    sessionData: Omit<Session, 'id' | 'refreshToken'>,
  ): Promise<string | false> {
    const session = await this.prisma.session.findFirst({
      where: {
        AND: [
          { userId: sessionData.userId },
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
