import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPoweredWheel, machineFingerprint } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

const axisComponent = (v, axis) => v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
const elevatedRuntimeSpawn = Object.freeze({ position: [0, 1.5, 0], rotation: [0, 0, 0, 1] });
const mount = (z, axisZ) => ({ position: [0, 0, z], axis: [0, 0, axisZ] });

test('powered wheel creates a real revolute motor consequence without authored mutation', async () => {
  const document = attachPoweredWheel(createSingleBeamMachine(), 'b1', {
    mount: mount(0.06, 1),
    motorVelocity: 8,
    motorDamping: 2.0,
  });
  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.components.length, 1);

  const runtime = await RapierMachineRuntime.create();
  runtime.start(plan, { spawnPose: elevatedRuntimeSpawn });

  const initial = runtime.sample();
  assert.ok(initial.has('island-1'));
  assert.ok(initial.has('c1'));

  for (let i = 0; i < 30; i += 1) runtime.step(1 / 90);

  const after = runtime.sample();
  const hostAngular = axisComponent(after.get('island-1').angularVelocity, [0, 0, 1]);
  const wheelAngular = axisComponent(after.get('c1').angularVelocity, [0, 0, 1]);
  const relativeAngularVelocity = wheelAngular - hostAngular;

  assert.ok(
    Math.abs(relativeAngularVelocity) > 1.0,
    `revolute motor should create material relative wheel rotation, got ${relativeAngularVelocity}`,
  );
  assert.equal(machineFingerprint(document), fingerprint, 'motorized runtime must not mutate authored wheel intent');

  runtime.stop();
  assert.equal(runtime.sample().size, 0);
});

test('mirrored mounts keep physical axle signs explicit and can author coherent motor rotation', async () => {
  let document = createSingleBeamMachine();
  document = attachPoweredWheel(document, 'b1', {
    mount: mount(-0.06, -1),
    motorVelocity: -7,
    motorDamping: 2,
  });
  document = attachPoweredWheel(document, 'b1', {
    mount: mount(0.06, 1),
    motorVelocity: 7,
    motorDamping: 2,
  });

  const plan = compileMachine(document);
  assert.equal(plan.components.length, 2);
  assert.deepEqual(plan.components[0].axis, [0, 0, -1]);
  assert.deepEqual(plan.components[1].axis, [0, 0, 1]);
  assert.ok(plan.components[0].center[2] < plan.components[0].hostAnchorMachine[2]);
  assert.ok(plan.components[1].center[2] > plan.components[1].hostAnchorMachine[2]);

  const runtime = await RapierMachineRuntime.create();
  runtime.start(plan, { spawnPose: elevatedRuntimeSpawn });
  for (let i = 0; i < 30; i += 1) runtime.step(1 / 90);

  const after = runtime.sample();
  const host = axisComponent(after.get('island-1').angularVelocity, [0, 0, 1]);
  const left = axisComponent(after.get('c1').angularVelocity, [0, 0, 1]) - host;
  const right = axisComponent(after.get('c2').angularVelocity, [0, 0, 1]) - host;

  assert.ok(Math.abs(left) > 1 && Math.abs(right) > 1, `both motors must create real relative rotation: ${left}, ${right}`);
  assert.ok(left * right > 0, `mirrored axle + mirrored motor signs should produce coherent machine-space rotation: ${left}, ${right}`);
  runtime.stop();
});
