// UNVERIFIED. Thin client. DEV ONLY header; production uses the Entra ID session cookie/token.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
export async function api<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const dev = process.env.NEXT_PUBLIC_DEV_USER;
  const res = await fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json', ...(dev ? { authorization: `Mock ${dev}` } : {}), ...(init.headers ?? {}) } });
  return { status: res.status, data: (await res.json()) as T };
}
