import { assertValidMachine, machineFingerprint } from '../core/machine-document.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v) => scale(v, 1 / length(v));

function multiplyQuaternion(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function rotateVector(v, q) {
  const [x, y, z] = v;
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

function rotationFromPositiveX(direction) {
  const [x, y, z] = normalize(direction);
  if (x < -0.999999) return [0, 1, 0, 0];
  const q = [0, -z, y, 1 + x];
  const qLen = Math.hypot(...q);
  return q.map((value) => value / qLen);
}

function rotationAroundPositiveX(angle) {
  const half = angle * 0.5;
  return [Math.sin(half), 0, 0, Math.cos(half)];
}

function beamRotation(direction, roll = 0) {
  return multiplyQuaternion(rotationFromPositiveX(direction), rotationAroundPositiveX(roll));
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
  const connected = connectedComponents(document);
  const nodeToIsland = new Map();
  const compiledBeamById = new Map();

  const islands = connected.map((nodeIds, index) => {
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
        const rotation = beamRotation(delta, beam.roll);
        const compiled = {
          id: beam.id,
          length: beamLength,
          thickness: beam.thickness,
          density: beam.density,
          roll: beam.roll,
          machinePosition: midpoint,
          machineRotation: rotation,
          localPosition: sub(midpoint, origin),
          localRotation: rotation,
        };
        compiledBeamById.set(beam.id, { ...compiled, hostIslandId: id, islandOrigin: origin });
        return compiled;
      });

    return { id, nodeIds, origin, beams };
  });

  const compiledComponents = document.components.map((component) => {
    if (component.kind !== 'powered-wheel') throw new Error(`unsupported component kind: ${component.kind}`);
    const hostBeam = compiledBeamById.get(component.hostBeamId);
    if (!hostBeam) throw new Error(`powered wheel ${component.id} has no structural host beam`);

    const hostLocalAxis = normalize(component.mount.axis);
    const axis = normalize(rotateVector(hostLocalAxis, hostBeam.machineRotation));
    const mountOffsetMachine = rotateVector(component.mount.position, hostBeam.machineRotation);
    const hostAnchorMachine = add(hostBeam.machinePosition, mountOffsetMachine);
    const wheelCenterOffset = component.width * 0.5 + component.mountGap;
    const wheelOffset = scale(axis, wheelCenterOffset);
    const center = add(hostAnchorMachine, wheelOffset);

    return {
      id: component.id,
      kind: component.kind,
      hostBeamId: component.hostBeamId,
      hostIslandId: hostBeam.hostIslandId,
      mountPosition: [...component.mount.position],
      mountAxis: [...hostLocalAxis],
      axis,
      center,
      hostAnchorMachine,
      hostAnchorLocal: sub(hostAnchorMachine, hostBeam.islandOrigin),
      wheelAnchorLocal: scale(wheelOffset, -1),
      colliderRotation: rotationFromPositiveY(axis),
      radius: component.radius,
      width: component.width,
      mountGap: component.mountGap,
      density: component.density,
      motorVelocity: component.motorVelocity,
      motorDamping: component.motorDamping,
    };
  });

  return {
    version: 3,
    sourceRevision: document.revision,
    sourceFingerprint: machineFingerprint(document),
    islands,
    components: compiledComponents,
  };
}
