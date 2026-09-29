// Dev proxy: browser calls /api/* on :3000, forwarded to the API on :3001 (avoids CORS; the API sends no CORS headers).
const API = process.env.API_URL ?? 'http://localhost:3001';
export default {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  async rewrites() { return [{ source: '/api/:path*', destination: `${API}/:path*` }]; },
};
