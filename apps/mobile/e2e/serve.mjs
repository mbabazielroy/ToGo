// Tiny static server for the end-to-end tests: serves a web build folder and
// falls back to index.html for app routes (single-page app). Test use only.
//   node e2e/serve.mjs <folder> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [, , folder, port] = process.argv;
const root = resolve(folder);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

async function file(path) {
  try { return (await stat(path)).isFile() ? path : null; } catch { return null; }
}

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const target = normalize(join(root, url));
  const inside = target === root || target.startsWith(root + sep);
  const found = (inside && await file(target)) || await file(join(root, 'index.html'));
  if (!found) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
  res.end(await readFile(found));
}).listen(Number(port), '127.0.0.1');
