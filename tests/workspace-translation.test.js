import test from 'node:test';
import assert from 'node:assert/strict';
import { beginWorkspaceTranslation, updateWorkspaceTranslation } from '../src/input/workspace-translation.js';

const assertVecClose = (actual, expected, epsilon = 1e-9) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= epsilon, `axis ${index}: expected ${expected[index]}, got ${value}`);
  });
};

test('workspace translation follows controller delta without mutating captured state', () => {
  const workspace = [0, 0.72, -1.55];
  const grip = [0.2, 1.0, -0.4];
  const drag = beginWorkspaceTranslation(workspace, grip);
  const next = updateWorkspaceTranslation(drag, [0.45, 1.15, -0.75]);

  assertVecClose(next, [0.25, 0.87, -1.9]);
  assert.deepEqual(workspace, [0, 0.72, -1.55]);
  assert.deepEqual(grip, [0.2, 1.0, -0.4]);
  assert.deepEqual(drag.workspaceStart, [0, 0.72, -1.55]);
});

test('workspace translation is pure and reversible inside an explicit envelope', () => {
  const drag = beginWorkspaceTranslation([1, 2, 3], [0, 0, 0]);
  const wideBounds = { min: [-10, -10, -10], max: [10, 10, 10] };
  assertVecClose(updateWorkspaceTranslation(drag, [-0.5, 0.25, 1], wideBounds), [0.5, 2.25, 4]);
});

test('default workspace envelope prevents the workbench from becoming unreachable', () => {
  const drag = beginWorkspaceTranslation([0, 0.72, -1.55], [0, 1, 0]);
  const next = updateWorkspaceTranslation(drag, [9, -8, 9]);
  assertVecClose(next, [1.0, 0.25, -1.35]);
});
