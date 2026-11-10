import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readReleaseInfo, ROOT } from '../../scripts/ci-release.mjs';

export function publishRelease(info, { commit, repository, ref, notesFile, run }) {
  assert.match(commit, /^[a-f0-9]{40}$/i, 'Expected the exact checked Git commit');
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Expected owner/repository');
  assert.ok(ref === 'refs/heads/main' || ref === 'refs/tags/' + info.tag, 'Only main or the matching release tag may publish');
  assert.equal(run('git', ['rev-parse', 'HEAD']).trim(), commit, 'Checkout must match the checked commit');
  run('git', ['merge-base', '--is-ancestor', commit, 'origin/main']);

  // A missing release is distinct from authentication, permission, or network failure.
  let existing;
  try {
    existing = JSON.parse(run('gh', ['release', 'view', info.tag, '--repo', repository, '--json', 'tagName']));
  } catch (error) {
    if (!/^release not found$/im.test(String(error.stderr ?? ''))) throw error;
  }
  if (existing) {
    assert.equal(existing.tagName, info.tag);
    return { tag: info.tag, state: 'existing-release' };
  }

  let tagExists = true;
  try { run('git', ['show-ref', '--verify', '--quiet', 'refs/tags/' + info.tag]); }
  catch (error) { if (error.status === 1) tagExists = false; else throw error; }
  if (tagExists) {
    const target = run('git', ['rev-parse', 'refs/tags/' + info.tag + '^{commit}']).trim();
    assert.equal(target, commit, 'Existing tag points to another commit; never move it. Rerun that commit or use a new manifest version.');
  } else {
    assert.equal(ref, 'refs/heads/main', 'A tag-push run cannot recreate a missing tag');
    run('gh', ['api', '--method', 'POST', 'repos/' + repository + '/git/refs', '-f', 'ref=refs/tags/' + info.tag, '-f', 'sha=' + commit]);
  }

  run('gh', ['release', 'create', info.tag, '--repo', repository, '--verify-tag', '--title', info.name + ' ' + info.version, '--notes-file', notesFile]);
  return { tag: info.tag, state: 'published' };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Publication requires a GitHub push event');
  assert.ok(process.env.RUNNER_TEMP, 'RUNNER_TEMP is required');
  const info = readReleaseInfo(ROOT, process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '');
  const notesFile = join(process.env.RUNNER_TEMP, 'n8n-release-notes.md');
  writeFileSync(notesFile, info.notes);
  const result = publishRelease(info, {
    commit: process.env.GITHUB_SHA, repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, notesFile,
    run: (file, args) => execFileSync(file, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  });
  console.log(result.state === 'published' ? 'Published ' + result.tag : 'Release ' + result.tag + ' already exists; leaving it unchanged.');
}
