import { assertValidMachine, machineFingerprint } from '../core/machine-document.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v) => scale(v, 1 / length(v));

function rotationFromPositiveX(direction) {
  const [x, y, z] = normalize(direction);
  if (x < -0.999999) return [0, 1, 0, 0];
  const q = [0, -z, y, 1 + x];
  const qLen = Math.hypot(...q);
  return q.map((value) => value / qLen);
}

function rotationFromPositiveY(direction) {
  const [x, y, z] = normalize(direction);
  if (y < -0.999999) return [1, 0, 0, 0];
  const q = [z, 0, -x, 1 + y];
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
  const nodeToIsland = new Map();

  const islands = components.map((nodeIds, index) => {
    const id = `island-${index + 1}`;
    for (const nodeId of nodeIds) nodeToIsland.set(nodeId, id);

    const origin = nodeIds
      .map((nodeId) => nodes.get(nodeId).position)
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

    return { id, nodeIds, origin, beams };
  });

  const compiledComponents = document.components.map((component) => {
    if (component.kind !== 'powered-wheel') throw new Error(`unsupported component kind: ${component.kind}`);
    const hostIslandId = nodeToIsland.get(component.nodeId);
    if (!hostIslandId) throw new Error(`powered wheel ${component.id} has no structural host island`);
    const hostIsland = islands.find((island) => island.id === hostIslandId);
    const anchorWorld = nodes.get(component.nodeId).position;
    const axis = normalize(component.axis);
    const mountVector = scale(axis, component.mountOffset * component.side);
    const center = add(anchorWorld, mountVector);

    return {
      id: component.id,
      kind: component.kind,
      hostIslandId,
      axis,
      side: component.side,
      center,
      hostAnchorLocal: sub(anchorWorld, hostIsland.origin),
      wheelAnchorLocal: scale(mountVector, -1),
      colliderRotation: rotationFromPositiveY(axis),
      radius: component.radius,
      width: component.width,
      density: component.density,
      motorVelocity: component.motorVelocity,
      motorDamping: component.motorDamping,
    };
  });

  return {
    version: 2,
    sourceRevision: document.revision,
    sourceFingerprint: machineFingerprint(document),
    islands,
    components: compiledComponents,
  };
}
