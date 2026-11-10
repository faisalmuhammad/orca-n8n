import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease } from '../../.github/scripts/publish-release.mjs';
import { releaseInfo } from '../../scripts/ci-release.mjs';

const commit = 'a'.repeat(40);
const info = { ...releaseInfo('0.2.0', '## 0.2.0\n- New workflows.\n\n## 0.1.0\n- Initial release.'), name: 'n8n in Orca' };
function failure(message, status = 1) { return Object.assign(new Error(message), { stderr: message, status }); }
function scenario({ releaseExists = false, tagExists = false, target = commit, viewError, createError } = {}) {
  const calls = [];
  const context = { commit, repository: 'owner/orca-n8n', ref: 'refs/heads/main', notesFile: '/tmp/notes.md', run(file, args) {
    calls.push([file, args]);
    if (file === 'git') {
      if (args.join(' ') === 'rev-parse HEAD') return commit + '\n';
      if (args[0] === 'merge-base') return '';
      if (args[0] === 'show-ref') { if (!tagExists) throw failure('', 1); return ''; }
      if (args[0] === 'rev-parse') return target + '\n';
    }
    if (file === 'gh') {
      if (args[0] === 'release' && args[1] === 'view') {
        if (viewError) throw viewError;
        if (!releaseExists) throw failure('release not found\n');
        return JSON.stringify({ tagName: info.tag });
      }
      if (args[0] === 'api') return '{}';
      if (args[0] === 'release' && args[1] === 'create') { if (createError) throw createError; return ''; }
    }
    throw new Error('Unexpected command: ' + file + ' ' + args);
  } };
  return { context, calls, mutations: () => calls.filter(([file, args]) => file === 'gh' && (args[0] === 'api' || args[1] === 'create')) };
}

test('main creates the manifest tag on the checked commit before creating the release', () => {
  const s = scenario();
  assert.deepEqual(publishRelease(info, s.context), { tag: 'v0.2.0', state: 'published' });
  assert.deepEqual(s.mutations(), [
    ['gh', ['api', '--method', 'POST', 'repos/owner/orca-n8n/git/refs', '-f', 'ref=refs/tags/v0.2.0', '-f', 'sha=' + commit]],
    ['gh', ['release', 'create', 'v0.2.0', '--repo', 'owner/orca-n8n', '--verify-tag', '--title', 'n8n in Orca 0.2.0', '--notes-file', '/tmp/notes.md']]
  ]);
});

test('an existing release makes ordinary pushes and retries read-only', () => {
  const s = scenario({ releaseExists: true, tagExists: true, target: 'b'.repeat(40) });
  assert.equal(publishRelease(info, s.context).state, 'existing-release');
  assert.equal(s.mutations().length, 0);
});

test('retry after tag creation reuses the matching tag', () => {
  const s = scenario({ tagExists: true });
  assert.equal(publishRelease(info, s.context).state, 'published');
  assert.equal(s.mutations().length, 1);
  assert.equal(s.mutations()[0][1][1], 'create');
});

test('a tag on another commit is never moved or released', () => {
  const s = scenario({ tagExists: true, target: 'b'.repeat(40) });
  assert.throws(() => publishRelease(info, s.context), /never move it/);
  assert.equal(s.mutations().length, 0);
});

test('authentication and network errors cannot be mistaken for a missing release', () => {
  for (const message of ['HTTP 401: Bad credentials', 'HTTP 403: Resource not accessible', 'connection timed out']) {
    const s = scenario({ viewError: failure(message) });
    assert.throws(() => publishRelease(info, s.context), new RegExp(message));
    assert.equal(s.mutations().length, 0);
  }
});

test('tag pushes can finish releases but cannot recreate missing tags', () => {
  const s = scenario({ tagExists: true });
  s.context.ref = 'refs/tags/v0.2.0';
  assert.equal(publishRelease(info, s.context).state, 'published');
  const missing = scenario();
  missing.context.ref = 'refs/tags/v0.2.0';
  assert.throws(() => publishRelease(info, missing.context), /cannot recreate/);
  assert.equal(missing.mutations().length, 0);
});

test('only the exact checked commit on main or its matching tag may publish', () => {
  for (const ref of ['refs/heads/feature', 'refs/tags/v0.1.0']) {
    const s = scenario(); s.context.ref = ref;
    assert.throws(() => publishRelease(info, s.context), /Only main/);
    assert.equal(s.calls.length, 0);
  }
  const mismatch = scenario(); mismatch.context.commit = 'b'.repeat(40);
  assert.throws(() => publishRelease(info, mismatch.context), /Checkout must match/);
  assert.equal(mismatch.mutations().length, 0);
  const unmerged = scenario();
  const run = unmerged.context.run;
  unmerged.context.run = (file, args) => { if (args[0] === 'merge-base') throw failure('not in main'); return run(file, args); };
  assert.throws(() => publishRelease(info, unmerged.context), /not in main/);
  assert.equal(unmerged.mutations().length, 0);
});

test('failed publication is reported and can resume using the already created tag', () => {
  const s = scenario({ createError: failure('HTTP 503') });
  assert.throws(() => publishRelease(info, s.context), /HTTP 503/);
  assert.equal(s.mutations().length, 2);
  const retry = scenario({ tagExists: true });
  assert.equal(publishRelease(info, retry.context).state, 'published');
  assert.equal(retry.mutations().length, 1);
});
