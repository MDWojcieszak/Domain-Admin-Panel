import { SetMetadata } from '@nestjs/common';
import { ApiKeyType } from '@prisma/client';

export const TOKEN_KEY = 'token_types';
export type AllowedApiKeyType =
  | typeof ApiKeyType.AI
  | typeof ApiKeyType.INTERNAL;

export const Token = (types: AllowedApiKeyType[]) =>
  SetMetadata(TOKEN_KEY, types);
