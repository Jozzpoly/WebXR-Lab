import { closestPointOnBeamSurface, getBeamFrame } from '../core/beam-frame.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function dominantFace(normal) {
  if (!Array.isArray(normal) || normal.length !== 3 || !normal.every(Number.isFinite)) {
    throw new Error('wheel placement requires a finite beam-local surface normal');
  }
  let axis = 0;
  for (let i = 1; i < 3; i += 1) {
    if (Math.abs(normal[i]) > Math.abs(normal[axis])) axis = i;
  }
  if (Math.abs(normal[axis]) < 1e-6) throw new Error('wheel placement requires a non-zero surface normal');
  return { axis, sign: normal[axis] < 0 ? -1 : 1 };
}

export function proposePoweredWheelPlacement(document, beamId, localPosition, localNormal, { motorSpeed = 8 } = {}) {
  const frame = getBeamFrame(document, beamId);
  if (!Array.isArray(localPosition) || localPosition.length !== 3 || !localPosition.every(Number.isFinite)) {
    throw new Error('wheel placement requires a finite beam-local position');
  }

  const face = dominantFace(localNormal);
  const extents = [frame.length * 0.5, frame.thickness * 0.5, frame.thickness * 0.5];
  const position = localPosition.map((value, axis) => clamp(value, -extents[axis], extents[axis]));
  position[face.axis] = face.sign * extents[face.axis];
  const axis = [0, 0, 0];
  axis[face.axis] = face.sign;

  return {
    hostBeamId: beamId,
    mount: { position, axis },
    motorVelocity: Math.abs(motorSpeed) * face.sign,
  };
}

export function proposePoweredWheelPlacementNearPoint(document, machinePoint, { maxDistance = 0.24, motorSpeed = 8 } = {}) {
  if (!Array.isArray(machinePoint) || machinePoint.length !== 3 || !machinePoint.every(Number.isFinite)) {
    throw new Error('wheel proximity placement requires a finite machine-local point');
  }

  let best = null;
  for (const beam of document.beams) {
    const frame = getBeamFrame(document, beam.id);
    const surface = closestPointOnBeamSurface(frame, machinePoint);
    if (surface.distance > maxDistance || (best && surface.distance >= best.distance)) continue;
    best = {
      ...proposePoweredWheelPlacement(document, beam.id, surface.position, surface.normal, { motorSpeed }),
      distance: surface.distance,
      surfaceMachinePosition: surface.machinePosition,
    };
  }
  return best;
}

export function poweredWheelPlacementMatches(component, candidate, epsilon = 1e-4) {
  if (!component || component.kind !== 'powered-wheel' || !candidate) return false;
  if (component.hostBeamId !== candidate.hostBeamId) return false;
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(component.mount.position[i] - candidate.mount.position[i]) > epsilon) return false;
    if (Math.abs(component.mount.axis[i] - candidate.mount.axis[i]) > epsilon) return false;
  }
  return true;
}
