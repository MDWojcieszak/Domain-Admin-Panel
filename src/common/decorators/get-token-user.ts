import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetTokenUser = createParamDecorator(
  (property: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (property) {
      return (
        request.tokenUser?.[property] ??
        request[`token${capitalizeFirstLetter(property)}`]
      );
    }
    return request.tokenUser ?? request.tokenUserId;
  },
);

function capitalizeFirstLetter(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
