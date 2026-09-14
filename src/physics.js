import RAPIER from '@dimforge/rapier3d-compat';

const FIXED_TIMESTEP = 1 / 72;

export class PhysicsSystem {
  constructor(world) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.world.timestep = FIXED_TIMESTEP;
    this.dynamicEntries = [];
    this.grabbables = [];
    this.accumulator = 0;
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
    const entry = {
      mesh,
      body,
      kind: options.kind ?? 'box',
      grabbable: options.grabbable !== false,
      heldBy: null
    };
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
    const entry = {
      mesh,
      body,
      kind: options.kind ?? 'ball',
      grabbable: options.grabbable !== false,
      heldBy: null
    };
    this.dynamicEntries.push(entry);
    if (entry.grabbable) this.grabbables.push(entry);
    return entry;
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
    entry.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    entry.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    entry.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    return true;
  }

  moveGrabbed(entry, position, quaternion) {
    if (!entry) return;
    entry.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
    entry.body.setNextKinematicRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w });
  }

  endGrab(entry, linearVelocity, angularVelocity) {
    if (!entry) return;
    entry.heldBy = null;
    entry.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    entry.body.setLinvel({
      x: linearVelocity?.x ?? 0,
      y: linearVelocity?.y ?? 0,
      z: linearVelocity?.z ?? 0
    }, true);
    entry.body.setAngvel({
      x: angularVelocity?.x ?? 0,
      y: angularVelocity?.y ?? 0,
      z: angularVelocity?.z ?? 0
    }, true);
  }

  applyImpulse(entry, impulse) {
    if (!entry?.body?.isDynamic()) return;
    entry.body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }
}
