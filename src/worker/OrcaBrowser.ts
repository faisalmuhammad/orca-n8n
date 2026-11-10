import { execFile } from 'node:child_process';
import type { Placement, WorkspaceTarget } from '../shared/types';
import { LauncherError } from './connection';
export type Cli = (args: string[], signal: AbortSignal) => Promise<unknown>;
export function executable(env = process.env, platform = process.platform): string {
  return env.ORCA_CLI_COMMAND || (env.ORCA_DEV_REPO_ROOT ? 'orca-dev' : platform === 'linux' ? 'orca-ide' : 'orca');
}
export const runCli: Cli = (args, signal) => new Promise((resolve, reject) => {
  execFile(executable(), args, { signal, timeout: 12000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
    let data: unknown;
    try { data = JSON.parse(stdout); } catch { /* Do not expose raw CLI output or other sessions' metadata. */ }
    if (error || !isRecord(data) || data.ok !== true) {
      reject(new LauncherError(signal.aborted ? 'Browser request cancelled.' : 'Orca could not complete the browser request. Check that Orca is running and its CLI is available, then refresh the sidebar.', signal.aborted ? 'cancelled' : 'unavailable'));
    } else resolve(data.result);
  });
});
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export async function workspaces(cli: Cli, signal: AbortSignal): Promise<WorkspaceTarget[]> {
  const data = await cli(['worktree', 'ps', '--json'], signal);
  if (!isRecord(data) || !Array.isArray(data.worktrees) || data.truncated) throw new LauncherError('Orca could not list all destinations. Refresh the sidebar.', 'unavailable');
  return data.worktrees.flatMap(item => {
    if (!isRecord(item) || !isRecord(item.address) || item.address.environment !== 'local' || typeof item.address.worktree !== 'string' || typeof item.path !== 'string' || item.isArchived === true) return [];
    return [{ selector: item.address.worktree, name: typeof item.displayName === 'string' ? item.displayName : item.path, path: item.path, active: item.isActive === true }];
  });
}
export async function openBrowser(cli: Cli, url: string, workspace: string, placement: Placement, signal: AbortSignal, baseUrl = new URL(url).origin + '/'): Promise<string> {
  if (!(await workspaces(cli, signal)).some(item => item.selector === workspace)) throw new LauncherError('That workspace is no longer available. Refresh and choose a local workspace.', 'invalid_params');
  if (!['tab', 'right', 'down'].includes(placement)) throw new LauncherError('Choose a tab or split placement.', 'invalid_params');
  const target = new URL(url); const base = new URL(baseUrl);
  const listed = await cli(['tab', 'list', '--environment', 'local', '--worktree', workspace, '--json'], signal);
  if (!isRecord(listed) || !Array.isArray(listed.tabs)) throw new LauncherError('Orca could not check existing n8n tabs. Refresh and try again.', 'unavailable');
  const candidates = listed.tabs.flatMap(item => {
    if (!isRecord(item) || typeof item.url !== 'string' || typeof item.browserPageId !== 'string' || item.browserPageId.startsWith('popup-')) return [];
    try { const current = new URL(item.url); if (current.origin !== base.origin || !current.pathname.startsWith(base.pathname)) return [];
      return [{ page: item.browserPageId, url: item.url, path: current.pathname, rank: current.pathname === target.pathname ? 0 : item.active === true ? 1 : current.pathname.startsWith(new URL('workflow/', base).pathname) ? 2 : 3 }];
    } catch { return []; }
  }).sort((a, b) => a.rank - b.rank);
  let browserPageId: string;
  if (candidates.length) {
    const existing = candidates[0]; browserPageId = existing.page;
    // Opening n8n itself preserves the current editor and its unsaved changes.
    if (target.href !== base.href && existing.path !== target.pathname) await cli(['goto', '--page', browserPageId, '--url', url, '--expect-url', existing.url, '--environment', 'local', '--worktree', workspace, '--json'], signal);
  } else {
    const args = ['tab', 'create', '--url', url, '--environment', 'local', '--worktree', workspace];
    if (placement !== 'tab') args.push('--split', placement);
    args.push('--json');
    const data = await cli(args, signal);
    if (!isRecord(data) || typeof data.browserPageId !== 'string' || !data.browserPageId) throw new LauncherError('Orca did not confirm a browser tab. Refresh and try again.', 'unavailable');
    browserPageId = data.browserPageId;
  }
  await cli(['tab', 'switch', '--page', browserPageId, '--focus', '--environment', 'local', '--worktree', workspace, '--json'], signal);
  return browserPageId;
}

export async function currentWorkspace(cli: Cli, signal: AbortSignal): Promise<string> {
  const active = (await workspaces(cli, signal)).filter(item => item.active);
  if (active.length !== 1) throw new LauncherError('Open a local Orca workspace, then try opening n8n again.', 'unavailable');
  return active[0].selector;
}
