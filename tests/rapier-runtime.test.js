import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  extendFromBeamEnd,
  machineFingerprint,
  moveBeamEnd,
} from '../src/core/machine-document.js';
import { proposePoweredWheelPlacementNearPoint } from '../src/input/wheel-placement.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { MACHINE_YARD_WORLD, resolveRunSpawn, surfaceTop } from '../src/runtime/machine-yard-world.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

test('Rapier RUN settles on the shared visible room floor without mutating authored truth', async () => {
  const document = createSingleBeamMachine();
  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  const spawnPose = resolveRunSpawn(plan, MACHINE_YARD_WORLD);
  const runtime = await RapierMachineRuntime.create();

  runtime.start(plan, { environment: MACHINE_YARD_WORLD, spawnPose });
  const initial = runtime.sample().get('island-1');
  assert.ok(initial, 'compiled island should own a runtime body');

  for (let i = 0; i < 180; i += 1) runtime.step(1 / 90);

  const after = runtime.sample().get('island-1');
  const floor = MACHINE_YARD_WORLD.surfaces.find((surface) => surface.id === 'room-floor');
  const floorY = surfaceTop(floor);
  const beamHalfThickness = plan.islands[0].beams[0].thickness * 0.5;
  const initialBottom = initial.position[1] - beamHalfThickness;
  const settledBottom = after.position[1] - beamHalfThickness;

  assert.ok(initialBottom > floorY, 'RUN spawn should begin with a small clearance above the room floor');
  assert.ok(initialBottom - floorY < 0.04, `RUN spawn clearance should stay small, got ${initialBottom - floorY} m`);
  assert.ok(settledBottom >= floorY - 0.003, `machine should not settle through the visible/physical floor, bottom=${settledBottom}`);
  assert.ok(settledBottom <= floorY + 0.01, `machine should settle onto the actual room floor, bottom=${settledBottom}`);
  assert.ok(Math.abs(after.linearVelocity[1]) < 0.05, `settled machine should not keep falling, vy=${after.linearVelocity[1]}`);
  assert.equal(machineFingerprint(document), fingerprint, 'runtime evaluation must not change authored truth');

  runtime.stop();
  assert.equal(runtime.sample().size, 0, 'STOP should discard runtime bodies');
});

test('XR rehearsal machine can enter and advance Rapier RUN without corrupting authored truth', async () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0, -0.45]);
  document = moveBeamEnd(document, 'b2', 'b', [0.58, 0, -0.57]);

  const candidate = proposePoweredWheelPlacementNearPoint(document, [0, 0, 0.1]);
  assert.ok(candidate, 'rehearsal wheel probe should resolve a real host-beam face');
  document = attachPoweredWheel(document, candidate.hostBeamId, {
    mount: candidate.mount,
    motorVelocity: candidate.motorVelocity,
  });

  const fingerprint = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 1);
  assert.equal(plan.components.length, 1);

  const runtime = await RapierMachineRuntime.create();
  const spawnPose = resolveRunSpawn(plan, MACHINE_YARD_WORLD);
  runtime.start(plan, { environment: MACHINE_YARD_WORLD, spawnPose });

  for (let i = 0; i < 24; i += 1) {
    runtime.step(1 / 90);
    const poses = runtime.sample();
    assert.ok(poses.has('island-1'), 'rehearsal structure should keep a runtime island body');
    assert.ok(poses.has('c1'), 'rehearsal powered wheel should keep a runtime body');
    for (const pose of poses.values()) {
      assert.ok(pose.position.every(Number.isFinite), 'runtime positions must stay finite');
      assert.ok(pose.rotation.every(Number.isFinite), 'runtime rotations must stay finite');
    }
  }

  assert.equal(machineFingerprint(document), fingerprint, 'rehearsal RUN must not mutate authored truth');
  runtime.stop();
});
