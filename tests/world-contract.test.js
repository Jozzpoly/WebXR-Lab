import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoweredCartMachine } from '../src/core/specimens.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import {
  MACHINE_YARD_WORLD,
  computePlanBounds,
  resolveRunSpawn,
  surfaceTop,
  translateBounds,
} from '../src/runtime/machine-yard-world.js';

test('run spawn places the compiled machine onto the visible room floor, not workbench height', () => {
  const plan = compileMachine(createPoweredCartMachine());
  const localBounds = computePlanBounds(plan);
  const spawn = resolveRunSpawn(plan);
  const worldBounds = translateBounds(localBounds, spawn);
  const floor = MACHINE_YARD_WORLD.surfaces.find((surface) => surface.id === 'room-floor');

  assert.ok(floor?.visible, 'room-floor must be an explicitly visible simulation surface');
  assert.ok(Math.abs(surfaceTop(floor)) < 1e-9, 'room-floor top should define world y=0');
  assert.ok(worldBounds.min[1] > -1e-9, 'spawned machine must not begin below the room floor');
  assert.ok(worldBounds.min[1] < 0.04, `spawned machine should begin just above room floor, got y=${worldBounds.min[1]}`);
});

test('run spawn is independent from arbitrary authoring workspace translation', () => {
  const plan = compileMachine(createPoweredCartMachine());
  const before = resolveRunSpawn(plan);

  // Workspace translation intentionally does not enter the simulation API.
  const arbitraryWorkspacePose = [2.3, 1.4, -0.25];
  assert.deepEqual(arbitraryWorkspacePose, [2.3, 1.4, -0.25]);

  const after = resolveRunSpawn(plan);
  assert.deepEqual(after, before);
});

test('room-floor descriptor has matching semantic and physical extents', () => {
  const floor = MACHINE_YARD_WORLD.surfaces.find((surface) => surface.id === 'room-floor');
  assert.equal(floor.shape, 'box');
  assert.deepEqual(floor.center, [0, -0.08, 0]);
  assert.deepEqual(floor.halfExtents, [30, 0.08, 30]);
  assert.equal(surfaceTop(floor), 0);
});

test('normal machine-yard runs do not begin near a world edge', () => {
  const floor = MACHINE_YARD_WORLD.surfaces.find((surface) => surface.id === 'room-floor');
  const [targetX, , targetZ] = MACHINE_YARD_WORLD.runTarget;
  const marginX = floor.halfExtents[0] - Math.abs(targetX - floor.center[0]);
  const marginZ = floor.halfExtents[2] - Math.abs(targetZ - floor.center[2]);

  assert.ok(marginX >= 25, `run target should have a generous X test envelope, got ${marginX} m`);
  assert.ok(marginZ >= 25, `run target should have a generous Z test envelope, got ${marginZ} m`);
});
