import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { build } from './build.mjs';

await build();
const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Also serves /digitalgarden/ for checking GitHub project-page asset paths.
    const relative = pathname.replace(/^\/digitalgarden(?=\/|$)/, '').replace(/^\/+/, '');
    const path = resolve(root, relative || 'index.html');
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(content);
  } catch { if (!response.headersSent) response.writeHead(404); response.end('Not found'); }
});
const port = Number(process.env.PORT ?? 4321);
server.listen(port, '127.0.0.1', () => console.log(`Garden preview: http://localhost:${port}`));
let timer;
let building = false;
let dirty = false;
const rebuild = async () => {
  if (building) { dirty = true; return; }
  building = true;
  try { await build(); } catch (error) { console.error(error.message); }
  finally { building = false; if (dirty) { dirty = false; await rebuild(); } }
};
['garden.yaml', 'content', 'src', 'public', 'scripts'].forEach(path => watch(path, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 120);
}));
