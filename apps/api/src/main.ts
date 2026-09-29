// Dev entrypoint (in-memory repository + mock auth). Runs with plain Node 22; VERIFIED only through tests/api.integration.test.ts.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { MockAuthProvider } from '../../../packages/auth/src/index.ts';
import { buildOrgIndex, parseOrgCsv } from '../../../packages/schemas/src/index.ts';
import { createApp } from './http.ts';
import { InMemoryRepository } from './repo.ts';
import { PlatformService } from './service.ts';

const org = buildOrgIndex(parseOrgCsv(readFileSync(new URL('../../../sample-data/golden/org_units.csv', import.meta.url), 'utf8')));
const svc = new PlatformService({ repo: new InMemoryRepository(), org, now: () => new Date().toISOString(), newId: () => randomUUID() });
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
createApp(svc, new MockAuthProvider({ NODE_ENV: process.env.NODE_ENV, AUTH_PROVIDER: process.env.AUTH_PROVIDER ?? 'mock' }), console.log).listen(port, host, () => console.log(`API (dev, in-memory) on http://${host}:${port}`));
