import RAPIER from '@dimforge/rapier3d-compat';
import { MACHINE_YARD_WORLD, resolveRunSpawn, transformPoint } from './machine-yard-world.js';

const vec = ([x, y, z]) => ({ x, y, z });
const quat = ([x, y, z, w]) => ({ x, y, z, w });

export class RapierMachineRuntime {
  static async create() {
    await RAPIER.init();
    return new RapierMachineRuntime();
  }

  constructor() {
    this.world = null;
    this.plan = null;
    this.environment = null;
    this.spawnPose = null;
    this.bodies = new Map();
    this.joints = new Map();
    this.accumulator = 0;
    this.fixedDt = 1 / 90;
  }

  start(plan, { environment = MACHINE_YARD_WORLD, spawnPose = null } = {}) {
    this.stop();
    this.plan = plan;
    this.environment = environment;
    this.spawnPose = spawnPose ?? resolveRunSpawn(plan, environment);
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = this.fixedDt;

    for (const surface of environment.surfaces ?? []) {
      if (surface.shape !== 'box') throw new Error(`unsupported environment collider shape: ${surface.shape}`);
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(...surface.center),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc
          .cuboid(...surface.halfExtents)
          .setFriction(surface.friction ?? 0.8)
          .setRestitution(surface.restitution ?? 0),
        body,
      );
    }

    const spawnRotation = quat(this.spawnPose.rotation);

    for (const island of plan.islands) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...transformPoint(island.origin, this.spawnPose))
          .setRotation(spawnRotation)
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

    for (const component of plan.components ?? []) {
      if (component.kind !== 'powered-wheel') continue;
      const hostBody = this.bodies.get(component.hostIslandId);
      if (!hostBody) throw new Error(`missing runtime host body: ${component.hostIslandId}`);

      const wheelBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(...transformPoint(component.center, this.spawnPose))
          .setRotation(spawnRotation)
          .setLinearDamping(0.04)
          .setAngularDamping(0.03),
      );
      const [x, y, z, w] = component.colliderRotation;
      this.world.createCollider(
        RAPIER.ColliderDesc
          .cylinder(component.width * 0.5, component.radius)
          .setRotation({ x, y, z, w })
          .setDensity(component.density)
          .setFriction(1.15)
          .setRestitution(0.03),
        wheelBody,
      );

      const jointData = RAPIER.JointData.revolute(
        vec(component.hostAnchorLocal),
        vec(component.wheelAnchorLocal),
        vec(component.axis),
      );
      const joint = this.world.createImpulseJoint(jointData, hostBody, wheelBody, true);
      joint.setContactsEnabled(false);
      joint.configureMotorVelocity(component.motorVelocity, component.motorDamping);

      this.bodies.set(component.id, wheelBody);
      this.joints.set(component.id, joint);
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
      const linear = body.linvel();
      const angular = body.angvel();
      poses.set(id, {
        position: [translation.x, translation.y, translation.z],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        linearVelocity: [linear.x, linear.y, linear.z],
        angularVelocity: [angular.x, angular.y, angular.z],
      });
    }
    return poses;
  }

  stop() {
    this.joints.clear();
    this.bodies.clear();
    this.plan = null;
    this.environment = null;
    this.spawnPose = null;
    this.accumulator = 0;
    if (this.world) {
      this.world.free();
      this.world = null;
    }
  }
}
