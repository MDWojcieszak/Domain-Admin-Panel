import { ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * Reads the optionally-decoded user populated by OptionalAuthGuard. Returns null
 * (never throws) when there is no authenticated viewer, unlike GetCurrentUser.
 */
export const GetOptionalUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.optionalUser ?? null;
    if (!data) return user;
    return user ? (user[data] ?? null) : null;
  },
);
