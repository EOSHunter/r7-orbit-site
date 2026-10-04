// Static server for Lighthouse: serves dist/ with gzip, the way the production host will.
// `astro preview` sends everything uncompressed, which makes Lighthouse's slow-4G simulation much harsher than real life.
// Usage: node tests/serve-dist.mjs <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.argv[2] ?? 4398);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const compressible = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt', '.webmanifest', '.ico']);

async function find(urlPath) {
  const clean = normalize(`.${decodeURIComponent(urlPath)}`);
  for (const candidate of [clean, join(clean, 'index.html')]) {
    const file = join(root, candidate);
    if (!file.startsWith(root)) return null;
    const info = await stat(file).catch(() => null);
    if (info?.isFile()) return file;
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = await find(url.pathname);
  const status = file ? 200 : 404;
  const target = file ?? join(root, '404.html');
  let body = await readFile(target);
  const ext = extname(target);
  const headers = { 'content-type': types[ext] ?? 'application/octet-stream' };
  if (compressible.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
    body = gzipSync(body);
    headers['content-encoding'] = 'gzip';
  }
  headers['content-length'] = body.length;
  res.writeHead(status, headers).end(body);
}).listen(port, '127.0.0.1', () => console.log(`serving dist/ on http://127.0.0.1:${port} (listening)`));
