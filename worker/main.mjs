// src/shared/types.ts
var DEFAULT_URL = "http://localhost:5678/";
var REFRESH_INTERVALS = [0, 15, 30, 60, 120, 300];

// src/worker/connection.ts
var LauncherError = class extends Error {
  constructor(message, code = "action_failed") {
    super(message);
    this.code = code;
  }
};
function instanceUrl(value, kind) {
  if (kind === "local") return localUrl(value);
  if (kind !== "cloud" || typeof value !== "string" || value.length > 2048) throw new LauncherError("Choose Local or n8n Cloud and enter an instance URL.", "invalid_params");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new LauncherError("Enter your full n8n Cloud URL.", "invalid_params");
  }
  if (url.protocol !== "https:" || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.n8n\.cloud$/.test(url.hostname) || url.port && url.port !== "443" || url.username || url.password || url.search || url.hash) throw new LauncherError("Use your HTTPS n8n Cloud address, such as https://your-team.app.n8n.cloud, without credentials or URL parameters.", "invalid_params");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
function localUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new LauncherError("Enter a local n8n URL.", "invalid_params");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new LauncherError("Enter a full URL, such as http://localhost:5678.", "invalid_params");
  }
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
    throw new LauncherError("Use localhost, 127.0.0.1, or [::1] with HTTP or HTTPS, without credentials, a query, or a fragment.", "invalid_params");
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
async function checkConnection(value, signal, transport = fetch) {
  const base = localUrl(value);
  const endpoint = new URL("healthz", base);
  if (endpoint.hostname === "localhost") endpoint.hostname = "127.0.0.1";
  let response;
  try {
    response = await transport(endpoint, { signal: AbortSignal.any([signal, AbortSignal.timeout(5e3)]), redirect: "error", credentials: "omit", cache: "no-store" });
  } catch {
    if (signal.aborted) throw new LauncherError("Connection check cancelled.", "cancelled");
    throw new LauncherError("Could not reach n8n at " + base.host + ". Start the instance and check the port, then try again.", "unavailable");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new LauncherError("n8n is not ready (HTTP " + response.status + "). Wait for it to start, then check again.", "unavailable");
  }
  const reader = response.body?.getReader();
  let text = "";
  let size = 0;
  try {
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > 1024) throw new LauncherError("This URL did not return an n8n health response.", "unavailable");
        text += decoder.decode(chunk, { stream: true });
      }
      text += decoder.decode();
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch {
    }
    if (!data || typeof data !== "object" || !("status" in data) || data.status !== "ok") throw new LauncherError("This URL did not return an n8n health response. Check the instance URL.", "unavailable");
  } finally {
    await reader?.cancel().catch(() => void 0);
  }
}

// src/worker/OrcaBrowser.ts
import { execFile } from "node:child_process";
function executable(env = process.env, platform = process.platform) {
  return env.ORCA_CLI_COMMAND || (env.ORCA_DEV_REPO_ROOT ? "orca-dev" : platform === "linux" ? "orca-ide" : "orca");
}
var runCli = (args, signal) => new Promise((resolve, reject) => {
  execFile(executable(), args, { signal, timeout: 12e3, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
    let data;
    try {
      data = JSON.parse(stdout);
    } catch {
    }
    if (error || !isRecord(data) || data.ok !== true) {
      reject(new LauncherError(signal.aborted ? "Browser request cancelled." : "Orca could not complete the browser request. Check that Orca is running and its CLI is available, then refresh the sidebar.", signal.aborted ? "cancelled" : "unavailable"));
    } else resolve(data.result);
  });
});
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function workspaces(cli, signal) {
  const data = await cli(["worktree", "ps", "--json"], signal);
  if (!isRecord(data) || !Array.isArray(data.worktrees) || data.truncated) throw new LauncherError("Orca could not list all destinations. Refresh the sidebar.", "unavailable");
  return data.worktrees.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.address) || item.address.environment !== "local" || typeof item.address.worktree !== "string" || typeof item.path !== "string" || item.isArchived === true) return [];
    return [{ selector: item.address.worktree, name: typeof item.displayName === "string" ? item.displayName : item.path, path: item.path, active: item.isActive === true }];
  });
}
async function openBrowser(cli, url, workspace, placement, signal, baseUrl = new URL(url).origin + "/") {
  if (!(await workspaces(cli, signal)).some((item) => item.selector === workspace)) throw new LauncherError("That workspace is no longer available. Refresh and choose a local workspace.", "invalid_params");
  if (!["tab", "right", "down"].includes(placement)) throw new LauncherError("Choose a tab or split placement.", "invalid_params");
  const target = new URL(url);
  const base = new URL(baseUrl);
  const listed = await cli(["tab", "list", "--environment", "local", "--worktree", workspace, "--json"], signal);
  if (!isRecord(listed) || !Array.isArray(listed.tabs)) throw new LauncherError("Orca could not check existing n8n tabs. Refresh and try again.", "unavailable");
  const candidates = listed.tabs.flatMap((item) => {
    if (!isRecord(item) || typeof item.url !== "string" || typeof item.browserPageId !== "string" || item.browserPageId.startsWith("popup-")) return [];
    try {
      const current = new URL(item.url);
      if (current.origin !== base.origin || !current.pathname.startsWith(base.pathname)) return [];
      return [{ page: item.browserPageId, url: item.url, path: current.pathname, rank: current.pathname === target.pathname ? 0 : item.active === true ? 1 : current.pathname.startsWith(new URL("workflow/", base).pathname) ? 2 : 3 }];
    } catch {
      return [];
    }
  }).sort((a, b) => a.rank - b.rank);
  let browserPageId;
  if (candidates.length) {
    const existing = candidates[0];
    browserPageId = existing.page;
    if (target.href !== base.href && existing.path !== target.pathname) await cli(["goto", "--page", browserPageId, "--url", url, "--expect-url", existing.url, "--environment", "local", "--worktree", workspace, "--json"], signal);
  } else {
    const args = ["tab", "create", "--url", url, "--environment", "local", "--worktree", workspace];
    if (placement !== "tab") args.push("--split", placement);
    args.push("--json");
    const data = await cli(args, signal);
    if (!isRecord(data) || typeof data.browserPageId !== "string" || !data.browserPageId) throw new LauncherError("Orca did not confirm a browser tab. Refresh and try again.", "unavailable");
    browserPageId = data.browserPageId;
  }
  await cli(["tab", "switch", "--page", browserPageId, "--focus", "--environment", "local", "--worktree", workspace, "--json"], signal);
  return browserPageId;
}
async function currentWorkspace(cli, signal) {
  const active = (await workspaces(cli, signal)).filter((item) => item.active);
  if (active.length !== 1) throw new LauncherError("Open a local Orca workspace, then try opening n8n again.", "unavailable");
  return active[0].selector;
}

// src/worker/N8nClient.ts
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
function publicAddress(ip) {
  if (isIP(ip) === 6) return /^[23][0-9a-f]{3}:/i.test(ip) && !/^2001:(?:db8|0):/i.test(ip);
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0 || b === 0 && c === 2) || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
}
var apiTransport = async (connection, key, path, query, signal) => {
  const base = instanceUrl(connection.baseUrl, connection.connectionKind);
  const url = new URL(path, base);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  if (url.origin !== base.origin) throw new LauncherError("Unsupported API destination.", "invalid_params");
  const cancel = AbortSignal.any([signal, AbortSignal.timeout(1e4)]);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const failure = () => new LauncherError(signal.aborted ? "Request cancelled." : "Could not reach n8n. Check the address and connection, then try again.", signal.aborted ? "cancelled" : "unavailable");
  if (cancel.aborted) throw failure();
  const addresses = connection.connectionKind === "local" ? [{ address: hostname === "localhost" ? "127.0.0.1" : hostname, family: hostname.includes(":") ? 6 : 4 }] : await new Promise((resolve, reject) => {
    const abort = () => reject(failure());
    cancel.addEventListener("abort", abort, { once: true });
    lookup(hostname, { all: true }).then(resolve, () => reject(failure())).finally(() => cancel.removeEventListener("abort", abort));
  });
  if (cancel.aborted) throw failure();
  if (!addresses.length || connection.connectionKind === "cloud" && addresses.some((item) => !publicAddress(item.address))) throw new LauncherError("The Cloud address resolved to an unsupported network destination.", "invalid_params");
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET",
      signal: cancel,
      headers: { Accept: "application/json", ...key ? { "X-N8N-API-KEY": key } : {} },
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [pinned]);
        else callback(null, pinned.address, pinned.family);
      }
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        response.resume();
        const message = status === 401 ? "n8n rejected the API key. Replace it in connection settings." : status === 403 ? "n8n denied API access. Check key scopes, project permissions, and your Cloud plan." : status === 429 ? "n8n rate-limited this request. Wait a moment, then refresh." : status >= 300 && status < 400 ? "n8n redirected the API request. Check the instance URL." : "n8n could not answer the API request (HTTP " + status + ").";
        reject(new LauncherError(message, status === 429 ? "rate_limited" : "unavailable"));
        return;
      }
      let size = 0;
      const chunks = [];
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          request.destroy();
          reject(new LauncherError("The n8n response is too large. Use fewer workflows per page.", "too_large"));
        } else chunks.push(chunk);
      });
      response.on("error", () => reject(new LauncherError("n8n disconnected while loading data.", "unavailable")));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          reject(new LauncherError("n8n returned an unexpected API response. Check the instance URL.", "unavailable"));
        }
      });
    });
    request.on("error", () => reject(failure()));
    request.end();
  });
};
function record(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function identifier(value) {
  return (typeof value === "string" || typeof value === "number") && /^[a-zA-Z0-9_-]{1,128}$/.test(String(value)) ? String(value) : void 0;
}
function normalizeInsights(value, startDate, endDate) {
  if (!record(value)) throw new LauncherError("n8n returned an unexpected insights summary.", "unavailable");
  function metric(name, unit) {
    const item = value[name];
    if (!record(item) || item.unit !== unit || typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < 0) throw new LauncherError("n8n returned an unexpected insights metric.", "unavailable");
    return item.value;
  }
  const total = metric("total", "count"), failed = metric("failed", "count"), failureRate = metric("failureRate", "ratio");
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(failed) || failed > total || failureRate > 1) throw new LauncherError("n8n returned an unexpected insights metric.", "unavailable");
  return { total, failed, failureRate, timeSavedMinutes: metric("timeSaved", "minute"), averageRunTimeMs: metric("averageRunTime", "millisecond"), startDate, endDate };
}
function normalizeWorkflows(value) {
  if (!record(value) || !Array.isArray(value.data)) throw new LauncherError("n8n returned an unexpected workflow list.", "unavailable");
  const data = value.data.slice(0, 25).flatMap((item) => {
    if (!record(item)) return [];
    const id = identifier(item.id);
    if (!id) return [];
    const state = item.isArchived === true ? "archived" : typeof item.activeVersionId === "string" && item.activeVersionId ? "published" : item.active === true ? "published" : item.active === false || "activeVersionId" in item ? "draft" : "unknown";
    return [{ id, name: typeof item.name === "string" ? item.name.slice(0, 250) : "Untitled workflow", state, ...Array.isArray(item.nodes) ? { nodeCount: item.nodes.length } : {}, ...typeof item.updatedAt === "string" ? { updatedAt: item.updatedAt } : {} }];
  });
  const nextCursor = typeof value.nextCursor === "string" && value.nextCursor.length <= 4096 ? value.nextCursor : void 0;
  return { data, ...nextCursor ? { nextCursor } : {} };
}
function addRecentRuns(page, value) {
  if (!record(value) || !Array.isArray(value.data)) throw new LauncherError("Execution status is unavailable.", "unavailable");
  const runs = /* @__PURE__ */ new Map();
  for (const item of value.data.slice(0, 100)) {
    if (!record(item)) continue;
    const workflowId = identifier(item.workflowId);
    const id = identifier(item.id);
    if (!workflowId || !id) continue;
    const status = typeof item.status === "string" && ["success", "error", "running", "waiting", "canceled", "crashed", "new", "unknown"].includes(item.status) ? item.status : "unknown";
    const startedAt = typeof item.startedAt === "string" ? item.startedAt : void 0;
    const previous = runs.get(workflowId);
    if (!previous || startedAt && (!previous.startedAt || startedAt > previous.startedAt)) runs.set(workflowId, { id, status, ...startedAt ? { startedAt } : {} });
  }
  for (const workflow of page.data) if (runs.has(workflow.id)) workflow.recentRun = runs.get(workflow.id);
}

// src/worker/main.ts
function activateWithServices(orca, cli = runCli, check = checkConnection, transport = apiTransport) {
  let queue = Promise.resolve();
  let openedThisSession = false;
  function serial(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => void 0);
    return result;
  }
  async function preferences() {
    const stored = await orca.storage.get("launcher");
    const data = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    let baseUrl = DEFAULT_URL;
    let connectionKind = "connectionKind" in data && data.connectionKind === "cloud" ? "cloud" : "local";
    try {
      if ("baseUrl" in data) baseUrl = instanceUrl(data.baseUrl, connectionKind).href;
    } catch {
      connectionKind = "local";
    }
    const refreshIntervalSeconds = "refreshIntervalSeconds" in data && REFRESH_INTERVALS.some((seconds) => seconds === data.refreshIntervalSeconds) ? Number(data.refreshIntervalSeconds) : 30;
    return { baseUrl, connectionKind, refreshIntervalSeconds, placement: "placement" in data && (data.placement === "right" || data.placement === "down") ? data.placement : "tab", onboardingCompleted: "onboardingCompleted" in data && data.onboardingCompleted === true, ..."lastOpenedAt" in data && typeof data.lastOpenedAt === "string" ? { lastOpenedAt: data.lastOpenedAt } : {} };
  }
  async function save(value) {
    await orca.storage.set("launcher", { ...value });
    return value;
  }
  async function apiKey(value) {
    if (!orca.grantedCapabilities.includes("secrets:own")) return void 0;
    const stored = await orca.secrets.get("api-key");
    if (!stored) return void 0;
    try {
      const data = JSON.parse(stored);
      if (data.baseUrl === value.baseUrl && data.connectionKind === (value.connectionKind ?? "local") && typeof data.apiKey === "string") return data.apiKey;
    } catch {
    }
    return void 0;
  }
  function connection(value) {
    return { baseUrl: value.baseUrl, connectionKind: value.connectionKind ?? "local" };
  }
  async function ready(value, signal) {
    if (value.connectionKind !== "cloud") {
      await check(value.baseUrl, signal);
      return;
    }
    const key = await apiKey(value);
    if (!key) return;
    normalizeWorkflows(await transport(connection(value), key, "api/v1/workflows", { limit: "1", excludePinnedData: "true" }, signal));
  }
  orca.panels.handle("n8n.state", async (_input, { signal }) => {
    const value = await preferences();
    const stored = await orca.storage.get("launcher");
    const hasConnection = !!stored && typeof stored === "object" && !Array.isArray(stored) && "baseUrl" in stored && typeof stored.baseUrl === "string";
    return { preferences: value, hasApiKey: !!await apiKey(value), hasConnection };
  });
  orca.panels.handle("n8n.delete-connection", (input) => serial(async () => {
    const previous = await preferences();
    if (instanceUrl(input?.baseUrl, input?.connectionKind).href !== previous.baseUrl || input.connectionKind !== (previous.connectionKind ?? "local")) throw new LauncherError("The connection changed. Reopen settings before deleting it.", "conflict");
    if (orca.grantedCapabilities.includes("secrets:own")) await orca.secrets.delete("api-key");
    await orca.storage.delete("launcher");
    openedThisSession = false;
    return preferences();
  }));
  orca.panels.handle("n8n.configure", (input) => serial(async () => {
    const url = instanceUrl(input?.baseUrl, input?.connectionKind).href;
    const previous = await preferences();
    const changed = previous.baseUrl !== url || previous.connectionKind !== input.connectionKind;
    if (input.refreshIntervalSeconds !== void 0 && !REFRESH_INTERVALS.some((seconds) => seconds === input.refreshIntervalSeconds)) throw new LauncherError("Choose a supported automatic refresh interval.", "invalid_params");
    if (input.apiKey !== void 0) {
      if (typeof input.apiKey !== "string" || !input.apiKey.trim() || input.apiKey.length > 8192 || /[\r\n]/.test(input.apiKey)) throw new LauncherError("Enter a valid n8n API key.", "invalid_params");
      const protection = await orca.host.call("secrets.protection");
      if (protection.status !== "os-keyring") throw new LauncherError("Secure API-key storage is unavailable on this Orca host. You can still open n8n in the browser.", "unavailable");
      await orca.secrets.set("api-key", JSON.stringify({ baseUrl: url, connectionKind: input.connectionKind, apiKey: input.apiKey.trim() }));
    } else if (changed || input.removeKey === true) await orca.secrets.delete("api-key");
    const value = { ...previous, baseUrl: url, connectionKind: input.connectionKind, refreshIntervalSeconds: input.refreshIntervalSeconds ?? previous.refreshIntervalSeconds ?? 30, ...changed ? { onboardingCompleted: false } : {} };
    if (changed) {
      delete value.lastOpenedAt;
      openedThisSession = false;
    }
    await save(value);
    return { preferences: value, hasApiKey: !!await apiKey(value) };
  }));
  orca.panels.handle("n8n.connect", (input, { signal }) => serial(async () => {
    const previous = await preferences();
    const kind = input?.connectionKind ?? previous.connectionKind ?? "local";
    const url = instanceUrl(input?.baseUrl, kind).href;
    await ready({ ...previous, baseUrl: url, connectionKind: kind }, signal);
    signal.throwIfAborted();
    const changed = previous.baseUrl !== url || previous.connectionKind !== kind;
    if (changed) {
      openedThisSession = false;
      if (orca.grantedCapabilities.includes("secrets:own")) await orca.secrets.delete("api-key");
    }
    const value = { ...previous, baseUrl: url, connectionKind: kind, ...changed ? { onboardingCompleted: false } : {} };
    if (changed) delete value.lastOpenedAt;
    return { preferences: await save(value), checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }));
  orca.panels.handle("n8n.preview-connection", async (input, { signal }) => {
    const baseUrl = instanceUrl(input?.baseUrl, input?.connectionKind).href;
    await ready({ ...await preferences(), baseUrl, connectionKind: input.connectionKind }, signal);
    signal.throwIfAborted();
    return { baseUrl, connectionKind: input.connectionKind, checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
  });
  async function launch(input, signal, rememberPlacement = true) {
    if (!input || !["tab", "right", "down"].includes(input.placement) || input.intent !== void 0 && !["new-workflow", "api-settings"].includes(input.intent) || input.workflowId !== void 0 && (!/^[a-zA-Z0-9_-]{1,128}$/.test(input.workflowId) || input.intent)) throw new LauncherError("Choose a tab or split placement and supported action.", "invalid_params");
    const previous = await preferences();
    if (input.preview !== void 0 && typeof input.preview !== "boolean" || !input.preview && (input.baseUrl !== void 0 || input.connectionKind !== void 0)) throw new LauncherError("Unsupported browser preview.", "invalid_params");
    const target = input.preview ? { ...previous, baseUrl: instanceUrl(input.baseUrl, input.connectionKind).href, connectionKind: input.connectionKind } : previous;
    if (target.connectionKind !== "cloud") await check(target.baseUrl, signal);
    const path = input.intent === "new-workflow" ? "workflow/new" : input.intent === "api-settings" ? "settings/api" : input.workflowId ? "workflow/" + encodeURIComponent(input.workflowId) : "";
    const url = new URL(path, instanceUrl(target.baseUrl, target.connectionKind ?? "local")).href;
    const workspace = await currentWorkspace(cli, signal);
    const browserPageId = await openBrowser(cli, url, workspace, input.placement, signal, target.baseUrl);
    openedThisSession = true;
    const value = { ...target, ...rememberPlacement ? { placement: input.placement } : {}, lastOpenedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (!input.preview) await save(value).catch(() => void 0);
    return { browserPageId, preferences: value };
  }
  orca.panels.handle("n8n.open", (input, { signal }) => serial(() => launch(input, signal)));
  orca.commands.register("n8n.new-workflow", (_args, { signal }) => serial(async () => {
    const result = await launch({ placement: "tab", intent: "new-workflow" }, signal, false);
    return "Opened a new workflow in n8n (browser page " + result.browserPageId + "). Sign in there if needed.";
  }));
  orca.panels.handle("n8n.insights", async (_input, { signal }) => {
    const value = await preferences(), key = await apiKey(value);
    if (!key) throw new LauncherError("Add an API key with insights:read access to view the overview.", "unavailable");
    const endDate = (/* @__PURE__ */ new Date()).toISOString(), startDate = new Date(Date.parse(endDate) - 7 * 24 * 60 * 60 * 1e3).toISOString();
    const result = await transport(connection(value), key, "api/v1/insights/summary", { startDate, endDate }, signal);
    return normalizeInsights(result, startDate, endDate);
  });
  orca.panels.handle("n8n.workflows", async (input, { signal }) => {
    if (input?.cursor !== void 0 && (typeof input.cursor !== "string" || input.cursor.length > 4096)) throw new LauncherError("Invalid workflow page cursor.", "invalid_params");
    const value = await preferences();
    const key = await apiKey(value);
    if (!key) throw new LauncherError("Add an API key in connection settings to browse your workflows here.", "unavailable");
    const page = normalizeWorkflows(await transport(connection(value), key, "api/v1/workflows", { limit: "25", excludePinnedData: "true", ...input?.cursor ? { cursor: input.cursor } : {} }, signal));
    try {
      addRecentRuns(page, await transport(connection(value), key, "api/v1/executions", { limit: "100", includeData: "false" }, signal));
    } catch (error) {
      if (signal.aborted) throw error;
      page.executionWarning = "Recent execution status is unavailable. Check execution:list access and retention in n8n.";
    }
    return page;
  });
  orca.panels.handle("n8n.complete", (input, { signal }) => serial(async () => {
    const previous = await preferences();
    if (!openedThisSession && !previous.lastOpenedAt) throw new LauncherError("Open n8n in Orca before finishing setup.", "invalid_params");
    let value = previous;
    if (input) {
      const baseUrl = instanceUrl(input.baseUrl, input.connectionKind).href;
      if (!["tab", "right", "down"].includes(input.placement)) throw new LauncherError("Choose a tab or split placement.", "invalid_params");
      value = { ...previous, baseUrl, connectionKind: input.connectionKind, placement: input.placement, lastOpenedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await ready(value, signal);
      signal.throwIfAborted();
      if ((previous.baseUrl !== baseUrl || previous.connectionKind !== input.connectionKind) && orca.grantedCapabilities.includes("secrets:own")) await orca.secrets.delete("api-key");
    }
    return save({ ...value, onboardingCompleted: true });
  }));
  orca.panels.handle("n8n.reset-onboarding", () => serial(async () => save({ ...await preferences(), onboardingCompleted: false })));
}
function activate(orca) {
  activateWithServices(orca);
}
export {
  activateWithServices,
  activate as default
};
