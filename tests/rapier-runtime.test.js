import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedMachine, machineFingerprint } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';

test('Rapier RUN produces physical motion without mutating authored truth', async () => {
  const document = createSeedMachine();
  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  const runtime = await RapierMachineRuntime.create();

  runtime.start(plan);
  const initial = runtime.sample().get('island-1');
  assert.ok(initial, 'compiled island should own a runtime body');

  for (let i = 0; i < 180; i += 1) runtime.step(1 / 90);

  const after = runtime.sample().get('island-1');
  assert.ok(after.position[1] < initial.position[1] - 0.25, 'gravity should create a material downward consequence');
  assert.equal(machineFingerprint(document), fingerprint, 'runtime evaluation must not change authored truth');

  runtime.stop();
  assert.equal(runtime.sample().size, 0, 'STOP should discard runtime bodies');
});
