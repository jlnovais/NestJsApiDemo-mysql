export interface AuditContext {
  actorUserId?: string | null;
  actorType?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  data?: unknown;
}
