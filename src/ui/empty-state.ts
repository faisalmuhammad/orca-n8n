import { el } from './dom';
type State = 'connect' | 'empty' | 'search' | 'loading' | 'error';

// Decorative, locally bundled SVGs; no remote assets or workflow data.
function illustration(state: State) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 160 104'); svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('empty-illustration');
  function shape(tag: 'path' | 'rect' | 'circle', attributes: Record<string, string>, className: string) {
    const node = document.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    node.setAttribute('class', className); svg.append(node);
  }
  shape('rect', { x: '12', y: '8', width: '136', height: '88', rx: '24' }, 'illustration-backdrop');
  shape('path', { d: 'M46 52h20q8 0 8-8V34q0-8 8-8h26 M74 52v18q0 8 8 8h26', 'stroke-dasharray': state === 'connect' || state === 'error' ? '4 4' : 'none' }, 'illustration-wire');
  for (const [x, y] of [[22, 40], [108, 14], [108, 66]]) {
    shape('rect', { x: String(x), y: String(y), width: '24', height: '24', rx: '8' }, 'illustration-node');
    shape('circle', { cx: String(x + 12), cy: String(y + 12), r: '3' }, 'illustration-port');
  }
  shape('circle', { cx: '74', cy: '52', r: '5' }, 'illustration-junction' + (state === 'loading' ? ' illustration-pulse' : ''));
  if (state === 'search') {
    shape('circle', { cx: '108', cy: '66', r: '17' }, 'illustration-lens');
    shape('path', { d: 'm120 78 12 12' }, 'illustration-wire');
  } else if (state !== 'loading') {
    shape('circle', { cx: '120', cy: '78', r: '14' }, 'illustration-badge');
    shape('path', { d: state === 'error' ? 'M120 71v8 M120 84h.01' : state === 'connect' ? 'M114 77v-4h12v4 M114 77h12v6h-12z M120 70v3' : 'M120 72v12 M114 78h12' }, 'illustration-mark');
  }
  return svg;
}
export function emptyState(state: State, title: string, description: string) {
  const container = el('div', undefined, 'empty-state'); container.dataset.empty = state;
  if (state === 'loading') container.setAttribute('role', 'status');
  container.append(illustration(state), el('h3', title), el('p', description, 'muted'));
  return container;
}
