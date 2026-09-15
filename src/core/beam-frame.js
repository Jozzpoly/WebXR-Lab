const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const normalize = (v) => scale(v, 1 / length(v));

export function multiplyQuaternion(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function rotateVector(v, q) {
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

export function inverseQuaternion([x, y, z, w]) {
  return [-x, -y, -z, w];
}

export function rotationFromPositiveX(direction) {
  const [x, y, z] = normalize(direction);
  if (x < -0.999999) return [0, 1, 0, 0];
  const q = [0, -z, y, 1 + x];
  const qLen = Math.hypot(...q);
  return q.map((value) => value / qLen);
}

export function rotationAroundPositiveX(angle) {
  const half = angle * 0.5;
  return [Math.sin(half), 0, 0, Math.cos(half)];
}

export function beamRotation(direction, roll = 0) {
  return multiplyQuaternion(rotationFromPositiveX(direction), rotationAroundPositiveX(roll));
}

export function getBeamFrame(document, beamId) {
  const beam = document.beams.find((candidate) => candidate.id === beamId);
  if (!beam) throw new Error(`unknown beam: ${beamId}`);
  const a = document.nodes.find((node) => node.id === beam.a)?.position;
  const b = document.nodes.find((node) => node.id === beam.b)?.position;
  if (!a || !b) throw new Error(`beam ${beamId} references a missing node`);
  const direction = sub(b, a);
  const beamLength = length(direction);
  if (!(beamLength > 0)) throw new Error(`beam ${beamId} has no direction`);
  return {
    id: beam.id,
    center: scale(add(a, b), 0.5),
    rotation: beamRotation(direction, beam.roll ?? 0),
    length: beamLength,
    thickness: beam.thickness,
  };
}

export function beamLocalToMachinePoint(frame, point) {
  return add(frame.center, rotateVector(point, frame.rotation));
}

export function beamLocalToMachineVector(frame, vector) {
  return rotateVector(vector, frame.rotation);
}

export function machineToBeamLocalPoint(frame, point) {
  return rotateVector(sub(point, frame.center), inverseQuaternion(frame.rotation));
}

export function machineToBeamLocalVector(frame, vector) {
  return rotateVector(vector, inverseQuaternion(frame.rotation));
}

export function closestPointOnBeamSurface(frame, machinePoint) {
  const point = machineToBeamLocalPoint(frame, machinePoint);
  const extents = [frame.length * 0.5, frame.thickness * 0.5, frame.thickness * 0.5];
  const outside = point.map((value, axis) => Math.max(0, Math.abs(value) - extents[axis]));
  const outsideDistance = Math.hypot(...outside);

  let faceAxis = 0;
  if (outsideDistance > 0) {
    let largestOutside = -Infinity;
    for (let axis = 0; axis < 3; axis += 1) {
      if (outside[axis] > largestOutside) {
        largestOutside = outside[axis];
        faceAxis = axis;
      }
    }
  } else {
    let nearestFace = Infinity;
    for (let axis = 0; axis < 3; axis += 1) {
      const distanceToFace = extents[axis] - Math.abs(point[axis]);
      if (distanceToFace < nearestFace) {
        nearestFace = distanceToFace;
        faceAxis = axis;
      }
    }
  }

  const localPosition = point.map((value, axis) => Math.min(extents[axis], Math.max(-extents[axis], value)));
  const sign = point[faceAxis] < 0 ? -1 : 1;
  localPosition[faceAxis] = sign * extents[faceAxis];
  const localNormal = [0, 0, 0];
  localNormal[faceAxis] = sign;
  const surfaceMachine = beamLocalToMachinePoint(frame, localPosition);
  return {
    position: localPosition,
    normal: localNormal,
    machinePosition: surfaceMachine,
    distance: Math.hypot(
      surfaceMachine[0] - machinePoint[0],
      surfaceMachine[1] - machinePoint[1],
      surfaceMachine[2] - machinePoint[2],
    ),
  };
}
