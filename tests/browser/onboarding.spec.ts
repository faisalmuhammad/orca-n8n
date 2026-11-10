import { test, expect, type Page } from '@playwright/test';
async function frame(page: Page, options: { completed?: boolean; missingWorkspaces?: boolean; failState?: boolean; hasKey?: boolean; manyWorkflows?: boolean; holdWorkflows?: boolean } = {}) {
  await page.addInitScript(options => {
    const callbacks: (() => void)[] = [];
    const calls: { name: string; input?: any }[] = [];
    const preview = { nodes: [
      { name: 'Webhook', type: 'Webhook', position: [0, 80] }, { name: 'Validate customer', type: 'Code', position: [160, 80] },
      { name: 'Check account', type: 'If', position: [320, 80] }, { name: 'Welcome email', type: 'Email', position: [480, 0] },
      { name: 'Update CRM', type: 'Action', position: [640, 0] }, { name: 'Log result', type: 'Code', position: [480, 160] },
      { name: 'Notify team', type: 'Action', position: [640, 160] }
    ], edges: [{ source: 0, target: 1, output: 0, auxiliary: false }, { source: 1, target: 2, output: 0, auxiliary: false }, { source: 2, target: 3, output: 0, auxiliary: false }, { source: 2, target: 5, output: 1, auxiliary: false }, { source: 3, target: 4, output: 0, auxiliary: false }, { source: 5, target: 6, output: 0, auxiliary: false }], partial: false };
    const fixture = { calls, releaseWorkflows: () => {}, failDelete: false, failHealth: false, failOpen: false, failWorkflows: false, emptyWorkflows: false, failInsights: false, workflowOverride: undefined as any, insights: { total: 12, failed: 3, failureRate: .25, timeSavedMinutes: 90, averageRunTimeMs: 1500, startDate: '2026-11-03T10:00:00Z', endDate: '2026-11-10T10:00:00Z' }, failState: !!options.failState, theme: (dark: boolean, background?: string) => { document.documentElement.style.setProperty('--orca-background', background ?? (dark ? '#191919' : '#FAFAFA')); document.documentElement.style.setProperty('--orca-foreground', dark ? '#FAFAFA' : '#191919'); document.documentElement.style.setProperty('--orca-muted-foreground', dark ? '#BFBFBF' : '#676767'); callbacks.forEach(fn => fn()); } };
    let preferences = { baseUrl: 'http://localhost:5678/', connectionKind: 'local', workspace: 'folder:current', placement: 'tab', onboardingCompleted: !!options.completed, refreshIntervalSeconds: 30 };
    let hasApiKey = !!options.hasKey;
    const saved = localStorage.getItem('launcher-fixture'); if (saved) preferences = JSON.parse(saved);
    const deleted = localStorage.getItem('launcher-fixture-deleted') === 'true';
    if (deleted) hasApiKey = false;
    let hasConnection = !deleted && (!!saved || !!options.completed || hasApiKey);
    const workspaces = options.missingWorkspaces ? [] : [{ selector: 'folder:current', name: 'Project', path: '/tmp/project', active: true }, { selector: 'identity:other', name: '<img src=x onerror=alert(1)>', path: '/tmp/other', active: false }];
    Object.assign(window, { fixture, orca: { on: (event: string, callback: () => void) => { if (event === 'theme') callbacks.push(callback); return { dispose() {} }; }, plugin: { request: async (name: string, input: any) => {
      calls.push({ name, input });
      if (name === 'n8n.state') { if (fixture.failState) throw new Error('Orca is unavailable. Refresh the sidebar.'); return { preferences, workspaces, hasApiKey, hasConnection }; }
      if (name === 'n8n.delete-connection') { if (fixture.failDelete) throw new Error('The connection could not be deleted. Try again.'); hasConnection = false; hasApiKey = false; preferences = { baseUrl: 'http://localhost:5678/', connectionKind: 'local', workspace: '', placement: 'tab', onboardingCompleted: false, refreshIntervalSeconds: 30 }; localStorage.setItem('launcher-fixture', JSON.stringify(preferences)); localStorage.setItem('launcher-fixture-deleted', 'true'); return preferences; }
      if (name === 'n8n.configure') { const baseUrl = input.baseUrl.replace(/\/$/, '') + '/'; const changed = preferences.baseUrl !== baseUrl || preferences.connectionKind !== input.connectionKind; preferences = { ...preferences, baseUrl, connectionKind: input.connectionKind, refreshIntervalSeconds: input.refreshIntervalSeconds ?? preferences.refreshIntervalSeconds, ...(changed ? { onboardingCompleted: false } : {}) }; hasConnection = true; localStorage.removeItem('launcher-fixture-deleted'); hasApiKey = !!input.apiKey || (hasApiKey && !changed && !input.removeKey); localStorage.setItem('launcher-fixture', JSON.stringify(preferences)); return { preferences, hasApiKey }; }
      if (name === 'n8n.workflows' && options.holdWorkflows && calls.filter(call => call.name === name).length === 1) await new Promise<void>(resolve => { fixture.releaseWorkflows = resolve; });
      if (name === 'n8n.workflows' && fixture.failWorkflows) throw new Error('Could not load workflows. Refresh to try again.');
      if (name === 'n8n.workflows' && fixture.emptyWorkflows) return { data: [] };
      if (name === 'n8n.workflows' && fixture.workflowOverride) return fixture.workflowOverride;
      if (name === 'n8n.insights') { if (fixture.failInsights) throw new Error('HTTP 403: Missing insights:read'); return fixture.insights; }
      if (name === 'n8n.workflows' && options.manyWorkflows) return { data: Array.from({ length: 25 }, (_, i) => ({ id: 'many-' + i, name: 'Workflow ' + i, state: i % 2 ? 'draft' : 'published', nodeCount: i + 1, updatedAt: '2026-11-10T09:00:00Z' })) };
      if (name === 'n8n.workflows') return { data: [{ id: input?.cursor ? 'wf2' : 'wf1', name: input?.cursor ? 'Daily Analytics' : 'Customer Onboarding', state: input?.cursor ? 'draft' : 'published', nodeCount: input?.cursor ? 0 : 7, ...(input?.cursor ? {} : { preview }), updatedAt: '2026-11-10T09:00:00Z', recentRun: { id: 'ex1', status: 'error', startedAt: '2026-11-10T10:42:00Z' } }], nextCursor: input?.cursor ? undefined : 'next' };
      if (name === 'n8n.connect') { if (fixture.failHealth) throw new Error('Could not reach n8n. Start the instance and check the port.'); hasConnection = true; localStorage.removeItem('launcher-fixture-deleted'); preferences = { ...preferences, baseUrl: input.baseUrl.replace(/\/$/, '') + '/', connectionKind: input.connectionKind }; return { preferences, checkedAt: new Date().toISOString() }; }
      if (name === 'n8n.preview-connection') { if (fixture.failHealth) throw new Error('Could not reach n8n. Start the instance and check the port.'); return { baseUrl: input.baseUrl.replace(/\/$/, '') + '/', connectionKind: input.connectionKind, checkedAt: new Date().toISOString() }; }
      if (name === 'n8n.open') { if (options.missingWorkspaces) throw new Error('Open a local Orca workspace, then try opening n8n again.'); await new Promise(resolve => setTimeout(resolve, 50)); if (fixture.failOpen) throw new Error('Orca could not open this workspace.'); if (input.preview) return { browserPageId: 'page-id', preferences: { ...preferences, baseUrl: input.baseUrl, connectionKind: input.connectionKind, workspace: input.workspace, placement: input.placement } }; preferences = { ...preferences, workspace: input.workspace, placement: input.placement }; }
      if (name === 'n8n.complete') preferences = { ...preferences, ...input, onboardingCompleted: true };
      if (name === 'n8n.reset-onboarding') preferences.onboardingCompleted = false;
      localStorage.setItem('launcher-fixture', JSON.stringify(preferences));
      return name === 'n8n.open' ? { browserPageId: 'page-id', preferences } : preferences;
    } } } });
  }, options);
  await page.goto('/panel/index.html');
}
async function connect(page: Page) { await page.getByRole('button', { name: 'Check connection', exact: true }).click(); await expect(page.getByText('n8n is ready on port 5678.')).toBeVisible(); }
async function launchStep(page: Page) { await connect(page); await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.getByRole('button', { name: 'Right split', exact: true }).click(); await page.getByRole('button', { name: 'Continue to n8n' }).click(); }
test('expanded cards show a safe, responsive preview without extra API requests or intercepting Open', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await page.evaluate(() => { (window as any).fixture.workflowOverride = { data: [{ id: 'preview', name: 'Preview workflow', state: 'draft', nodeCount: 3, preview: { nodes: [
    { name: '<img src=x onerror=alert(1)>', type: 'Webhook', position: [0, 0] }, { name: 'Branch', type: 'If', position: [160, 0] }, { name: 'Action', type: 'Unknown', position: [320, 80] }
  ], edges: [{ source: 0, target: 1, output: 0, auxiliary: false }, { source: 1, target: 2, output: 1, auxiliary: true }], partial: false } }] }; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  const card = page.getByRole('article', { name: 'Preview workflow', exact: true });
  await expect(card.locator('.workflow-preview')).toHaveCount(0);
  const requests = await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length);
  await card.getByRole('button', { name: 'Preview workflow', exact: true }).click();
  await expect(card.getByRole('img', { name: 'Workflow preview: 3 nodes, 2 connections' })).toBeVisible();
  await expect(card.locator('.workflow-preview img, .workflow-preview script')).toHaveCount(0);
  await expect(card.locator('.workflow-preview rect')).toHaveCount(3);
  for (const dark of [false, true]) {
    await page.evaluate(dark => (window as any).fixture.theme(dark), dark);
    await page.setViewportSize({ width: 260, height: 900 });
    await expect(card.getByRole('img', { name: 'Workflow preview: 3 nodes, 2 connections' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length)).toBe(requests);
  await card.getByRole('button', { name: 'Open Preview workflow', exact: true }).click();
  await expect(card.getByRole('img', { name: 'Workflow preview: 3 nodes, 2 connections' })).toBeVisible();
  await card.getByRole('button', { name: 'Preview workflow', exact: true }).click();
  await expect(card.getByRole('img', { name: 'Workflow preview: 3 nodes, 2 connections' })).toBeHidden();
  await card.getByRole('button', { name: 'Preview workflow', exact: true }).click();
  await expect(card.locator('.workflow-preview')).toHaveCount(1);
  await page.screenshot({ path: '.orca/shots/preview-dark.png' });
});
test('preview zoom, pan, fit and keyboard controls preserve the view through collapse, filtering and refresh', async ({ page }) => {
  await page.clock.install();
  await frame(page, { completed: true, hasKey: true });
  const card = page.getByRole('article', { name: 'Customer Onboarding', exact: true });
  const toggle = card.getByRole('button', { name: 'Customer Onboarding', exact: true });
  await toggle.click();
  const graph = card.getByRole('img', { name: 'Workflow preview: 7 nodes, 6 connections' });
  const zoom = card.locator('output');
  const fitBounds = (await graph.getAttribute('viewBox'))!;
  const fitWidth = Number(fitBounds.split(' ')[2]);
  const count = () => page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length);
  const requests = await count();
  await expect(card.getByRole('button', { name: 'Zoom out preview' })).toBeDisabled();
  await card.getByRole('button', { name: 'Zoom in preview' }).click();
  await expect(zoom).toHaveText('125%');
  expect(Number((await graph.getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(fitWidth);
  await card.getByRole('button', { name: 'Zoom out preview' }).click();
  await expect(graph).toHaveAttribute('viewBox', fitBounds);
  await graph.focus();
  for (let i = 0; i < 12; i++) await graph.press('+');
  await expect(zoom).toHaveText('800%');
  await expect(card.getByRole('button', { name: 'Zoom in preview' })).toBeDisabled();
  await graph.press('+'); await expect(zoom).toHaveText('800%');
  await graph.press('0'); await expect(graph).toHaveAttribute('viewBox', fitBounds);
  await graph.press('+'); await graph.press('+');
  const centered = (await graph.getAttribute('viewBox'))!;
  const box = (await graph.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 - 8, { steps: 4 }); await page.mouse.up();
  const panned = (await graph.getAttribute('viewBox'))!;
  expect(panned).not.toBe(centered);
  expect(panned.split(' ').slice(2)).toEqual(centered.split(' ').slice(2));
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(graph).not.toHaveAttribute('data-dragging', 'true');
  await graph.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await graph.press('ArrowLeft');
  expect(await graph.getAttribute('viewBox')).not.toBe(panned);
  const saved = (await graph.getAttribute('viewBox'))!;
  expect(await graph.evaluate(node => { const event = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }); node.dispatchEvent(event); return event.defaultPrevented; })).toBe(false);
  await expect(graph).toHaveAttribute('viewBox', saved);
  expect(await count()).toBe(requests);
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.open').length)).toBe(0);
  await toggle.click(); await toggle.click(); await expect(graph).toHaveAttribute('viewBox', saved);
  const search = page.getByRole('searchbox', { name: 'Search workflows' });
  await search.fill('nothing matches'); await expect(card).toHaveCount(0);
  await search.fill(''); await expect(graph).toHaveAttribute('viewBox', saved);
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(graph).toHaveAttribute('viewBox', saved);
  await graph.focus(); await page.clock.fastForward('00:31');
  await expect.poll(count).toBe(requests + 2);
  await expect(graph).toHaveAttribute('viewBox', saved);
  const bounds = (await graph.boundingBox())!;
  expect(await graph.evaluate((node, point) => { const event = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true }); node.dispatchEvent(event); return event.defaultPrevented; }, { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 })).toBe(true);
  expect(Number((await graph.getAttribute('viewBox'))!.split(' ')[2])).toBeLessThan(Number(saved.split(' ')[2]));
  await card.getByRole('button', { name: 'Fit workflow preview' }).click();
  await expect(graph).toHaveAttribute('viewBox', fitBounds); await expect(zoom).toHaveText('100%');
  await graph.focus(); await graph.press('-'); await expect(graph).toHaveAttribute('viewBox', fitBounds);
  await graph.press('+'); await graph.press('Home'); await expect(graph).toHaveAttribute('viewBox', fitBounds);
});
test('preview viewports are independent per workflow and reset after a workflow disappears', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  const first = page.getByRole('article', { name: 'Customer Onboarding', exact: true });
  await first.getByRole('button', { name: 'Customer Onboarding', exact: true }).click();
  await first.getByRole('button', { name: 'Zoom in preview' }).click();
  await page.evaluate(() => { const fixture = (window as any).fixture; const preview = { nodes: [{ name: 'Start', type: 'Webhook', position: [0, 0] }], edges: [], partial: false }; fixture.workflowOverride = { data: [
    { id: 'wf1', name: 'Customer Onboarding', state: 'published', preview }, { id: 'wf-other', name: 'Other workflow', state: 'draft', preview }
  ] }; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(first.locator('output')).toHaveText('125%');
  const second = page.getByRole('article', { name: 'Other workflow', exact: true });
  await second.getByRole('button', { name: 'Other workflow', exact: true }).click();
  await expect(second.locator('output')).toHaveText('100%');
  await second.getByRole('button', { name: 'Zoom in preview' }).click();
  await second.getByRole('button', { name: 'Zoom in preview' }).click();
  await expect(first.locator('output')).toHaveText('125%');
  await page.evaluate(() => { (window as any).fixture.emptyWorkflows = true; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(first).toHaveCount(0);
  await page.evaluate(() => { (window as any).fixture.emptyWorkflows = false; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await first.getByRole('button', { name: 'Customer Onboarding', exact: true }).click();
  await expect(first.locator('output')).toHaveText('100%');
});
test('onboarding connects, chooses placement, opens official editor and persists completion', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await frame(page); await expect(page.getByLabel('Instance URL')).toHaveValue('http://localhost:5678');
  await expect(page.getByRole('button', { name: 'Make room for workflows' })).toBeDisabled();
  await launchStep(page);
  await expect(page.getByText('Sign in or create your account', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open n8n in Orca' }).click();
  await expect(page.getByRole('status')).toContainText('Your n8n tab is open.');
  expect(await page.evaluate(() => (window as any).fixture.calls.find((call: any) => call.name === 'n8n.open').input)).toEqual({ placement: 'right' });
  await page.getByRole('button', { name: 'Finish setup' }).click(); await expect(page.getByRole('heading', { name: 'Workflows', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Workflows', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Open n8n in Orca' })).toBeEnabled();
  expect(errors).toEqual([]); await expect(page.locator('iframe, input[type=password], .canvas')).toHaveCount(0);
});
test('failed connection is recoverable and editing a checked URL disables Continue', async ({ page }) => {
  await frame(page); await page.evaluate(() => { (window as any).fixture.failHealth = true; }); await page.getByRole('button', { name: 'Check connection', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('Could not reach n8n');
  await page.evaluate(() => { (window as any).fixture.failHealth = false; }); await connect(page);
  await expect(page.getByRole('combobox', { name: 'Connections', exact: true }).getByRole('img', { name: 'Connected', exact: true })).toBeVisible();
  await page.getByLabel('Instance URL').fill('http://localhost:5678'); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Connections', exact: true }).getByRole('img', { name: 'Not checked', exact: true })).toBeVisible();
});
test('launcher creates a new workflow through the worker and remains disabled offline', async ({ page }) => {
  await frame(page, { completed: true });
  await expect(page.getByRole('combobox', { name: 'Connections', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('combobox', { name: 'Connections', exact: true })).toHaveText('Local n8n');
  await expect(page.getByText('Your workflows, in view.', { exact: true })).toHaveCount(0);
  await expect(page.getByText('for Orca', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Workflows in Orca', { exact: true })).toBeVisible();
  await expect(page.getByText('Unofficial plugin for managing n8n workflows in Orca.', { exact: true })).toBeVisible();
  const create = page.getByRole('button', { name: 'New n8n workflow', exact: true });
  await expect(create).toBeEnabled(); await create.click();
  expect(await page.evaluate(() => (window as any).fixture.calls.find((call: any) => call.name === 'n8n.open').input)).toEqual({ placement: 'tab', intent: 'new-workflow' });
  await expect(create).toBeEnabled();
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length)).toBe(0);
  await page.evaluate(() => { (window as any).fixture.failHealth = true; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click(); await expect(create).toBeDisabled();
});
test('new workflow refreshes immediately, automatic and manual refresh work, and settings can turn polling off', async ({ page }) => {
  await page.clock.install();
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('button', { name: 'Customer Onboarding', exact: true })).toBeVisible();
  const count = () => page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length);
  expect(await count()).toBe(1);
  const create = page.getByRole('button', { name: 'New n8n workflow', exact: true });
  await create.click();
  expect(await count()).toBe(1);
  await page.clock.runFor(50); await expect.poll(count).toBe(2);
  await page.clock.runFor(30000); expect(await count()).toBe(3);
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click(); expect(await count()).toBe(4);
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Refresh workflows', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Automatic refresh', exact: true }).selectOption('0');
  await page.getByRole('button', { name: 'Save and test', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workflows', exact: true })).toBeVisible();
  const savedCount = await count(); await page.clock.runFor(120000); expect(await count()).toBe(savedCount);
  await create.click(); await page.clock.runFor(50); await expect.poll(count).toBe(savedCount + 1);
  await page.evaluate(() => { (window as any).fixture.failOpen = true; });
  await create.click(); await page.clock.runFor(50);
  await expect(page.getByRole('alert')).toContainText('Orca could not open this workspace.');
  expect(await count()).toBe(savedCount + 1);
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Automatic refresh', exact: true })).toHaveValue('0');
});
test('existing users can leave setup after checking and opening a preview without saving', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('button', { name: 'Customer Onboarding', exact: true })).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem('launcher-fixture'));
  await page.getByRole('combobox', { name: 'Connections', exact: true }).click();
  await page.getByRole('button', { name: 'View setup guide', exact: true }).click();
  await page.getByLabel('Instance URL').fill('http://localhost:5678');
  await page.getByRole('button', { name: 'Check connection', exact: true }).click();
  await expect(page.getByText('n8n is ready on port 5678.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Right split', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to n8n', exact: true }).click();
  await page.getByRole('button', { name: 'Open n8n in Orca', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save setup', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to workflows', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workflows', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Connections', exact: true }).click(); await expect(page.getByText('localhost:5678', { exact: true })).toBeVisible(); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('launcher-fixture'))).toBe(before);
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => ['n8n.complete', 'n8n.configure', 'n8n.reset-onboarding'].includes(call.name)).length)).toBe(0);
});
test('fixed header and actions stay in place while cards scroll, and custom dropdowns support keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await frame(page, { completed: true, hasKey: true, manyWorkflows: true });
  await expect(page.getByRole('article')).toHaveCount(25);
  const headerBefore = await page.locator('.brand-header').boundingBox();
  await expect(page.locator('.brand-header').getByRole('button', { name: /Refresh/ })).toHaveCount(0);
  const actionsBefore = await page.locator('.action-bar').boundingBox();
  expect(await page.locator('.workflow-scroll').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.locator('.workflow-scroll').evaluate(element => { element.scrollTop = 600; });
  expect(await page.locator('.brand-header').boundingBox()).toEqual(headerBefore); expect(await page.locator('.action-bar').boundingBox()).toEqual(actionsBefore);
  const connection = page.getByRole('combobox', { name: 'Connections', exact: true });
  await connection.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Local n8n', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(page.getByRole('option', { name: 'n8n Cloud', exact: true })).toBeFocused();
  await page.screenshot({ path: '.orca/shots/connection-dropdown-light.png' });
  await page.keyboard.press('Escape'); await expect(connection).toHaveAttribute('aria-expanded', 'false'); await expect(connection).toBeFocused();
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(25);
});
test('top settings supports local and Cloud connections and keeps API keys out of saved UI preferences', async ({ page }) => {
  await frame(page, { completed: true }); await expect(page.getByRole('button', { name: 'Connection settings', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByRole('combobox', { name: 'Connection type' }).selectOption('cloud');
  await expect(page.getByText('n8n Cloud API access is unavailable during the free trial.', { exact: false })).toBeVisible();
  await page.getByLabel('Instance URL').fill('https://team.app.n8n.cloud');
  await page.getByLabel('API key (optional)').fill('private-key-fixture');
  for (const dark of [false, true]) { await page.evaluate(dark => (window as any).fixture.theme(dark), dark); await page.screenshot({ path: '.orca/shots/settings-' + (dark ? 'dark' : 'light') + '.png', fullPage: true }); }
  await page.getByRole('button', { name: 'Save and test', exact: true }).click();
  await expect(page.getByText('Cloud address saved. Sign in in the n8n tab.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('launcher-fixture'))).not.toContain('private-key-fixture');
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click(); await expect(page.getByLabel('API key (optional)')).toHaveValue('');
});
test('deletion requires confirmation, supports cancellation, clears workflows and stops polling', async ({ page }) => {
  await page.clock.install(); await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep connection', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.delete-connection').length)).toBe(0);
  await page.getByRole('button', { name: 'Delete connection', exact: true }).click();
  const confirmation = page.getByRole('group', { name: 'Delete connection confirmation' });
  await expect(confirmation).toContainText('localhost:5678');
  await confirmation.scrollIntoViewIfNeeded(); await page.screenshot({ path: '.orca/shots/delete-connection.png' });
  await confirmation.getByRole('button', { name: 'Delete connection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
  const count = await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length);
  await page.clock.runFor(60000);
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length)).toBe(count);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete connection', exact: true })).toHaveCount(0);
});
test('failed connection deletion keeps setup available and permits retry', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.evaluate(() => { (window as any).fixture.failDelete = true; });
  await page.getByRole('button', { name: 'Delete connection', exact: true }).click();
  await page.getByRole('group', { name: 'Delete connection confirmation' }).getByRole('button', { name: 'Delete connection', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be deleted');
  await expect(page.getByRole('heading', { name: 'Connection settings', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).fixture.failDelete = false; });
  await page.getByRole('button', { name: 'Delete connection', exact: true }).click();
  await page.getByRole('group', { name: 'Delete connection confirmation' }).getByRole('button', { name: 'Delete connection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeVisible();
});
test('sidebar shows workflow state and recent execution status, filters and opens in n8n', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('button', { name: 'Customer Onboarding', exact: true })).toBeVisible();
  const customer = page.getByRole('article', { name: 'Customer Onboarding', exact: true });
  const toggle = customer.getByRole('button', { name: 'Customer Onboarding', exact: true });
  const status = customer.getByRole('img', { name: 'Published', exact: true });
  await expect(status).toBeVisible();
  await expect(status).toHaveText('');
  const tooltip = customer.getByRole('tooltip', { name: 'Published', exact: true });
  await expect(tooltip).toBeHidden();
  await expect(status).toHaveCSS('cursor', 'default');
  await status.hover();
  await expect(tooltip).toBeVisible();
  for (const dark of [false, true]) { await page.evaluate(dark => (window as any).fixture.theme(dark), dark); await page.screenshot({ path: '.orca/shots/status-tooltip-' + (dark ? 'dark' : 'light') + '.png' }); }
  await page.mouse.move(0, 0); await expect(tooltip).toBeHidden();
  await status.focus(); await expect(tooltip).toBeVisible();
  await status.press('Escape'); await expect(tooltip).toBeHidden();
  await toggle.focus(); await status.focus(); await expect(tooltip).toBeVisible();
  await toggle.focus(); await expect(tooltip).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(customer.getByText('Recent run: Failed', { exact: false })).toBeHidden();
  await customer.locator('.workflow-meta').click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(customer.getByText('Recent run: Failed', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.open').length)).toBe(0);
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(customer.getByText('Recent run: Failed', { exact: false })).toBeHidden();
  await page.keyboard.press('Space'); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('article').getByText('7 nodes', { exact: true })).toBeVisible();
  await expect(page.getByRole('article').locator('time')).toHaveCount(2);
  await expect(page.getByRole('article').locator('time').first()).toHaveAttribute('datetime', '2026-11-10T09:00:00.000Z');
  await expect(page.getByRole('button', { name: /Run .* in n8n/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Customer Onboarding', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Customer Onboarding', exact: true })).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => (window as any).fixture.calls.find((call: any) => call.name === 'n8n.open').input)).toMatchObject({ workflowId: 'wf1' });
  await page.getByRole('button', { name: 'Load more workflows' }).click(); await expect(page.getByRole('button', { name: 'Daily Analytics', exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Daily Analytics', exact: true }).getByText('0 nodes', { exact: true })).toBeVisible();
  for (const width of [260, 320, 360, 440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.setViewportSize({ width: 360, height: 900 });
  await page.mouse.move(0, 0);
  for (const dark of [false, true]) { await page.evaluate(dark => (window as any).fixture.theme(dark), dark); await page.screenshot({ path: '.orca/shots/workflows-' + (dark ? 'dark' : 'light') + '.png', fullPage: true }); }
  await page.getByRole('combobox', { name: 'Workflow status' }).click(); await page.getByRole('option', { name: 'Draft', exact: true }).click(); await expect(page.getByRole('button', { name: 'Customer Onboarding', exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search workflows' }).fill('absent'); await expect(page.getByRole('heading', { name: 'No matching workflows' })).toBeVisible();
  await page.screenshot({ path: '.orca/shots/workflows-no-results.png' });
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('searchbox', { name: 'Search workflows' })).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Workflow status' })).toContainText('All statuses');
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
});
test('illustrated empty and error states offer creation and recovery without misleading zero counts', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true, holdWorkflows: true });
  await expect(page.getByRole('status')).toContainText('Loading workflows…');
  await expect(page.getByRole('heading', { name: 'Your next workflow starts here' })).toHaveCount(0);
  await page.screenshot({ path: '.orca/shots/workflows-loading.png' });
  await expect.poll(() => page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.workflows').length)).toBe(1);
  await page.evaluate(() => (window as any).fixture.releaseWorkflows());
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.evaluate(() => { (window as any).fixture.emptyWorkflows = true; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your next workflow starts here' })).toBeVisible();
  await page.screenshot({ path: '.orca/shots/workflows-empty.png' });
  await page.getByRole('button', { name: 'Create a workflow', exact: true }).click();
  expect(await page.evaluate(() => (window as any).fixture.calls.find((call: any) => call.name === 'n8n.open').input.intent)).toBe('new-workflow');
  await page.evaluate(() => { (window as any).fixture.failWorkflows = true; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Couldn’t load workflows' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your next workflow starts here' })).toHaveCount(0);
  await page.evaluate(() => { (window as any).fixture.failWorkflows = false; (window as any).fixture.emptyWorkflows = false; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
});
test('Enter checks once, keyboard focus follows steps and opening cannot be repeated while pending', async ({ page }) => {
  await frame(page); await page.getByLabel('Instance URL').focus(); await page.keyboard.press('Enter'); await expect(page.getByText('n8n is ready on port 5678.')).toBeVisible();
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((c: any) => c.name === 'n8n.connect').length)).toBe(1);
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await expect(page.getByRole('button', { name: 'Make room for workflows' })).toBeFocused();
  await page.getByRole('button', { name: 'Continue to n8n' }).click(); await page.getByRole('button', { name: 'Open n8n in Orca' }).click(); await expect(page.getByRole('status')).toBeVisible();
  expect(await page.evaluate(() => (window as any).fixture.calls.filter((c: any) => c.name === 'n8n.open').length)).toBe(1);
});
test('workspace failures and missing destinations give useful recovery', async ({ page }) => {
  await frame(page, { failState: true }); await expect(page.getByRole('alert')).toContainText('unavailable'); await page.evaluate(() => { (window as any).fixture.failState = false; }); await page.getByRole('button', { name: 'Refresh sidebar' }).click(); await expect(page.getByLabel('Instance URL')).toBeVisible();
  await launchStep(page); await page.evaluate(() => { (window as any).fixture.failOpen = true; }); await page.getByRole('button', { name: 'Open n8n in Orca' }).click(); await expect(page.getByRole('alert')).toContainText('could not open'); await expect(page.getByRole('button', { name: 'Finish setup' })).toHaveCount(0);
});
test('layout setup needs no workspace selection and a missing current workspace is recoverable', async ({ page }) => {
  await frame(page, { missingWorkspaces: true }); await connect(page); await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Orca workspace', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Refresh workspaces', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to n8n' })).toBeEnabled();
  await page.getByRole('button', { name: 'Continue to n8n' }).click(); await page.getByRole('button', { name: 'Open n8n in Orca' }).click();
  await expect(page.getByRole('alert')).toContainText('Open a local Orca workspace');
  await expect(page.getByRole('button', { name: 'Finish setup' })).toHaveCount(0);
});
for (const dark of [false, true]) test('Orca theme ' + (dark ? 'dark' : 'light') + ' backgrounds and screenshots at sidebar widths', async ({ page }) => {
  await frame(page); await page.evaluate(({ dark, background }) => (window as any).fixture.theme(dark, background), { dark, background: dark ? '#0C1422' : '#F1F4F8' });
  await expect(page.locator('html')).toHaveCSS('background-color', dark ? 'rgb(12, 20, 34)' : 'rgb(241, 244, 248)');
  await expect(page.locator('.logo-' + (dark ? 'dark' : 'light'))).toBeVisible(); await expect(page.locator('.logo-' + (dark ? 'light' : 'dark'))).toBeHidden();
  await expect.poll(() => page.locator('.logo-' + (dark ? 'dark' : 'light')).evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: '.orca/shots/onboarding-' + (dark ? 'dark' : 'light') + '.png', fullPage: true });
  await connect(page); await page.getByRole('button', { name: 'Continue', exact: true }).click(); await expect(page.locator('img')).toHaveCount(2);
  await page.screenshot({ path: '.orca/shots/placement-' + (dark ? 'dark' : 'light') + '.png', fullPage: true });
  for (const width of [260, 320, 360, 440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
  await page.getByRole('button', { name: 'Continue to n8n' }).click(); await page.getByRole('button', { name: 'Open n8n in Orca' }).click(); await page.getByRole('button', { name: 'Finish setup' }).click();
  await page.setViewportSize({ width: 360, height: 900 }); await page.screenshot({ path: '.orca/shots/launcher-' + (dark ? 'dark' : 'light') + '.png', fullPage: true });
});

test('workflow list sorts loaded pages by most recent update and reorders after refresh', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.evaluate(() => { (window as any).fixture.workflowOverride = { data: [{ id: 'newer', name: 'Recently changed', state: 'draft', updatedAt: '2026-11-10T11:00:00Z' }, { id: 'undated', name: 'No update date', state: 'draft' }] }; });
  await page.getByRole('button', { name: 'Load more workflows' }).click();
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByRole('article').nth(0)).toHaveAttribute('aria-label', 'Recently changed');
  await expect(page.getByRole('article').nth(2)).toHaveAttribute('aria-label', 'No update date');
  await page.evaluate(() => { (window as any).fixture.workflowOverride = { data: [{ id: 'newer', name: 'Recently changed', state: 'draft', updatedAt: '2026-11-09T11:00:00Z' }, { id: 'wf1', name: 'Customer Onboarding', state: 'published', updatedAt: '2026-11-10T12:00:00Z' }] }; });
  await page.getByRole('button', { name: 'Refresh workflows', exact: true }).click();
  await expect(page.getByRole('article').first()).toHaveAttribute('aria-label', 'Customer Onboarding');
});

test('overview loads on expansion, formats n8n metrics, and refreshes manually and automatically', async ({ page }) => {
  await page.clock.install();
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  const toggle = page.getByRole('button', { name: 'Execution overview', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const count = () => page.evaluate(() => (window as any).fixture.calls.filter((call: any) => call.name === 'n8n.insights').length);
  expect(await count()).toBe(0);
  await toggle.click();
  await expect(page.locator('[data-metric=total] dd')).toHaveText('12');
  await expect(page.locator('[data-metric=failed] dd')).toHaveText('3');
  await expect(page.locator('[data-metric=rate] dd')).toHaveText('25%');
  await expect(page.locator('[data-metric=saved] dd')).toHaveText('1.5h');
  await expect(page.locator('[data-metric=duration] dd')).toHaveText('1.5s');
  expect(await page.locator('.insights-card').evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(230);
  await page.getByRole('button', { name: 'Refresh overview', exact: true }).click();
  await expect.poll(count).toBe(2);
  await page.clock.fastForward('00:31');
  await expect.poll(count).toBe(3);
  for (const dark of [false, true]) {
    await page.evaluate(dark => (window as any).fixture.theme(dark), dark);
    for (const width of [260, 360, 440]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    await page.setViewportSize({ width: 360, height: 900 }); await page.mouse.move(0, 0);
    await page.screenshot({ path: '.orca/shots/overview-' + (dark ? 'dark' : 'light') + '.png' });
  }
  await toggle.click();
  await expect(page.locator('.insights-grid')).toHaveCount(0);
  const before = await count();
  await page.clock.fastForward('00:31');
  expect(await count()).toBe(before);
});

test('overview distinguishes missing permission from zero data and clears with connection removal', async ({ page }) => {
  await frame(page, { completed: true, hasKey: true });
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.evaluate(() => { (window as any).fixture.failInsights = true; });
  await page.getByRole('button', { name: 'Execution overview', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Overview unavailable');
  await expect(page.locator('.insights-grid')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.evaluate(() => { const f = (window as any).fixture; f.failInsights = false; f.insights = { ...f.insights, total: 0, failed: 0, failureRate: 0, timeSavedMinutes: 0, averageRunTimeMs: 0 }; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('[data-metric=total] dd')).toHaveText('0');
  await expect(page.locator('[data-metric=rate] dd')).toHaveText('0%');
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete connection', exact: true }).click();
  await page.getByRole('group', { name: 'Delete connection confirmation' }).getByRole('button', { name: 'Delete connection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Get started', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Execution overview', exact: true })).toHaveCount(0);
  await expect(page.locator('.insights-grid')).toHaveCount(0);
});
