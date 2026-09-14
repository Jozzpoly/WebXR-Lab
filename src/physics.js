import RAPIER from '@dimforge/rapier3d-compat';

const FIXED_TIMESTEP = 1 / 72;
const THROW_HISTORY_SECONDS = 0.12;
const THROW_MAX_LINEAR_SPEED = 9;
const THROW_MAX_ANGULAR_SPEED = 24;

function diagnostics() {
  if (typeof window === 'undefined') return null;
  window.__WEBXR_F1_DIAGNOSTICS__ ??= {};
  window.__WEBXR_F1_DIAGNOSTICS__.physics ??= {
    grabs: 0,
    releases: 0,
    nativeLinearReleases: 0,
    fallbackLinearReleases: 0,
    nativeAngularReleases: 0,
    fallbackAngularReleases: 0,
    lastLinearSpeed: 0,
    lastAngularSpeed: 0
  };
  return window.__WEBXR_F1_DIAGNOSTICS__.physics;
}

function finiteVector(vector) {
  return vector && Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

function clampVector(vector, maxLength) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length <= maxLength || length === 0) return vector;
  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale, z: vector.z * scale };
}

function multiplyQuaternion(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

function estimateMotion(history) {
  if (history.length < 2) {
    return {
      linear: { x: 0, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: 0 }
    };
  }

  const newest = history[history.length - 1];
  let oldest = history[0];
  for (let i = history.length - 2; i >= 0; i--) {
    const candidate = history[i];
    if (newest.time - candidate.time >= 0.035) {
      oldest = candidate;
      break;
    }
  }

  const dt = Math.max(0.001, newest.time - oldest.time);
  const linear = clampVector({
    x: (newest.position.x - oldest.position.x) / dt,
    y: (newest.position.y - oldest.position.y) / dt,
    z: (newest.position.z - oldest.position.z) / dt
  }, THROW_MAX_LINEAR_SPEED);

  const oldInverse = {
    x: -oldest.quaternion.x,
    y: -oldest.quaternion.y,
    z: -oldest.quaternion.z,
    w: oldest.quaternion.w
  };
  let delta = multiplyQuaternion(newest.quaternion, oldInverse);
  if (delta.w < 0) {
    delta = { x: -delta.x, y: -delta.y, z: -delta.z, w: -delta.w };
  }
  const w = Math.max(-1, Math.min(1, delta.w));
  const angle = 2 * Math.acos(w);
  const sinHalf = Math.sqrt(Math.max(0, 1 - w * w));
  const angular = sinHalf > 1e-5
    ? clampVector({
        x: (delta.x / sinHalf) * angle / dt,
        y: (delta.y / sinHalf) * angle / dt,
        z: (delta.z / sinHalf) * angle / dt
      }, THROW_MAX_ANGULAR_SPEED)
    : { x: 0, y: 0, z: 0 };

  return { linear, angular };
}

export class PhysicsSystem {
  constructor(world) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.world.timestep = FIXED_TIMESTEP;
    this.dynamicEntries = [];
    this.grabbables = [];
    this.accumulator = 0;
    diagnostics();
  }

  static async create() {
    await RAPIER.init();
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    return new PhysicsSystem(world);
  }

  addFixedBox(position, halfExtents, options = {}) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z)
    );
    const collider = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setFriction(options.friction ?? 0.9)
      .setRestitution(options.restitution ?? 0.05);
    this.world.createCollider(collider, body);
    return body;
  }

  addDynamicBox(mesh, halfExtents, options = {}) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
        .setLinearDamping(options.linearDamping ?? 0.15)
        .setAngularDamping(options.angularDamping ?? 0.35)
        .setCcdEnabled(options.ccd ?? false)
    );
    const collider = RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
      .setDensity(options.density ?? 1)
      .setFriction(options.friction ?? 0.75)
      .setRestitution(options.restitution ?? 0.16);
    this.world.createCollider(collider, body);
    const entry = this.makeEntry(mesh, body, options.kind ?? 'box', options.grabbable !== false);
    this.dynamicEntries.push(entry);
    if (entry.grabbable) this.grabbables.push(entry);
    return entry;
  }

  addDynamicBall(mesh, radius, options = {}) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
        .setRotation({ x: mesh.quaternion.x, y: mesh.quaternion.y, z: mesh.quaternion.z, w: mesh.quaternion.w })
        .setLinearDamping(options.linearDamping ?? 0.08)
        .setAngularDamping(options.angularDamping ?? 0.2)
        .setCcdEnabled(options.ccd ?? true)
    );
    const collider = RAPIER.ColliderDesc.ball(radius)
      .setDensity(options.density ?? 1)
      .setFriction(options.friction ?? 0.55)
      .setRestitution(options.restitution ?? 0.45);
    this.world.createCollider(collider, body);
    const entry = this.makeEntry(mesh, body, options.kind ?? 'ball', options.grabbable !== false);
    this.dynamicEntries.push(entry);
    if (entry.grabbable) this.grabbables.push(entry);
    return entry;
  }

  makeEntry(mesh, body, kind, grabbable) {
    return {
      mesh,
      body,
      kind,
      grabbable,
      heldBy: null,
      initialPosition: mesh.position.clone(),
      initialQuaternion: mesh.quaternion.clone(),
      motionHistory: []
    };
  }

  step(dt) {
    this.accumulator = Math.min(this.accumulator + Math.min(dt, 0.05), 0.2);
    while (this.accumulator >= FIXED_TIMESTEP) {
      this.world.step();
      this.accumulator -= FIXED_TIMESTEP;
    }
    this.syncMeshes();
  }

  syncMeshes() {
    for (const { mesh, body } of this.dynamicEntries) {
      const p = body.translation();
      const q = body.rotation();
      mesh.position.set(p.x, p.y, p.z);
      mesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  resetDynamicBodies() {
    this.accumulator = 0;
    for (const entry of this.dynamicEntries) {
      entry.heldBy = null;
      entry.motionHistory.length = 0;
      entry.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      entry.body.setTranslation({
        x: entry.initialPosition.x,
        y: entry.initialPosition.y,
        z: entry.initialPosition.z
      }, true);
      entry.body.setRotation({
        x: entry.initialQuaternion.x,
        y: entry.initialQuaternion.y,
        z: entry.initialQuaternion.z,
        w: entry.initialQuaternion.w
      }, true);
      entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.syncMeshes();
  }

  findNearestGrabbable(worldPosition, maxDistance = 0.48) {
    let nearest = null;
    let nearestDistanceSq = maxDistance * maxDistance;
    for (const entry of this.grabbables) {
      if (entry.heldBy !== null) continue;
      const p = entry.body.translation();
      const dx = p.x - worldPosition.x;
      const dy = p.y - worldPosition.y;
      const dz = p.z - worldPosition.z;
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = entry;
      }
    }
    return nearest;
  }

  beginGrab(entry, handIndex) {
    if (!entry || entry.heldBy !== null) return false;
    entry.heldBy = handIndex;
    entry.motionHistory.length = 0;
    entry.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const info = diagnostics();
    if (info) info.grabs += 1;
    return true;
  }

  moveGrabbed(entry, position, quaternion) {
    if (!entry) return;
    const now = performance.now() * 0.001;
    entry.motionHistory.push({
      time: now,
      position: { x: position.x, y: position.y, z: position.z },
      quaternion: { x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }
    });
    while (entry.motionHistory.length > 2 && now - entry.motionHistory[0].time > THROW_HISTORY_SECONDS) {
      entry.motionHistory.shift();
    }
    this.world.timestep = FIXED_TIMESTEP;
    entry.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
    entry.body.setNextKinematicRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
  }

  endGrab(entry, linearVelocity, angularVelocity) {
    if (!entry) return;
    const estimated = estimateMotion(entry.motionHistory);
    const hasNativeLinear = finiteVector(linearVelocity);
    const hasNativeAngular = finiteVector(angularVelocity);
    const linear = clampVector(hasNativeLinear
      ? { x: linearVelocity.x, y: linearVelocity.y, z: linearVelocity.z }
      : estimated.linear, THROW_MAX_LINEAR_SPEED);
    const angular = clampVector(hasNativeAngular
      ? { x: angularVelocity.x, y: angularVelocity.y, z: angularVelocity.z }
      : estimated.angular, THROW_MAX_ANGULAR_SPEED);

    entry.heldBy = null;
    entry.motionHistory.length = 0;
    entry.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    entry.body.setLinvel(linear, true);
    entry.body.setAngvel(angular, true);

    const info = diagnostics();
    if (info) {
      info.releases += 1;
      info[hasNativeLinear ? 'nativeLinearReleases' : 'fallbackLinearReleases'] += 1;
      info[hasNativeAngular ? 'nativeAngularReleases' : 'fallbackAngularReleases'] += 1;
      info.lastLinearSpeed = Math.hypot(linear.x, linear.y, linear.z);
      info.lastAngularSpeed = Math.hypot(angular.x, angular.y, angular.z);
    }
  }

  applyImpulse(entry, impulse) {
    if (!entry?.body?.isDynamic()) return;
    entry.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }
}
