import test from 'node:test';
import assert from 'node:assert/strict';
import { machineFingerprint } from '../src/core/machine-document.js';
import { createPoweredCartMachine } from '../src/core/specimens.js';
import {
  MACHINE_PRESENTATION_OFFSET,
  machinePointToWorkspace,
  workspacePointToMachine,
} from '../src/view/authoring-space.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

test('default authored machines use a natural machine-local origin, not workbench presentation height', () => {
  const beam = createSingleBeamMachine();
  const cart = createPoweredCartMachine();

  assert.ok(beam.nodes.every((node) => node.position[1] === 0));
  assert.ok(cart.nodes.every((node) => node.position[1] === 0));
  assert.notEqual(MACHINE_PRESENTATION_OFFSET[1], 0, 'workbench presentation should remain a distinct transform');
});

test('machine/workspace presentation mapping is explicit, reversible and cannot mutate authored truth', () => {
  const document = createSingleBeamMachine();
  const before = machineFingerprint(document);
  const machinePoint = [0.2, 0, -0.1];
  const workspacePoint = machinePointToWorkspace(machinePoint);

  assert.deepEqual(workspacePoint, [0.2, 0.45, -0.1]);
  assert.deepEqual(workspacePointToMachine(workspacePoint), machinePoint);
  assert.equal(machineFingerprint(document), before);
});
