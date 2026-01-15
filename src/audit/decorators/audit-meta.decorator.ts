import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuditMetadata } from '../entities/auditMetadata';

function toHeaderString(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  return null;
}

/**
 * Extracts audit metadata from the current HTTP request.
 *
 * Usage:
 *   handler(@AuditMeta() meta: AuditMeta) { ... }
 */
export const AuditMetaParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuditMetadata => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      (typeof req.socket?.remoteAddress === 'string'
        ? req.socket.remoteAddress
        : null);

    const userAgent = toHeaderString(req.headers?.['user-agent']);

    return {
      ip,
      userAgent,
    };
  },
);
