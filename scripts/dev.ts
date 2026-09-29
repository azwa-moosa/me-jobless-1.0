import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [
  {
    name: 'api',
    command: process.execPath,
    args: ['apps/api/src/main.ts'],
    env: { PORT: process.env.PORT ?? '3001' },
  },
  {
    name: 'web',
    command: npm,
    args: ['--workspace', '@bml/web', 'run', 'dev'],
    env: {
      API_URL: process.env.API_URL ?? 'http://127.0.0.1:3001',
      NEXT_PUBLIC_DEV_USER: process.env.NEXT_PUBLIC_DEV_USER ?? 'u-hr-admin',
    },
  },
];

let stopping = false;
const running = children.map(({ name, command, args, env }) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    stopping = true;
    console.error(`${name} exited${signal ? ` (${signal})` : ` with code ${code ?? 0}`}`);
    for (const other of running) {
      if (other !== child && other.pid && !other.killed) other.kill('SIGTERM');
    }
    process.exitCode = code ?? 1;
  });

  return child;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true;
    for (const child of running) {
      if (child.pid && !child.killed) child.kill(signal);
    }
  });
}
