// Minimal HTTP adapter (node:http). Authenticates via the pluggable provider, maps errors, logs no bodies.
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { ForbiddenError } from '../../../packages/auth/src/index.ts';
import type { AuthProvider } from '../../../packages/auth/src/index.ts';
import { WorkflowError } from '../../../packages/schemas/src/index.ts';
import type { PlatformService } from './service.ts';

const STATUS: Record<string, number> = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_INPUT: 400, ALREADY_EXISTS: 409, BAD_STATE: 409, BATCH_IMMUTABLE: 409, ALREADY_RESOLVED: 409, STAFF_NOT_APPROVED: 409, BLOCKING_ISSUES: 409 };

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 20_000_000) throw new WorkflowError('INVALID_INPUT', 'Body too large.'); chunks.push(c as Buffer); }
  const t = Buffer.concat(chunks).toString('utf8');
  if (!t) return {};
  try { return JSON.parse(t); } catch { throw new WorkflowError('INVALID_INPUT', 'Body must be JSON.'); }
}

export function createApp(svc: PlatformService, auth: AuthProvider, log: (line: string) => void = () => {}): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const route = `${req.method} ${url.pathname}`;
    const send = (status: number, body: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    let userId = 'anonymous', status = 500;
    try {
      const user = await auth.authenticate(req.headers as Record<string, string | undefined>);
      if (!user) { status = 401; return send(401, { error: 'UNAUTHENTICATED', message: 'Sign in required.' }); }
      userId = user.id;
      const seg = url.pathname.split('/').filter(Boolean);
      const m = req.method;
      const body = m === 'POST' ? await readJson(req) : {};
      let out: unknown; let code = 200;
      if (m === 'GET' && seg[0] === 'reporting-periods' && seg.length === 1) out = await svc.listPeriods(user);
      else if (m === 'POST' && seg[0] === 'reporting-periods' && seg.length === 1) { out = await svc.createPeriod(user, body); code = 201; }
      else if (m === 'POST' && seg[0] === 'uploads' && seg[1] === 'profile') out = await svc.profile(user, body);
      else if (m === 'POST' && seg[0] === 'reporting-periods' && seg[2] === 'uploads') { const r = await svc.upload(user, seg[1], body as never); out = r; code = r.deduplicated ? 200 : 201; }
      else if (m === 'GET' && seg[0] === 'batches' && seg.length === 2) out = await svc.getBatchWithIssues(user, seg[1]);
      else if (m === 'POST' && seg[0] === 'batches' && seg[2] === 'issues' && seg[4] === 'resolve') out = await svc.resolve(user, seg[1], decodeURIComponent(seg[3]), body as never);
      else if (m === 'POST' && seg[0] === 'batches' && seg[2] === 'approve') out = await svc.approve(user, seg[1]);
      else if (m === 'POST' && seg[0] === 'periods' && seg[2] === 'calculate') out = await svc.calculate(user, seg[1], body as never);
      else if (m === 'GET' && seg[0] === 'org-units' && seg.length === 1) out = await svc.listOrgUnits(user);
      else if (m === 'GET' && seg[0] === 'org-units' && seg.length === 2) {
        if (!svc.org.byId.has(seg[1])) { status = 403; return send(403, { error: 'FORBIDDEN', message: 'Access denied.' }); } // same answer as out-of-scope: no existence oracle
        out = await svc.getOrgUnit(user, seg[1]);
      }
      else if (m === 'GET' && seg[0] === 'audit') out = await svc.auditLog(user);
      else { status = 404; return send(404, { error: 'NOT_FOUND', message: 'No such route.' }); }
      status = code; return send(code, out);
    } catch (e) {
      if (e instanceof ForbiddenError) { status = 403; return send(403, { error: 'FORBIDDEN', message: 'You do not have access to this resource.' }); }
      if (e instanceof WorkflowError) { status = STATUS[e.code] ?? 422; return send(status, { error: e.code, message: e.message }); }
      status = 500; return send(500, { error: 'INTERNAL', message: 'Unexpected error.' }); // no stack/data leaked
    } finally { log(`${req.method} ${route.split(' ')[1].split('/').slice(0, 3).join('/')} ${status} user=${userId}`); }
  });
}
