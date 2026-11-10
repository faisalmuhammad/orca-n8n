import type { InsightsSummary } from '../shared/types';
import { el, button, icon } from './dom';

function duration(milliseconds: number): string {
  if (milliseconds === 0) return '0s';
  if (milliseconds < 1000) return Math.round(milliseconds).toLocaleString() + 'ms';
  if (milliseconds < 60000) return (milliseconds / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 's';
  if (milliseconds < 3600000) return (milliseconds / 60000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'm';
  return (milliseconds / 3600000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'h';
}
export function insightsCard(state: { expanded: boolean; summary?: InsightsSummary; loading: boolean; error: string; toggle: () => void; refresh: () => Promise<void> }) {
  const card = el('section', undefined, 'insights-card'); card.setAttribute('aria-label', 'Execution overview');
  const heading = el('div', undefined, 'insights-heading');
  const toggle = button('', state.toggle, 'insights-toggle'); toggle.setAttribute('aria-label', 'Execution overview'); toggle.setAttribute('aria-expanded', String(state.expanded)); toggle.setAttribute('aria-controls', 'insights-details');
  toggle.append(icon('chevron'), el('span', 'Overview'), el('span', 'Last 7 days', 'muted insights-range')); heading.append(toggle);
  if (state.expanded) {
    const refresh = button('', state.refresh, 'icon-button'); refresh.append(icon('refresh')); refresh.setAttribute('aria-label', 'Refresh overview'); refresh.title = 'Refresh overview'; refresh.disabled = state.loading; heading.append(refresh);
  }
  card.append(heading);
  const details = el('div', undefined, 'insights-details'); details.id = 'insights-details'; details.hidden = !state.expanded; card.append(details);
  if (!state.expanded) return card;
  if (state.error) {
    const error = el('p', 'Overview unavailable. Your instance must support insights and your API key needs insights:read access.', 'help'); error.setAttribute('role', 'status'); error.title = state.error; details.append(error);
  } else if (state.summary) {
    const data = state.summary, grid = el('dl', undefined, 'insights-grid');
    for (const [label, value, name] of [
      ['Prod. runs', data.total.toLocaleString(), 'total'],
      ['Failed runs', data.failed.toLocaleString(), 'failed'],
      ['Failure rate', (data.failureRate * 100).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '%', 'rate'],
      ['Time saved', duration(data.timeSavedMinutes * 60000), 'saved'],
      ['Avg. run time', duration(data.averageRunTimeMs), 'duration']
    ]) { const metric = el('div', undefined, 'insight-metric'); metric.dataset.metric = name; metric.append(el('dt', label), el('dd', value)); grid.append(metric); }
    details.append(grid);
    toggle.title = 'Reported by n8n · ' + data.startDate + ' – ' + data.endDate;
  }
  if (state.loading) { const loading = el('p', 'Loading overview…', 'help'); loading.setAttribute('role', 'status'); details.append(loading); }
  if (state.error) { const retry = button('Try again', state.refresh, 'text-button'); retry.disabled = state.loading; details.append(retry); }
  return card;
}
