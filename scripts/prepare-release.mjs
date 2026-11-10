import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, releaseInfo, readReleaseInfo } from './ci-release.mjs';

const manifest = JSON.parse(readFileSync(join(ROOT, 'orca-plugin.json'), 'utf8'));
const info = releaseInfo(manifest.version, readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));
for (const file of ['package.json', 'package-lock.json']) {
  const path = join(ROOT, file);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = info.version;
  if (pkg.packages) pkg.packages[''].version = info.version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}
// Keep the release installation references current without changing the Orca API floor.
for (const file of ['README.md', 'RELEASE.md']) {
  const path = join(ROOT, file);
  let source = readFileSync(path, 'utf8').replace(/\bv\d+\.\d+\.\d+\b/g, info.tag);
  if (file === 'README.md') source = source.replace(/Version \*\*\d+\.\d+\.\d+\*\*/, 'Version **' + info.version + '**');
  else source = source.replace(/Prepared version: \*\*\d+\.\d+\.\d+\*\*/, 'Prepared version: **' + info.version + '**');
  writeFileSync(path, source);
}
readReleaseInfo();
console.log('Prepared ' + info.tag + ' from orca-plugin.json. Build and commit the release files before pushing main.');
