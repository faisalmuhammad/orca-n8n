import assert from 'node:assert/strict';
import { lstatSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = process.argv[2] ? resolve(process.argv[2]) : fileURLToPath(new URL('../', import.meta.url));
const files = new Map();
const ignored = new Set(['.git', '.orca', '.n8n', '.codex', '.agents', 'AGENTS.md', 'node_modules', 'dist', '.cache', '.DS_Store', 'Thumbs.db', 'playwright-report', 'test-results']);
function collect(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (ignored.has(name)) continue;
    const file = join(dir, name), stat = lstatSync(file), key = relative(root, file).replaceAll('\\', '/');
    assert.ok(!stat.isSymbolicLink(), 'Symlink: ' + key);
    if (stat.isDirectory()) collect(file); else files.set(key, readFileSync(file));
  }
}
collect(root);
if (existsSync(join(root, '.git'))) for (const file of execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean)) {
  assert.ok(!file.split('/').some(part => ignored.has(part)), 'Tracked generated/dependency file: ' + file);
  assert.ok(!lstatSync(join(root, file)).isSymbolicLink(), 'Tracked symlink: ' + file);
}
const manifest = JSON.parse(files.get('orca-plugin.json'));
const required = ['README.md', 'CHANGELOG.md', 'RELEASE.md', 'COMPATIBILITY.md', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'assets/SCREENSHOTS.md', manifest.main, ...manifest.contributes.panels.map(panel => panel.entry), 'panel/main.js', 'ui/styles.css', 'ui/brand.css'];
for (const file of required) assert.ok(files.has(file), 'Required release file: ' + file);
assert.ok(!manifest.publisher, 'Publisher must be derived from the GitHub owner');
assert.ok(manifest.author?.name && manifest.repository && manifest.cover?.alt, 'Listing metadata missing');
assert.match(manifest.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.ok(files.get('CHANGELOG.md').toString().includes('## ' + manifest.version + '\n'), 'Matching changelog missing');
if (files.has('package.json')) {
  const pkg = JSON.parse(files.get('package.json')), lock = JSON.parse(files.get('package-lock.json'));
  assert.equal(pkg.version, manifest.version); assert.equal(lock.version, manifest.version); assert.equal(lock.packages[''].version, manifest.version);
}
const privacy = [
  /\/(?:Users|home)\/[A-Za-z0-9_.-]+(?:\/|\b)/i,
  /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
const decoder = new TextDecoder('utf-8', { fatal: true });
let totalBytes = 0;
for (const [name, data] of files) {
  assert.ok(!/(?:^|\/)\.env(?:$|\.)|\.(?:pem|key|p12|pfx|db|sqlite3?|log|tsbuildinfo|zip|tgz)$/i.test(name), 'Private or generated file: ' + name);
  totalBytes += data.length;
  if (/\.(png|jpe?g|webp)$/.test(name)) { const meta = await sharp(data).metadata(); assert.ok(!meta.exif && !meta.xmp && !meta.iptc, 'Embedded image metadata: ' + name); continue; }
  assert.ok(!/\.(woff2?|ttf|otf)$/.test(name), 'Do not redistribute proprietary font files: ' + name);
  const source = decoder.decode(data); assert.ok(!data.includes(0), 'Unexpected binary: ' + name);
  if (!name.startsWith('tests/')) assert.ok(!/\bhttps?:\/\/[^\s/]+:[^\s/@]+@/i.test(source), 'Embedded URL credentials: ' + name);
  for (const pattern of privacy) assert.ok(!pattern.test(source), 'Sensitive local text: ' + name);
  if (/\.(ts|tsx|mts|jsx)$/.test(name)) assert.ok(data.length <= 1024 * 1024, 'Transpilation budget: ' + name);
  if (required.includes(name) && /\.(mjs|js|html)$/.test(name)) assert.ok(data.length <= 1024 * 1024, 'Entry budget: ' + name);
}
assert.ok(files.size <= 2000, 'Orca 2,000-file budget'); assert.ok(totalBytes <= 50 * 1024 * 1024, 'Orca 50 MiB budget');
assert.ok(manifest.screenshots.length <= 6, 'Screenshot count');
let imageBytes = 0;
const images = [];
for (const [kind, item] of [['icon', { path: manifest.icon }], ['cover', manifest.cover], ...manifest.screenshots.map(item => ['screenshot', item])]) {
  const data = files.get(item.path); assert.ok(data, 'Listing image missing: ' + item.path);
  const meta = await sharp(data).metadata();
  const [width, height, limit] = kind === 'icon' ? [128, 128, 256 * 1024] : kind === 'cover' ? [800, 500, 1024 * 1024] : [1280, 800, 1.5 * 1024 * 1024];
  assert.ok(meta.format === 'png' && (meta.pages ?? 1) === 1, 'Static listing PNG required');
  assert.ok(meta.width >= width && meta.height >= height && data.length <= limit, 'Listing dimensions/size: ' + item.path);
  if (kind === 'icon') assert.equal(meta.width, meta.height); else assert.ok(item.alt && item.alt.length <= 160, 'Listing alt text must fit Orca’s 160-character limit');
  imageBytes += data.length; images.push({ path: item.path, width: meta.width, height: meta.height, bytes: data.length });
}
assert.ok(imageBytes <= 8 * 1024 * 1024, 'Combined listing image budget');
console.log(JSON.stringify({ ok: true, files: files.size, totalBytes, imageBytes, images }, null, 2));
