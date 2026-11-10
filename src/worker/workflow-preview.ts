import type { WorkflowPreview } from '../shared/types';
const MAX_NODES = 100, MAX_EDGES = 200;
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }

// Project topology only. Node parameters, credentials, pinned data, and execution data never cross the bridge.
export function normalizePreview(value: Record<string, unknown>): WorkflowPreview | undefined {
  if (!Array.isArray(value.nodes) || !value.nodes.length) return;
  const nodes: WorkflowPreview['nodes'] = [], edges: WorkflowPreview['edges'] = [];
  const names = new Map<string, number | undefined>();
  let partial = value.nodes.length > MAX_NODES;
  for (const item of value.nodes.slice(0, MAX_NODES)) {
    if (!record(item) || typeof item.name !== 'string' || !item.name || item.name.length > 250) { partial = true; continue; }
    const index = nodes.length;
    const validPosition = Array.isArray(item.position) && item.position.length === 2 && item.position.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000);
    const position: [number, number] = validPosition ? [Number((item.position as number[])[0]), Number((item.position as number[])[1])] : [(index % 8) * 160, Math.floor(index / 8) * 112];
    if (!validPosition) partial = true;
    nodes.push({ name: item.name, type: typeof item.type === 'string' ? item.type.slice(0, 128) : 'Unknown node', position });
    if (names.has(item.name)) { names.set(item.name, undefined); partial = true; } else names.set(item.name, index);
  }
  if (!nodes.length) return;
  if (!record(value.connections)) return { nodes, edges, partial: true };
  let inspected = 0;
  outer: for (const [name, channels] of Object.entries(value.connections)) {
    const source = names.get(name);
    if (source === undefined || !record(channels)) { partial = true; continue; }
    const entries = Object.entries(channels);
    if (entries.length > 16) partial = true;
    for (const [channel, outputs] of entries.slice(0, 16)) {
      if (!Array.isArray(outputs)) { partial = true; continue; }
      if (outputs.length > 32) partial = true;
      for (const [output, targets] of outputs.slice(0, 32).entries()) {
        if (!Array.isArray(targets)) { partial = true; continue; }
        for (const connection of targets) {
          if (++inspected > MAX_EDGES) { partial = true; break outer; }
          const target = record(connection) && typeof connection.node === 'string' ? names.get(connection.node) : undefined;
          if (target === undefined) { partial = true; continue; }
          edges.push({ source, target, output, auxiliary: channel !== 'main' });
        }
      }
    }
  }
  return { nodes, edges, partial };
}
