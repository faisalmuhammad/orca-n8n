import type { WorkflowSummary } from '../shared/types';
import { button, el, icon } from './dom';
import { workflowPreview, type PreviewViewport } from './workflow-preview';

function timestamp(value: string | undefined, label: string, prefix = '') {
  if (!value) return;
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return;
  const age = Date.now() - date.getTime();
  const text = age >= -60000 && age < 60000 ? 'Just now' : age >= 60000 && age < 3600000 ? Math.floor(age / 60000) + 'm ago' : age >= 3600000 && age < 86400000 ? Math.floor(age / 3600000) + 'h ago' : age >= 86400000 && age < 604800000 ? Math.floor(age / 86400000) + 'd ago' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  const time = el('time', prefix + text); time.dateTime = date.toISOString(); time.title = label + ' ' + date.toLocaleString(); time.setAttribute('aria-label', time.title); return time;
}

export function workflowCard(item: WorkflowSummary, open: () => Promise<void>, disabled: boolean, state: { expanded: boolean; setExpanded: (expanded: boolean) => void; previewViewport?: PreviewViewport; setPreviewViewport?: (viewport: PreviewViewport) => void }) {
  const row = el('article', undefined, 'workflow-row'); row.setAttribute('aria-label', item.name);
  const details = el('div', undefined, 'workflow-details'); details.id = 'workflow-details-' + encodeURIComponent(item.id);
  let expanded = state.expanded;
  let previewRendered = false;
  function updateExpansion() {
    if (expanded && !previewRendered && item.preview?.nodes.length) { details.prepend(workflowPreview(item.preview, state.previewViewport, state.setPreviewViewport)); previewRendered = true; }
    row.dataset.expanded = String(expanded); details.hidden = !expanded; name.setAttribute('aria-expanded', String(expanded));
  }
  function toggle() { expanded = !expanded; state.setExpanded(expanded); updateExpansion(); }
  const name = button(item.name, toggle, 'workflow-name'); name.title = item.name; name.setAttribute('aria-controls', details.id);
  const status = el('span', undefined, 'workflow-state'); status.dataset.state = item.state;
  const statusLabel = item.state === 'published' ? 'Published' : item.state === 'draft' ? 'Draft' : item.state === 'archived' ? 'Archived' : 'Unavailable';
  status.setAttribute('role', 'img'); status.setAttribute('aria-label', statusLabel); status.tabIndex = 0;
  const dot = el('span', undefined, 'status-dot'); dot.setAttribute('aria-hidden', 'true');
  status.append(dot);
  const statusTooltip = el('span', statusLabel, 'workflow-status-tooltip'); statusTooltip.id = 'workflow-status-' + encodeURIComponent(item.id); statusTooltip.setAttribute('role', 'tooltip');
  status.setAttribute('aria-describedby', statusTooltip.id);
  const statusIndicator = el('span', undefined, 'workflow-status'); statusIndicator.append(status, statusTooltip);
  status.addEventListener('keydown', event => { if (event.key === 'Escape') { statusIndicator.dataset.tooltipDismissed = 'true'; event.preventDefault(); event.stopPropagation(); } });
  statusIndicator.addEventListener('mouseleave', () => { delete statusIndicator.dataset.tooltipDismissed; });
  status.addEventListener('blur', () => { delete statusIndicator.dataset.tooltipDismissed; });
  const emblem = el('span', undefined, 'workflow-emblem'); emblem.append(icon('workflow'));
  const copy = el('div', undefined, 'workflow-copy'); copy.append(name);
  const chevron = icon('chevron'); chevron.classList.add('workflow-disclosure-icon');
  const identity = el('div', undefined, 'workflow-identity'); identity.append(chevron, emblem, copy);
  const openButton = button('Open', open, 'open-workflow'); openButton.setAttribute('aria-label', 'Open ' + item.name); openButton.disabled = disabled;
  const actions = el('div', undefined, 'workflow-row-actions'); actions.append(statusIndicator, openButton);
  const heading = el('div', undefined, 'workflow-row-heading'); heading.append(identity, actions); row.append(heading);

  const meta = el('div', undefined, 'workflow-meta');
  if (item.nodeCount !== undefined) { const nodes = el('span', undefined, 'workflow-node-count'); nodes.append(icon('workflow'), el('span', item.nodeCount.toLocaleString() + (item.nodeCount === 1 ? ' node' : ' nodes'))); meta.append(nodes); }
  const updated = timestamp(item.updatedAt, 'Updated', 'Updated '); if (updated) meta.append(updated);
  if (meta.childElementCount) row.append(meta);

  const titles: Record<string, string> = { success: 'Succeeded', error: 'Failed', running: 'Running', waiting: 'Waiting', canceled: 'Canceled', crashed: 'Crashed', new: 'Queued', unknown: 'Unavailable' };
  const failed = item.recentRun?.status === 'error' || item.recentRun?.status === 'crashed';
  const run = el('div', undefined, 'workflow-run'); run.dataset.state = failed ? 'failed' : item.recentRun ? 'observed' : 'none';
  const evidence = el('span', undefined, 'workflow-run-evidence'); evidence.append(icon(failed ? 'close' : item.recentRun?.status === 'success' ? 'check' : 'clock'), el('span', item.recentRun ? 'Recent run: ' + (titles[item.recentRun.status] ?? 'Unavailable') : 'No recent run'));
  run.append(evidence); const started = timestamp(item.recentRun?.startedAt, 'Started'); if (started) run.append(started);
  details.append(run); row.append(details); updateExpansion();
  row.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('button, a, input, select, .workflow-preview, .workflow-status')) return;
    if (window.getSelection()?.toString()) return;
    toggle();
  });
  return row;
}
