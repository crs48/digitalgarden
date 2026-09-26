import { mkdir, rm, cp, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readGarden } from './data.mjs';
import { renderGarden } from './render.mjs';

export const build = async () => {
  const garden = await readGarden();
  await rm('dist', { recursive: true, force: true });
  await mkdir('dist', { recursive: true });
  await cp('public', 'dist', { recursive: true });
  await cp('src/styles.css', 'dist/styles.css');
  await cp('src/garden.js', 'dist/garden.js');
  await cp('src/masonry.js', 'dist/masonry.js');
  await cp('src/media.js', 'dist/media.js');
  await mkdir('dist/vendor', { recursive: true });
  await cp('node_modules/hls.js/dist/hls.light.min.mjs', 'dist/vendor/hls.light.mjs');
  await cp('node_modules/hls.js/LICENSE', 'dist/vendor/hls.LICENSE');
  await writeFile('dist/index.html', renderGarden(garden));
  await writeFile('dist/.nojekyll', '');
  console.log(`Built ${garden.entries.length} garden entries → dist/`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build().catch(error => { console.error(`Build failed: ${error.message}`); process.exitCode = 1; });
}
