import { closestPointOnBeamSurface, getBeamFrame } from '../core/beam-frame.js';

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
  const excludedBeam = excluded
    ? document.beams.find((beam) => beam.id === excluded.beamId)
    : null;
  const excludedNodeId = excludedBeam && (excluded?.end === 'a' || excluded?.end === 'b')
    ? excludedBeam[excluded.end]
    : null;

  for (const beam of document.beams) {
    for (const end of ['a', 'b']) {
      const nodeId = beam[end];
      if (nodeId === excludedNodeId || seenNodeIds.has(nodeId)) continue;
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

export function nearestBeamSurface(document, point, maxDistance = 0.2) {
  let best = null;
  for (const beam of document.beams) {
    const frame = getBeamFrame(document, beam.id);
    const surface = closestPointOnBeamSurface(frame, point);
    if (surface.distance > maxDistance || (best && surface.distance >= best.distance)) continue;
    best = {
      beamId: beam.id,
      distance: surface.distance,
      machinePosition: surface.machinePosition,
      localPosition: surface.position,
      localNormal: surface.normal,
    };
  }
  return best;
}
