import { assert, hostError, mockHost, mountWorker, test } from 'orca/testing';
import { instanceUrl } from '../../src/worker/connection';
import { apiTransport, publicAddress, normalizeWorkflows, addRecentRuns, normalizeInsights } from '../../src/worker/N8nClient';
import { newestWorkflows } from '../../src/shared/workflow-order';
import { activateWithServices } from '../../src/worker/main';
import { DEFAULT_URL } from '../../src/shared/types';
const capabilities = ['storage:own', 'workspace:read', 'workspace:write', 'secrets:own'];
const cli = async () => ({ worktrees: [], truncated: false });
test('workflow order uses actual update times across pages, keeping missing dates last and equal dates stable', () => {
  const items = normalizeWorkflows({ data: [
    { id: 'missing' }, { id: 'old', updatedAt: '2026-11-09T20:00:00Z' }, { id: 'invalid', updatedAt: 'invalid' },
    { id: 'new', updatedAt: '2026-11-10T10:00:00+02:00' }, { id: 'same', updatedAt: '2026-11-10T08:00:00Z' }
  ] }).data;
  assert.deepEqual(newestWorkflows(items).map(item => item.id), ['new', 'same', 'old', 'missing', 'invalid']);
  assert.equal(items[0].id, 'missing');
});
const insightResponse = { total: { value: 12, unit: 'count' }, failed: { value: 3, unit: 'count' }, failureRate: { value: .25, unit: 'ratio' }, timeSaved: { value: 90, unit: 'minute' }, averageRunTime: { value: 1500, unit: 'millisecond' } };
test('insights preserve API units and zero values without returning unknown data', () => {
  assert.deepEqual(normalizeInsights({ ...insightResponse, secret: 'private' }, 'start', 'end'), { total: 12, failed: 3, failureRate: .25, timeSavedMinutes: 90, averageRunTimeMs: 1500, startDate: 'start', endDate: 'end' });
  const zero = Object.fromEntries(Object.entries(insightResponse).map(([key, metric]) => [key, { ...metric, value: 0 }]));
  assert.equal(normalizeInsights(zero, 'start', 'end').total, 0);
  for (const value of [null, {}, { ...insightResponse, total: { value: '12', unit: 'count' } }, { ...insightResponse, timeSaved: { value: 90, unit: 'second' } }, { ...insightResponse, failed: { value: 13, unit: 'count' } }, { ...insightResponse, failureRate: { value: 25, unit: 'ratio' } }, { ...insightResponse, averageRunTime: { value: Infinity, unit: 'millisecond' } }]) assert.throws(() => normalizeInsights(value, 'start', 'end'));
});
test('overview requests only the public insights endpoint with a seven-day range and an isolated key', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, connectionKind: 'local' } }, secrets: { 'api-key': JSON.stringify({ baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' }) } });
  const requests: { path: string; query: Record<string, string> }[] = [];
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined, async (_connection, key, path, query) => { assert.equal(key, 'private-key'); requests.push({ path, query }); return insightResponse; }) }, { host });
  try {
    const result = await worker.request('n8n.insights');
    assert.equal(requests[0].path, 'api/v1/insights/summary');
    assert.equal(Date.parse(requests[0].query.endDate) - Date.parse(requests[0].query.startDate), 7 * 24 * 60 * 60 * 1000);
    assert.equal(result.total, 12); assert.ok(!JSON.stringify(result).includes('private-key')); assert.deepEqual(worker.logs, []);
  } finally { await worker.deactivate(); }
});
test('overview without a key makes no requests and failed API access is not a zero summary', async () => {
  let requests = 0;
  const host = mockHost({ capabilities, results: { 'secrets.protection': { status: 'os-keyring' } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined, async () => { requests++; throw new Error('Permission denied'); }) }, { host });
  try {
    await assert.rejects(() => worker.request('n8n.insights')); assert.equal(requests, 0);
    await worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' });
    await assert.rejects(() => worker.request('n8n.insights')); assert.equal(requests, 1);
  } finally { await worker.deactivate(); }
});
test('deleting local or Cloud connections removes preferences and credentials without contacting n8n', async () => {
  for (const connectionKind of ['local', 'cloud'] as const) {
    const baseUrl = connectionKind === 'local' ? 'http://localhost:6789/' : 'https://team.app.n8n.cloud/';
    const host = mockHost({ capabilities, storage: { launcher: { baseUrl, connectionKind, onboardingCompleted: true, lastOpenedAt: '2026-11-10T10:00:00Z' }, unrelated: 'keep' }, secrets: { 'api-key': JSON.stringify({ baseUrl, connectionKind, apiKey: 'private-key' }), unrelated: 'keep' } });
    let networkCalls = 0;
    const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => { networkCalls++; }, async () => { networkCalls++; return { data: [] }; }) }, { host });
    try {
      assert.equal((await worker.request('n8n.state')).hasConnection, true);
      await worker.request('n8n.delete-connection', { baseUrl, connectionKind });
      const state = await worker.request('n8n.state');
      assert.equal(state.hasConnection, false); assert.equal(state.hasApiKey, false); assert.equal(state.preferences.onboardingCompleted, false); assert.equal(state.preferences.lastOpenedAt, undefined);
      assert.deepEqual(host.data().storage, { unrelated: 'keep' }); assert.deepEqual(host.data().secrets, { unrelated: 'keep' }); assert.equal(networkCalls, 0);
      await assert.rejects(() => worker.request('n8n.workflows'));
      await assert.rejects(() => worker.request('n8n.complete'));
    } finally { await worker.deactivate(); }
  }
});
test('a stale deletion cannot remove a different saved connection or its key', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: 'http://localhost:6789/', connectionKind: 'local' } }, secrets: { 'api-key': 'keep' } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli) }, { host });
  const before = JSON.stringify(host.data());
  try {
    await assert.rejects(() => worker.request('n8n.delete-connection', { baseUrl: DEFAULT_URL, connectionKind: 'local' }), /connection changed/);
    assert.equal(JSON.stringify(host.data()), before);
  } finally { await worker.deactivate(); }
});
test('failed credential removal leaves the saved connection available for recovery', async () => {
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, connectionKind: 'local', onboardingCompleted: true } }, secrets: { 'api-key': 'keep' }, results: { 'secrets.delete': () => { throw hostError('unavailable', 'Secure storage is unavailable.'); } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli) }, { host });
  const before = JSON.stringify(host.data());
  try {
    await assert.rejects(() => worker.request('n8n.delete-connection', { baseUrl: DEFAULT_URL, connectionKind: 'local' }), /Secure storage/);
    assert.equal(JSON.stringify(host.data()), before); assert.equal((await worker.request('n8n.state')).hasConnection, true);
  } finally { await worker.deactivate(); }
});
test('refresh settings default to 30 seconds, persist valid intervals, and reject unsupported intervals', async () => {
  const host = mockHost({ capabilities });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli) }, { host });
  try {
    assert.equal((await worker.request('n8n.state')).preferences.refreshIntervalSeconds, 30);
    await worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', refreshIntervalSeconds: 0 });
    assert.equal((await worker.request('n8n.state')).preferences.refreshIntervalSeconds, 0);
    await assert.rejects(() => worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', refreshIntervalSeconds: 1 }));
    assert.equal((await worker.request('n8n.state')).preferences.refreshIntervalSeconds, 0);
  } finally { await worker.deactivate(); }
});
test('API transport rejects cancelled requests and paths to another origin before sending credentials', async () => {
  const abort = new AbortController(); abort.abort();
  await assert.rejects(() => apiTransport({ baseUrl: 'https://team.app.n8n.cloud/', connectionKind: 'cloud' }, 'private-key', 'api/v1/workflows', {}, abort.signal), /cancelled/);
  await assert.rejects(() => apiTransport({ baseUrl: DEFAULT_URL, connectionKind: 'local' }, 'private-key', 'https://other.app.n8n.cloud/api/v1/workflows', {}, new AbortController().signal), /destination/);
});
test('Cloud requires n8n Cloud HTTPS addresses and blocks unsafe destinations', async () => {
  assert.equal(instanceUrl('https://team.app.n8n.cloud', 'cloud').href, 'https://team.app.n8n.cloud/');
  for (const url of ['http://team.app.n8n.cloud', 'https://n8n.cloud.evil.test', 'https://localhost', 'https://team.app.n8n.cloud:8080', 'https://secret@team.app.n8n.cloud', 'https://team.app.n8n.cloud/?token=secret']) await assert.rejects(async () => instanceUrl(url, 'cloud'));
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '172.16.0.1', '100.64.0.1', '::1', '::ffff:127.0.0.1', 'fd00::1', '2001:db8::1']) assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress('8.8.8.8'), true); assert.equal(publicAddress('2606:4700:4700::1111'), true);
});
test('workflow metadata preserves publication and archive state and excludes node parameters', () => {
  const page = normalizeWorkflows({ data: [{ id: 'a', name: 'A', active: false, activeVersionId: 'published', nodes: [{ parameters: { password: 'private' } }] }, { id: 'b', name: 'B', active: false }, { id: 'c', name: 'C', isArchived: true }, { id: 'd', name: 'D' }], nextCursor: 'next' });
  assert.deepEqual(page.data.map(w => w.state), ['published', 'draft', 'archived', 'unknown']); assert.equal(page.nextCursor, 'next'); assert.equal(page.data[0].nodeCount, 1); assert.equal(page.data[1].nodeCount, undefined); assert.ok(!JSON.stringify(page).includes('private'));
  addRecentRuns(page, { data: [{ id: 'ex1', workflowId: 'a', status: 'error', startedAt: '2026-11-10T10:00:00Z', data: { secret: 'must-not-show' } }, { id: 'ex2', workflowId: 'a', status: 'success', startedAt: '2026-11-10T11:00:00Z' }] });
  assert.equal(page.data[0].recentRun?.status, 'success'); assert.ok(!JSON.stringify(page).includes('must-not-show')); assert.equal(page.data[1].recentRun, undefined);
});
test('API keys are bound to a connection and isolated in secure storage', async () => {
  const host = mockHost({ capabilities, results: { 'secrets.protection': { status: 'os-keyring' } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined, async () => ({ data: [] })) }, { host });
  try {
    const result = await worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' });
    assert.equal(result.hasApiKey, true); assert.ok(!JSON.stringify(result).includes('private-key')); assert.ok(!JSON.stringify(host.data().storage).includes('private-key'));
    await worker.request('n8n.connect', { baseUrl: 'http://localhost:6789/', connectionKind: 'local' });
    assert.equal((await worker.request('n8n.state')).hasApiKey, false); assert.deepEqual(host.data().secrets, {});
    await worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' });
    await worker.request('n8n.configure', { baseUrl: 'https://team.app.n8n.cloud/', connectionKind: 'cloud' });
    assert.equal((await worker.request('n8n.state')).hasApiKey, false); assert.deepEqual(host.data().secrets, {});
  } finally { await worker.deactivate(); }
});
test('unavailable secure storage never falls back to plaintext key storage', async () => {
  const host = mockHost({ capabilities, results: { 'secrets.protection': { status: 'unavailable' } } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli) }, { host });
  try { await assert.rejects(() => worker.request('n8n.configure', { baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'private-key' })); assert.deepEqual(host.data().secrets, {}); assert.deepEqual(host.data().storage, {}); }
  finally { await worker.deactivate(); }
});
test('public API pagination and optional execution status use only read endpoints', async () => {
  const requests: { path: string; query: Record<string, string> }[] = [];
  const host = mockHost({ capabilities, storage: { launcher: { baseUrl: DEFAULT_URL, connectionKind: 'local', workspace: '', placement: 'tab', onboardingCompleted: true } }, secrets: { 'api-key': JSON.stringify({ baseUrl: DEFAULT_URL, connectionKind: 'local', apiKey: 'key' }) } });
  const worker = await mountWorker({ default: api => activateWithServices(api, cli, async () => undefined, async (_connection, key, path, query) => { assert.equal(key, 'key'); requests.push({ path, query }); if (path.endsWith('/executions')) throw new Error('Permission denied'); return { data: [{ id: 'wf1', name: 'Workflow', active: false }], nextCursor: 'next' }; }) }, { host });
  try { const page = await worker.request('n8n.workflows', { cursor: 'cursor' }); assert.equal(page.data.length, 1); assert.ok(page.executionWarning); assert.equal(requests[0].query.cursor, 'cursor'); assert.equal(requests[1].query.includeData, 'false'); assert.deepEqual(worker.logs, []); }
  finally { await worker.deactivate(); }
});
