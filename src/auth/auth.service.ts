import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  AuthDto,
  RegisterDto,
  RequestResetPasswordDto,
  ResetPasswordDto,
} from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hash, verify } from 'argon2';
import { Tokens } from './types';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { SessionService } from '../session/session.service';
import { v4 as uuid } from 'uuid';
import { MailService } from '../mail/mail.service';
import { UserCreatedEvent } from '../user/events';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private userService: UserService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private mailService: MailService,
  ) {}

  async signIn(dto: AuthDto): Promise<Tokens> {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (!user || !user.hashPassword)
      throw new ForbiddenException('Credentials incorrect');
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

  async initiateRegister(event: UserCreatedEvent) {
    try {
      const registerToken = await this.createToken(
        {
          sub: event.id,
        },
        'JWT_REGISTER_SECRET',
        60 * 60 * 12,
      );
      await this.mailService.sendUserConfirmation({
        email: event.email,
        firstName: event.firstName,
        accessLink: `${this.config.get<string>('APP_URL')}/register?token=${registerToken}`,
      });
      this.userService.update(event.id, {
        accountStatus: 'EMAIL_VERIFICATION',
      });
    } catch (e) {
      throw new ForbiddenException();
    }
  }

  async register(userId: string, dto: RegisterDto) {
    const user = await this.userService.get(userId);
    if (user.accountStatus !== 'EMAIL_VERIFICATION')
      throw new ForbiddenException();
    const hashPassword = await hash(dto.password);
    const changed = await this.userService.update(user.id, {
      hashPassword,
      accountStatus: 'ACTIVE',
    });

    return changed;
  }

  async initiatePasswordReset(dto: RequestResetPasswordDto) {
    try {
      const user = await this.userService.find(dto.email);
      const resetPasswordToken = await this.createToken(
        {
          sub: user.id,
        },
        'JWT_RESET_PASSWORD_SECRET',
        60 * 15,
      );

      await this.mailService.sendUserResetPassword({
        email: user.email,
        firstName: user.firstName,
        resetLink: `${this.config.get<string>('APP_URL')}/reset-password?token=${resetPasswordToken}`,
      });
    } catch (e) {
      throw new ForbiddenException();
    }
  }

  async resetPassword(userId: string, dto: ResetPasswordDto) {
    try {
      const user = await this.userService.get(userId);
    } catch (e) {
      throw new ForbiddenException();
    }
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
      this.createToken(
        {
          sub: userId,
          email,
          role,
          sessionId,
        },
        'JWT_SECRET',
        60 * 15,
      ),
      this.createToken(
        {
          sub: userId,
          email,
          role,
          sessionId,
        },
        'JWT_REFRESH_SECRET',
        60 * 60 * 24 * 7,
      ),
    ]);
    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async createToken(payload: object, secret: string, expiration: number) {
    return await this.jwtService.signAsync(payload, {
      secret: this.config.get(secret),
      expiresIn: expiration,
    });
  }

  async onModuleInit() {
    const superUser = await this.prisma.user.findUnique({
      where: { email: this.config.get('SUPERUSER_EMAIL') },
    });
    if (!superUser) {
      Logger.log('Super User not created, creating...');
      const hashPassword = await hash(this.config.get('SUPERUSER_PASSWORD'));

      this.userService.create(
        {
          firstName: this.config.get('SUPERUSER_FIRSTNAME'),
          lastName: this.config.get('SUPERUSER_LASTNAME'),
          email: this.config.get('SUPERUSER_EMAIL'),
          role: 'OWNER',
        },
        hashPassword,
        'ACTIVE',
      );
    }
  }
}
