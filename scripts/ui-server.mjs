import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, relative } from 'node:path';
const root = resolve('dist/plugin');
createServer(async (req, res) => {
  try { const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); if (relative(root, path).startsWith('..')) throw new Error('Outside root'); res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' })[extname(path)] || 'text/plain'); res.end(await readFile(path)); } catch { res.writeHead(404); res.end('Not found'); }
}).listen(41873, '127.0.0.1');
