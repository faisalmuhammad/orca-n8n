import type { WorkflowPreview } from '../shared/types';
import { button, el, icon } from './dom';

/** Viewport offsets are relative to the fitted graph, and stay in panel memory. */
export interface PreviewViewport { zoom: number; panX: number; panY: number }

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

export function workflowPreview(preview: WorkflowPreview, viewport?: PreviewViewport, onViewportChange?: (viewport: PreviewViewport) => void): HTMLElement {
  const figure = el('figure', undefined, 'workflow-preview');
  const caption = el('figcaption', undefined, 'workflow-preview-caption');
  caption.append(el('span', 'Preview'));
  if (preview.partial) caption.append(el('span', 'Partial', 'muted'));
  const width = 72, height = 40, padding = 32;
  const xs = preview.nodes.map(node => node.position[0]), ys = preview.nodes.map(node => node.position[1]);
  const left = Math.min(...xs) - padding, top = Math.min(...ys) - padding;
  const boundsWidth = Math.max(...xs) + width + padding - left, boundsHeight = Math.max(...ys) + height + padding - top;
  const viewWidth = Math.max(boundsWidth, 432), viewHeight = Math.max(boundsHeight, 180);
  const centerX = left + boundsWidth / 2, centerY = top + boundsHeight / 2;
  const graph = svg('svg', { preserveAspectRatio: 'xMidYMid meet', role: 'img', tabindex: 0, 'aria-label': 'Workflow preview: ' + preview.nodes.length + ' nodes, ' + preview.edges.length + ' connections', 'aria-description': 'Use plus or minus to zoom, arrow keys to pan, and 0 or Home to fit. Drag to pan when zoomed. Hold Ctrl or Command and scroll to zoom.' });
  const instructions = svg('title'); instructions.textContent = 'Drag to pan · Ctrl/⌘ + scroll to zoom · 0 to fit'; graph.append(instructions);
  let view: PreviewViewport = { zoom: 1, panX: 0, panY: 0, ...viewport };
  const zoomOut = button('−', () => zoomTo(view.zoom / 1.25), 'workflow-preview-control');
  zoomOut.setAttribute('aria-label', 'Zoom out preview'); zoomOut.title = 'Zoom out';
  const zoomIn = button('+', () => zoomTo(view.zoom * 1.25), 'workflow-preview-control');
  zoomIn.setAttribute('aria-label', 'Zoom in preview'); zoomIn.title = 'Zoom in';
  const fit = button('Fit', () => { view = { zoom: 1, panX: 0, panY: 0 }; updateViewport(); }, 'workflow-preview-control');
  fit.setAttribute('aria-label', 'Fit workflow preview'); fit.title = 'Fit workflow';
  const percentage = el('output', undefined, 'workflow-preview-zoom'); percentage.setAttribute('aria-label', 'Preview zoom');
  const controls = el('div', undefined, 'workflow-preview-controls'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Preview controls');
  controls.append(zoomOut, percentage, zoomIn, fit); caption.append(controls);
  function updateViewport() {
    view.zoom = Math.max(1, Math.min(8, view.zoom));
    const limit = (1 - 1 / view.zoom) / 2;
    view.panX = Math.max(-limit, Math.min(limit, view.panX));
    view.panY = Math.max(-limit, Math.min(limit, view.panY));
    graph.setAttribute('viewBox', [centerX + view.panX * viewWidth - viewWidth / view.zoom / 2, centerY + view.panY * viewHeight - viewHeight / view.zoom / 2, viewWidth / view.zoom, viewHeight / view.zoom].join(' '));
    graph.dataset.zoomed = String(view.zoom > 1);
    percentage.value = Math.round(view.zoom * 100) + '%';
    zoomOut.disabled = view.zoom <= 1; zoomIn.disabled = view.zoom >= 8;
    onViewportChange?.({ ...view });
  }
  function zoomTo(zoom: number, anchor?: DOMPoint) {
    const next = Math.max(1, Math.min(8, zoom));
    if (anchor) {
      const ratio = 1 - view.zoom / next;
      view.panX += (anchor.x - centerX - view.panX * viewWidth) * ratio / viewWidth;
      view.panY += (anchor.y - centerY - view.panY * viewHeight) * ratio / viewHeight;
    }
    view.zoom = next; updateViewport();
  }
  graph.addEventListener('wheel', event => {
    if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return;
    event.preventDefault();
    const transform = graph.getScreenCTM();
    const anchor = transform ? new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse()) : undefined;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? graph.clientHeight : 1);
    zoomTo(view.zoom * Math.exp(-Math.max(-200, Math.min(200, delta)) * .005), anchor);
  }, { passive: false });
  graph.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') zoomTo(view.zoom * 1.25);
    else if (event.key === '-' || event.key === '_') zoomTo(view.zoom / 1.25);
    else if (event.key === '0' || event.key === 'Home') { view = { zoom: 1, panX: 0, panY: 0 }; updateViewport(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && view.zoom > 1) {
      view.panX += (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0) * .1 / view.zoom;
      view.panY += (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0) * .1 / view.zoom; updateViewport();
    } else return;
    event.preventDefault();
  });
  let drag: { id: number; x: number; y: number; view: PreviewViewport; inverse: DOMMatrix } | undefined;
  graph.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || view.zoom <= 1) return;
    const transform = graph.getScreenCTM(); if (!transform) return;
    event.preventDefault(); graph.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view }, inverse: transform.inverse() };
    graph.setPointerCapture(event.pointerId); graph.dataset.dragging = 'true';
  });
  graph.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const start = new DOMPoint(drag.x, drag.y).matrixTransform(drag.inverse);
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(drag.inverse);
    view = { zoom: drag.view.zoom, panX: drag.view.panX + (start.x - point.x) / viewWidth, panY: drag.view.panY + (start.y - point.y) / viewHeight }; updateViewport();
  });
  function endDrag(event: PointerEvent) {
    if (event.pointerId !== drag?.id) return;
    drag = undefined; delete graph.dataset.dragging;
    if (graph.hasPointerCapture(event.pointerId)) graph.releasePointerCapture(event.pointerId);
  }
  graph.addEventListener('pointerup', endDrag); graph.addEventListener('pointercancel', endDrag); graph.addEventListener('lostpointercapture', endDrag);
  updateViewport();
  for (const edge of preview.edges) {
    const source = preview.nodes[edge.source], target = preview.nodes[edge.target];
    if (!source || !target) continue;
    const sx = source.position[0] + width, sy = source.position[1] + height / 2 + Math.min(edge.output * 8, 12);
    const tx = target.position[0], ty = target.position[1] + height / 2;
    const bend = Math.max(Math.abs(tx - sx) / 2, 48);
    const path = svg('path', { d: 'M ' + sx + ' ' + sy + ' C ' + (sx + bend) + ' ' + sy + ', ' + (tx - bend) + ' ' + ty + ', ' + tx + ' ' + ty, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, opacity: .5 });
    if (edge.auxiliary) path.setAttribute('stroke-dasharray', '5 4');
    graph.append(path, svg('path', { d: 'M ' + (tx - 6) + ' ' + (ty - 4) + ' L ' + tx + ' ' + ty + ' L ' + (tx - 6) + ' ' + (ty + 4), fill: 'none', stroke: 'currentColor', 'stroke-width': 2, opacity: .5 }));
  }
  for (const node of preview.nodes) {
    const group = svg('g', { transform: 'translate(' + node.position.join(' ') + ')' });
    const title = svg('title'); title.textContent = node.name + ' · ' + node.type;
    const outline = svg('rect', { width, height, rx: 8, fill: 'var(--color-surface)', stroke: 'var(--color-primary)', 'stroke-width': 2 });
    const emblem = icon('workflow'); emblem.setAttribute('x', '24'); emblem.setAttribute('y', '8'); emblem.setAttribute('width', '24'); emblem.setAttribute('height', '24'); emblem.classList.remove('icon');
    group.append(title, outline, emblem); graph.append(group);
  }
  figure.append(caption, graph);
  return figure;
}
