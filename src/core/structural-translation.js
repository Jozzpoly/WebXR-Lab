import { assertValidMachine } from './machine-document.js';

const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function collectIslandNodeIds(document, beamId) {
  const seed = document.beams.find((beam) => beam.id === beamId);
  if (!seed) throw new Error(`unknown beam: ${beamId}`);

  const nodeIds = new Set([seed.a, seed.b]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const beam of document.beams) {
      if (!nodeIds.has(beam.a) && !nodeIds.has(beam.b)) continue;
      const before = nodeIds.size;
      nodeIds.add(beam.a);
      nodeIds.add(beam.b);
      if (nodeIds.size !== before) changed = true;
    }
  }
  return nodeIds;
}

export function translateStructuralIsland(document, beamId, delta) {
  assertValidMachine(document);
  if (!finiteVec3(delta)) throw new Error('structural island translation requires a finite vec3 delta');
  if (delta.every((value) => value === 0)) return document;

  const nodeIds = collectIslandNodeIds(document, beamId);
  const next = structuredClone(document);
  for (const node of next.nodes) {
    if (!nodeIds.has(node.id)) continue;
    node.position = node.position.map((value, index) => value + delta[index]);
  }
  next.revision += 1;
  return assertValidMachine(next);
}
