import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const ALLOWED_USER_TYPES_KEY = 'allowedUserTypes';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session;

    console.log('SessionGuard.canActivate. session', session);

    if (!session || !session.userId) {
      throw new UnauthorizedException('Authentication required');
    }

    console.log('SessionGuard.canActivate. session.type', session.type);

    // Get allowed types from metadata
    const allowedTypes = this.reflector.get<string[]>(
      ALLOWED_USER_TYPES_KEY,
      context.getHandler(),
    );

    // If allowedTypes is provided, check user type
    if (allowedTypes && allowedTypes.length > 0) {
      const userType = session.type;
      if (!userType || !allowedTypes.includes(userType)) {
        throw new ForbiddenException(
          `Access denied. Required user type: ${allowedTypes.join(' or ')}`,
        );
      }
    }

    return true;
  }
}
