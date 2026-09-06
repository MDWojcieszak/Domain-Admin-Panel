import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TOKEN_KEY } from '../decorators';
import { IntegrationTokenService } from '../../integration/integration-token.service';

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private config: ConfigService,
    private integrationTokens: IntegrationTokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const requiredTokenTypes = this.reflector.getAllAndOverride(TOKEN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredTokenTypes) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    // Integration tokens (desktop app, CLI) authenticate the same routes as a
    // session does. `request.user` is filled with the same shape a JWT produces,
    // so @GetCurrentUser and PermissionsGuard need no special casing — except
    // for `scopes`, which PermissionsGuard uses to cap what the token may do.
    if (IntegrationTokenService.looksLikeIntegrationToken(token)) {
      const verified = await this.integrationTokens.verify(token, request.ip);

      if (!verified) {
        throw new UnauthorizedException();
      }

      request['user'] = {
        sub: verified.userId,
        role: verified.role,
        scopes: verified.scopes,
        integrationTokenId: verified.id,
      };
      return true;
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      request['user'] = payload;
    } catch {
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
