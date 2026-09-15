import test from 'node:test';
import assert from 'node:assert/strict';
import { createBeam, extendFromBeamEnd } from '../src/core/machine-document.js';
import { beamEndPosition, nearestBeamEnd, nearestBeamSurface } from '../src/input/structural-placement.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

test('beam endpoint targeting exposes part references instead of node ids', () => {
  const document = createSingleBeamMachine();
  assert.deepEqual(beamEndPosition(document, 'b1', 'a'), [-0.4, 0, 0]);
  assert.deepEqual(beamEndPosition(document, 'b1', 'b'), [0.4, 0, 0]);

  const target = nearestBeamEnd(document, [0.39, 0, 0.01], 0.08);
  assert.deepEqual(target, {
    beamId: 'b1',
    end: 'b',
    position: [0.4, 0, 0],
  });
  assert.equal('nodeId' in target, false);
});

test('shared welded endpoint is one physical target even when multiple beams reference it', () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0, -0.6]);

  const target = nearestBeamEnd(document, [0.405, 0, 0.005], 0.08);
  assert.ok(target);
  assert.deepEqual(target.position, [0.4, 0, 0]);

  const excluded = nearestBeamEnd(document, [0.405, 0, 0.005], 0.08, {
    beamId: target.beamId,
    end: target.end,
  });
  assert.equal(excluded, null, 'the same welded node must not leak back through a second beam identity');
});

test('nearest surface resolves a concrete host part and remains stable under unrelated topology', () => {
  const base = createSingleBeamMachine();
  const query = [0.1, 0.08, 0.01];
  const before = nearestBeamSurface(base, query, 0.2);
  assert.ok(before);
  assert.equal(before.beamId, 'b1');
  assert.ok(before.distance < 0.03);

  const expanded = createBeam(base, [4, 0, 4], [5, 0, 4]);
  const after = nearestBeamSurface(expanded, query, 0.2);
  assert.equal(after.beamId, before.beamId);
  assert.deepEqual(after.localNormal, before.localNormal);
  assert.deepEqual(after.localPosition, before.localPosition);
});
