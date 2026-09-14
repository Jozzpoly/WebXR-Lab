import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedMachine, extendFromNode } from '../src/core/machine-document.js';
import { inferPoweredWheelPlacement } from '../src/input/wheel-placement.js';

test('seed beam endpoints infer one shared X axle with opposite mount sides', () => {
  const document = createSeedMachine();
  assert.deepEqual(inferPoweredWheelPlacement(document, 'n1'), { axis: [1, 0, 0], side: -1 });
  assert.deepEqual(inferPoweredWheelPlacement(document, 'n2'), { axis: [1, 0, 0], side: 1 });
});

test('dominant Z separation infers a Z axle instead of smuggling viewport orientation into authored intent', () => {
  let document = createSeedMachine();
  document = extendFromNode(document, 'n2', [0.4, 1.12, -2.45]);
  const placement = inferPoweredWheelPlacement(document, 'n3');
  assert.deepEqual(placement, { axis: [0, 0, 1], side: -1 });
});
