import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const session = request.session;

    if (!session || !session.userId) {
      return null;
    }

    return {
      id: session.userId,
      username: session.username,
      email: session.email,
      type: session.type,
    };
  },
);
