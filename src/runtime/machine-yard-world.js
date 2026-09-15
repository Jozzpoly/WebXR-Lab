const IDENTITY_ROTATION = [0, 0, 0, 1];

export const MACHINE_YARD_WORLD = Object.freeze({
  id: 'machine-yard-r0',
  surfaces: Object.freeze([
    Object.freeze({
      id: 'room-floor',
      shape: 'box',
      center: Object.freeze([0, -0.08, 0]),
      halfExtents: Object.freeze([30, 0.08, 30]),
      friction: 0.9,
      restitution: 0.03,
      visible: true,
    }),
  ]),
  runTarget: Object.freeze([0, 0, -1.65]),
});

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function rotateVector(vector, quaternion) {
  const [x, y, z] = vector;
  const [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

export function transformPoint(point, pose) {
  return add(rotateVector(point, pose.rotation ?? IDENTITY_ROTATION), pose.position ?? [0, 0, 0]);
}

export function transformVector(vector, pose) {
  return rotateVector(vector, pose.rotation ?? IDENTITY_ROTATION);
}

function quaternionToAbsMatrix([x, y, z, w]) {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  return [
    [Math.abs(1 - 2 * (yy + zz)), Math.abs(2 * (xy - wz)), Math.abs(2 * (xz + wy))],
    [Math.abs(2 * (xy + wz)), Math.abs(1 - 2 * (xx + zz)), Math.abs(2 * (yz - wx))],
    [Math.abs(2 * (xz - wy)), Math.abs(2 * (yz + wx)), Math.abs(1 - 2 * (xx + yy))],
  ];
}

function includeBox(bounds, center, halfExtents, rotation = IDENTITY_ROTATION) {
  const matrix = quaternionToAbsMatrix(rotation);
  const extents = matrix.map((row) => row[0] * halfExtents[0] + row[1] * halfExtents[1] + row[2] * halfExtents[2]);
  for (let axis = 0; axis < 3; axis += 1) {
    bounds.min[axis] = Math.min(bounds.min[axis], center[axis] - extents[axis]);
    bounds.max[axis] = Math.max(bounds.max[axis], center[axis] + extents[axis]);
  }
}

function includeWheel(bounds, component) {
  const axis = component.axis;
  const halfWidth = component.width * 0.5;
  const extents = axis.map((axisComponent) =>
    Math.abs(axisComponent) * halfWidth + component.radius * Math.sqrt(Math.max(0, 1 - axisComponent * axisComponent)));
  for (let i = 0; i < 3; i += 1) {
    bounds.min[i] = Math.min(bounds.min[i], component.center[i] - extents[i]);
    bounds.max[i] = Math.max(bounds.max[i], component.center[i] + extents[i]);
  }
}

export function computePlanBounds(plan) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };

  for (const island of plan.islands ?? []) {
    for (const beam of island.beams ?? []) {
      includeBox(
        bounds,
        add(island.origin, beam.localPosition),
        [beam.length * 0.5, beam.thickness * 0.5, beam.thickness * 0.5],
        beam.localRotation,
      );
    }
  }

  for (const component of plan.components ?? []) {
    if (component.kind === 'powered-wheel') includeWheel(bounds, component);
  }

  if (!Number.isFinite(bounds.min[0])) throw new Error('cannot compute bounds for an empty compiled machine');
  return bounds;
}

export function surfaceTop(surface) {
  if (surface.shape !== 'box') throw new Error(`unsupported surface shape: ${surface.shape}`);
  return surface.center[1] + surface.halfExtents[1];
}

export function resolveRunSpawn(plan, world = MACHINE_YARD_WORLD, { clearance = 0.025 } = {}) {
  const floor = world.surfaces.find((surface) => surface.id === 'room-floor');
  if (!floor) throw new Error('simulation world requires room-floor');
  const bounds = computePlanBounds(plan);
  const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) * 0.5);
  const floorY = surfaceTop(floor);
  const target = world.runTarget;
  return {
    position: [
      target[0] - center[0],
      floorY + clearance - bounds.min[1],
      target[2] - center[2],
    ],
    rotation: [...IDENTITY_ROTATION],
  };
}

export function translateBounds(bounds, pose) {
  if ((pose.rotation ?? IDENTITY_ROTATION).some((value, index) => Math.abs(value - IDENTITY_ROTATION[index]) > 1e-12)) {
    throw new Error('translateBounds currently accepts identity run rotation only');
  }
  return {
    min: add(bounds.min, pose.position),
    max: add(bounds.max, pose.position),
  };
}

export function inverseTranslatePoint(point, pose) {
  if ((pose.rotation ?? IDENTITY_ROTATION).some((value, index) => Math.abs(value - IDENTITY_ROTATION[index]) > 1e-12)) {
    throw new Error('inverseTranslatePoint currently accepts identity run rotation only');
  }
  return sub(point, pose.position);
}
