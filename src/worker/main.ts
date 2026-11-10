import type { OrcaWorkerApi } from 'orca/worker';
import '../shared/protocol';
import { DEFAULT_URL, REFRESH_INTERVALS, type Preferences, type Placement, type ConnectionKind } from '../shared/types';
import { checkConnection, LauncherError, instanceUrl } from './connection';
import { openBrowser, runCli, currentWorkspace, type Cli } from './OrcaBrowser';
import { apiTransport, normalizeWorkflows, addRecentRuns, normalizeInsights, type ApiTransport, type Connection } from './N8nClient';
type HealthCheck = (url: string, signal: AbortSignal) => Promise<void>;
export function activateWithServices(orca: OrcaWorkerApi, cli: Cli = runCli, check: HealthCheck = checkConnection, transport: ApiTransport = apiTransport) {
  let queue: Promise<unknown> = Promise.resolve();
  let openedThisSession = false;
  function serial<T>(operation: () => Promise<T>): Promise<T> { const result = queue.then(operation); queue = result.catch(() => undefined); return result; }
  async function preferences(): Promise<Preferences> {
    const stored = await orca.storage.get('launcher');
    const data = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    let baseUrl = DEFAULT_URL;
    let connectionKind: ConnectionKind = 'connectionKind' in data && data.connectionKind === 'cloud' ? 'cloud' : 'local';
    try { if ('baseUrl' in data) baseUrl = instanceUrl(data.baseUrl, connectionKind).href; } catch { connectionKind = 'local'; }
    const refreshIntervalSeconds = 'refreshIntervalSeconds' in data && REFRESH_INTERVALS.some(seconds => seconds === data.refreshIntervalSeconds) ? Number(data.refreshIntervalSeconds) : 30;
    return { baseUrl, connectionKind, refreshIntervalSeconds, placement: 'placement' in data && (data.placement === 'right' || data.placement === 'down') ? data.placement : 'tab', onboardingCompleted: 'onboardingCompleted' in data && data.onboardingCompleted === true, ...('lastOpenedAt' in data && typeof data.lastOpenedAt === 'string' ? { lastOpenedAt: data.lastOpenedAt } : {}) };
  }
  async function save(value: Preferences) { await orca.storage.set('launcher', { ...value }); return value; }
  async function apiKey(value: Preferences): Promise<string | undefined> {
    if (!orca.grantedCapabilities.includes('secrets:own')) return undefined;
    const stored = await orca.secrets.get('api-key');
    if (!stored) return undefined;
    try { const data = JSON.parse(stored); if (data.baseUrl === value.baseUrl && data.connectionKind === (value.connectionKind ?? 'local') && typeof data.apiKey === 'string') return data.apiKey; } catch { /* Fail closed for a key bound to another instance. */ }
    return undefined;
  }
  function connection(value: Preferences): Connection { return { baseUrl: value.baseUrl, connectionKind: value.connectionKind ?? 'local' }; }
  async function ready(value: Preferences, signal: AbortSignal) {
    if (value.connectionKind !== 'cloud') { await check(value.baseUrl, signal); return; }
    const key = await apiKey(value);
    if (!key) return; // Cloud browser access does not depend on API availability or trial limits.
    normalizeWorkflows(await transport(connection(value), key, 'api/v1/workflows', { limit: '1', excludePinnedData: 'true' }, signal));
  }
  orca.panels.handle('n8n.state', async (_input, { signal }) => {
    const value = await preferences(); const stored = await orca.storage.get('launcher');
    const hasConnection = !!stored && typeof stored === 'object' && !Array.isArray(stored) && 'baseUrl' in stored && typeof stored.baseUrl === 'string';
    return { preferences: value, hasApiKey: !!await apiKey(value), hasConnection };
  });
  orca.panels.handle('n8n.delete-connection', input => serial(async () => {
    const previous = await preferences();
    if (instanceUrl(input?.baseUrl, input?.connectionKind).href !== previous.baseUrl || input.connectionKind !== (previous.connectionKind ?? 'local')) throw new LauncherError('The connection changed. Reopen settings before deleting it.', 'conflict');
    // Remove credentials first; a secure-storage failure must retain the saved connection.
    if (orca.grantedCapabilities.includes('secrets:own')) await orca.secrets.delete('api-key');
    await orca.storage.delete('launcher');
    openedThisSession = false;
    return preferences();
  }));
  orca.panels.handle('n8n.configure', input => serial(async () => {
    const url = instanceUrl(input?.baseUrl, input?.connectionKind).href;
    const previous = await preferences();
    const changed = previous.baseUrl !== url || previous.connectionKind !== input.connectionKind;
    if (input.refreshIntervalSeconds !== undefined && !REFRESH_INTERVALS.some(seconds => seconds === input.refreshIntervalSeconds)) throw new LauncherError('Choose a supported automatic refresh interval.', 'invalid_params');
    if (input.apiKey !== undefined) {
      if (typeof input.apiKey !== 'string' || !input.apiKey.trim() || input.apiKey.length > 8192 || /[\r\n]/.test(input.apiKey)) throw new LauncherError('Enter a valid n8n API key.', 'invalid_params');
      const protection = await orca.host.call('secrets.protection');
      if (protection.status !== 'os-keyring') throw new LauncherError('Secure API-key storage is unavailable on this Orca host. You can still open n8n in the browser.', 'unavailable');
      await orca.secrets.set('api-key', JSON.stringify({ baseUrl: url, connectionKind: input.connectionKind, apiKey: input.apiKey.trim() }));
    } else if (changed || input.removeKey === true) await orca.secrets.delete('api-key');
    const value: Preferences = { ...previous, baseUrl: url, connectionKind: input.connectionKind, refreshIntervalSeconds: input.refreshIntervalSeconds ?? previous.refreshIntervalSeconds ?? 30, ...(changed ? { onboardingCompleted: false } : {}) };
    if (changed) { delete value.lastOpenedAt; openedThisSession = false; }
    await save(value);
    return { preferences: value, hasApiKey: !!await apiKey(value) };
  }));
  orca.panels.handle('n8n.connect', (input, { signal }) => serial(async () => {
    const previous = await preferences();
    const kind = input?.connectionKind ?? previous.connectionKind ?? 'local';
    const url = instanceUrl(input?.baseUrl, kind).href;
    await ready({ ...previous, baseUrl: url, connectionKind: kind }, signal);
    signal.throwIfAborted();
    const changed = previous.baseUrl !== url || previous.connectionKind !== kind;
    if (changed) {
      openedThisSession = false;
      if (orca.grantedCapabilities.includes('secrets:own')) await orca.secrets.delete('api-key');
    }
    const value: Preferences = { ...previous, baseUrl: url, connectionKind: kind, ...(changed ? { onboardingCompleted: false } : {}) };
    if (changed) delete value.lastOpenedAt;
    return { preferences: await save(value), checkedAt: new Date().toISOString() };
  }));
  orca.panels.handle('n8n.preview-connection', async (input, { signal }) => {
    const baseUrl = instanceUrl(input?.baseUrl, input?.connectionKind).href;
    await ready({ ...await preferences(), baseUrl, connectionKind: input.connectionKind }, signal);
    signal.throwIfAborted();
    return { baseUrl, connectionKind: input.connectionKind, checkedAt: new Date().toISOString() };
  });
  async function launch(input: { placement: Placement; intent?: 'new-workflow' | 'api-settings'; workflowId?: string; preview?: boolean; baseUrl?: string; connectionKind?: ConnectionKind }, signal: AbortSignal, rememberPlacement = true) {
    if (!input || !['tab', 'right', 'down'].includes(input.placement) || (input.intent !== undefined && !['new-workflow', 'api-settings'].includes(input.intent)) || (input.workflowId !== undefined && (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.workflowId) || input.intent))) throw new LauncherError('Choose a tab or split placement and supported action.', 'invalid_params');
    const previous = await preferences();
    if (input.preview !== undefined && typeof input.preview !== 'boolean' || !input.preview && (input.baseUrl !== undefined || input.connectionKind !== undefined)) throw new LauncherError('Unsupported browser preview.', 'invalid_params');
    const target = input.preview ? { ...previous, baseUrl: instanceUrl(input.baseUrl, input.connectionKind!).href, connectionKind: input.connectionKind } : previous;
    // Browser access remains available when API-key permissions are insufficient.
    if (target.connectionKind !== 'cloud') await check(target.baseUrl, signal);
    const path = input.intent === 'new-workflow' ? 'workflow/new' : input.intent === 'api-settings' ? 'settings/api' : input.workflowId ? 'workflow/' + encodeURIComponent(input.workflowId) : '';
    const url = new URL(path, instanceUrl(target.baseUrl, target.connectionKind ?? 'local')).href;
    const workspace = await currentWorkspace(cli, signal);
    const browserPageId = await openBrowser(cli, url, workspace, input.placement, signal, target.baseUrl);
    openedThisSession = true;
    const value = { ...target, ...(rememberPlacement ? { placement: input.placement } : {}), lastOpenedAt: new Date().toISOString() };
    // A persistence failure must not invite retrying a tab that already opened.
    if (!input.preview) await save(value).catch(() => undefined);
    return { browserPageId, preferences: value };
  }
  orca.panels.handle('n8n.open', (input, { signal }) => serial(() => launch(input, signal)));
  orca.commands.register('n8n.new-workflow', (_args, { signal }) => serial(async () => {
    const result = await launch({ placement: 'tab', intent: 'new-workflow' }, signal, false);
    return 'Opened a new workflow in n8n (browser page ' + result.browserPageId + '). Sign in there if needed.';
  }));
  orca.panels.handle('n8n.insights', async (_input, { signal }) => {
    const value = await preferences(), key = await apiKey(value);
    if (!key) throw new LauncherError('Add an API key with insights:read access to view the overview.', 'unavailable');
    const endDate = new Date().toISOString(), startDate = new Date(Date.parse(endDate) - 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await transport(connection(value), key, 'api/v1/insights/summary', { startDate, endDate }, signal);
    return normalizeInsights(result, startDate, endDate);
  });
  orca.panels.handle('n8n.workflows', async (input, { signal }) => {
    if (input?.cursor !== undefined && (typeof input.cursor !== 'string' || input.cursor.length > 4096)) throw new LauncherError('Invalid workflow page cursor.', 'invalid_params');
    const value = await preferences(); const key = await apiKey(value);
    if (!key) throw new LauncherError('Add an API key in connection settings to browse your workflows here.', 'unavailable');
    const page = normalizeWorkflows(await transport(connection(value), key, 'api/v1/workflows', { limit: '25', excludePinnedData: 'true', ...(input?.cursor ? { cursor: input.cursor } : {}) }, signal));
    try { addRecentRuns(page, await transport(connection(value), key, 'api/v1/executions', { limit: '100', includeData: 'false' }, signal)); }
    catch (error) { if (signal.aborted) throw error; page.executionWarning = 'Recent execution status is unavailable. Check execution:list access and retention in n8n.'; }
    return page;
  });
  orca.panels.handle('n8n.complete', (input, { signal }) => serial(async () => {
    const previous = await preferences();
    if (!openedThisSession && !previous.lastOpenedAt) throw new LauncherError('Open n8n in Orca before finishing setup.', 'invalid_params');
    let value = previous;
    if (input) {
      const baseUrl = instanceUrl(input.baseUrl, input.connectionKind).href;
      if (!['tab', 'right', 'down'].includes(input.placement)) throw new LauncherError('Choose a tab or split placement.', 'invalid_params');
      value = { ...previous, baseUrl, connectionKind: input.connectionKind, placement: input.placement, lastOpenedAt: new Date().toISOString() };
      await ready(value, signal); signal.throwIfAborted();
      if ((previous.baseUrl !== baseUrl || previous.connectionKind !== input.connectionKind) && orca.grantedCapabilities.includes('secrets:own')) await orca.secrets.delete('api-key');
    }
    return save({ ...value, onboardingCompleted: true });
  }));
  orca.panels.handle('n8n.reset-onboarding', () => serial(async () => save({ ...await preferences(), onboardingCompleted: false })));
}
export default function activate(orca: OrcaWorkerApi) { activateWithServices(orca); }
