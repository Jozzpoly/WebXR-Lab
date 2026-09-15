const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function beamEndPosition(document, beamId, end) {
  const beam = document.beams.find((candidate) => candidate.id === beamId);
  if (!beam) return null;
  if (end !== 'a' && end !== 'b') return null;
  const node = document.nodes.find((candidate) => candidate.id === beam[end]);
  return node ? [...node.position] : null;
}

export function nearestBeamEnd(document, point, radius = 0.16, excluded = null) {
  let best = null;
  let bestDistance = radius;
  const seenNodeIds = new Set();

  for (const beam of document.beams) {
    for (const end of ['a', 'b']) {
      if (excluded?.beamId === beam.id && excluded?.end === end) continue;
      const nodeId = beam[end];
      if (seenNodeIds.has(nodeId)) continue;
      seenNodeIds.add(nodeId);
      const node = document.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) continue;
      const currentDistance = distance(point, node.position);
      if (currentDistance <= bestDistance) {
        best = { beamId: beam.id, end, position: [...node.position] };
        bestDistance = currentDistance;
      }
    }
  }

  return best;
}
