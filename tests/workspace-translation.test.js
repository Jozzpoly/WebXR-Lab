import test from 'node:test';
import assert from 'node:assert/strict';
import { beginWorkspaceTranslation, updateWorkspaceTranslation } from '../src/input/workspace-translation.js';

test('workspace translation follows controller delta without mutating captured state', () => {
  const workspace = [0, 0.72, -1.55];
  const grip = [0.2, 1.0, -0.4];
  const drag = beginWorkspaceTranslation(workspace, grip);
  const next = updateWorkspaceTranslation(drag, [0.45, 1.15, -0.75]);

  assert.deepEqual(next, [0.25, 0.87, -1.9]);
  assert.deepEqual(workspace, [0, 0.72, -1.55]);
  assert.deepEqual(grip, [0.2, 1.0, -0.4]);
  assert.deepEqual(drag.workspaceStart, [0, 0.72, -1.55]);
});

test('workspace translation is reversible for opposite controller delta', () => {
  const drag = beginWorkspaceTranslation([1, 2, 3], [0, 0, 0]);
  assert.deepEqual(updateWorkspaceTranslation(drag, [-0.5, 0.25, 1]), [0.5, 2.25, 4]);
});
