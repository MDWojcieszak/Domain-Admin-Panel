import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyType } from '@prisma/client';
import * as argon2 from 'argon2';
import { TOKEN_KEY } from '../decorators';

const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.EXTERNAL_TOKEN_KEY!, 'hex');

@Injectable()
export class TokenGuard implements CanActivate {
  private readonly logger = new Logger(TokenGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTokenTypes = this.reflector.getAllAndOverride<ApiKeyType[]>(
      TOKEN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredTokenTypes) {
      return true;
    }

    if (
      !requiredTokenTypes.every(
        (type) => type === ApiKeyType.AI || type === ApiKeyType.INTERNAL,
      )
    ) {
      throw new ForbiddenException(
        'Only AI or INTERNAL token types are allowed for this endpoint',
      );
    }

    const req = context.switchToHttp().getRequest();
    const authHeader =
      req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid authorization header',
      );
    }
    const token = authHeader.split(' ')[1];
    if (!token) throw new UnauthorizedException('Missing token');

    const apiKeys = await this.prisma.apiKey.findMany({
      where: {
        type: { in: requiredTokenTypes },
        expiresAt: { gte: new Date() },
      },
    });

    for (const apiKey of apiKeys) {
      try {
        if (await argon2.verify(apiKey.value, token)) {
          req.tokenUserId = apiKey.userId;
          req.tokenType = apiKey.type;
          req.tokenId = apiKey.id;
          return true;
        }
      } catch (e) {
        this.logger.warn(
          `TokenGuard: argon2 verification failed for token (id: ${apiKey.id}): ${(e as Error).message}`,
        );
      }
    }

    throw new UnauthorizedException('Invalid or expired token');
  }
}
