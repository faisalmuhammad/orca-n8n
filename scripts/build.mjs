import { build } from 'esbuild';
import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
const common = { bundle: true, format: 'esm', target: 'es2022', logLevel: 'info' };
await rm('dist/plugin', { recursive: true, force: true });
for (const base of ['.', 'dist/plugin']) {
  await mkdir(base + '/worker', { recursive: true });
  await build({ ...common, entryPoints: ['src/worker/main.ts'], outfile: base + '/worker/main.mjs', platform: 'node', target: 'node22' });
  await mkdir(base + '/panel', { recursive: true });
  await build({ ...common, entryPoints: ['src/panel/main.ts'], outfile: base + '/panel/main.js', platform: 'browser' });
  await copyFile('src/panel/index.html', base + '/panel/index.html');
  await cp('src/panel/assets', base + '/panel/assets', { recursive: true });
  await mkdir(base + '/ui', { recursive: true });
  for (const file of ['styles.css', 'brand.css']) await copyFile('src/ui/' + file, base + '/ui/' + file);
}
await cp('assets', 'dist/plugin/assets', { recursive: true });
for (const file of ['orca-plugin.json', 'README.md', 'CHANGELOG.md', 'RELEASE.md', 'LICENSE', 'COMPATIBILITY.md', 'THIRD_PARTY_NOTICES.md']) await copyFile(file, 'dist/plugin/' + file);
await mkdir('dist/plugin/docs', { recursive: true });
await copyFile('docs/usage.md', 'dist/plugin/docs/usage.md');
