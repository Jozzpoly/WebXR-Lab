import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPoweredWheel, createSeedMachine, machineFingerprint } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';

const axisComponent = (v, axis) => v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];

test('powered wheel creates a real revolute motor consequence without authored mutation', async () => {
  const document = attachPoweredWheel(createSeedMachine(), 'n1', {
    axis: [0, 0, 1],
    mountOffset: 0.18,
    motorVelocity: 8,
    motorDamping: 2.0,
  });
  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.components.length, 1);

  const runtime = await RapierMachineRuntime.create();
  runtime.start(plan);

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
