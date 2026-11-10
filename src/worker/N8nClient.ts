import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { instanceUrl, LauncherError } from './connection';
import type { ConnectionKind, WorkflowPage, WorkflowSummary, InsightsSummary } from '../shared/types';
import { normalizePreview } from './workflow-preview';
export interface Connection { baseUrl: string; connectionKind: ConnectionKind }
export type ApiTransport = (connection: Connection, key: string | undefined, path: string, query: Record<string, string>, signal: AbortSignal) => Promise<unknown>;
export function publicAddress(ip: string): boolean {
  if (isIP(ip) === 6) return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(?:db8|0):/i.test(ip);
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 0 && c === 2))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export const apiTransport: ApiTransport = async (connection, key, path, query, signal) => {
  const base = instanceUrl(connection.baseUrl, connection.connectionKind);
  const url = new URL(path, base); for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  if (url.origin !== base.origin) throw new LauncherError('Unsupported API destination.', 'invalid_params');
  const cancel = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const failure = () => new LauncherError(signal.aborted ? 'Request cancelled.' : 'Could not reach n8n. Check the address and connection, then try again.', signal.aborted ? 'cancelled' : 'unavailable');
  if (cancel.aborted) throw failure();
  const addresses = connection.connectionKind === 'local' ? [{ address: hostname === 'localhost' ? '127.0.0.1' : hostname, family: hostname.includes(':') ? 6 : 4 }] : await new Promise<{ address: string; family: number }[]>((resolve, reject) => {
    const abort = () => reject(failure());
    cancel.addEventListener('abort', abort, { once: true });
    lookup(hostname, { all: true }).then(resolve, () => reject(failure())).finally(() => cancel.removeEventListener('abort', abort));
  });
  if (cancel.aborted) throw failure();
  if (!addresses.length || (connection.connectionKind === 'cloud' && addresses.some(item => !publicAddress(item.address)))) throw new LauncherError('The Cloud address resolved to an unsupported network destination.', 'invalid_params');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET', signal: cancel,
      headers: { Accept: 'application/json', ...(key ? { 'X-N8N-API-KEY': key } : {}) },
      lookup: (_hostname, options, callback) => { if (options.all) callback(null, [pinned]); else callback(null, pinned.address, pinned.family); },
    }, response => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        const message = status === 401 ? 'n8n rejected the API key. Replace it in connection settings.' : status === 403 ? 'n8n denied API access. Check key scopes, project permissions, and your Cloud plan.' : status === 429 ? 'n8n rate-limited this request. Wait a moment, then refresh.' : status >= 300 && status < 400 ? 'n8n redirected the API request. Check the instance URL.' : 'n8n could not answer the API request (HTTP ' + status + ').';
        reject(new LauncherError(message, status === 429 ? 'rate_limited' : 'unavailable')); return;
      }
      let size = 0; const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 4 * 1024 * 1024) { request.destroy(); reject(new LauncherError('The n8n response is too large. Use fewer workflows per page.', 'too_large')); } else chunks.push(chunk); });
      response.on('error', () => reject(new LauncherError('n8n disconnected while loading data.', 'unavailable')));
      response.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new LauncherError('n8n returned an unexpected API response. Check the instance URL.', 'unavailable')); } });
    });
    request.on('error', () => reject(failure()));
    request.end();
  });
};
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function identifier(value: unknown): string | undefined { return (typeof value === 'string' || typeof value === 'number') && /^[a-zA-Z0-9_-]{1,128}$/.test(String(value)) ? String(value) : undefined; }
export function normalizeInsights(value: unknown, startDate: string, endDate: string): InsightsSummary {
  if (!record(value)) throw new LauncherError('n8n returned an unexpected insights summary.', 'unavailable');
  function metric(name: string, unit: string): number {
    const item = (value as Record<string, unknown>)[name];
    if (!record(item) || item.unit !== unit || typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0) throw new LauncherError('n8n returned an unexpected insights metric.', 'unavailable');
    return item.value;
  }
  const total = metric('total', 'count'), failed = metric('failed', 'count'), failureRate = metric('failureRate', 'ratio');
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(failed) || failed > total || failureRate > 1) throw new LauncherError('n8n returned an unexpected insights metric.', 'unavailable');
  return { total, failed, failureRate, timeSavedMinutes: metric('timeSaved', 'minute'), averageRunTimeMs: metric('averageRunTime', 'millisecond'), startDate, endDate };
}
export function normalizeWorkflows(value: unknown): WorkflowPage {
  if (!record(value) || !Array.isArray(value.data)) throw new LauncherError('n8n returned an unexpected workflow list.', 'unavailable');
  const data = value.data.slice(0, 25).flatMap(item => {
    if (!record(item)) return []; const id = identifier(item.id); if (!id) return [];
    const state: WorkflowSummary['state'] = item.isArchived === true ? 'archived' : typeof item.activeVersionId === 'string' && item.activeVersionId ? 'published' : item.active === true ? 'published' : item.active === false || 'activeVersionId' in item ? 'draft' : 'unknown';
    const preview = normalizePreview(item);
    return [{ id, name: typeof item.name === 'string' ? item.name.slice(0, 250) : 'Untitled workflow', state, ...(Array.isArray(item.nodes) ? { nodeCount: item.nodes.length } : {}), ...(preview ? { preview } : {}), ...(typeof item.updatedAt === 'string' ? { updatedAt: item.updatedAt } : {}) }];
  });
  const nextCursor = typeof value.nextCursor === 'string' && value.nextCursor.length <= 4096 ? value.nextCursor : undefined;
  return { data, ...(nextCursor ? { nextCursor } : {}) };
}
export function addRecentRuns(page: WorkflowPage, value: unknown): void {
  if (!record(value) || !Array.isArray(value.data)) throw new LauncherError('Execution status is unavailable.', 'unavailable');
  const runs = new Map<string, NonNullable<WorkflowSummary['recentRun']>>();
  for (const item of value.data.slice(0, 100)) {
    if (!record(item)) continue; const workflowId = identifier(item.workflowId); const id = identifier(item.id); if (!workflowId || !id) continue;
    const status = typeof item.status === 'string' && ['success', 'error', 'running', 'waiting', 'canceled', 'crashed', 'new', 'unknown'].includes(item.status) ? item.status : 'unknown';
    const startedAt = typeof item.startedAt === 'string' ? item.startedAt : undefined;
    const previous = runs.get(workflowId);
    if (!previous || (startedAt && (!previous.startedAt || startedAt > previous.startedAt))) runs.set(workflowId, { id, status, ...(startedAt ? { startedAt } : {}) });
  }
  for (const workflow of page.data) if (runs.has(workflow.id)) workflow.recentRun = runs.get(workflow.id);
}
