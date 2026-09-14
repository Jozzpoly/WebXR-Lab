import RAPIER from '@dimforge/rapier3d-compat';

export class RapierMachineRuntime {
  static async create() {
    await RAPIER.init();
    return new RapierMachineRuntime();
  }

  constructor() {
    this.world = null;
    this.plan = null;
    this.bodies = new Map();
    this.accumulator = 0;
    this.fixedDt = 1 / 90;
  }

  start(plan) {
    this.stop();
    this.plan = plan;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = this.fixedDt;

    const floor = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.08, -1.5),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(5.5, 0.08, 5.5).setFriction(0.9),
      floor,
    );

    for (const island of plan.islands) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...island.origin)
          .setLinearDamping(0.08)
          .setAngularDamping(0.08),
      );

      for (const beam of island.beams) {
        const [x, y, z, w] = beam.localRotation;
        const collider = RAPIER.ColliderDesc
          .cuboid(beam.length * 0.5, beam.thickness * 0.5, beam.thickness * 0.5)
          .setTranslation(...beam.localPosition)
          .setRotation({ x, y, z, w })
          .setDensity(beam.density)
          .setFriction(0.82)
          .setRestitution(0.06);
        this.world.createCollider(collider, body);
      }

      this.bodies.set(island.id, body);
    }
    this.accumulator = 0;
  }

  step(deltaSeconds) {
    if (!this.world) return;
    this.accumulator += Math.min(Math.max(deltaSeconds, 0), 0.05);
    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 6) {
      this.world.step();
      this.accumulator -= this.fixedDt;
      steps += 1;
    }
    if (steps === 6) this.accumulator = 0;
  }

  sample() {
    const poses = new Map();
    for (const [id, body] of this.bodies) {
      const translation = body.translation();
      const rotation = body.rotation();
      poses.set(id, {
        position: [translation.x, translation.y, translation.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      });
    }
    return poses;
  }

  stop() {
    this.bodies.clear();
    this.plan = null;
    this.accumulator = 0;
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
