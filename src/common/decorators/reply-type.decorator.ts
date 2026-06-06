import 'reflect-metadata';

/**
 * Declares the reply payload of a request/reply (@MessagePattern) handler so the
 * AsyncAPI generator can document it (AsyncAPI 2.6 has no native reply, so it is
 * emitted as `x-reply` on the operation). Reflection cannot recover the type
 * from `Promise<T[]>`, hence the explicit declaration.
 */
export const REPLY_TYPE_METADATA = 'messaging:reply_type';

export interface ReplyTypeMeta {
  type: Function;
  isArray: boolean;
}

export function ReplyType(
  type: Function,
  options?: { isArray?: boolean },
): MethodDecorator {
  return (_target, _key, descriptor) => {
    Reflect.defineMetadata(
      REPLY_TYPE_METADATA,
      { type, isArray: options?.isArray ?? false } satisfies ReplyTypeMeta,
      descriptor.value as object,
    );
    return descriptor;
  };
}
