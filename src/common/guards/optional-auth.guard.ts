import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Decodes a Bearer token when present and exposes the payload as
 * `request.optionalUser`, but NEVER rejects — anonymous and invalid-token
 * requests pass through with `optionalUser = null`. Use on @Public() endpoints
 * that personalize behaviour for logged-in viewers (e.g. paywall tier).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      request['optionalUser'] = null;
      return true;
    }

    try {
      request['optionalUser'] = await this.jwtService.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
      });
    } catch {
      request['optionalUser'] = null; // invalid/expired => treat as anonymous
    }

    return true;
  }
}
