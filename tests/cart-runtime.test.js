import test from 'node:test';
import assert from 'node:assert/strict';
import { machineFingerprint } from '../src/core/machine-document.js';
import { createPoweredCartMachine } from '../src/core/specimens.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { MACHINE_YARD_WORLD, resolveRunSpawn } from '../src/runtime/machine-yard-world.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';

test('four authored powered wheels create whole-machine translation through contact physics', async () => {
  const document = createPoweredCartMachine();
  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 1);
  assert.equal(plan.components.length, 4);

  const runtime = await RapierMachineRuntime.create();
  const spawnPose = resolveRunSpawn(plan, MACHINE_YARD_WORLD);
  runtime.start(plan, { environment: MACHINE_YARD_WORLD, spawnPose });
  const initial = runtime.sample().get('island-1').position;

  for (let i = 0; i < 360; i += 1) runtime.step(1 / 90);

  const after = runtime.sample();
  const final = after.get('island-1').position;
  const horizontalTravel = Math.hypot(final[0] - initial[0], final[2] - initial[2]);

  assert.ok(horizontalTravel > 0.25, `powered cart should translate through wheel/floor contact, travelled ${horizontalTravel} m`);
  assert.ok(final[1] < initial[1], 'cart should settle under gravity rather than being kinematically animated');
  assert.equal(machineFingerprint(document), fingerprint, 'emergent locomotion must not mutate authored truth');
  runtime.stop();
});
