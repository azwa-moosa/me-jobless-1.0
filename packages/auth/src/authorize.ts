// Server-side authorisation. Fail-closed: unknown permission, no scope, unknown org => deny.
import { PERMISSION_BY_NAME } from './matrix.ts';
import type { Role } from './matrix.ts';

export interface UserScope { orgUnitId: string } // scope root; covers this unit and all descendants
export interface AuthUser { id: string; displayName: string; role: Role; scopes: UserScope[] }
export interface OrgAncestry { ancestorsOf(id: string): string[] } // [self, parent, ..., root]; [] if unknown

export interface Decision { allowed: boolean; reason: 'OK' | 'UNKNOWN_PERMISSION' | 'ROLE_NOT_PERMITTED' | 'NO_SCOPE' | 'TARGET_REQUIRED' | 'UNKNOWN_ORG' | 'OUT_OF_SCOPE' }

export function authorize(user: AuthUser | null, permission: string, target: { orgUnitId?: string } | undefined, org: OrgAncestry): Decision {
  const spec = PERMISSION_BY_NAME.get(permission);
  if (!user || !spec) return { allowed: false, reason: 'UNKNOWN_PERMISSION' };
  if (!spec.roles.includes(user.role)) return { allowed: false, reason: 'ROLE_NOT_PERMITTED' };
  if (!spec.scoped) return { allowed: true, reason: 'OK' };
  if (user.scopes.length === 0) return { allowed: false, reason: 'NO_SCOPE' };
  if (!target?.orgUnitId) return { allowed: false, reason: 'TARGET_REQUIRED' };
  const chain = org.ancestorsOf(target.orgUnitId);
  if (chain.length === 0) return { allowed: false, reason: 'UNKNOWN_ORG' };
  const inScope = user.scopes.some((s) => chain.includes(s.orgUnitId));
  return inScope ? { allowed: true, reason: 'OK' } : { allowed: false, reason: 'OUT_OF_SCOPE' };
}

/** Row-level filter used by every repository query: rows outside the user's scope are never returned. */
export function filterByScope<T>(user: AuthUser, permission: string, rows: T[], orgUnitOf: (row: T) => string, org: OrgAncestry): T[] {
  return rows.filter((r) => authorize(user, permission, { orgUnitId: orgUnitOf(r) }, org).allowed);
}

/** Throws a 403-style error; controllers call this before touching data. */
export class ForbiddenError extends Error { reason: string; constructor(reason: string) { super(`Forbidden: ${reason}`); this.reason = reason; } }
export function requirePermission(user: AuthUser | null, permission: string, target: { orgUnitId?: string } | undefined, org: OrgAncestry): void {
  const d = authorize(user, permission, target, org);
  if (!d.allowed) throw new ForbiddenError(d.reason);
}
