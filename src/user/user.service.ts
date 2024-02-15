import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { hash } from 'argon2';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserDto } from 'src/user/dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string): Promise<Omit<User, 'hashPassword'>> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException();
    delete user.hashPassword;
    return user;
  }

  async create(dto: UserDto) {
    const hashPassword = await hash(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          hashPassword,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
      delete user.hashPassword;
      return user;
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ForbiddenException('Credentials taken');
      throw error;
    }
  }
}
