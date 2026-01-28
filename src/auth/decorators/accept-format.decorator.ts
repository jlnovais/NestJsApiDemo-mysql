import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const AcceptsFormat = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Express's req.accepts(...) returns the best match (string) or false.
    // Normalize to a small set used by controllers: 'json' | 'csv'.
    // If the client doesn't send Accept (or sends */*), prefer json by default.
    const acceptHeader = request.get('accept');
    if (!acceptHeader || acceptHeader.trim() === '*/*') return 'json';

    // Support non-standard Accept values like "csv" (some clients send this).
    // Also handle headers with multiple values like "csv, */*".
    const firstAcceptToken = acceptHeader.split(',')[0]?.trim().toLowerCase();
    if (firstAcceptToken === 'csv') return 'csv';
    if (firstAcceptToken === 'json') return 'json';
    if (firstAcceptToken === '*/*') return 'json';

    const accepted = request.accepts([
      // Prefer json when multiple are acceptable
      'application/json',
      'text/json',
      'json',
      'text/csv',
      'application/csv',
      'csv',
    ]);

    if (!accepted) return 'json';

    const normalized = accepted.toLowerCase();

    if (normalized === 'csv' || normalized.endsWith('/csv')) return 'csv';
    if (normalized === 'json' || normalized.endsWith('/json')) return 'json';

    return 'json';
  },
);
