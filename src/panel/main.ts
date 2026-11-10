import type {} from 'orca/frame';
import '../shared/protocol';
import { version } from '../../orca-plugin.json';
import { DEFAULT_URL, REFRESH_INTERVALS, type Preferences, type ConnectionKind, type WorkflowSummary, type InsightsSummary } from '../shared/types';
import { newestWorkflows } from '../shared/workflow-order';
import { el, button, field, select, theme, icon } from '../ui/dom';
import { dropdown, closeDropdown } from '../ui/dropdown';
import { emptyState } from '../ui/empty-state';
import { workflowCard } from '../ui/workflow-card';
import type { PreviewViewport } from '../ui/workflow-preview';
import { insightsCard } from '../ui/insights';

theme(); orca.on('theme', theme);
const root = el('main', undefined, 'panel'); document.body.append(root);
const signal = new AbortController();
let prefs: Preferences = { baseUrl: DEFAULT_URL, placement: 'tab', onboardingCompleted: false };
let draftUrl = DEFAULT_URL.replace(/\/$/, '');
let step = 1;
let busy = '';
let connected = false;
let opened = false;
let error = '';
let loading = true;
let editing = false;
let settingsVisible = false;
let draftKind: ConnectionKind = 'local';
let hasApiKey = false;
let hasConnection = false;
let workflowItems: WorkflowSummary[] = [];
const expandedWorkflows = new Set<string>();
const previewViewports = new Map<string, PreviewViewport>();
function pruneWorkflowViews() {
  const loadedKeys = new Set(workflowItems.map(item => JSON.stringify([prefs.baseUrl, item.id])));
  for (const key of expandedWorkflows) if (!loadedKeys.has(key)) expandedWorkflows.delete(key);
  for (const key of previewViewports.keys()) if (!loadedKeys.has(key)) previewViewports.delete(key);
}
let workflowCursor: string | undefined;
let workflowError = '';
let executionWarning = '';
let workflowsLoading = false;
let workflowsLoaded = false;
let workflowSearch = '';
let workflowFilter = '';
let browseGeneration = 0;
let browseAbort = new AbortController();
let refreshTimer: number | undefined;
let setupSnapshot: { preferences: Preferences; connected: boolean } | undefined;
let overviewExpanded = false;
let overview: InsightsSummary | undefined;
let overviewLoading = false;
let overviewError = '';
let overviewGeneration = 0;
let overviewAbort = new AbortController();
function clearOverview() { overviewAbort.abort(); ++overviewGeneration; overview = undefined; overviewLoading = false; overviewError = ''; overviewExpanded = false; }
async function loadOverview() {
  if (!hasApiKey || !overviewExpanded || overviewLoading) return;
  overviewAbort.abort(); overviewAbort = new AbortController(); const token = ++overviewGeneration;
  overviewLoading = true; overviewError = ''; render();
  try {
    const result = await orca.plugin.request('n8n.insights', undefined, { signal: overviewAbort.signal });
    if (token === overviewGeneration) overview = result;
  } catch (value) { if (token === overviewGeneration) overviewError = value instanceof Error ? value.message : 'Insights are unavailable.'; }
  finally { if (token === overviewGeneration) { overviewLoading = false; render(); } }
}
function toggleOverview() {
  overviewExpanded = !overviewExpanded;
  if (!overviewExpanded) { overviewAbort.abort(); ++overviewGeneration; overviewLoading = false; }
  render();
  if (overviewExpanded) void loadOverview();
  root.querySelector<HTMLButtonElement>('.insights-toggle')?.focus();
}

function action(label: string, run: () => Promise<void> | void, primary = false) {
  const control = button(label, run, primary ? 'action primary' : 'action');
  if (primary) control.append(icon('arrow'));
  control.disabled = Boolean(busy) || loading;
  return control;
}
async function task(name: string, run: () => Promise<void>) {
  if (busy) return;
  busy = name; error = ''; render();
  try { await run(); } catch (value) { error = value instanceof Error ? value.message : 'Something went wrong. Try again.'; }
  finally { busy = ''; render(); focusStep(); }
}
function notify() {
  const status = el('div', error, 'notice'); status.dataset.status = ''; status.hidden = !error; status.setAttribute('role', 'alert'); return status;
}
function connectionBadge(current = true) {
  const badge = el('span', undefined, 'status-dot connection-badge');
  badge.dataset.current = String(current);
  badge.dataset.state = !current ? 'offline' : busy === 'connect' ? 'checking' : connected ? 'online' : 'offline';
  const status = !current ? 'Not configured' : busy === 'connect' ? 'Checking connection' : connected ? prefs.connectionKind === 'cloud' && !hasApiKey ? 'Configured' : 'Connected' : 'Not checked';
  badge.setAttribute('role', 'img'); badge.setAttribute('aria-label', status); badge.title = status;
  return badge;
}
function header() {
  const header = el('header', undefined, 'brand-header');
  const logo = el('div', undefined, 'logo');
  for (const mode of ['light', 'dark']) { const img = el('img', undefined, 'logo-' + mode); img.src = './assets/n8n-logo-' + mode + '.svg'; img.alt = 'n8n'; img.width = 88; img.height = 32; logo.append(img); }
  const title = el('span', 'Workflows in Orca', 'brand-subtitle');
  const mark = el('div', undefined, 'brand-lockup'); mark.append(logo, title);
  const tools = el('div', undefined, 'header-tools');
  const kind = prefs.connectionKind ?? 'local';
  const currentTitle = kind === 'local' ? 'Local n8n' : 'n8n Cloud';
  function connectionCopy(title: string, current: boolean) {
    const copy = el('span', undefined, 'connection-copy');
    const name = el('span', undefined, 'connection-name'); name.append(connectionBadge(current), el('span', title, 'connection-title')); copy.append(name);
    return copy;
  }
  const picker = dropdown('Connections', kind, ['local', 'cloud'].map(value => ({ value, label: value === 'local' ? 'Local n8n' : 'n8n Cloud', content: () => {
    const option = el('span', undefined, 'connection-option'); const symbol = el('span', undefined, 'connection-symbol'); symbol.append(icon(value === 'local' ? 'server' : 'cloud'));
    const copy = connectionCopy(value === 'local' ? 'Local n8n' : 'n8n Cloud', value === kind);
    copy.append(el('span', value === kind ? new URL(prefs.baseUrl).host : 'Set up connection', 'connection-address'));
    option.append(symbol, copy); return option;
  }, select: () => { if (value !== kind) showSettings(value as ConnectionKind); } })), () => connectionCopy(currentTitle, true), () => {
    const actions = el('div', undefined, 'dropdown-extra');
    if (prefs.onboardingCompleted) actions.append(button('Change connection or layout', () => beginSetup(connected ? 2 : 1), 'dropdown-link'), button('View setup guide', () => beginSetup(1), 'dropdown-link'));
    return actions;
  }); picker.element.classList.add('connection-picker'); picker.trigger.disabled = Boolean(busy) || loading || settingsVisible;
  const settings = button('', showSettings, 'icon-button'); settings.append(icon('settings')); settings.setAttribute('aria-label', 'Connection settings'); settings.title = 'Connection settings'; settings.disabled = Boolean(busy) || loading;
  tools.append(picker.element, settings); header.append(mark, tools); return header;
}
function hero() {
  const section = el('section', undefined, 'hero');
  const texture = el('div', undefined, 'dot-grid'); texture.setAttribute('aria-hidden', 'true');
  section.append(texture, el('p', 'Bring your workflows into Orca.', 'hero-title'), el('p', 'Connect an instance, choose your layout, and open n8n.', 'hero-copy'));
  return section;
}
function progress() {
  const section = el('div', undefined, 'setup-progress');
  const row = el('div', undefined, 'section-label'); row.append(el('h1', editing ? 'Update setup' : 'Get started'), el('span', 'Step ' + step + ' of 3', 'muted'));
  const bars = el('div', undefined, 'progress-bars'); bars.setAttribute('aria-hidden', 'true');
  for (let i = 1; i <= 3; i++) { const bar = el('span'); bar.dataset.current = String(i <= step); bars.append(bar); }
  section.append(row, bars); return section;
}
function stepCard(number: number, title: string, subtitle: string, content: () => HTMLElement, done: boolean, available: boolean) {
  const card = el('section', undefined, 'step-card'); card.dataset.active = String(step === number); card.dataset.done = String(done);
  const toggle = button('', () => { if (available) { step = number; error = ''; render(); } }, 'step-heading'); toggle.disabled = !available || Boolean(busy) || loading;
  toggle.setAttribute('aria-label', title); toggle.setAttribute('aria-expanded', String(step === number)); toggle.setAttribute('aria-controls', 'step-' + number);
  if (step === number) toggle.setAttribute('aria-current', 'step');
  const numberBadge = el('span', done ? '' : String(number), 'step-number'); if (done) numberBadge.append(icon('check'));
  const copy = el('span', undefined, 'step-copy'); copy.append(el('span', title, 'step-title'), el('span', subtitle, 'muted'));
  toggle.append(numberBadge, copy, icon('chevron')); card.append(toggle);
  const body = el('div', undefined, 'step-body'); body.id = 'step-' + number; body.hidden = step !== number; if (step === number) body.append(content()); card.append(body); return card;
}
async function check() {
  await task('connect', async () => {
    connected = false;
    const changed = prefs.baseUrl.replace(/\/$/, '') !== draftUrl || (prefs.connectionKind ?? 'local') !== draftKind;
    if (changed) { browseAbort.abort(); ++browseGeneration; workflowsLoading = false; clearOverview(); }
    if (setupSnapshot) {
      const result = await orca.plugin.request('n8n.preview-connection', { baseUrl: draftUrl, connectionKind: draftKind }, { signal: signal.signal });
      prefs = { ...prefs, baseUrl: result.baseUrl, connectionKind: result.connectionKind };
    } else {
      const result = await orca.plugin.request('n8n.connect', { baseUrl: draftUrl, connectionKind: draftKind }, { signal: signal.signal });
      prefs = { ...result.preferences, placement: prefs.placement };
      hasConnection = true;
    }
    draftUrl = prefs.baseUrl.replace(/\/$/, ''); connected = true;
    if (changed) { hasApiKey = false; workflowsLoaded = false; workflowItems = []; workflowCursor = undefined; workflowError = ''; executionWarning = ''; }
  });
}
function connectStep() {
  const body = el('div', undefined, 'stack');
  body.append(el('p', draftKind === 'cloud' ? 'Save your Cloud address, then sign in in n8n.' : 'Check that your local n8n instance is ready.', 'muted'));
  const form = el('form', undefined, 'stack');
  const kind = select('Connection type', [['local', 'Local n8n'], ['cloud', 'n8n Cloud']]); kind.value = draftKind; kind.disabled = Boolean(busy) || loading;
  kind.addEventListener('change', () => { draftKind = kind.value as ConnectionKind; draftUrl = draftKind === (prefs.connectionKind ?? 'local') ? prefs.baseUrl.replace(/\/$/, '') : draftKind === 'local' ? DEFAULT_URL.replace(/\/$/, '') : ''; connected = false; opened = false; render(); });
  const input = el('input'); input.type = 'url'; input.required = true; input.value = draftUrl; input.placeholder = draftKind === 'local' ? 'http://localhost:5678' : 'https://your-team.app.n8n.cloud'; input.autocomplete = 'off'; input.spellcheck = false; input.id = 'instance-url'; input.setAttribute('aria-describedby', 'url-help'); input.disabled = Boolean(busy) || loading;
  const help = el('p', draftKind === 'local' ? 'Use the address and port of your running n8n instance. Sign in directly in n8n.' : 'Use the HTTPS address of your n8n Cloud workspace. API access is optional.', 'help'); help.id = 'url-help';
  const submit = el('button', busy === 'connect' ? 'Checking connection…' : connected ? 'Check again' : 'Check connection', connected ? 'action' : 'action primary'); submit.type = 'submit'; submit.disabled = Boolean(busy) || loading; if (!connected) submit.append(icon('arrow'));
  input.addEventListener('input', () => { draftUrl = input.value; connected = false; opened = false; submit.textContent = 'Check connection'; submit.className = 'action primary'; submit.append(icon('arrow')); const next = document.querySelector<HTMLButtonElement>('[data-continue]'); if (next) next.disabled = true; root.querySelectorAll('.connection-badge[data-current=true]').forEach(badge => badge.replaceWith(connectionBadge())); });
  form.append(field('Connection', kind), field('Instance URL', input), help, submit);
  form.addEventListener('submit', event => { event.preventDefault(); void check(); });
  body.append(form);
  if (connected) {
    const ready = el('div', undefined, 'ready-note'); ready.append(icon('check'), el('span', draftKind === 'cloud' ? 'Cloud address saved. Sign in in the n8n tab.' : 'n8n is ready on port ' + (new URL(prefs.baseUrl).port || (prefs.baseUrl.startsWith('https') ? '443' : '80')) + '.'));
    body.append(ready);
    const next = action('Continue', () => { step = 2; render(); focusStep(); }, true); next.dataset.continue = ''; body.append(next);
  }
  const helpDetails = el('details', undefined, 'help-details'); helpDetails.append(el('summary', 'Need to start n8n?'), el('p', 'Start your local n8n instance, wait for it to finish loading, then paste its address above.', 'muted')); body.append(helpDetails);
  return body;
}
function destinationStep() {
  const body = el('div', undefined, 'stack');
  body.append(el('p', 'n8n opens automatically in your current Orca workspace.', 'muted'), el('span', 'Open the editor as', 'field-title'));
  const choices = el('div', undefined, 'placement-options'); choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', 'Editor placement');
  for (const [placement, name] of [['tab', 'Tab'], ['right', 'Right split'], ['down', 'Below']] as const) {
    const control = button('', () => { prefs.placement = placement; for (const item of choices.querySelectorAll('button')) item.setAttribute('aria-pressed', String(item.dataset.placement === placement)); }, 'placement');
    control.dataset.placement = placement; control.setAttribute('aria-label', name); control.setAttribute('aria-pressed', String(prefs.placement === placement)); control.disabled = Boolean(busy);
    control.append(icon(placement), el('span', name)); choices.append(control);
  }
  const next = action('Continue to n8n', () => { step = 3; render(); focusStep(); }, true); next.disabled ||= !connected;
  body.append(choices, el('p', 'A split keeps your code and workflows in view together.', 'muted'), next);
  return body;
}
async function open(intent?: 'new-workflow' | 'api-settings', workflowId?: string) {
  let launched = false;
  await task('open', async () => {
    try { const result = await orca.plugin.request('n8n.open', { placement: prefs.placement, ...(intent ? { intent } : {}), ...(workflowId ? { workflowId } : {}), ...(setupSnapshot ? { preview: true, baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? 'local' } : {}) }, { signal: signal.signal }); prefs = result.preferences; opened = true; launched = true; }
    catch (value) { connected = false; throw value; }
  });
  if (launched && intent === 'new-workflow' && hasApiKey && prefs.onboardingCompleted && !setupSnapshot) await loadWorkflows();
}
function launchStep() {
  const body = el('div', undefined, 'stack');
  if (opened) { const note = el('div', undefined, 'ready-note'); note.setAttribute('role', 'status'); note.append(icon('check'), el('span', 'Your n8n tab is open.')); body.append(note); }
  const tips = el('ol', undefined, 'launch-tips');
  for (const [title, description] of [['Sign in or create your account', prefs.connectionKind === 'cloud' ? 'Sign in to your n8n Cloud workspace in the browser tab.' : 'Finish account setup in the n8n tab if this is your first visit.'], ['Create your first workflow', 'Choose a trigger, connect your nodes, and test in n8n’s editor.'], ['Bring your workflow list here', 'Optional: create an API key in n8n Settings → n8n API, then add it with the settings icon above.']]) { const item = el('li'); item.append(el('span', title, 'tip-title'), el('p', description, 'muted')); tips.append(item); }
  body.append(tips);
  const launch = action(busy === 'open' ? 'Opening n8n…' : opened ? 'Show n8n editor' : 'Open n8n in Orca', () => open(), !opened); launch.disabled ||= !connected; body.append(launch);
  if (opened) body.append(action(setupSnapshot ? 'Save setup' : 'Finish setup', async () => { await task('complete', async () => { prefs = await orca.plugin.request('n8n.complete', setupSnapshot ? { baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? 'local', placement: prefs.placement } : undefined, { signal: signal.signal }); hasApiKey = (await orca.plugin.request('n8n.state', undefined, { signal: signal.signal })).hasApiKey; editing = false; setupSnapshot = undefined; }); if (!error && hasApiKey) await loadWorkflows(); }, true));
  body.append(el('p', 'Your login stays in n8n’s browser session.', 'help'));
  return body;
}
function focusStep() { root.querySelector<HTMLButtonElement>('[aria-current=step]')?.focus(); }
function beginSetup(startStep: number) {
  setupSnapshot ??= { preferences: { ...prefs }, connected };
  editing = true; step = startStep; opened = false; error = ''; draftKind = prefs.connectionKind ?? 'local'; draftUrl = prefs.baseUrl.replace(/\/$/, ''); render(); focusStep();
}
async function cancelSetup() {
  if (!setupSnapshot) return;
  await task('cancel-setup', async () => {
    const result = await orca.plugin.request('n8n.state', undefined, { signal: signal.signal });
    connected = !!setupSnapshot?.connected && result.preferences.baseUrl === setupSnapshot.preferences.baseUrl;
    prefs = result.preferences; hasApiKey = result.hasApiKey; hasConnection = result.hasConnection;
    draftKind = prefs.connectionKind ?? 'local'; draftUrl = prefs.baseUrl.replace(/\/$/, ''); editing = false; setupSnapshot = undefined; settingsVisible = false; opened = false;
  });
  if (!error && hasApiKey) await loadWorkflows();
}
function showSettings(kind?: ConnectionKind) {
  if (busy) return;
  settingsVisible = true; error = ''; draftKind = kind ?? prefs.connectionKind ?? 'local'; draftUrl = draftKind === (prefs.connectionKind ?? 'local') ? prefs.baseUrl.replace(/\/$/, '') : draftKind === 'local' ? DEFAULT_URL.replace(/\/$/, '') : ''; render();
  root.querySelector<HTMLInputElement>('#settings-url')?.focus();
}
function settingsForm() {
  const card = el('section', undefined, 'home-card');
  card.append(el('h1', 'Connection settings'), el('p', 'Choose where n8n runs. Add an API key to show workflows and execution status in this sidebar.', 'muted'));
  const form = el('form', undefined, 'stack');
  const kind = select('Connection type', [['local', 'Local n8n'], ['cloud', 'n8n Cloud']]); kind.value = draftKind; kind.disabled = Boolean(busy);
  const url = el('input'); url.id = 'settings-url'; url.type = 'url'; url.required = true; url.value = draftUrl; url.autocomplete = 'off'; url.spellcheck = false; url.placeholder = draftKind === 'local' ? 'http://localhost:5678' : 'https://your-team.app.n8n.cloud'; url.disabled = Boolean(busy);
  kind.addEventListener('change', () => { draftKind = kind.value as ConnectionKind; draftUrl = draftKind === (prefs.connectionKind ?? 'local') ? prefs.baseUrl.replace(/\/$/, '') : draftKind === 'local' ? DEFAULT_URL.replace(/\/$/, '') : ''; render(); });
  url.addEventListener('input', () => { draftUrl = url.value; });
  const key = el('input'); key.type = 'password'; key.autocomplete = 'off'; key.spellcheck = false; key.placeholder = hasApiKey ? 'Leave blank to keep the stored key' : 'Paste your n8n API key'; key.disabled = Boolean(busy);
  const remove = el('input'); remove.type = 'checkbox'; remove.disabled = Boolean(busy) || !hasApiKey;
  form.append(field('Connection', kind), field('Instance URL', url), field('API key (optional)', key), el('p', 'In n8n, open Settings → n8n API → Create an API key. Workflows need workflow:list; recent runs need execution:list; overview needs insights:read.', 'help'));
  if (draftKind === 'cloud') form.append(el('p', 'n8n Cloud API access is unavailable during the free trial. You can still use the browser editor without a key.', 'help'));
  if (hasApiKey) form.append(field('Remove stored API key', remove));
  const refresh = select('Automatic refresh', REFRESH_INTERVALS.map(seconds => [String(seconds), seconds === 0 ? 'Off — manual refresh only' : seconds < 60 ? 'Every ' + seconds + ' seconds' : 'Every ' + seconds / 60 + (seconds === 60 ? ' minute' : ' minutes')]));
  refresh.value = String(prefs.refreshIntervalSeconds ?? 30); refresh.disabled = Boolean(busy);
  form.append(field('Automatic refresh', refresh), el('p', 'Refresh pauses while settings are open, you are typing, or the panel is hidden.', 'help'));
  const save = el('button', busy === 'settings' ? 'Saving and testing…' : 'Save and test', 'action primary'); save.type = 'submit'; save.disabled = Boolean(busy); save.append(icon('arrow')); form.append(save);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const apiKey = key.value; key.value = '';
    const baseUrl = url.value; const connectionKind = draftKind; const removeKey = remove.checked;
    const refreshIntervalSeconds = Number(refresh.value);
    void task('settings', async () => {
      browseAbort.abort(); ++browseGeneration; clearOverview(); workflowsLoading = false; workflowsLoaded = false; workflowItems = []; workflowCursor = undefined; workflowError = ''; connected = false;
      const result = await orca.plugin.request('n8n.configure', { baseUrl, connectionKind, refreshIntervalSeconds, ...(apiKey ? { apiKey } : {}), ...(removeKey ? { removeKey } : {}) }, { signal: signal.signal });
      prefs = { ...result.preferences, placement: prefs.placement }; hasApiKey = result.hasApiKey; hasConnection = true; draftUrl = prefs.baseUrl.replace(/\/$/, ''); draftKind = prefs.connectionKind ?? 'local';
      await orca.plugin.request('n8n.connect', { baseUrl: prefs.baseUrl, connectionKind: draftKind }, { signal: signal.signal }); connected = true;
      if (hasApiKey) {
        const page = await orca.plugin.request('n8n.workflows', undefined, { signal: signal.signal });
        workflowItems = page.data; workflowsLoaded = true; workflowCursor = page.nextCursor; executionWarning = page.executionWarning ?? '';
      }
      pruneWorkflowViews();
      settingsVisible = false;
    });
  });
  card.append(form);
  const apiSettings = action('Open API settings in n8n', () => open('api-settings')); card.append(apiSettings);
  if (hasConnection) card.append(connectionRemoval());
  const close = button('Back', () => { key.value = ''; settingsVisible = false; error = ''; draftKind = prefs.connectionKind ?? 'local'; draftUrl = prefs.baseUrl.replace(/\/$/, ''); render(); }, 'text-button'); close.disabled = Boolean(busy); card.append(close);
  return card;
}
function connectionRemoval() {
  const section = el('div', undefined, 'connection-removal');
  function cancel() { section.replaceChildren(remove); remove.focus(); }
  const remove = button(busy === 'delete-connection' ? 'Deleting connection…' : 'Delete connection', () => {
    const saved = { baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? 'local' };
    const confirmation = el('div', undefined, 'delete-confirmation'); confirmation.setAttribute('role', 'group'); confirmation.setAttribute('aria-label', 'Delete connection confirmation');
    confirmation.append(el('h2', 'Delete this connection?'), el('p', new URL(saved.baseUrl).host, 'connection-address'), el('p', 'Remove the saved connection, API key, and sidebar setup from Orca. Your n8n instance and workflows stay available.', 'muted'));
    const choices = el('div', undefined, 'connection-actions');
    const keep = button('Keep connection', cancel, 'action');
    const confirm = button('Delete connection', async () => {
      await task('delete-connection', async () => {
        browseAbort.abort(); ++browseGeneration; workflowsLoading = false; window.clearTimeout(refreshTimer);
        prefs = await orca.plugin.request('n8n.delete-connection', saved, { signal: signal.signal });
        hasConnection = false; hasApiKey = false; connected = false; opened = false; settingsVisible = false; editing = false; setupSnapshot = undefined; clearOverview();
        workflowItems = []; expandedWorkflows.clear(); previewViewports.clear(); workflowCursor = undefined; workflowError = ''; executionWarning = ''; workflowsLoaded = false; workflowSearch = ''; workflowFilter = '';
        draftKind = prefs.connectionKind ?? 'local'; draftUrl = prefs.baseUrl.replace(/\/$/, ''); step = 1;
      });
    }, 'action delete-confirm');
    choices.append(keep, confirm); confirmation.append(choices); section.replaceChildren(confirmation); keep.focus();
  }, 'action delete-confirm'); remove.disabled = Boolean(busy);
  section.addEventListener('keydown', event => { if (event.key === 'Escape' && section.querySelector('.delete-confirmation')) { event.preventDefault(); cancel(); } });
  section.append(remove); return section;
}
async function loadWorkflows(more = false) {
  if (!hasApiKey || (more && (!workflowCursor || workflowItems.length >= 500))) return;
  browseAbort.abort(); browseAbort = new AbortController(); const token = ++browseGeneration;
  workflowsLoading = true; workflowError = ''; render();
  try {
    const page = await orca.plugin.request('n8n.workflows', more ? { cursor: workflowCursor } : undefined, { signal: browseAbort.signal });
    if (token !== browseGeneration) return;
    workflowItems = [...new Map((more ? [...workflowItems, ...page.data] : page.data).map(item => [item.id, item])).values()].slice(0, 500);
    pruneWorkflowViews();
    workflowCursor = page.nextCursor; executionWarning = page.executionWarning ?? '';
    workflowsLoaded = true;
  } catch (value) { if (token === browseGeneration) workflowError = value instanceof Error ? value.message : 'Could not load workflows. Refresh to try again.'; }
  finally { if (token === browseGeneration) { workflowsLoading = false; render(); } }
}
async function refreshSidebar() {
  if (busy || workflowsLoading || loading) return;
  if (hasApiKey && prefs.onboardingCompleted) await Promise.all([loadWorkflows(), loadOverview()]); else await check();
}
function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  const seconds = prefs.refreshIntervalSeconds ?? 30;
  if (!seconds || !prefs.onboardingCompleted || settingsVisible || editing || loading || document.hidden) return;
  refreshTimer = window.setTimeout(async () => {
    const typing = root.contains(document.activeElement) && document.activeElement?.matches('input, select, [role=combobox], [role=option]');
    if (!typing && !busy && !workflowsLoading) await refreshSidebar();
    scheduleRefresh();
  }, seconds * 1000);
}
function workflowSection() {
  const section = el('section', undefined, 'workflow-section');
  const heading = el('div', undefined, 'section-label'); const title = el('div', undefined, 'workflow-heading'); title.append(el('h2', 'Workflows'), el('span', String(workflowItems.length), 'muted'));
  const refresh = button('', refreshSidebar, 'icon-button'); refresh.append(icon('refresh')); refresh.setAttribute('aria-label', 'Refresh workflows'); refresh.title = 'Refresh workflows'; refresh.disabled = Boolean(busy) || workflowsLoading; heading.append(title, refresh); section.append(heading);
  if (!hasApiKey) {
    const state = emptyState('connect', 'Bring your workflows into view', 'Add an API key to see your workflows and their status here.');
    state.append(action('Connect workflow list', showSettings));
    const scroll = el('div', undefined, 'workflow-scroll'); scroll.append(state); section.append(scroll); return section;
  }
  const search = el('input'); search.type = 'search'; search.value = workflowSearch; search.placeholder = 'Search workflows'; search.setAttribute('aria-label', 'Search workflows');
  const filter = dropdown('Workflow status', workflowFilter, [['', 'All statuses'], ['published', 'Published'], ['draft', 'Draft'], ['archived', 'Archived']].map(([value, label]) => ({ value, label, select: () => { workflowFilter = value; renderList(); } })));
  const list = el('div', undefined, 'workflow-list');
  function renderList() {
    list.replaceChildren();
    const items = newestWorkflows(workflowItems).filter(item => item.name.toLowerCase().includes(workflowSearch.toLowerCase()) && (!workflowFilter || item.state === workflowFilter));
    for (const item of items) {
      const key = JSON.stringify([prefs.baseUrl, item.id]);
      list.append(workflowCard(item, () => open(undefined, item.id), Boolean(busy), {
        expanded: expandedWorkflows.has(key), setExpanded: expanded => { if (expanded) expandedWorkflows.add(key); else expandedWorkflows.delete(key); },
        previewViewport: previewViewports.get(key), setPreviewViewport: viewport => previewViewports.set(key, viewport)
      }));
    }
    if (!items.length) {
      if (workflowsLoading) list.append(emptyState('loading', 'Loading workflows…', 'Fetching your workflows from n8n.'));
      else if (workflowError || error) { const state = emptyState('error', 'Couldn’t load workflows', 'Check your connection and try again.'); state.append(action('Try again', refreshSidebar)); list.append(state); }
      else if (!workflowsLoaded) list.append(emptyState('loading', 'Loading workflows…', 'Fetching your workflows from n8n.'));
      else if (workflowSearch || workflowFilter || workflowItems.length) {
        const state = emptyState('search', 'No matching workflows', 'Try a different search or status. Filters apply to the loaded workflows.');
        state.append(button('Clear filters', () => { workflowSearch = ''; workflowFilter = ''; render(); root.querySelector<HTMLInputElement>('[aria-label="Search workflows"]')?.focus(); }, 'empty-action')); list.append(state);
      } else {
        const state = emptyState('empty', 'Your next workflow starts here', 'Create a workflow in n8n. It will appear here after the next refresh.');
        const create = action('Create a workflow', () => open('new-workflow')); create.disabled ||= !connected; state.append(create); list.append(state);
      }
    }
  }
  search.addEventListener('input', () => { workflowSearch = search.value; renderList(); }); renderList();
  const controls = el('div', undefined, 'workflow-controls'); controls.append(search, filter.element); section.append(controls);
  const scroll = el('div', undefined, 'workflow-scroll'); scroll.append(list); section.append(scroll);
  if (workflowsLoading && workflowItems.length) { const loading = el('p', 'Refreshing workflows…', 'muted'); loading.setAttribute('role', 'status'); section.append(loading); }
  if (workflowError) { const error = el('p', workflowError, 'notice'); error.setAttribute('role', 'alert'); section.append(error); }
  if (executionWarning) section.append(el('p', executionWarning, 'help'));
  if (workflowCursor && workflowItems.length < 500) { const more = action('Load more workflows', () => loadWorkflows(true)); more.disabled ||= workflowsLoading; scroll.append(more); }
  if (workflowItems.length >= 500) section.append(el('p', 'Showing up to 500 workflows. Use n8n to browse the full instance.', 'help'));
  return section;
}
function homeActions() {
  const card = el('section', undefined, 'action-bar');
  card.setAttribute('aria-label', 'n8n actions');
  const create = button('New Workflow', () => open('new-workflow'), 'action primary'); create.setAttribute('aria-label', 'New n8n workflow'); create.disabled = Boolean(busy) || !connected;
  const launch = button(busy === 'open' ? 'Opening…' : 'Open n8n', () => open(), 'action'); launch.setAttribute('aria-label', 'Open n8n in Orca'); launch.disabled = Boolean(busy) || !connected;
  card.append(create, launch); return card;
}
function render() {
  const scrollTop = root.querySelector('.workflow-scroll')?.scrollTop ?? 0;
  closeDropdown();
  const isHome = prefs.onboardingCompleted && !editing;
  root.replaceChildren(header(), notify());
  const content = el('div', undefined, 'panel-body');
  if (loading) { const loadingText = el('p', 'Getting your workspace ready…', 'loading'); loadingText.setAttribute('role', 'status'); content.append(loadingText); }
  else if (settingsVisible) content.append(settingsForm());
  else if (isHome) {
    root.append(homeActions()); content.dataset.view = 'home';
    if (hasApiKey) content.append(insightsCard({ expanded: overviewExpanded, summary: overview, loading: overviewLoading, error: overviewError, toggle: toggleOverview, refresh: loadOverview }));
    content.append(workflowSection());
  }
  else {
    if (!setupSnapshot) content.append(hero());
    if (setupSnapshot) { const back = button('Back to workflows', cancelSetup, 'back-button'); back.setAttribute('aria-label', 'Back to workflows'); back.disabled = Boolean(busy); content.append(back); }
    content.append(progress(), stepCard(1, 'Connect your instance', connected ? 'Your instance is configured' : 'Local or n8n Cloud', connectStep, connected, true), stepCard(2, 'Make room for workflows', 'Choose a tab or split', destinationStep, step > 2, connected), stepCard(3, 'Start building', 'Sign in and create a workflow', launchStep, opened, connected));
  }
  if (error) content.append(button('Refresh sidebar', initialise, 'text-button'));
  const footer = el('footer', undefined, 'footer');
  const release = el('span', 'v' + version, 'plugin-version'); release.setAttribute('aria-label', 'Plugin version ' + version);
  footer.append(el('span', 'Unofficial plugin for managing n8n workflows in Orca.'), release);
  root.append(content, footer);
  const scroll = root.querySelector('.workflow-scroll'); if (scroll) scroll.scrollTop = scrollTop;
  root.setAttribute('aria-busy', String(loading || !!busy)); scheduleRefresh();
}
async function initialise() {
  if (busy) return;
  loading = true; connected = false; opened = false; step = 1; error = ''; clearOverview(); render();
  try { const result = await orca.plugin.request('n8n.state', undefined, { signal: signal.signal }); prefs = result.preferences; hasApiKey = result.hasApiKey; hasConnection = result.hasConnection; draftKind = prefs.connectionKind ?? 'local'; draftUrl = prefs.baseUrl.replace(/\/$/, ''); }
  catch (value) { error = value instanceof Error ? value.message : 'Worker unavailable. Refresh to try again.'; }
  finally { loading = false; render(); }
  if (!error && prefs.onboardingCompleted) await check();
  if (!error && hasApiKey && prefs.onboardingCompleted) await loadWorkflows();
}
document.addEventListener('visibilitychange', scheduleRefresh);
window.addEventListener('pagehide', () => { window.clearTimeout(refreshTimer); signal.abort(); browseAbort.abort(); overviewAbort.abort(); }, { once: true });
void initialise();
