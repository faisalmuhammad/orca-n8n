import type { WorkflowSummary } from './types';

export function newestWorkflows(items: WorkflowSummary[]): WorkflowSummary[] {
  const updated = (item: WorkflowSummary) => { const time = Date.parse(item.updatedAt ?? ''); return Number.isFinite(time) ? time : -Infinity; };
  return [...items].sort((a, b) => { const left = updated(a), right = updated(b); return left === right ? 0 : left > right ? -1 : 1; });
}
