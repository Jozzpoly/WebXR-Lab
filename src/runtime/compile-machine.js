import { assertValidMachine, machineFingerprint } from '../core/machine-document.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const length = (v) => Math.hypot(v[0], v[1], v[2]);

function rotationFromPositiveX(direction) {
  const len = length(direction);
  if (len < 1e-8) throw new Error('cannot orient a zero-length beam');
  const x = direction[0] / len;
  const y = direction[1] / len;
  const z = direction[2] / len;
  if (x < -0.999999) return [0, 1, 0, 0];
  const q = [0, -z, y, 1 + x];
  const qLen = Math.hypot(...q);
  return q.map((value) => value / qLen);
}

function connectedComponents(document) {
  const adjacency = new Map(document.nodes.map((node) => [node.id, new Set()]));
  for (const beam of document.beams) {
    adjacency.get(beam.a).add(beam.b);
    adjacency.get(beam.b).add(beam.a);
  }

  const activeNodes = new Set(document.beams.flatMap((beam) => [beam.a, beam.b]));
  const visited = new Set();
  const components = [];

  for (const nodeId of [...activeNodes].sort()) {
    if (visited.has(nodeId)) continue;
    const stack = [nodeId];
    const component = [];
    visited.add(nodeId);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      for (const neighbor of adjacency.get(current)) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component.sort());
  }
  return components;
}

export function compileMachine(document) {
  assertValidMachine(document);
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const components = connectedComponents(document);

  const islands = components.map((nodeIds, index) => {
    const origin = nodeIds
      .map((id) => nodes.get(id).position)
      .reduce((sum, position) => add(sum, position), [0, 0, 0])
      .map((value) => value / nodeIds.length);
    const nodeSet = new Set(nodeIds);
    const beams = document.beams
      .filter((beam) => nodeSet.has(beam.a) && nodeSet.has(beam.b))
      .map((beam) => {
        const a = nodes.get(beam.a).position;
        const b = nodes.get(beam.b).position;
        const delta = sub(b, a);
        const beamLength = length(delta);
        const midpoint = scale(add(a, b), 0.5);
        return {
          id: beam.id,
          length: beamLength,
          thickness: beam.thickness,
          density: beam.density,
          localPosition: sub(midpoint, origin),
          localRotation: rotationFromPositiveX(delta),
        };
      });

    return {
      id: `island-${index + 1}`,
      nodeIds,
      origin,
      beams,
    };
  });

  return {
    version: 1,
    sourceRevision: document.revision,
    sourceFingerprint: machineFingerprint(document),
    islands,
  };
}
