// orca-plugin.json
var version = "0.1.1";

// src/shared/types.ts
var DEFAULT_URL = "http://localhost:5678/";
var REFRESH_INTERVALS = [0, 15, 30, 60, 120, 300];

// src/shared/workflow-order.ts
function newestWorkflows(items) {
  const updated = (item) => {
    const time = Date.parse(item.updatedAt ?? "");
    return Number.isFinite(time) ? time : -Infinity;
  };
  return [...items].sort((a, b) => {
    const left = updated(a), right = updated(b);
    return left === right ? 0 : left > right ? -1 : 1;
  });
}

// src/ui/dom.ts
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== void 0) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(label, onClick, className = "") {
  const node = el("button", label, className);
  node.type = "button";
  node.addEventListener("click", () => {
    Promise.resolve().then(onClick).catch((error2) => {
      const status = document.querySelector("[data-status]");
      if (status) {
        status.hidden = false;
        status.textContent = error2 instanceof Error ? error2.message : "Action failed.";
        status.setAttribute("role", "alert");
      }
    });
  });
  return node;
}
function field(label, control) {
  const node = el("label");
  node.append(el("span", label), control);
  return node;
}
function select(label, options) {
  const node = el("select");
  node.setAttribute("aria-label", label);
  for (const [value, title] of options) {
    const option = el("option", title);
    option.value = value;
    node.append(option);
  }
  return node;
}
function theme() {
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue("--orca-background").trim();
  const rgb = bg.match(/[0-9.]+/g)?.map(Number);
  let dark = matchMedia("(prefers-color-scheme: dark)").matches;
  if (bg.startsWith("#")) {
    const hex = bg.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (full.length === 6) dark = parseInt(full.slice(0, 2), 16) * 0.2126 + parseInt(full.slice(2, 4), 16) * 0.7152 + parseInt(full.slice(4, 6), 16) * 0.0722 < 128;
  } else if (rgb && rgb.length >= 3) dark = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 < 128;
  document.documentElement.dataset.mode = dark ? "dark" : "light";
}
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("icon");
  const paths = { settings: "M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4", arrow: "M5 12h14m-6-6 6 6-6 6", check: "m5 12 4 4L19 6", refresh: "M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 13-2l2 3 M4 16l2 3a8 8 0 0 0 13-2", chevron: "m9 5 7 7-7 7", tab: "M4 4h16v16H4zM4 8h16", right: "M4 4h16v16H4zM4 8h16M12 8v12", down: "M4 4h16v16H4zM4 8h16M4 14h16", server: "M4 4h16v6H4zM4 14h16v6H4zM7 7h1m-1 10h1", cloud: "M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10Z", workflow: "M4 4h5v5H4Z M15 15h5v5h-5Z M9 6h8v9 M6 9v8h9", clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2", close: "m6 6 12 12 M6 18 18 6" };
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", paths[name]);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

// src/ui/dropdown.ts
var nextId = 0;
var active;
function closeDropdown() {
  active?.close();
}
document.addEventListener("pointerdown", (event) => {
  if (active && !active.element.contains(event.target)) active.close();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && active) {
    event.preventDefault();
    active.close(true);
  }
});
function dropdown(label, value, items, content, extras) {
  const wrapper = el("div", void 0, "dropdown");
  const id = "dropdown-" + ++nextId;
  const trigger = button("", () => menu.hidden ? show() : hide(), "dropdown-trigger");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-label", label);
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-controls", id);
  trigger.setAttribute("aria-expanded", "false");
  const selected = el("span", void 0, "dropdown-value");
  selected.append(content ? content() : el("span", items.find((item) => item.value === value)?.label ?? items[0]?.label));
  trigger.append(selected, icon("chevron"));
  const menu = el("div", void 0, "dropdown-menu");
  menu.hidden = true;
  const options = el("div", void 0, "dropdown-options");
  options.id = id;
  options.setAttribute("role", "listbox");
  options.setAttribute("aria-label", label);
  const controls = items.map((item) => {
    const option = button("", () => {
      value = item.value;
      controls.forEach((control, index) => control.setAttribute("aria-selected", String(items[index].value === value)));
      if (!content) selected.replaceChildren(el("span", item.label));
      hide(true);
      item.select();
    }, "dropdown-option");
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(item.value === value));
    option.setAttribute("aria-label", item.label);
    option.tabIndex = -1;
    const copy = el("span", void 0, "dropdown-option-copy");
    if (item.content) copy.append(item.content());
    else {
      copy.append(el("span", item.label));
      if (item.description) copy.append(el("span", item.description, "muted"));
    }
    option.append(copy, icon("check"));
    options.append(option);
    return option;
  });
  menu.append(options);
  if (extras) menu.append(extras());
  function hide(focus = false) {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (active?.element === wrapper) active = void 0;
    if (focus && trigger.isConnected) trigger.focus();
  }
  function show(last = false) {
    closeDropdown();
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    active = { element: wrapper, close: hide };
    (last ? controls.at(-1) : controls.find((control) => control.getAttribute("aria-selected") === "true") ?? controls[0])?.focus();
  }
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show(event.key === "ArrowUp");
    }
  });
  options.addEventListener("keydown", (event) => {
    const index = controls.indexOf(document.activeElement);
    const target = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1 : event.key === "ArrowDown" ? (index + 1) % controls.length : event.key === "ArrowUp" ? (index + controls.length - 1) % controls.length : void 0;
    if (target !== void 0) {
      event.preventDefault();
      controls[target]?.focus();
    }
  });
  wrapper.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && !wrapper.contains(event.relatedTarget)) hide();
  });
  wrapper.append(trigger, menu);
  return { element: wrapper, trigger };
}

// src/ui/empty-state.ts
function illustration(state) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 160 104");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("empty-illustration");
  function shape(tag, attributes, className) {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    node.setAttribute("class", className);
    svg.append(node);
  }
  shape("rect", { x: "12", y: "8", width: "136", height: "88", rx: "24" }, "illustration-backdrop");
  shape("path", { d: "M46 52h20q8 0 8-8V34q0-8 8-8h26 M74 52v18q0 8 8 8h26", "stroke-dasharray": state === "connect" || state === "error" ? "4 4" : "none" }, "illustration-wire");
  for (const [x, y] of [[22, 40], [108, 14], [108, 66]]) {
    shape("rect", { x: String(x), y: String(y), width: "24", height: "24", rx: "8" }, "illustration-node");
    shape("circle", { cx: String(x + 12), cy: String(y + 12), r: "3" }, "illustration-port");
  }
  shape("circle", { cx: "74", cy: "52", r: "5" }, "illustration-junction" + (state === "loading" ? " illustration-pulse" : ""));
  if (state === "search") {
    shape("circle", { cx: "108", cy: "66", r: "17" }, "illustration-lens");
    shape("path", { d: "m120 78 12 12" }, "illustration-wire");
  } else if (state !== "loading") {
    shape("circle", { cx: "120", cy: "78", r: "14" }, "illustration-badge");
    shape("path", { d: state === "error" ? "M120 71v8 M120 84h.01" : state === "connect" ? "M114 77v-4h12v4 M114 77h12v6h-12z M120 70v3" : "M120 72v12 M114 78h12" }, "illustration-mark");
  }
  return svg;
}
function emptyState(state, title, description) {
  const container = el("div", void 0, "empty-state");
  container.dataset.empty = state;
  if (state === "loading") container.setAttribute("role", "status");
  container.append(illustration(state), el("h3", title), el("p", description, "muted"));
  return container;
}

// src/ui/workflow-card.ts
function timestamp(value, label, prefix = "") {
  if (!value) return;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return;
  const age = Date.now() - date.getTime();
  const text = age >= -6e4 && age < 6e4 ? "Just now" : age >= 6e4 && age < 36e5 ? Math.floor(age / 6e4) + "m ago" : age >= 36e5 && age < 864e5 ? Math.floor(age / 36e5) + "h ago" : age >= 864e5 && age < 6048e5 ? Math.floor(age / 864e5) + "d ago" : date.toLocaleDateString(void 0, { month: "short", day: "numeric", ...date.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear() ? { year: "numeric" } : {} });
  const time = el("time", prefix + text);
  time.dateTime = date.toISOString();
  time.title = label + " " + date.toLocaleString();
  time.setAttribute("aria-label", time.title);
  return time;
}
function workflowCard(item, open2, disabled, state) {
  const row = el("article", void 0, "workflow-row");
  row.setAttribute("aria-label", item.name);
  const details = el("div", void 0, "workflow-details");
  details.id = "workflow-details-" + encodeURIComponent(item.id);
  let expanded = state.expanded;
  function updateExpansion() {
    row.dataset.expanded = String(expanded);
    details.hidden = !expanded;
    name.setAttribute("aria-expanded", String(expanded));
  }
  function toggle() {
    expanded = !expanded;
    state.setExpanded(expanded);
    updateExpansion();
  }
  const name = button(item.name, toggle, "workflow-name");
  name.title = item.name;
  name.setAttribute("aria-controls", details.id);
  const status = el("span", void 0, "workflow-state");
  status.dataset.state = item.state;
  const dot = el("span", void 0, "status-dot");
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, el("span", item.state === "published" ? "Published" : item.state === "draft" ? "Draft" : item.state === "archived" ? "Archived" : "Unavailable"));
  const emblem = el("span", void 0, "workflow-emblem");
  emblem.append(icon("workflow"));
  const copy = el("div", void 0, "workflow-copy");
  copy.append(name);
  const chevron = icon("chevron");
  chevron.classList.add("workflow-disclosure-icon");
  const identity = el("div", void 0, "workflow-identity");
  identity.append(chevron, emblem, copy);
  const openButton = button("Open", open2, "open-workflow");
  openButton.setAttribute("aria-label", "Open " + item.name);
  openButton.disabled = disabled;
  const actions = el("div", void 0, "workflow-row-actions");
  actions.append(status, openButton);
  const heading = el("div", void 0, "workflow-row-heading");
  heading.append(identity, actions);
  row.append(heading);
  const meta = el("div", void 0, "workflow-meta");
  if (item.nodeCount !== void 0) {
    const nodes = el("span", void 0, "workflow-node-count");
    nodes.append(icon("workflow"), el("span", item.nodeCount.toLocaleString() + (item.nodeCount === 1 ? " node" : " nodes")));
    meta.append(nodes);
  }
  const updated = timestamp(item.updatedAt, "Updated", "Updated ");
  if (updated) meta.append(updated);
  if (meta.childElementCount) row.append(meta);
  const titles = { success: "Succeeded", error: "Failed", running: "Running", waiting: "Waiting", canceled: "Canceled", crashed: "Crashed", new: "Queued", unknown: "Unavailable" };
  const failed = item.recentRun?.status === "error" || item.recentRun?.status === "crashed";
  const run = el("div", void 0, "workflow-run");
  run.dataset.state = failed ? "failed" : item.recentRun ? "observed" : "none";
  const evidence = el("span", void 0, "workflow-run-evidence");
  evidence.append(icon(failed ? "close" : item.recentRun?.status === "success" ? "check" : "clock"), el("span", item.recentRun ? "Recent run: " + (titles[item.recentRun.status] ?? "Unavailable") : "No recent run"));
  run.append(evidence);
  const started = timestamp(item.recentRun?.startedAt, "Started");
  if (started) run.append(started);
  details.append(run);
  row.append(details);
  updateExpansion();
  row.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("button, a, input, select")) return;
    if (window.getSelection()?.toString()) return;
    toggle();
  });
  return row;
}

// src/ui/insights.ts
function duration(milliseconds) {
  if (milliseconds === 0) return "0s";
  if (milliseconds < 1e3) return Math.round(milliseconds).toLocaleString() + "ms";
  if (milliseconds < 6e4) return (milliseconds / 1e3).toLocaleString(void 0, { maximumFractionDigits: 1 }) + "s";
  if (milliseconds < 36e5) return (milliseconds / 6e4).toLocaleString(void 0, { maximumFractionDigits: 1 }) + "m";
  return (milliseconds / 36e5).toLocaleString(void 0, { maximumFractionDigits: 1 }) + "h";
}
function insightsCard(state) {
  const card = el("section", void 0, "insights-card");
  card.setAttribute("aria-label", "Execution overview");
  const heading = el("div", void 0, "insights-heading");
  const toggle = button("", state.toggle, "insights-toggle");
  toggle.setAttribute("aria-label", "Execution overview");
  toggle.setAttribute("aria-expanded", String(state.expanded));
  toggle.setAttribute("aria-controls", "insights-details");
  toggle.append(icon("chevron"), el("span", "Overview"), el("span", "Last 7 days", "muted insights-range"));
  heading.append(toggle);
  if (state.expanded) {
    const refresh = button("", state.refresh, "icon-button");
    refresh.append(icon("refresh"));
    refresh.setAttribute("aria-label", "Refresh overview");
    refresh.title = "Refresh overview";
    refresh.disabled = state.loading;
    heading.append(refresh);
  }
  card.append(heading);
  const details = el("div", void 0, "insights-details");
  details.id = "insights-details";
  details.hidden = !state.expanded;
  card.append(details);
  if (!state.expanded) return card;
  if (state.error) {
    const error2 = el("p", "Overview unavailable. Your instance must support insights and your API key needs insights:read access.", "help");
    error2.setAttribute("role", "status");
    error2.title = state.error;
    details.append(error2);
  } else if (state.summary) {
    const data = state.summary, grid = el("dl", void 0, "insights-grid");
    for (const [label, value, name] of [
      ["Prod. runs", data.total.toLocaleString(), "total"],
      ["Failed runs", data.failed.toLocaleString(), "failed"],
      ["Failure rate", (data.failureRate * 100).toLocaleString(void 0, { maximumFractionDigits: 1 }) + "%", "rate"],
      ["Time saved", duration(data.timeSavedMinutes * 6e4), "saved"],
      ["Avg. run time", duration(data.averageRunTimeMs), "duration"]
    ]) {
      const metric = el("div", void 0, "insight-metric");
      metric.dataset.metric = name;
      metric.append(el("dt", label), el("dd", value));
      grid.append(metric);
    }
    details.append(grid);
    toggle.title = "Reported by n8n \xB7 " + data.startDate + " \u2013 " + data.endDate;
  }
  if (state.loading) {
    const loading2 = el("p", "Loading overview\u2026", "help");
    loading2.setAttribute("role", "status");
    details.append(loading2);
  }
  if (state.error) {
    const retry = button("Try again", state.refresh, "text-button");
    retry.disabled = state.loading;
    details.append(retry);
  }
  return card;
}

// src/panel/main.ts
theme();
orca.on("theme", theme);
var root = el("main", void 0, "panel");
document.body.append(root);
var signal = new AbortController();
var prefs = { baseUrl: DEFAULT_URL, placement: "tab", onboardingCompleted: false };
var draftUrl = DEFAULT_URL.replace(/\/$/, "");
var step = 1;
var busy = "";
var connected = false;
var opened = false;
var error = "";
var loading = true;
var editing = false;
var settingsVisible = false;
var draftKind = "local";
var hasApiKey = false;
var hasConnection = false;
var workflowItems = [];
var expandedWorkflows = /* @__PURE__ */ new Set();
var workflowCursor;
var workflowError = "";
var executionWarning = "";
var workflowsLoading = false;
var workflowsLoaded = false;
var workflowSearch = "";
var workflowFilter = "";
var browseGeneration = 0;
var browseAbort = new AbortController();
var refreshTimer;
var setupSnapshot;
var overviewExpanded = false;
var overview;
var overviewLoading = false;
var overviewError = "";
var overviewGeneration = 0;
var overviewAbort = new AbortController();
function clearOverview() {
  overviewAbort.abort();
  ++overviewGeneration;
  overview = void 0;
  overviewLoading = false;
  overviewError = "";
  overviewExpanded = false;
}
async function loadOverview() {
  if (!hasApiKey || !overviewExpanded || overviewLoading) return;
  overviewAbort.abort();
  overviewAbort = new AbortController();
  const token = ++overviewGeneration;
  overviewLoading = true;
  overviewError = "";
  render();
  try {
    const result = await orca.plugin.request("n8n.insights", void 0, { signal: overviewAbort.signal });
    if (token === overviewGeneration) overview = result;
  } catch (value) {
    if (token === overviewGeneration) overviewError = value instanceof Error ? value.message : "Insights are unavailable.";
  } finally {
    if (token === overviewGeneration) {
      overviewLoading = false;
      render();
    }
  }
}
function toggleOverview() {
  overviewExpanded = !overviewExpanded;
  if (!overviewExpanded) {
    overviewAbort.abort();
    ++overviewGeneration;
    overviewLoading = false;
  }
  render();
  if (overviewExpanded) void loadOverview();
  root.querySelector(".insights-toggle")?.focus();
}
function action(label, run, primary = false) {
  const control = button(label, run, primary ? "action primary" : "action");
  if (primary) control.append(icon("arrow"));
  control.disabled = Boolean(busy) || loading;
  return control;
}
async function task(name, run) {
  if (busy) return;
  busy = name;
  error = "";
  render();
  try {
    await run();
  } catch (value) {
    error = value instanceof Error ? value.message : "Something went wrong. Try again.";
  } finally {
    busy = "";
    render();
    focusStep();
  }
}
function notify() {
  const status = el("div", error, "notice");
  status.dataset.status = "";
  status.hidden = !error;
  status.setAttribute("role", "alert");
  return status;
}
function connectionBadge(current = true) {
  const badge = el("span", void 0, "status-dot connection-badge");
  badge.dataset.current = String(current);
  badge.dataset.state = !current ? "offline" : busy === "connect" ? "checking" : connected ? "online" : "offline";
  const status = !current ? "Not configured" : busy === "connect" ? "Checking connection" : connected ? prefs.connectionKind === "cloud" && !hasApiKey ? "Configured" : "Connected" : "Not checked";
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", status);
  badge.title = status;
  return badge;
}
function header() {
  const header2 = el("header", void 0, "brand-header");
  const logo = el("div", void 0, "logo");
  for (const mode of ["light", "dark"]) {
    const img = el("img", void 0, "logo-" + mode);
    img.src = "./assets/n8n-logo-" + mode + ".svg";
    img.alt = "n8n";
    img.width = 88;
    img.height = 32;
    logo.append(img);
  }
  const title = el("span", "Workflows in Orca", "brand-subtitle");
  const mark = el("div", void 0, "brand-lockup");
  mark.append(logo, title);
  const tools = el("div", void 0, "header-tools");
  const kind = prefs.connectionKind ?? "local";
  const currentTitle = kind === "local" ? "Local n8n" : "n8n Cloud";
  function connectionCopy(title2, current) {
    const copy = el("span", void 0, "connection-copy");
    const name = el("span", void 0, "connection-name");
    name.append(connectionBadge(current), el("span", title2, "connection-title"));
    copy.append(name);
    return copy;
  }
  const picker = dropdown("Connections", kind, ["local", "cloud"].map((value) => ({ value, label: value === "local" ? "Local n8n" : "n8n Cloud", content: () => {
    const option = el("span", void 0, "connection-option");
    const symbol = el("span", void 0, "connection-symbol");
    symbol.append(icon(value === "local" ? "server" : "cloud"));
    const copy = connectionCopy(value === "local" ? "Local n8n" : "n8n Cloud", value === kind);
    copy.append(el("span", value === kind ? new URL(prefs.baseUrl).host : "Set up connection", "connection-address"));
    option.append(symbol, copy);
    return option;
  }, select: () => {
    if (value !== kind) showSettings(value);
  } })), () => connectionCopy(currentTitle, true), () => {
    const actions = el("div", void 0, "dropdown-extra");
    if (prefs.onboardingCompleted) actions.append(button("Change connection or layout", () => beginSetup(connected ? 2 : 1), "dropdown-link"), button("View setup guide", () => beginSetup(1), "dropdown-link"));
    return actions;
  });
  picker.element.classList.add("connection-picker");
  picker.trigger.disabled = Boolean(busy) || loading || settingsVisible;
  const settings = button("", showSettings, "icon-button");
  settings.append(icon("settings"));
  settings.setAttribute("aria-label", "Connection settings");
  settings.title = "Connection settings";
  settings.disabled = Boolean(busy) || loading;
  tools.append(picker.element, settings);
  header2.append(mark, tools);
  return header2;
}
function hero() {
  const section = el("section", void 0, "hero");
  const texture = el("div", void 0, "dot-grid");
  texture.setAttribute("aria-hidden", "true");
  section.append(texture, el("p", "Bring your workflows into Orca.", "hero-title"), el("p", "Connect an instance, choose your layout, and open n8n.", "hero-copy"));
  return section;
}
function progress() {
  const section = el("div", void 0, "setup-progress");
  const row = el("div", void 0, "section-label");
  row.append(el("h1", editing ? "Update setup" : "Get started"), el("span", "Step " + step + " of 3", "muted"));
  const bars = el("div", void 0, "progress-bars");
  bars.setAttribute("aria-hidden", "true");
  for (let i = 1; i <= 3; i++) {
    const bar = el("span");
    bar.dataset.current = String(i <= step);
    bars.append(bar);
  }
  section.append(row, bars);
  return section;
}
function stepCard(number, title, subtitle, content, done, available) {
  const card = el("section", void 0, "step-card");
  card.dataset.active = String(step === number);
  card.dataset.done = String(done);
  const toggle = button("", () => {
    if (available) {
      step = number;
      error = "";
      render();
    }
  }, "step-heading");
  toggle.disabled = !available || Boolean(busy) || loading;
  toggle.setAttribute("aria-label", title);
  toggle.setAttribute("aria-expanded", String(step === number));
  toggle.setAttribute("aria-controls", "step-" + number);
  if (step === number) toggle.setAttribute("aria-current", "step");
  const numberBadge = el("span", done ? "" : String(number), "step-number");
  if (done) numberBadge.append(icon("check"));
  const copy = el("span", void 0, "step-copy");
  copy.append(el("span", title, "step-title"), el("span", subtitle, "muted"));
  toggle.append(numberBadge, copy, icon("chevron"));
  card.append(toggle);
  const body = el("div", void 0, "step-body");
  body.id = "step-" + number;
  body.hidden = step !== number;
  if (step === number) body.append(content());
  card.append(body);
  return card;
}
async function check() {
  await task("connect", async () => {
    connected = false;
    const changed = prefs.baseUrl.replace(/\/$/, "") !== draftUrl || (prefs.connectionKind ?? "local") !== draftKind;
    if (changed) {
      browseAbort.abort();
      ++browseGeneration;
      workflowsLoading = false;
      clearOverview();
    }
    if (setupSnapshot) {
      const result = await orca.plugin.request("n8n.preview-connection", { baseUrl: draftUrl, connectionKind: draftKind }, { signal: signal.signal });
      prefs = { ...prefs, baseUrl: result.baseUrl, connectionKind: result.connectionKind };
    } else {
      const result = await orca.plugin.request("n8n.connect", { baseUrl: draftUrl, connectionKind: draftKind }, { signal: signal.signal });
      prefs = { ...result.preferences, placement: prefs.placement };
      hasConnection = true;
    }
    draftUrl = prefs.baseUrl.replace(/\/$/, "");
    connected = true;
    if (changed) {
      hasApiKey = false;
      workflowsLoaded = false;
      workflowItems = [];
      workflowCursor = void 0;
      workflowError = "";
      executionWarning = "";
    }
  });
}
function connectStep() {
  const body = el("div", void 0, "stack");
  body.append(el("p", draftKind === "cloud" ? "Save your Cloud address, then sign in in n8n." : "Check that your local n8n instance is ready.", "muted"));
  const form = el("form", void 0, "stack");
  const kind = select("Connection type", [["local", "Local n8n"], ["cloud", "n8n Cloud"]]);
  kind.value = draftKind;
  kind.disabled = Boolean(busy) || loading;
  kind.addEventListener("change", () => {
    draftKind = kind.value;
    draftUrl = draftKind === (prefs.connectionKind ?? "local") ? prefs.baseUrl.replace(/\/$/, "") : draftKind === "local" ? DEFAULT_URL.replace(/\/$/, "") : "";
    connected = false;
    opened = false;
    render();
  });
  const input = el("input");
  input.type = "url";
  input.required = true;
  input.value = draftUrl;
  input.placeholder = draftKind === "local" ? "http://localhost:5678" : "https://your-team.app.n8n.cloud";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.id = "instance-url";
  input.setAttribute("aria-describedby", "url-help");
  input.disabled = Boolean(busy) || loading;
  const help = el("p", draftKind === "local" ? "Use the address and port of your running n8n instance. Sign in directly in n8n." : "Use the HTTPS address of your n8n Cloud workspace. API access is optional.", "help");
  help.id = "url-help";
  const submit = el("button", busy === "connect" ? "Checking connection\u2026" : connected ? "Check again" : "Check connection", connected ? "action" : "action primary");
  submit.type = "submit";
  submit.disabled = Boolean(busy) || loading;
  if (!connected) submit.append(icon("arrow"));
  input.addEventListener("input", () => {
    draftUrl = input.value;
    connected = false;
    opened = false;
    submit.textContent = "Check connection";
    submit.className = "action primary";
    submit.append(icon("arrow"));
    const next = document.querySelector("[data-continue]");
    if (next) next.disabled = true;
    root.querySelectorAll(".connection-badge[data-current=true]").forEach((badge) => badge.replaceWith(connectionBadge()));
  });
  form.append(field("Connection", kind), field("Instance URL", input), help, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void check();
  });
  body.append(form);
  if (connected) {
    const ready = el("div", void 0, "ready-note");
    ready.append(icon("check"), el("span", draftKind === "cloud" ? "Cloud address saved. Sign in in the n8n tab." : "n8n is ready on port " + (new URL(prefs.baseUrl).port || (prefs.baseUrl.startsWith("https") ? "443" : "80")) + "."));
    body.append(ready);
    const next = action("Continue", () => {
      step = 2;
      render();
      focusStep();
    }, true);
    next.dataset.continue = "";
    body.append(next);
  }
  const helpDetails = el("details", void 0, "help-details");
  helpDetails.append(el("summary", "Need to start n8n?"), el("p", "Start your local n8n instance, wait for it to finish loading, then paste its address above.", "muted"));
  body.append(helpDetails);
  return body;
}
function destinationStep() {
  const body = el("div", void 0, "stack");
  body.append(el("p", "n8n opens automatically in your current Orca workspace.", "muted"), el("span", "Open the editor as", "field-title"));
  const choices = el("div", void 0, "placement-options");
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Editor placement");
  for (const [placement, name] of [["tab", "Tab"], ["right", "Right split"], ["down", "Below"]]) {
    const control = button("", () => {
      prefs.placement = placement;
      for (const item of choices.querySelectorAll("button")) item.setAttribute("aria-pressed", String(item.dataset.placement === placement));
    }, "placement");
    control.dataset.placement = placement;
    control.setAttribute("aria-label", name);
    control.setAttribute("aria-pressed", String(prefs.placement === placement));
    control.disabled = Boolean(busy);
    control.append(icon(placement), el("span", name));
    choices.append(control);
  }
  const next = action("Continue to n8n", () => {
    step = 3;
    render();
    focusStep();
  }, true);
  next.disabled ||= !connected;
  body.append(choices, el("p", "A split keeps your code and workflows in view together.", "muted"), next);
  return body;
}
async function open(intent, workflowId) {
  let launched = false;
  await task("open", async () => {
    try {
      const result = await orca.plugin.request("n8n.open", { placement: prefs.placement, ...intent ? { intent } : {}, ...workflowId ? { workflowId } : {}, ...setupSnapshot ? { preview: true, baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? "local" } : {} }, { signal: signal.signal });
      prefs = result.preferences;
      opened = true;
      launched = true;
    } catch (value) {
      connected = false;
      throw value;
    }
  });
  if (launched && intent === "new-workflow" && hasApiKey && prefs.onboardingCompleted && !setupSnapshot) await loadWorkflows();
}
function launchStep() {
  const body = el("div", void 0, "stack");
  if (opened) {
    const note = el("div", void 0, "ready-note");
    note.setAttribute("role", "status");
    note.append(icon("check"), el("span", "Your n8n tab is open."));
    body.append(note);
  }
  const tips = el("ol", void 0, "launch-tips");
  for (const [title, description] of [["Sign in or create your account", prefs.connectionKind === "cloud" ? "Sign in to your n8n Cloud workspace in the browser tab." : "Finish account setup in the n8n tab if this is your first visit."], ["Create your first workflow", "Choose a trigger, connect your nodes, and test in n8n\u2019s editor."], ["Bring your workflow list here", "Optional: create an API key in n8n Settings \u2192 n8n API, then add it with the settings icon above."]]) {
    const item = el("li");
    item.append(el("span", title, "tip-title"), el("p", description, "muted"));
    tips.append(item);
  }
  body.append(tips);
  const launch = action(busy === "open" ? "Opening n8n\u2026" : opened ? "Show n8n editor" : "Open n8n in Orca", () => open(), !opened);
  launch.disabled ||= !connected;
  body.append(launch);
  if (opened) body.append(action(setupSnapshot ? "Save setup" : "Finish setup", async () => {
    await task("complete", async () => {
      prefs = await orca.plugin.request("n8n.complete", setupSnapshot ? { baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? "local", placement: prefs.placement } : void 0, { signal: signal.signal });
      hasApiKey = (await orca.plugin.request("n8n.state", void 0, { signal: signal.signal })).hasApiKey;
      editing = false;
      setupSnapshot = void 0;
    });
    if (!error && hasApiKey) await loadWorkflows();
  }, true));
  body.append(el("p", "Your login stays in n8n\u2019s browser session.", "help"));
  return body;
}
function focusStep() {
  root.querySelector("[aria-current=step]")?.focus();
}
function beginSetup(startStep) {
  setupSnapshot ??= { preferences: { ...prefs }, connected };
  editing = true;
  step = startStep;
  opened = false;
  error = "";
  draftKind = prefs.connectionKind ?? "local";
  draftUrl = prefs.baseUrl.replace(/\/$/, "");
  render();
  focusStep();
}
async function cancelSetup() {
  if (!setupSnapshot) return;
  await task("cancel-setup", async () => {
    const result = await orca.plugin.request("n8n.state", void 0, { signal: signal.signal });
    connected = !!setupSnapshot?.connected && result.preferences.baseUrl === setupSnapshot.preferences.baseUrl;
    prefs = result.preferences;
    hasApiKey = result.hasApiKey;
    hasConnection = result.hasConnection;
    draftKind = prefs.connectionKind ?? "local";
    draftUrl = prefs.baseUrl.replace(/\/$/, "");
    editing = false;
    setupSnapshot = void 0;
    settingsVisible = false;
    opened = false;
  });
  if (!error && hasApiKey) await loadWorkflows();
}
function showSettings(kind) {
  if (busy) return;
  settingsVisible = true;
  error = "";
  draftKind = kind ?? prefs.connectionKind ?? "local";
  draftUrl = draftKind === (prefs.connectionKind ?? "local") ? prefs.baseUrl.replace(/\/$/, "") : draftKind === "local" ? DEFAULT_URL.replace(/\/$/, "") : "";
  render();
  root.querySelector("#settings-url")?.focus();
}
function settingsForm() {
  const card = el("section", void 0, "home-card");
  card.append(el("h1", "Connection settings"), el("p", "Choose where n8n runs. Add an API key to show workflows and execution status in this sidebar.", "muted"));
  const form = el("form", void 0, "stack");
  const kind = select("Connection type", [["local", "Local n8n"], ["cloud", "n8n Cloud"]]);
  kind.value = draftKind;
  kind.disabled = Boolean(busy);
  const url = el("input");
  url.id = "settings-url";
  url.type = "url";
  url.required = true;
  url.value = draftUrl;
  url.autocomplete = "off";
  url.spellcheck = false;
  url.placeholder = draftKind === "local" ? "http://localhost:5678" : "https://your-team.app.n8n.cloud";
  url.disabled = Boolean(busy);
  kind.addEventListener("change", () => {
    draftKind = kind.value;
    draftUrl = draftKind === (prefs.connectionKind ?? "local") ? prefs.baseUrl.replace(/\/$/, "") : draftKind === "local" ? DEFAULT_URL.replace(/\/$/, "") : "";
    render();
  });
  url.addEventListener("input", () => {
    draftUrl = url.value;
  });
  const key = el("input");
  key.type = "password";
  key.autocomplete = "off";
  key.spellcheck = false;
  key.placeholder = hasApiKey ? "Leave blank to keep the stored key" : "Paste your n8n API key";
  key.disabled = Boolean(busy);
  const remove = el("input");
  remove.type = "checkbox";
  remove.disabled = Boolean(busy) || !hasApiKey;
  form.append(field("Connection", kind), field("Instance URL", url), field("API key (optional)", key), el("p", "In n8n, open Settings \u2192 n8n API \u2192 Create an API key. Workflows need workflow:list; recent runs need execution:list; overview needs insights:read.", "help"));
  if (draftKind === "cloud") form.append(el("p", "n8n Cloud API access is unavailable during the free trial. You can still use the browser editor without a key.", "help"));
  if (hasApiKey) form.append(field("Remove stored API key", remove));
  const refresh = select("Automatic refresh", REFRESH_INTERVALS.map((seconds) => [String(seconds), seconds === 0 ? "Off \u2014 manual refresh only" : seconds < 60 ? "Every " + seconds + " seconds" : "Every " + seconds / 60 + (seconds === 60 ? " minute" : " minutes")]));
  refresh.value = String(prefs.refreshIntervalSeconds ?? 30);
  refresh.disabled = Boolean(busy);
  form.append(field("Automatic refresh", refresh), el("p", "Refresh pauses while settings are open, you are typing, or the panel is hidden.", "help"));
  const save = el("button", busy === "settings" ? "Saving and testing\u2026" : "Save and test", "action primary");
  save.type = "submit";
  save.disabled = Boolean(busy);
  save.append(icon("arrow"));
  form.append(save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const apiKey = key.value;
    key.value = "";
    const baseUrl = url.value;
    const connectionKind = draftKind;
    const removeKey = remove.checked;
    const refreshIntervalSeconds = Number(refresh.value);
    void task("settings", async () => {
      browseAbort.abort();
      ++browseGeneration;
      clearOverview();
      workflowsLoading = false;
      workflowsLoaded = false;
      workflowItems = [];
      workflowCursor = void 0;
      workflowError = "";
      connected = false;
      const result = await orca.plugin.request("n8n.configure", { baseUrl, connectionKind, refreshIntervalSeconds, ...apiKey ? { apiKey } : {}, ...removeKey ? { removeKey } : {} }, { signal: signal.signal });
      prefs = { ...result.preferences, placement: prefs.placement };
      hasApiKey = result.hasApiKey;
      hasConnection = true;
      draftUrl = prefs.baseUrl.replace(/\/$/, "");
      draftKind = prefs.connectionKind ?? "local";
      await orca.plugin.request("n8n.connect", { baseUrl: prefs.baseUrl, connectionKind: draftKind }, { signal: signal.signal });
      connected = true;
      if (hasApiKey) {
        const page = await orca.plugin.request("n8n.workflows", void 0, { signal: signal.signal });
        workflowItems = page.data;
        workflowsLoaded = true;
        workflowCursor = page.nextCursor;
        executionWarning = page.executionWarning ?? "";
      }
      settingsVisible = false;
    });
  });
  card.append(form);
  const apiSettings = action("Open API settings in n8n", () => open("api-settings"));
  card.append(apiSettings);
  if (hasConnection) card.append(connectionRemoval());
  const close = button("Back", () => {
    key.value = "";
    settingsVisible = false;
    error = "";
    draftKind = prefs.connectionKind ?? "local";
    draftUrl = prefs.baseUrl.replace(/\/$/, "");
    render();
  }, "text-button");
  close.disabled = Boolean(busy);
  card.append(close);
  return card;
}
function connectionRemoval() {
  const section = el("div", void 0, "connection-removal");
  function cancel() {
    section.replaceChildren(remove);
    remove.focus();
  }
  const remove = button(busy === "delete-connection" ? "Deleting connection\u2026" : "Delete connection", () => {
    const saved = { baseUrl: prefs.baseUrl, connectionKind: prefs.connectionKind ?? "local" };
    const confirmation = el("div", void 0, "delete-confirmation");
    confirmation.setAttribute("role", "group");
    confirmation.setAttribute("aria-label", "Delete connection confirmation");
    confirmation.append(el("h2", "Delete this connection?"), el("p", new URL(saved.baseUrl).host, "connection-address"), el("p", "Remove the saved connection, API key, and sidebar setup from Orca. Your n8n instance and workflows stay available.", "muted"));
    const choices = el("div", void 0, "connection-actions");
    const keep = button("Keep connection", cancel, "action");
    const confirm = button("Delete connection", async () => {
      await task("delete-connection", async () => {
        browseAbort.abort();
        ++browseGeneration;
        workflowsLoading = false;
        window.clearTimeout(refreshTimer);
        prefs = await orca.plugin.request("n8n.delete-connection", saved, { signal: signal.signal });
        hasConnection = false;
        hasApiKey = false;
        connected = false;
        opened = false;
        settingsVisible = false;
        editing = false;
        setupSnapshot = void 0;
        clearOverview();
        workflowItems = [];
        expandedWorkflows.clear();
        workflowCursor = void 0;
        workflowError = "";
        executionWarning = "";
        workflowsLoaded = false;
        workflowSearch = "";
        workflowFilter = "";
        draftKind = prefs.connectionKind ?? "local";
        draftUrl = prefs.baseUrl.replace(/\/$/, "");
        step = 1;
      });
    }, "action delete-confirm");
    choices.append(keep, confirm);
    confirmation.append(choices);
    section.replaceChildren(confirmation);
    keep.focus();
  }, "action delete-confirm");
  remove.disabled = Boolean(busy);
  section.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && section.querySelector(".delete-confirmation")) {
      event.preventDefault();
      cancel();
    }
  });
  section.append(remove);
  return section;
}
async function loadWorkflows(more = false) {
  if (!hasApiKey || more && (!workflowCursor || workflowItems.length >= 500)) return;
  browseAbort.abort();
  browseAbort = new AbortController();
  const token = ++browseGeneration;
  workflowsLoading = true;
  workflowError = "";
  render();
  try {
    const page = await orca.plugin.request("n8n.workflows", more ? { cursor: workflowCursor } : void 0, { signal: browseAbort.signal });
    if (token !== browseGeneration) return;
    workflowItems = [...new Map((more ? [...workflowItems, ...page.data] : page.data).map((item) => [item.id, item])).values()].slice(0, 500);
    const loadedKeys = new Set(workflowItems.map((item) => JSON.stringify([prefs.baseUrl, item.id])));
    for (const key of expandedWorkflows) if (!loadedKeys.has(key)) expandedWorkflows.delete(key);
    workflowCursor = page.nextCursor;
    executionWarning = page.executionWarning ?? "";
    workflowsLoaded = true;
  } catch (value) {
    if (token === browseGeneration) workflowError = value instanceof Error ? value.message : "Could not load workflows. Refresh to try again.";
  } finally {
    if (token === browseGeneration) {
      workflowsLoading = false;
      render();
    }
  }
}
async function refreshSidebar() {
  if (busy || workflowsLoading || loading) return;
  if (hasApiKey && prefs.onboardingCompleted) await Promise.all([loadWorkflows(), loadOverview()]);
  else await check();
}
function scheduleRefresh() {
  window.clearTimeout(refreshTimer);
  const seconds = prefs.refreshIntervalSeconds ?? 30;
  if (!seconds || !prefs.onboardingCompleted || settingsVisible || editing || loading || document.hidden) return;
  refreshTimer = window.setTimeout(async () => {
    const typing = root.contains(document.activeElement) && document.activeElement?.matches("input, select, [role=combobox], [role=option]");
    if (!typing && !busy && !workflowsLoading) await refreshSidebar();
    scheduleRefresh();
  }, seconds * 1e3);
}
function workflowSection() {
  const section = el("section", void 0, "workflow-section");
  const heading = el("div", void 0, "section-label");
  const title = el("div", void 0, "workflow-heading");
  title.append(el("h2", "Workflows"), el("span", String(workflowItems.length), "muted"));
  const refresh = button("", refreshSidebar, "icon-button");
  refresh.append(icon("refresh"));
  refresh.setAttribute("aria-label", "Refresh workflows");
  refresh.title = "Refresh workflows";
  refresh.disabled = Boolean(busy) || workflowsLoading;
  heading.append(title, refresh);
  section.append(heading);
  if (!hasApiKey) {
    const state = emptyState("connect", "Bring your workflows into view", "Add an API key to see your workflows and their status here.");
    state.append(action("Connect workflow list", showSettings));
    const scroll2 = el("div", void 0, "workflow-scroll");
    scroll2.append(state);
    section.append(scroll2);
    return section;
  }
  const search = el("input");
  search.type = "search";
  search.value = workflowSearch;
  search.placeholder = "Search workflows";
  search.setAttribute("aria-label", "Search workflows");
  const filter = dropdown("Workflow status", workflowFilter, [["", "All statuses"], ["published", "Published"], ["draft", "Draft"], ["archived", "Archived"]].map(([value, label]) => ({ value, label, select: () => {
    workflowFilter = value;
    renderList();
  } })));
  const list = el("div", void 0, "workflow-list");
  function renderList() {
    list.replaceChildren();
    const items = newestWorkflows(workflowItems).filter((item) => item.name.toLowerCase().includes(workflowSearch.toLowerCase()) && (!workflowFilter || item.state === workflowFilter));
    for (const item of items) {
      const key = JSON.stringify([prefs.baseUrl, item.id]);
      list.append(workflowCard(item, () => open(void 0, item.id), Boolean(busy), { expanded: expandedWorkflows.has(key), setExpanded: (expanded) => {
        if (expanded) expandedWorkflows.add(key);
        else expandedWorkflows.delete(key);
      } }));
    }
    if (!items.length) {
      if (workflowsLoading) list.append(emptyState("loading", "Loading workflows\u2026", "Fetching your workflows from n8n."));
      else if (workflowError || error) {
        const state = emptyState("error", "Couldn\u2019t load workflows", "Check your connection and try again.");
        state.append(action("Try again", refreshSidebar));
        list.append(state);
      } else if (!workflowsLoaded) list.append(emptyState("loading", "Loading workflows\u2026", "Fetching your workflows from n8n."));
      else if (workflowSearch || workflowFilter || workflowItems.length) {
        const state = emptyState("search", "No matching workflows", "Try a different search or status. Filters apply to the loaded workflows.");
        state.append(button("Clear filters", () => {
          workflowSearch = "";
          workflowFilter = "";
          render();
          root.querySelector('[aria-label="Search workflows"]')?.focus();
        }, "empty-action"));
        list.append(state);
      } else {
        const state = emptyState("empty", "Your next workflow starts here", "Create a workflow in n8n. It will appear here after the next refresh.");
        const create = action("Create a workflow", () => open("new-workflow"));
        create.disabled ||= !connected;
        state.append(create);
        list.append(state);
      }
    }
  }
  search.addEventListener("input", () => {
    workflowSearch = search.value;
    renderList();
  });
  renderList();
  const controls = el("div", void 0, "workflow-controls");
  controls.append(search, filter.element);
  section.append(controls);
  const scroll = el("div", void 0, "workflow-scroll");
  scroll.append(list);
  section.append(scroll);
  if (workflowsLoading && workflowItems.length) {
    const loading2 = el("p", "Refreshing workflows\u2026", "muted");
    loading2.setAttribute("role", "status");
    section.append(loading2);
  }
  if (workflowError) {
    const error2 = el("p", workflowError, "notice");
    error2.setAttribute("role", "alert");
    section.append(error2);
  }
  if (executionWarning) section.append(el("p", executionWarning, "help"));
  if (workflowCursor && workflowItems.length < 500) {
    const more = action("Load more workflows", () => loadWorkflows(true));
    more.disabled ||= workflowsLoading;
    scroll.append(more);
  }
  if (workflowItems.length >= 500) section.append(el("p", "Showing up to 500 workflows. Use n8n to browse the full instance.", "help"));
  return section;
}
function homeActions() {
  const card = el("section", void 0, "action-bar");
  card.setAttribute("aria-label", "n8n actions");
  const create = button("New Workflow", () => open("new-workflow"), "action primary");
  create.setAttribute("aria-label", "New n8n workflow");
  create.disabled = Boolean(busy) || !connected;
  const launch = button(busy === "open" ? "Opening\u2026" : "Open n8n", () => open(), "action");
  launch.setAttribute("aria-label", "Open n8n in Orca");
  launch.disabled = Boolean(busy) || !connected;
  card.append(create, launch);
  return card;
}
function render() {
  const scrollTop = root.querySelector(".workflow-scroll")?.scrollTop ?? 0;
  closeDropdown();
  const isHome = prefs.onboardingCompleted && !editing;
  root.replaceChildren(header(), notify());
  const content = el("div", void 0, "panel-body");
  if (loading) {
    const loadingText = el("p", "Getting your workspace ready\u2026", "loading");
    loadingText.setAttribute("role", "status");
    content.append(loadingText);
  } else if (settingsVisible) content.append(settingsForm());
  else if (isHome) {
    root.append(homeActions());
    content.dataset.view = "home";
    if (hasApiKey) content.append(insightsCard({ expanded: overviewExpanded, summary: overview, loading: overviewLoading, error: overviewError, toggle: toggleOverview, refresh: loadOverview }));
    content.append(workflowSection());
  } else {
    if (!setupSnapshot) content.append(hero());
    if (setupSnapshot) {
      const back = button("Back to workflows", cancelSetup, "back-button");
      back.setAttribute("aria-label", "Back to workflows");
      back.disabled = Boolean(busy);
      content.append(back);
    }
    content.append(progress(), stepCard(1, "Connect your instance", connected ? "Your instance is configured" : "Local or n8n Cloud", connectStep, connected, true), stepCard(2, "Make room for workflows", "Choose a tab or split", destinationStep, step > 2, connected), stepCard(3, "Start building", "Sign in and create a workflow", launchStep, opened, connected));
  }
  if (error) content.append(button("Refresh sidebar", initialise, "text-button"));
  const footer = el("footer", void 0, "footer");
  const release = el("span", "v" + version, "plugin-version");
  release.setAttribute("aria-label", "Plugin version " + version);
  footer.append(el("span", "Unofficial plugin for managing n8n workflows in Orca."), release);
  root.append(content, footer);
  const scroll = root.querySelector(".workflow-scroll");
  if (scroll) scroll.scrollTop = scrollTop;
  root.setAttribute("aria-busy", String(loading || !!busy));
  scheduleRefresh();
}
async function initialise() {
  if (busy) return;
  loading = true;
  connected = false;
  opened = false;
  step = 1;
  error = "";
  clearOverview();
  render();
  try {
    const result = await orca.plugin.request("n8n.state", void 0, { signal: signal.signal });
    prefs = result.preferences;
    hasApiKey = result.hasApiKey;
    hasConnection = result.hasConnection;
    draftKind = prefs.connectionKind ?? "local";
    draftUrl = prefs.baseUrl.replace(/\/$/, "");
  } catch (value) {
    error = value instanceof Error ? value.message : "Worker unavailable. Refresh to try again.";
  } finally {
    loading = false;
    render();
  }
  if (!error && prefs.onboardingCompleted) await check();
  if (!error && hasApiKey && prefs.onboardingCompleted) await loadWorkflows();
}
document.addEventListener("visibilitychange", scheduleRefresh);
window.addEventListener("pagehide", () => {
  window.clearTimeout(refreshTimer);
  signal.abort();
  browseAbort.abort();
  overviewAbort.abort();
}, { once: true });
void initialise();
