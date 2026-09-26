import { mkdir, rm, cp, writeFile, access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readConfig, readImported, mergeEntries, isWebUrl } from './data.mjs';
import { renderGarden } from './render.mjs';

export const build = async () => {
  const config = await readConfig();
  const imported = config.bluesky.enabled ? await readImported() : [];
  const entries = mergeEntries(config.entries, imported, config.bluesky.excludeUrls).sort((a, b) => Number(Boolean(a.example)) - Number(Boolean(b.example)));
  await Promise.all(entries.filter(entry => entry.thumbnail && !isWebUrl(entry.thumbnail)).map(entry => access(`public/${entry.thumbnail}`).catch(() => { throw new Error(`Missing thumbnail: public/${entry.thumbnail}`); })));
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await cp('public', 'dist', { recursive: true });
  await cp('src/styles.css', 'dist/styles.css');
  await cp('src/garden.js', 'dist/garden.js');
  await cp('src/media.js', 'dist/media.js');
  await mkdir('dist/vendor', { recursive: true });
  await cp('node_modules/hls.js/dist/hls.light.mjs', 'dist/vendor/hls.light.mjs');
  await cp('node_modules/hls.js/LICENSE', 'dist/vendor/hls.LICENSE');
  await writeFile('dist/index.html', renderGarden(config, entries));
  await writeFile('dist/.nojekyll', '');
  console.log(`Built ${entries.length} garden entries → dist/`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
