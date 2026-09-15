export const MACHINE_VERSION = 2;
export const MIN_BEAM_LENGTH = 0.08;

const clone = (value) => structuredClone(value);
const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const vectorLength = (v) => Math.hypot(...v);
const normalizeVec3 = (v) => {
  const len = vectorLength(v);
  return v.map((value) => value / len);
};

function beamEndNodeId(document, beamId, end) {
  const beam = document.beams.find((candidate) => candidate.id === beamId);
  if (!beam) throw new Error(`unknown beam: ${beamId}`);
  if (end !== 'a' && end !== 'b') throw new Error(`beam end must be "a" or "b", got: ${end}`);
  return beam[end];
}

function beamLength(document, beam) {
  const a = document.nodes.find((node) => node.id === beam.a)?.position;
  const b = document.nodes.find((node) => node.id === beam.b)?.position;
  if (!a || !b) return 0;
  return distance(a, b);
}

function physicalEndpoint(document, target, fallbackPosition, label) {
  if (target) {
    const nodeId = beamEndNodeId(document, target.beamId, target.end);
    const node = document.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error(`${label} target references missing topology`);
    return { nodeId, position: [...node.position], reused: true };
  }
  if (!finiteVec3(fallbackPosition)) throw new Error(`${label} position must be a finite vec3`);
  return { nodeId: null, position: [...fallbackPosition], reused: false };
}

function validateWheelMount(mount, label) {
  if (!finiteVec3(mount?.position)) throw new Error(`${label} requires a finite host-local position`);
  if (!finiteVec3(mount?.axis) || vectorLength(mount.axis) < 1e-6) throw new Error(`${label} requires a non-zero host-local axis`);
}

export function createEmptyMachine() {
  return {
    version: MACHINE_VERSION,
    revision: 0,
    nextIds: { node: 1, beam: 1, component: 1 },
    nodes: [],
    beams: [],
    components: [],
  };
}

export function validateMachine(document) {
  const errors = [];
  if (!document || document.version !== MACHINE_VERSION) errors.push(`unsupported machine version: ${document?.version}`);
  if (!Number.isInteger(document?.revision) || document.revision < 0) errors.push('revision must be a non-negative integer');
  if (!Array.isArray(document?.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(document?.beams)) errors.push('beams must be an array');
  if (!Array.isArray(document?.components)) errors.push('components must be an array');
  if (errors.length) return errors;

  const nodes = new Map();
  for (const node of document.nodes) {
    if (!node?.id || nodes.has(node.id)) errors.push(`duplicate or missing node id: ${node?.id}`);
    if (!finiteVec3(node?.position)) errors.push(`node ${node?.id ?? '?'} has an invalid position`);
    nodes.set(node.id, node);
  }

  const beams = new Map();
  const connections = new Set();
  for (const beam of document.beams) {
    if (!beam?.id || beams.has(beam.id)) errors.push(`duplicate or missing beam id: ${beam?.id}`);
    beams.set(beam?.id, beam);
    const aNode = nodes.get(beam?.a);
    const bNode = nodes.get(beam?.b);
    if (!aNode || !bNode) errors.push(`beam ${beam?.id ?? '?'} references a missing node`);
    if (beam?.a === beam?.b) errors.push(`beam ${beam?.id ?? '?'} cannot connect a node to itself`);
    if (aNode && bNode && finiteVec3(aNode.position) && finiteVec3(bNode.position) && distance(aNode.position, bNode.position) < MIN_BEAM_LENGTH) {
      errors.push(`beam ${beam?.id ?? '?'} is shorter than ${MIN_BEAM_LENGTH} m`);
    }
    if (!Number.isFinite(beam?.roll)) errors.push(`beam ${beam?.id ?? '?'} has invalid roll`);
    if (!(Number.isFinite(beam?.thickness) && beam.thickness > 0)) errors.push(`beam ${beam?.id ?? '?'} has invalid thickness`);
    if (!(Number.isFinite(beam?.density) && beam.density > 0)) errors.push(`beam ${beam?.id ?? '?'} has invalid density`);
    const key = [beam?.a, beam?.b].sort().join('|');
    if (connections.has(key)) errors.push(`duplicate structural connection: ${key}`);
    connections.add(key);
  }

  const componentIds = new Set();
  for (const component of document.components) {
    if (!component?.id || componentIds.has(component.id)) errors.push(`duplicate or missing component id: ${component?.id}`);
    componentIds.add(component?.id);
    if (component?.kind !== 'powered-wheel') {
      errors.push(`component ${component?.id ?? '?'} has unsupported kind: ${component?.kind}`);
      continue;
    }
    if (!beams.has(component.hostBeamId)) errors.push(`powered wheel ${component.id} references a missing host beam`);
    if (!finiteVec3(component?.mount?.position)) errors.push(`powered wheel ${component.id} has an invalid mount position`);
    if (!finiteVec3(component?.mount?.axis) || vectorLength(component.mount.axis) < 1e-6) errors.push(`powered wheel ${component.id} has an invalid mount axis`);
    if (!(Number.isFinite(component.radius) && component.radius > 0.04)) errors.push(`powered wheel ${component.id} has invalid radius`);
    if (!(Number.isFinite(component.width) && component.width > 0.02)) errors.push(`powered wheel ${component.id} has invalid width`);
    if (!(Number.isFinite(component.mountGap) && component.mountGap >= 0)) errors.push(`powered wheel ${component.id} has invalid mount gap`);
    if (!(Number.isFinite(component.density) && component.density > 0)) errors.push(`powered wheel ${component.id} has invalid density`);
    if (!Number.isFinite(component.motorVelocity)) errors.push(`powered wheel ${component.id} has invalid motor velocity`);
    if (!(Number.isFinite(component.motorDamping) && component.motorDamping >= 0)) errors.push(`powered wheel ${component.id} has invalid motor damping`);
  }

  return errors;
}

export function assertValidMachine(document) {
  const errors = validateMachine(document);
  if (errors.length) throw new Error(errors.join('\n'));
  return document;
}

export function machineFingerprint(document) {
  assertValidMachine(document);
  return JSON.stringify(document);
}

export function createBeam(document, startPosition, endPosition, options = {}) {
  assertValidMachine(document);
  const start = physicalEndpoint(document, options.startTargetBeamEnd ?? null, startPosition, 'beam start');
  const end = physicalEndpoint(document, options.endTargetBeamEnd ?? null, endPosition, 'beam end');

  if (start.nodeId && end.nodeId && start.nodeId === end.nodeId) return document;
  if (distance(start.position, end.position) < MIN_BEAM_LENGTH) return document;

  if (start.nodeId && end.nodeId) {
    const duplicate = document.beams.some((beam) =>
      (beam.a === start.nodeId && beam.b === end.nodeId) ||
      (beam.a === end.nodeId && beam.b === start.nodeId));
    if (duplicate) return document;
  }

  const roll = options.roll ?? 0;
  const thickness = options.thickness ?? 0.12;
  const density = options.density ?? 420;
  if (!Number.isFinite(roll)) throw new Error('beam roll must be finite');
  if (!(Number.isFinite(thickness) && thickness > 0)) throw new Error('beam thickness must be positive');
  if (!(Number.isFinite(density) && density > 0)) throw new Error('beam density must be positive');

  const next = clone(document);
  let a = start.nodeId;
  let b = end.nodeId;

  if (!a) {
    a = `n${next.nextIds.node++}`;
    next.nodes.push({ id: a, position: [...start.position] });
  }
  if (!b) {
    b = `n${next.nextIds.node++}`;
    next.nodes.push({ id: b, position: [...end.position] });
  }

  next.beams.push({
    id: `b${next.nextIds.beam++}`,
    a,
    b,
    roll,
    thickness,
    density,
  });
  next.revision += 1;
  return assertValidMachine(next);
}

export function extendFromBeamEnd(document, beamId, end, endPosition, targetBeamEnd = null) {
  assertValidMachine(document);
  const startPosition = document.nodes.find((node) => node.id === beamEndNodeId(document, beamId, end))?.position;
  return createBeam(document, startPosition, endPosition, {
    startTargetBeamEnd: { beamId, end },
    endTargetBeamEnd: targetBeamEnd,
  });
}

export function moveBeamEnd(document, beamId, end, position) {
  assertValidMachine(document);
  if (!finiteVec3(position)) throw new Error('beam end position must be a finite vec3');

  const nodeId = beamEndNodeId(document, beamId, end);
  const currentNode = document.nodes.find((node) => node.id === nodeId);
  if (currentNode.position.every((value, index) => value === position[index])) return document;

  const affectedBeams = document.beams.filter((beam) => beam.a === nodeId || beam.b === nodeId);
  const oldLengths = new Map(affectedBeams.map((beam) => [beam.id, beamLength(document, beam)]));
  const next = clone(document);
  next.nodes.find((node) => node.id === nodeId).position = [...position];

  for (const beam of affectedBeams) {
    const nextBeam = next.beams.find((candidate) => candidate.id === beam.id);
    const newLength = beamLength(next, nextBeam);
    if (newLength < MIN_BEAM_LENGTH) return document;
    const oldLength = oldLengths.get(beam.id);
    if (!(oldLength > 0)) continue;
    const ratio = newLength / oldLength;
    for (const component of next.components) {
      if (component.hostBeamId !== beam.id) continue;
      component.mount.position[0] *= ratio;
    }
  }

  next.revision += 1;
  return assertValidMachine(next);
}

export function removeBeam(document, beamId) {
  assertValidMachine(document);
  const beamIndex = document.beams.findIndex((beam) => beam.id === beamId);
  if (beamIndex < 0) throw new Error(`unknown beam: ${beamId}`);

  const next = clone(document);
  next.beams.splice(beamIndex, 1);
  next.components = next.components.filter((component) => component.hostBeamId !== beamId);

  const referencedNodes = new Set(next.beams.flatMap((beam) => [beam.a, beam.b]));
  next.nodes = next.nodes.filter((node) => referencedNodes.has(node.id));
  next.revision += 1;
  return assertValidMachine(next);
}

export function attachPoweredWheel(document, hostBeamId, options = {}) {
  assertValidMachine(document);
  if (!document.beams.some((beam) => beam.id === hostBeamId)) throw new Error(`unknown wheel host beam: ${hostBeamId}`);
  const mount = options.mount;
  validateWheelMount(mount, 'powered wheel mount');

  const next = clone(document);
  const componentId = `c${next.nextIds.component++}`;
  next.components.push({
    id: componentId,
    kind: 'powered-wheel',
    hostBeamId,
    mount: {
      position: [...mount.position],
      axis: normalizeVec3(mount.axis),
    },
    radius: options.radius ?? 0.26,
    width: options.width ?? 0.12,
    mountGap: options.mountGap ?? 0.02,
    density: options.density ?? 650,
    motorVelocity: options.motorVelocity ?? 8,
    motorDamping: options.motorDamping ?? 1.2,
  });
  next.revision += 1;
  return assertValidMachine(next);
}

export function rehostPoweredWheel(document, componentId, hostBeamId, mount) {
  assertValidMachine(document);
  const current = document.components.find((component) => component.id === componentId);
  if (!current) throw new Error(`unknown component: ${componentId}`);
  if (current.kind !== 'powered-wheel') throw new Error(`component ${componentId} is not a powered wheel`);
  if (!document.beams.some((beam) => beam.id === hostBeamId)) throw new Error(`unknown wheel host beam: ${hostBeamId}`);
  validateWheelMount(mount, 'powered wheel rehost mount');

  const sameHost = current.hostBeamId === hostBeamId;
  const samePosition = current.mount.position.every((value, index) => value === mount.position[index]);
  const normalizedAxis = normalizeVec3(mount.axis);
  const sameAxis = current.mount.axis.every((value, index) => Math.abs(value - normalizedAxis[index]) < 1e-12);
  if (sameHost && samePosition && sameAxis) return document;

  const next = clone(document);
  const wheel = next.components.find((component) => component.id === componentId);
  wheel.hostBeamId = hostBeamId;
  wheel.mount = {
    position: [...mount.position],
    axis: normalizedAxis,
  };
  next.revision += 1;
  return assertValidMachine(next);
}

export function editPoweredWheel(document, componentId, patch = {}) {
  assertValidMachine(document);
  const current = document.components.find((component) => component.id === componentId);
  if (!current) throw new Error(`unknown component: ${componentId}`);
  if (current.kind !== 'powered-wheel') throw new Error(`component ${componentId} is not a powered wheel`);

  const allowed = new Set(['mount', 'radius', 'width', 'mountGap', 'density', 'motorVelocity', 'motorDamping']);
  const unknown = Object.keys(patch).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`unsupported powered-wheel edit field(s): ${unknown.join(', ')}`);

  const next = clone(document);
  const wheel = next.components.find((component) => component.id === componentId);
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'mount') {
      validateWheelMount(value, 'powered wheel mount edit');
      wheel.mount = { position: [...value.position], axis: normalizeVec3(value.axis) };
    } else {
      wheel[key] = value;
    }
  }
  next.revision += 1;
  return assertValidMachine(next);
}

export function removeComponent(document, componentId) {
  assertValidMachine(document);
  const index = document.components.findIndex((component) => component.id === componentId);
  if (index < 0) throw new Error(`unknown component: ${componentId}`);

  const next = clone(document);
  next.components.splice(index, 1);
  next.revision += 1;
  return assertValidMachine(next);
}
