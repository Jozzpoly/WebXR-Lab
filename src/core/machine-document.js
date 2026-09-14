export const MACHINE_VERSION = 1;
export const MIN_BEAM_LENGTH = 0.08;

const clone = (value) => structuredClone(value);
const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const vectorLength = (v) => Math.hypot(v[0], v[1], v[2]);

export function createSeedMachine() {
  return {
    version: MACHINE_VERSION,
    revision: 0,
    nextIds: { node: 3, beam: 2, component: 1 },
    nodes: [
      { id: 'n1', position: [-0.4, 0.45, 0] },
      { id: 'n2', position: [0.4, 0.45, 0] },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', thickness: 0.12, density: 420 },
    ],
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

  const beamIds = new Set();
  const connections = new Set();
  const structuralNodes = new Set();
  for (const beam of document.beams) {
    if (!beam?.id || beamIds.has(beam.id)) errors.push(`duplicate or missing beam id: ${beam?.id}`);
    beamIds.add(beam?.id);
    const aNode = nodes.get(beam?.a);
    const bNode = nodes.get(beam?.b);
    if (!aNode || !bNode) errors.push(`beam ${beam?.id ?? '?'} references a missing node`);
    if (beam?.a === beam?.b) errors.push(`beam ${beam?.id ?? '?'} cannot connect a node to itself`);
    if (aNode && bNode && finiteVec3(aNode.position) && finiteVec3(bNode.position) && distance(aNode.position, bNode.position) < MIN_BEAM_LENGTH) {
      errors.push(`beam ${beam?.id ?? '?'} is shorter than ${MIN_BEAM_LENGTH} m`);
    }
    if (!(Number.isFinite(beam?.thickness) && beam.thickness > 0)) errors.push(`beam ${beam?.id ?? '?'} has invalid thickness`);
    if (!(Number.isFinite(beam?.density) && beam.density > 0)) errors.push(`beam ${beam?.id ?? '?'} has invalid density`);
    const key = [beam?.a, beam?.b].sort().join('|');
    if (connections.has(key)) errors.push(`duplicate structural connection: ${key}`);
    connections.add(key);
    if (aNode && bNode) {
      structuralNodes.add(beam.a);
      structuralNodes.add(beam.b);
    }
  }

  const componentIds = new Set();
  for (const component of document.components) {
    if (!component?.id || componentIds.has(component.id)) errors.push(`duplicate or missing component id: ${component?.id}`);
    componentIds.add(component?.id);
    if (component?.kind !== 'powered-wheel') {
      errors.push(`component ${component?.id ?? '?'} has unsupported kind: ${component?.kind}`);
      continue;
    }
    if (!nodes.has(component.nodeId)) errors.push(`powered wheel ${component.id} references a missing node`);
    else if (!structuralNodes.has(component.nodeId)) errors.push(`powered wheel ${component.id} must attach to a structural node`);
    if (!finiteVec3(component.axis) || vectorLength(component.axis) < 1e-6) errors.push(`powered wheel ${component.id} has an invalid axis`);
    if (component.side !== -1 && component.side !== 1) errors.push(`powered wheel ${component.id} has invalid side`);
    if (!(Number.isFinite(component.radius) && component.radius > 0.04)) errors.push(`powered wheel ${component.id} has invalid radius`);
    if (!(Number.isFinite(component.width) && component.width > 0.02)) errors.push(`powered wheel ${component.id} has invalid width`);
    if (!(Number.isFinite(component.mountOffset) && component.mountOffset >= 0)) errors.push(`powered wheel ${component.id} has invalid mount offset`);
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

export function extendFromNode(document, startNodeId, endPosition, targetNodeId = null) {
  assertValidMachine(document);
  if (!finiteVec3(endPosition)) throw new Error('endPosition must be a finite vec3');

  const start = document.nodes.find((node) => node.id === startNodeId);
  if (!start) throw new Error(`unknown start node: ${startNodeId}`);

  const next = clone(document);
  let endNode;

  if (targetNodeId) {
    endNode = next.nodes.find((node) => node.id === targetNodeId);
    if (!endNode) throw new Error(`unknown target node: ${targetNodeId}`);
    if (endNode.id === startNodeId) return document;
    const duplicate = next.beams.some((beam) =>
      (beam.a === startNodeId && beam.b === targetNodeId) ||
      (beam.a === targetNodeId && beam.b === startNodeId));
    if (duplicate) return document;
  } else {
    const nodeId = `n${next.nextIds.node++}`;
    endNode = { id: nodeId, position: [...endPosition] };
    next.nodes.push(endNode);
  }

  if (distance(endNode.position, start.position) < MIN_BEAM_LENGTH) return document;

  next.beams.push({
    id: `b${next.nextIds.beam++}`,
    a: startNodeId,
    b: endNode.id,
    thickness: 0.12,
    density: 420,
  });
  next.revision += 1;
  return assertValidMachine(next);
}

export function attachPoweredWheel(document, nodeId, options = {}) {
  assertValidMachine(document);
  if (!document.nodes.some((node) => node.id === nodeId)) throw new Error(`unknown wheel node: ${nodeId}`);

  const axis = options.axis ?? [0, 0, 1];
  if (!finiteVec3(axis) || vectorLength(axis) < 1e-6) throw new Error('wheel axis must be a non-zero finite vec3');
  const side = options.side ?? 1;
  if (side !== -1 && side !== 1) throw new Error('wheel side must be -1 or 1');

  const next = clone(document);
  const componentId = `c${next.nextIds.component++}`;
  next.components.push({
    id: componentId,
    kind: 'powered-wheel',
    nodeId,
    axis: [...axis],
    side,
    radius: options.radius ?? 0.26,
    width: options.width ?? 0.12,
    mountOffset: options.mountOffset ?? 0.15,
    density: options.density ?? 650,
    motorVelocity: options.motorVelocity ?? 8,
    motorDamping: options.motorDamping ?? 1.2,
  });
  next.revision += 1;
  return assertValidMachine(next);
}
