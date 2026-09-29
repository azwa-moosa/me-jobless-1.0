// Pluggable identity provider. Local dev uses the mock; production will use Entra ID (pending IT approval).
import type { AuthUser } from './authorize.ts';

export interface AuthProvider { authenticate(headers: Record<string, string | undefined>): Promise<AuthUser | null> }

export const SEEDED_USERS: AuthUser[] = [
  { id: 'u-hr-admin', displayName: 'Test HR Analytics Admin', role: 'HR_ANALYTICS_ADMIN', scopes: [{ orgUnitId: 'BML' }] },
  { id: 'u-er', displayName: 'Test ER Restricted', role: 'ER_RESTRICTED', scopes: [{ orgUnitId: 'BML' }] },
  { id: 'u-hr-lead', displayName: 'Test HR Leadership', role: 'HR_LEADERSHIP', scopes: [{ orgUnitId: 'BML' }] },
  { id: 'u-dh-credit', displayName: 'Test Division Head Credit', role: 'DIVISION_HEAD', scopes: [{ orgUnitId: 'DIV-CR' }] },
  { id: 'u-dh-finance', displayName: 'Test Division Head Finance', role: 'DIVISION_HEAD', scopes: [{ orgUnitId: 'DIV-FIN' }] },
  { id: 'u-dept-retail', displayName: 'Test Department Head Retail Credit', role: 'DEPARTMENT_HEAD', scopes: [{ orgUnitId: 'DEP-CR-RET' }] },
  { id: 'u-readonly', displayName: 'Test Read-only Leadership', role: 'READONLY_LEADERSHIP', scopes: [{ orgUnitId: 'BML' }] },
  { id: 'u-sys-admin', displayName: 'Test System Admin', role: 'SYSTEM_ADMIN', scopes: [] },
];

/** Accepts `Authorization: Mock <userId>` ONLY outside production. Refuses to construct in production. */
export class MockAuthProvider implements AuthProvider {
  users: Map<string, AuthUser>;
  constructor(env: { NODE_ENV?: string; AUTH_PROVIDER?: string } = {}, users: AuthUser[] = SEEDED_USERS) {
    if (env.NODE_ENV === 'production') throw new Error('MockAuthProvider must never run in production');
    if (env.AUTH_PROVIDER !== undefined && env.AUTH_PROVIDER !== 'mock') throw new Error('AUTH_PROVIDER is not mock');
    this.users = new Map(users.map((u) => [u.id, u] as const));
  }
  async authenticate(headers: Record<string, string | undefined>): Promise<AuthUser | null> {
    const h = headers['authorization'] ?? '';
    const m = /^Mock (.+)$/.exec(h);
    return m ? (this.users.get(m[1].trim()) ?? null) : null;
  }
}

/** Placeholder: real OIDC/JWT validation (issuer, audience, signature, group->role mapping, MFA claim) is Phase 2 and needs IT approval. */
export class EntraAuthProvider implements AuthProvider {
  async authenticate(): Promise<AuthUser | null> { throw new Error('EntraAuthProvider not implemented - pending BML IT / InfoSec approval'); }
}
