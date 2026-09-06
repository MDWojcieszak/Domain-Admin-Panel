import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Rejects requests authenticated by an integration token, allowing only a real
 * signed-in session.
 *
 * Put this on anything that mints or manages credentials. Without it a token
 * scoped to, say, `photoEntry.read` could call the token-creation endpoint and
 * issue itself a second token with wider scopes — the scope cap only limits
 * what a token *does*, not what it can *ask for*.
 */
@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (user?.integrationTokenId) {
      throw new ForbiddenException(
        'This endpoint requires a signed-in session, not an integration token',
      );
    }

    return true;
  }
}
