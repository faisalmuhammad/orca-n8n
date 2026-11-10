import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function releaseInfo(version, changelog, tag = '') {
  assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use a stable major.minor.patch release version');
  if (tag) assert.equal(tag, 'v' + version, 'Tag must match orca-plugin.json version');
  const entry = changelog.replaceAll('\r\n', '\n').split(/^## /m).slice(1).find(section => section === version || section.startsWith(version + '\n') || section.startsWith(version + ' '));
  assert.ok(entry, 'Missing changelog entry for ' + version);
  assert.ok(entry.includes('\n'), 'Empty release notes');
  const notes = entry.slice(entry.indexOf('\n') + 1).trim();
  assert.ok(notes, 'Empty release notes');
  return { version, tag: 'v' + version, notes: notes + '\n' };
}

export function readReleaseInfo(root = ROOT, tag = '') {
  const read = file => readFileSync(join(root, file), 'utf8');
  const manifest = JSON.parse(read('orca-plugin.json'));
  const info = releaseInfo(manifest.version, read('CHANGELOG.md'), tag);
  for (const file of ['package.json', 'package-lock.json']) {
    const value = JSON.parse(read(file));
    assert.equal(value.version, info.version, file + ' version must match manifest; run npm run release:prepare');
    if (value.packages) assert.equal(value.packages[''].version, info.version, 'Lockfile root version must match manifest');
  }
  return { ...info, name: manifest.name };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const info = readReleaseInfo(ROOT, process.env.RELEASE_TAG);
  if (process.argv[2]) writeFileSync(process.argv[2], info.notes);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'version=' + info.version + '\ntag=' + info.tag + '\n');
  console.log('Release metadata valid: ' + info.tag);
}
