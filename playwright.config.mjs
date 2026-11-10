import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.N8N_BROWSER_EXECUTABLE || (process.platform === 'darwin' && existsSync(systemChrome) ? systemChrome : undefined);
export default defineConfig({ testDir: './tests/browser', workers: 1, fullyParallel: false, timeout: 30000, outputDir: '.orca/browser-results', use: { baseURL: 'http://127.0.0.1:41873', headless: true, viewport: { width: 360, height: 900 }, ...(executablePath ? { launchOptions: { executablePath } } : {}) }, webServer: { command: 'node scripts/ui-server.mjs', url: 'http://127.0.0.1:41873/panel/index.html', reuseExistingServer: false } });
