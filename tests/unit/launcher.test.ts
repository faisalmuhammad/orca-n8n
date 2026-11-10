import { assert, mockHost, mountWorker, test } from 'orca/testing';
import { localUrl, checkConnection } from '../../src/worker/connection';
import { executable, openBrowser, workspaces, type Cli } from '../../src/worker/OrcaBrowser';
import { activateWithServices } from '../../src/worker/main';
import { DEFAULT_URL } from '../../src/shared/types';
const signal = new AbortController().signal;
const selector = 'folder:exact-local-identity';
const available = { worktrees: [{ displayName: 'Project', path: '/tmp/project with spaces', isActive: true, agents: [{ secret: 'unrelated-context' }], address: { environment: 'local', worktree: selector } }, { displayName: 'Remote', path: '/remote', address: { environment: 'ssh', worktree: 'remote' } }], truncated: false };
const calls: string[][] = [];
const cli: Cli = async args => { calls.push(args); return args[0] === 'worktree' ? available : args[1] === 'list' ? { tabs: [] } : { browserPageId: 'page-id' }; };
const capabilities = ['storage:own', 'workspace:read', 'workspace:write', 'secrets:own'];

test('local URLs normalize base paths and reject remote URLs and embedded secrets', async () => {
  assert.equal(localUrl(' http://localhost:5678 ').href, DEFAULT_URL);
  assert.equal(localUrl('https://[::1]:5678/n8n').href, 'https://[::1]:5678/n8n/');
  assert.equal(localUrl('http://127.0.0.1:5678/').href, 'http://127.0.0.1:5678/');
  for (const url of ['https://example.com', 'http://localhost.evil.test', 'file:///tmp/a', 'javascript:alert(1)', 'http://user:pass@localhost:5678', 'http://localhost:5678/?token=secret', 'http://localhost:5678/#secret', 'http://169.254.169.254', 'http://127.0.0.2']) await assert.rejects(async () => localUrl(url));
});
test('health checks pin loopback, preserve the base path and prohibit redirects', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  await checkConnection('http://localhost:5678/n8n/', signal, async (url, options) => { requests.push({ url: String(url), options }); return new Response('{"status":"ok"}'); });
  assert.equal(requests[0].url, 'http://127.0.0.1:5678/n8n/healthz');
  assert.equal(requests[0].options?.redirect, 'error');
  assert.equal(requests[0].options?.credentials, 'omit');
  assert.ok(requests[0].options?.signal instanceof AbortSignal);
});
test('health checks reject unrelated servers, oversized data, startup failures and cancellation', async () => {
  for (const response of [new Response('<html>login</html>'), new Response('{"status":"other"}'), new Response('x'.repeat(1025)), new Response('private server details', { status: 503 })]) await assert.rejects(() => checkConnection(DEFAULT_URL, signal, async () => response));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => checkConnection(DEFAULT_URL, abort.signal, async () => { throw new Error('private transport message'); }), /cancelled/);
});
test('CLI resolver honors Orca overrides and uses orca-ide on Linux', () => {
  assert.equal(executable({ ORCA_CLI_COMMAND: '/custom/orca' }, 'linux'), '/custom/orca');
  assert.equal(executable({ ORCA_DEV_REPO_ROOT: '/dev' }, 'darwin'), 'orca-dev');
  assert.equal(executable({}, 'linux'), 'orca-ide');
  assert.equal(executable({}, 'darwin'), 'orca');
});
test('workspace projection removes session metadata and remote destinations', async () => {
  const items = await workspaces(cli, signal);
  assert.deepEqual(items, [{ selector, name: 'Project', path: '/tmp/project with spaces', active: true }]);
  assert.ok(!JSON.stringify(items).includes('unrelated-context'));
  await assert.rejects(() => workspaces(async () => ({ ...available, truncated: true }), signal));
});
test('browser launcher preserves exact selectors and uses structured tab and split arguments', async () => {
  for (const placement of ['tab', 'right', 'down'] as const) {
    calls.length = 0;
    assert.equal(await openBrowser(cli, DEFAULT_URL, selector, placement, signal), 'page-id');
    assert.deepEqual(calls.find(args => args[1] === 'create'), ['tab', 'create', '--url', DEFAULT_URL, '--environment', 'local', '--worktree', selector, ...(placement === 'tab' ? [] : ['--split', placement]), '--json']);
    assert.deepEqual(calls.at(-1), ['tab', 'switch', '--page', 'page-id', '--focus', '--environment', 'local', '--worktree', selector, '--json']);
  }
  calls.length = 0;
  await assert.rejects(() => openBrowser(cli, DEFAULT_URL, 'folder:removed', 'tab', signal));
  assert.equal(calls.length, 1);
});
test('browser-only onboarding persists preferences without writing secrets or workflow files', async () => {
  let checks = 0;
  const host = mockHost({ capabilities });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => { checks++; }) }, { host });
  try {
    const state = await worker.request('n8n.state'); assert.equal(state.preferences.baseUrl, DEFAULT_URL);
    await assert.rejects(() => worker.request('n8n.complete'));
    await worker.request('n8n.connect', { baseUrl: DEFAULT_URL });
    const result = await worker.request('n8n.open', { placement: 'right' });
    assert.equal(result.browserPageId, 'page-id'); assert.equal(checks, 2);
    assert.equal((await worker.request('n8n.complete')).onboardingCompleted, true);
    assert.equal((await worker.request('n8n.state')).preferences.placement, 'right');
    assert.equal((await worker.request('n8n.reset-onboarding')).onboardingCompleted, false);
    assert.deepEqual(host.data().secrets, {}); assert.deepEqual(worker.logs, []);
    assert.ok(host.calls.every(call => !call.method.startsWith('editor.') && (!call.method.startsWith('secrets.') || call.method === 'secrets.get')));
  } finally { await worker.deactivate(); }
});
test('failed checks do not replace a working address; changing instance resets completion', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, workspace: selector, placement: 'tab', onboardingCompleted: true, lastOpenedAt: '2026-11-10T10:00:00Z' } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async url => { if (url.includes(':1/')) throw new Error('Offline'); }) }, { host });
  try {
    await assert.rejects(() => worker.request('n8n.connect', { baseUrl: 'http://localhost:1/' }));
    assert.equal((await worker.request('n8n.state')).preferences.baseUrl, DEFAULT_URL);
    const connected = await worker.request('n8n.connect', { baseUrl: 'http://localhost:6789/' });
    assert.equal(connected.preferences.onboardingCompleted, false); assert.equal(connected.preferences.lastOpenedAt, undefined);
  } finally { await worker.deactivate(); }
});
test('failed browser launch never marks setup opened or complete', async () => {
  const host = mockHost({ capabilities });
  const worker = await mountWorker({ default: api => activateWithServices(api, async args => args[0] === 'worktree' ? available : {}, async () => undefined) }, { host });
  try {
    await assert.rejects(() => worker.request('n8n.open', { placement: 'tab' }));
    assert.equal((await worker.request('n8n.state')).preferences.lastOpenedAt, undefined);
    await assert.rejects(() => worker.request('n8n.complete'));
  } finally { await worker.deactivate(); }
});
test('new workflow requests open the official route under the configured base path', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: 'http://localhost:5678/n8n/', workspace: selector, placement: 'right', onboardingCompleted: true } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined) }, { host });
  try {
    calls.length = 0;
    await worker.request('n8n.open', { placement: 'right', intent: 'new-workflow' });
    assert.deepEqual(calls.find(args => args[1] === 'create'), ['tab', 'create', '--url', 'http://localhost:5678/n8n/workflow/new', '--environment', 'local', '--worktree', selector, '--split', 'right', '--json']);
    await assert.rejects(() => worker.request('n8n.open', { placement: 'tab', intent: 'unknown' as 'new-workflow' }));
  } finally { await worker.deactivate(); }
});
test('palette creation uses the active workspace without replacing saved sidebar placement', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, workspace: 'folder:saved-other', placement: 'down', onboardingCompleted: true } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined) }, { host });
  try {
    calls.length = 0;
    assert.ok(String(await worker.command('n8n.new-workflow')).includes('Opened a new workflow'));
    assert.deepEqual(calls.find(args => args[1] === 'create'), ['tab', 'create', '--url', 'http://localhost:5678/workflow/new', '--environment', 'local', '--worktree', selector, '--json']);
    const prefs = (await worker.request('n8n.state')).preferences;
    assert.ok(!('workspace' in prefs)); assert.equal(prefs.placement, 'down');
  } finally { await worker.deactivate(); }
});
test('palette refuses ambiguous destinations and offline instances before opening a tab', async () => {
  for (const scenario of ['ambiguous', 'offline']) {
    let created = false;
    const host = mockHost({ capabilities });
    const worker = await mountWorker({ default: api => activateWithServices(api, async args => {
      if (args[0] === 'tab') { if (args[1] === 'create') created = true; return args[1] === 'list' ? { tabs: [] } : { browserPageId: 'page' }; }
      return scenario === 'ambiguous' ? { ...available, worktrees: [...available.worktrees, available.worktrees[0]] } : available;
    }, async () => { if (scenario === 'offline') throw new Error('Instance is offline'); }) }, { host });
    try { await assert.rejects(() => worker.command('n8n.new-workflow')); assert.equal(created, false); }
    finally { await worker.deactivate(); }
  }
});
test('browser launcher reuses and focuses an n8n editor, preserving the same workflow and guarding navigation', async () => {
  const existing = { browserPageId: 'existing-page', url: DEFAULT_URL + 'workflow/a?view=editor', active: true };
  for (const target of [DEFAULT_URL, DEFAULT_URL + 'workflow/a', DEFAULT_URL + 'workflow/b']) {
    const routed: string[][] = [];
    const reuse: Cli = async args => { routed.push(args); return args[0] === 'worktree' ? available : { tabs: [existing] }; };
    assert.equal(await openBrowser(reuse, target, selector, 'right', signal), 'existing-page');
    assert.ok(!routed.some(args => args[1] === 'create'));
    assert.equal(routed.some(args => args[0] === 'goto'), target.endsWith('workflow/b'));
    if (target.endsWith('workflow/b')) assert.deepEqual(routed.find(args => args[0] === 'goto'), ['goto', '--page', 'existing-page', '--url', target, '--expect-url', existing.url, '--environment', 'local', '--worktree', selector, '--json']);
    assert.ok(routed.at(-1)?.includes('--focus'));
  }
});
test('setup previews preserve saved connection, placement, and API key until explicitly saved', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, connectionKind: 'local', workspace: selector, placement: 'tab', onboardingCompleted: true, lastOpenedAt: '2026-11-10T10:00:00Z' } }, secrets: { 'api-key': JSON.stringify({ baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' }) } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined) }, { host });
  const before = JSON.stringify(host.data());
  try {
    const baseUrl = 'http://localhost:6789/';
    await worker.request('n8n.preview-connection', { baseUrl, connectionKind: 'local' });
    await worker.request('n8n.open', { baseUrl, connectionKind: 'local', placement: 'right', preview: true });
    assert.equal(JSON.stringify(host.data()), before);
    assert.equal((await worker.request('n8n.state')).hasApiKey, true);
    await assert.rejects(() => worker.request('n8n.complete', { baseUrl, connectionKind: 'local', placement: 'invalid' as 'right' }));
    assert.equal(JSON.stringify(host.data()), before);
    const saved = await worker.request('n8n.complete', { baseUrl, connectionKind: 'local', placement: 'right' });
    assert.equal(saved.baseUrl, baseUrl); assert.equal(saved.placement, 'right'); assert.equal(saved.onboardingCompleted, true); assert.deepEqual(host.data().secrets, {});
  } finally { await worker.deactivate(); }
});

test('sidebar actions resolve the current workspace each time and discard the legacy saved workspace', async () => {
  let current = 'folder:first';
  const routed: string[][] = [];
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, workspace: 'folder:stale-saved', placement: 'right', onboardingCompleted: true } } });
  const dynamic: Cli = async args => {
    routed.push(args);
    if (args[0] === 'worktree') return { worktrees: ['folder:first', 'folder:second'].map(worktree => ({ displayName: worktree, path: '/tmp/' + worktree, isActive: worktree === current, address: { environment: 'local', worktree } })), truncated: false };
    return args[1] === 'list' ? { tabs: [] } : { browserPageId: 'page-id' };
  };
  const worker = await mountWorker({ default: api => activateWithServices(api, dynamic, async () => undefined) }, { host });
  try {
    await worker.request('n8n.open', { placement: 'right', intent: 'new-workflow' });
    assert.ok(routed.find(args => args[1] === 'create')?.includes('folder:first'));
    current = 'folder:second'; routed.length = 0;
    await worker.request('n8n.open', { placement: 'right', workflowId: 'wf1' });
    assert.ok(routed.find(args => args[1] === 'create')?.includes('folder:second'));
    assert.ok(routed.find(args => args[1] === 'create')?.includes(DEFAULT_URL + 'workflow/wf1'));
    assert.ok(!('workspace' in (await worker.request('n8n.state')).preferences));
    assert.ok(!JSON.stringify(host.data().storage).includes('stale-saved'));
  } finally { await worker.deactivate(); }
});
