import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccountStatus, User, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from 'src/user/dto';
import { PaginationDto } from '../common/dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserCreatedEvent } from './events';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async get(userId: string): Promise<Omit<User, 'hashPassword'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException();
    delete user.hashPassword;
    return user;
  }

  async find(email: string): Promise<Omit<User, 'hashPassword'>> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) throw new ForbiddenException();
    delete user.hashPassword;
    return user;
  }

  async update(
    userId: string,
    data: Partial<User>,
  ): Promise<Omit<User, 'hashPassword'>> {
    const res = await this.prisma.user.update({
      data: data,
      where: { id: userId },
    });
    delete res.hashPassword;
    return res;
  }

  async getMultiple(dto: PaginationDto) {
    const total = await this.prisma.user.count();
    const users = await this.prisma.user.findMany({
      take: dto.take,
      skip: dto.skip,
      select: {
        id: true,
        createdAt: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return { users, total, params: { ...dto } };
  }

  async create(
    dto: UserDto,
    hashPassword?: string,
    accountStatus?: AccountStatus,
  ) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          role: dto.role,
          firstName: dto.firstName,
          hashPassword,
          lastName: dto.lastName,
          accountStatus: accountStatus || 'CREATED',
        },
      });
      delete user.hashPassword;
      // Only users created WITHOUT a password need the email-verification flow
      // (sets a password via the register link). Users created with a password
      // (e.g. the superuser, created ACTIVE) must not be flipped to verification.
      if (!hashPassword) {
        this.eventEmitter.emit(
          'user.created',
          new UserCreatedEvent(user.id, user.email, user.firstName),
        );
      }
      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ForbiddenException('Credentials taken');
      throw error;
    }
  }
}
