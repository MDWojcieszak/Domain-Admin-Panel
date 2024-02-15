import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AuthDto } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { verify } from 'argon2';
import { Tokens } from './types';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../session/session.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private userService: UserService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async signIn(dto: AuthDto): Promise<Tokens> {
    const superUserEmail = this.config.get('SUPERUSER_EMAIL');
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user) throw new ForbiddenException('Credentials incorrect');
    const pwMatches = await verify(user.hashPassword, dto.password);
    if (!pwMatches) throw new ForbiddenException('Credentials incorrect');

    const matchingSession = await this.sessionService.findMatching({
      userId: user.id,
      browser: dto.browser,
      platform: dto.platform,
      os: dto.os,
    });
    const userSessionId = uuid();
    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.role,
      matchingSession ? matchingSession : userSessionId,
    );

    if (matchingSession) {
      this.sessionService.update({
        id: matchingSession,
        refreshToken: tokens.refresh_token,
      });
    } else {
      this.sessionService.create({
        browser: dto.browser,
        platform: dto.platform,
        os: dto.os,
        id: userSessionId,
        refreshToken: tokens.refresh_token,
        userId: user.id,
      });
    }

    return tokens;
  }

  async logout(sessionId: string) {
    const session = await this.sessionService.get(sessionId);
    await this.sessionService.delete(session.id);
  }

  async refteshTokens(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<Tokens> {
    const user = await this.userService.get(userId);
    const session = await this.sessionService.get(sessionId);
    const rtMatches = refreshToken === session.refreshToken;
    if (!rtMatches) throw new ForbiddenException();

    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.role,
      session.id,
    );

    this.sessionService.update({
      id: session.id,
      refreshToken: tokens.refresh_token,
    });
    return tokens;
  }

  async getTokens(
    userId: string,
    email: string,
    role: Role,
    sessionId: string,
  ): Promise<Tokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          role,
          sessionId,
        },
        {
          secret: this.config.get('JWT_SECRET'),
          expiresIn: 60 * 15,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          role,
          sessionId,
        },
        {
          secret: this.config.get('JWT_REFRESH_SECRET'),
          expiresIn: 60 * 60 * 24 * 7,
        },
      ),
    ]);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async onModuleInit() {
    const superUser = await this.prisma.user.findUnique({
      where: { email: this.config.get('SUPERUSER_EMAIL') },
    });
    if (!superUser) {
      Logger.log('Super User not created, creating...');
      this.userService.create({
        firstName: this.config.get('SUPERUSER_FIRSTNAME'),
        lastName: this.config.get('SUPERUSER_LASTNAME'),
        email: this.config.get('SUPERUSER_EMAIL'),
        password: this.config.get('SUPERUSER_PASSWORD'),
        role: 'OWNER',
      });
    }
  }
}
