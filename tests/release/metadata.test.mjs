import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { releaseInfo, readReleaseInfo, ROOT } from '../../scripts/ci-release.mjs';

const changelog = '# Changelog\n\n## 0.2.0 — New release\n- Added workflows.\n\n## 0.1.0\n- Initial release.\n';
test('manifest version selects only its own changelog entry and tag', () => {
  assert.deepEqual(releaseInfo('0.2.0', changelog), { version: '0.2.0', tag: 'v0.2.0', notes: '- Added workflows.\n' });
  assert.equal(releaseInfo('0.1.0', changelog.replaceAll('\n', '\r\n')).notes, '- Initial release.\n');
});
test('release preparation reads only the manifest version and synchronizes install and package metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'n8n-release-prepare-'));
  const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value));
  try {
    mkdirSync(join(root, 'scripts'));
    for (const name of ['ci-release.mjs', 'prepare-release.mjs']) copyFileSync(join(ROOT, 'scripts', name), join(root, 'scripts', name));
    write('orca-plugin.json', { name: 'n8n in Orca', version: '0.2.0' });
    write('package.json', { version: '0.1.0' });
    write('package-lock.json', { version: '0.1.0', packages: { '': { version: '0.1.0' } } });
    writeFileSync(join(root, 'CHANGELOG.md'), changelog);
    writeFileSync(join(root, 'README.md'), 'Version **0.1.0**\nInstall repo#v0.1.0; Orca 1.4.248+');
    writeFileSync(join(root, 'RELEASE.md'), 'Release version: **0.1.0**, tag **v0.1.0**');
    execFileSync(process.execPath, [join(root, 'scripts/prepare-release.mjs')]);
    assert.equal(readReleaseInfo(root).version, '0.2.0');
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    assert.ok(readme.includes('Version **0.2.0**') && readme.includes('#v0.2.0') && readme.includes('Orca 1.4.248+'));
    assert.ok(readFileSync(join(root, 'RELEASE.md'), 'utf8').includes('Release version: **0.2.0**'));
    write('orca-plugin.json', { name: 'n8n in Orca', version: '0.3.0' });
    assert.throws(() => execFileSync(process.execPath, [join(root, 'scripts/prepare-release.mjs')], { stdio: 'pipe' }));
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'))).version, '0.2.0');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('mismatched tags, missing notes, similar prefixes and invalid versions are refused', () => {
  assert.throws(() => releaseInfo('0.2.0', changelog, 'v0.1.0'), /Tag must match/);
  assert.throws(() => releaseInfo('0.2.0', '## 0.2.01\n- Other.'), /Missing changelog/);
  assert.throws(() => releaseInfo('0.2.0', '## 0.2.0\n\n## 0.1.0\n- Old.'), /Empty release/);
  assert.throws(() => releaseInfo('0.2.0', '## 0.2.0'), /Empty release/);
  for (const version of ['0.2.0;echo injected', '0.2.0-beta.1', '00.2.0', '0.2']) assert.throws(() => releaseInfo(version, changelog), /stable major/);
});
test('package and lockfile versions must agree with the manifest', () => {
  const root = mkdtempSync(join(tmpdir(), 'n8n-release-metadata-'));
  const write = (name, value) => writeFileSync(join(root, name), JSON.stringify(value));
  try {
    write('orca-plugin.json', { name: 'n8n in Orca', version: '0.2.0' });
    write('package.json', { version: '0.2.0' });
    write('package-lock.json', { version: '0.2.0', packages: { '': { version: '0.2.0' } } });
    writeFileSync(join(root, 'CHANGELOG.md'), changelog);
    assert.equal(readReleaseInfo(root).tag, 'v0.2.0');
    write('package.json', { version: '0.1.0' });
    assert.throws(() => readReleaseInfo(root), /release:prepare/);
    write('package.json', { version: '0.2.0' });
    write('package-lock.json', { version: '0.2.0', packages: { '': { version: '0.1.0' } } });
    assert.throws(() => readReleaseInfo(root), /Lockfile root/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
