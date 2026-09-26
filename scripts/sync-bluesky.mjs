import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeHandle, readGarden, validateGarden } from './data.mjs';
import { collectFeed, gardenFromFeed } from './bluesky.mjs';

const publicApi = async (method, params) => {
  const url = new URL(`https://public.api.bsky.app/xrpc/${method}`);
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Bluesky returned HTTP ${response.status}`);
  return response.json();
};

export const syncGarden = async ({ handle = process.env.BLUESKY_HANDLE, filename = 'content/garden.json', fetchJson = publicApi } = {}) => {
  // Local development can reuse the saved handle. GitHub Actions explicitly requires a repository variable.
  const actor = normalizeHandle(handle || (await readGarden(filename)).profile.handle);
  const result = await collectFeed(actor, fetchJson);
  const garden = validateGarden(gardenFromFeed(result), actor);
  const serialized = `${JSON.stringify(garden, null, 2)}\n`;
  const previous = await readFile(filename, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  if (serialized !== previous) {
    await mkdir(dirname(filename), { recursive: true });
    await writeFile(`${filename}.tmp`, serialized);
    await rename(`${filename}.tmp`, filename);
  }
  return garden;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await syncGarden().then(garden => {
    console.log(`Bluesky: ${garden.entries.length} #garden posts from @${garden.profile.handle}.`);
  }).catch(error => {
    console.error(`Bluesky sync failed: ${error.message}. The saved garden was not changed.`);
    process.exitCode = 1;
  });
}
