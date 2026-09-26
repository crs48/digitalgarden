import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readGarden } from './data.mjs';
import { renderGarden } from './render.mjs';

export const build = async () => {
  const garden = await readGarden();
  const assetNames = ['styles.css', 'garden.js', 'masonry.js', 'media.js'];
  const sources = await Promise.all(assetNames.map(name => readFile(`src/${name}`, 'utf8')));
  const assetVersion = createHash('sha256').update(sources.join('\n')).update(await readFile('package-lock.json')).digest('hex').slice(0, 12);
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await cp('public', 'dist', { recursive: true });
  await Promise.all(assetNames.map((name, index) => writeFile(`dist/${name}`, sources[index]
    .replace("'./masonry.js'", `'./masonry.js?v=${assetVersion}'`)
    .replace("'./vendor/hls.light.mjs'", `'./vendor/hls.light.mjs?v=${assetVersion}'`))));
  await mkdir('dist/vendor', { recursive: true });
  await cp('node_modules/hls.js/dist/hls.light.min.mjs', 'dist/vendor/hls.light.mjs');
  await cp('node_modules/hls.js/LICENSE', 'dist/vendor/hls.LICENSE');
  await writeFile('dist/index.html', renderGarden(garden, { assetVersion }));
  await writeFile('dist/.nojekyll', '');
  console.log(`Built ${garden.entries.length} garden entries → dist/`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
