import { SetMetadata } from '@nestjs/common';
import { ALLOWED_USER_TYPES_KEY } from '../guards/session.guard';

export const AllowedUserTypes = (...types: string[]) =>
  SetMetadata(ALLOWED_USER_TYPES_KEY, types);
