export const MACHINE_VERSION = 1;
export const MIN_BEAM_LENGTH = 0.08;

const clone = (value) => structuredClone(value);
const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function createSeedMachine() {
  return {
    version: MACHINE_VERSION,
    revision: 0,
    nextIds: { node: 3, beam: 2 },
    nodes: [
      { id: 'n1', position: [-0.4, 1.12, -1.45] },
      { id: 'n2', position: [0.4, 1.12, -1.45] },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', thickness: 0.12, density: 420 },
    ],
  };
}

export function validateMachine(document) {
  const errors = [];
  if (!document || document.version !== MACHINE_VERSION) errors.push(`unsupported machine version: ${document?.version}`);
  if (!Number.isInteger(document?.revision) || document.revision < 0) errors.push('revision must be a non-negative integer');
  if (!Array.isArray(document?.nodes)) errors.push('nodes must be an array');
  if (!Array.isArray(document?.beams)) errors.push('beams must be an array');
  if (errors.length) return errors;

  const nodes = new Map();
  for (const node of document.nodes) {
    if (!node?.id || nodes.has(node.id)) errors.push(`duplicate or missing node id: ${node?.id}`);
    if (!finiteVec3(node?.position)) errors.push(`node ${node?.id ?? '?'} has an invalid position`);
    nodes.set(node.id, node);
  }

  const beamIds = new Set();
  const connections = new Set();
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
