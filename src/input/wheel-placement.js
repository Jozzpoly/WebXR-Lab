export function inferPoweredWheelPlacement(document, nodeId) {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) throw new Error(`unknown wheel placement node: ${nodeId}`);

  const structuralIds = new Set(document.beams.flatMap((beam) => [beam.a, beam.b]));
  const structuralNodes = document.nodes.filter((candidate) => structuralIds.has(candidate.id));
  if (!structuralNodes.length) throw new Error('wheel placement requires structural geometry');

  const centroid = structuralNodes
    .reduce((sum, candidate) => [
      sum[0] + candidate.position[0],
      sum[1] + candidate.position[1],
      sum[2] + candidate.position[2],
    ], [0, 0, 0])
    .map((value) => value / structuralNodes.length);

  const dx = node.position[0] - centroid[0];
  const dz = node.position[2] - centroid[2];

  if (Math.abs(dx) >= Math.abs(dz)) {
    return { axis: [1, 0, 0], side: dx < 0 ? -1 : 1 };
  }
  return { axis: [0, 0, 1], side: dz < 0 ? -1 : 1 };
}
