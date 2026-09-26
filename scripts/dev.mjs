import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { resolve, extname, sep, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const build = async () => {
  const { stdout } = await run(process.execPath, ['scripts/build.mjs']);
  process.stdout.write(stdout);
};

const inputs = ['garden.yaml', 'content', 'src', 'public', 'scripts'];
const fingerprint = async path => {
  const info = await stat(path);
  if (!info.isDirectory()) return `${path}:${info.size}:${info.mtimeMs}`;
  const children = (await readdir(path)).sort();
  return (await Promise.all(children.map(child => fingerprint(join(path, child))))).join('|');
};
const inputFingerprint = async () => (await Promise.all(inputs.map(fingerprint))).join('|');
let lastFingerprint = await inputFingerprint();
await build();
const root = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
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
  try {
    const nextFingerprint = await inputFingerprint();
    // Some filesystem backends report changes outside the watched input paths.
    // Output writes must never trigger another build of the same source.
    if (nextFingerprint !== lastFingerprint) {
      lastFingerprint = nextFingerprint;
      await build();
    }
  } catch (error) { console.error(error.message); }
  finally { building = false; if (dirty) { dirty = false; await rebuild(); } }
};
inputs.forEach(path => watch(path, { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 120);
}));
