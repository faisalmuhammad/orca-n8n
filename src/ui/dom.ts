import type {} from 'orca/frame';
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node;
}
export function button(label: string, onClick: () => void | Promise<unknown>, className = ''): HTMLButtonElement {
  const node = el('button', label, className); node.type = 'button';
  node.addEventListener('click', () => { Promise.resolve().then(onClick).catch(error => { const status = document.querySelector<HTMLElement>('[data-status]'); if (status) { status.hidden = false; status.textContent = error instanceof Error ? error.message : 'Action failed.'; status.setAttribute('role', 'alert'); } }); }); return node;
}
export function field(label: string, control: HTMLElement): HTMLLabelElement { const node = el('label'); node.append(el('span', label), control); return node; }
export function select(label: string, options: [string, string][]): HTMLSelectElement {
  const node = el('select'); node.setAttribute('aria-label', label);
  for (const [value, title] of options) { const option = el('option', title); option.value = value; node.append(option); } return node;
}
export function theme(): void {
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--orca-background').trim();
  const rgb = bg.match(/[0-9.]+/g)?.map(Number);
  let dark = matchMedia('(prefers-color-scheme: dark)').matches;
  if (bg.startsWith('#')) {
    const hex = bg.slice(1); const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    if (full.length === 6) dark = (parseInt(full.slice(0, 2), 16) * .2126 + parseInt(full.slice(2, 4), 16) * .7152 + parseInt(full.slice(4, 6), 16) * .0722) < 128;
  } else if (rgb && rgb.length >= 3) dark = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < 128;
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
}
export function icon(name: 'arrow' | 'check' | 'refresh' | 'chevron' | 'tab' | 'right' | 'down' | 'server' | 'cloud' | 'settings' | 'workflow' | 'clock' | 'close'): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('icon');
  // Settings and refresh match Command Center's outline icon vocabulary.
  const paths = { settings: 'M4 6h16 M4 12h16 M4 18h16 M8 4v4 M16 10v4 M10 16v4', arrow: 'M5 12h14m-6-6 6 6-6 6', check: 'm5 12 4 4L19 6', refresh: 'M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 13-2l2 3 M4 16l2 3a8 8 0 0 0 13-2', chevron: 'm9 5 7 7-7 7', tab: 'M4 4h16v16H4zM4 8h16', right: 'M4 4h16v16H4zM4 8h16M12 8v12', down: 'M4 4h16v16H4zM4 8h16M4 14h16', server: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h1m-1 10h1', cloud: 'M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10Z', workflow: 'M4 4h5v5H4Z M15 15h5v5h-5Z M9 6h8v9 M6 9v8h9', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2', close: 'm6 6 12 12 M6 18 18 6' };
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name]); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.6'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); svg.append(path); return svg;
}
