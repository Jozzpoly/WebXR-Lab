import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestAuthoredHit } from '../src/input/authored-picking.js';

test('nearest authored hit chooses the physically closer beam or component independent of tool mode', () => {
  assert.deepEqual(
    nearestAuthoredHit(
      { beamId: 'b1', distance: 0.8 },
      { componentId: 'c1', distance: 1.2 },
    ),
    { kind: 'beam', beamId: 'b1', distance: 0.8 },
  );

  assert.deepEqual(
    nearestAuthoredHit(
      { beamId: 'b1', distance: 1.2 },
      { componentId: 'c1', distance: 0.8 },
    ),
    { kind: 'component', componentId: 'c1', distance: 0.8 },
  );
});

test('nearest authored hit handles isolated hits and uses beam as deterministic tie-breaker', () => {
  assert.deepEqual(
    nearestAuthoredHit({ beamId: 'b2', distance: 1 }, null),
    { kind: 'beam', beamId: 'b2', distance: 1 },
  );
  assert.deepEqual(
    nearestAuthoredHit(null, { componentId: 'c2', distance: 1 }),
    { kind: 'component', componentId: 'c2', distance: 1 },
  );
  assert.deepEqual(
    nearestAuthoredHit(
      { beamId: 'b3', distance: 1 },
      { componentId: 'c3', distance: 1 },
    ),
    { kind: 'beam', beamId: 'b3', distance: 1 },
  );
  assert.equal(nearestAuthoredHit(null, null), null);
});
