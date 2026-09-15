import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoweredCartMachine } from '../src/core/specimens.js';
import { MACHINE_PRESENTATION_OFFSET } from '../src/view/authoring-space.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

test('default authored machines use a natural machine-local origin, not workbench presentation height', () => {
  const beam = createSingleBeamMachine();
  const cart = createPoweredCartMachine();

  assert.ok(beam.nodes.every((node) => node.position[1] === 0));
  assert.ok(cart.nodes.every((node) => node.position[1] === 0));
  assert.notEqual(MACHINE_PRESENTATION_OFFSET[1], 0, 'workbench presentation should remain a distinct transform');
});
