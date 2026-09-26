import { writeFile, rename } from 'node:fs/promises';
import { readConfig, readImported, mergeEntries, validateEntry } from './data.mjs';
import { collectFeed, entriesFromFeed } from './bluesky.mjs';

try {
  const { bluesky } = await readConfig();
  if (!bluesky.enabled || (bluesky.mode === 'manual' && !process.argv.includes('--force'))) {
    console.log('Bluesky auto-import is disabled. Use npm run sync -- --force for manual mode.');
  } else {
    const fetchJson = async (method, params) => {
      const url = new URL(`https://public.api.bsky.app/xrpc/${method}`);
      url.search = new URLSearchParams(params).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Bluesky returned HTTP ${response.status}`);
      return response.json();
    };
    const { feed, did } = await collectFeed(bluesky.handle, fetchJson);
    const previous = await readImported();
    // Keep the newest post when the same link was shared more than once.
    const incoming = entriesFromFeed(feed, bluesky, did).map(entry => validateEntry(entry));
    const entries = mergeEntries(incoming, previous, bluesky.excludeUrls).sort((a, b) => b.added.localeCompare(a.added));
    const serialized = `${JSON.stringify(entries, null, 2)}\n`;
    if (serialized !== `${JSON.stringify(previous, null, 2)}\n`) {
      await writeFile('content/bluesky.json.tmp', serialized);
      await rename('content/bluesky.json.tmp', 'content/bluesky.json');
    }
    console.log(`Bluesky: ${incoming.length} matching links; ${entries.length} saved in content/bluesky.json.`);
  }
} catch (error) {
  console.error(`Bluesky sync failed: ${error.message}. Saved entries were not changed.`);
  process.exitCode = 1;
}
