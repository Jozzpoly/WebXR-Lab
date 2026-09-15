import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedMachine, extendFromBeamEnd } from '../src/core/machine-document.js';
import { beamEndPosition, nearestBeamEnd, nearestBeamSurface } from '../src/input/structural-placement.js';

test('beam endpoint targeting exposes part references instead of node ids', () => {
  const document = createSeedMachine();
  assert.deepEqual(beamEndPosition(document, 'b1', 'a'), [-0.4, 0.45, 0]);
  assert.deepEqual(beamEndPosition(document, 'b1', 'b'), [0.4, 0.45, 0]);

  const target = nearestBeamEnd(document, [0.39, 0.45, 0.01], 0.08);
  assert.deepEqual(target, {
    beamId: 'b1',
    end: 'b',
    position: [0.4, 0.45, 0],
  });
  assert.equal('nodeId' in target, false);
});

test('shared welded endpoint is one physical target even when multiple beams reference it', () => {
  let document = createSeedMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0.45, -0.6]);

  const target = nearestBeamEnd(document, [0.405, 0.45, 0.005], 0.08);
  assert.ok(target);
  assert.deepEqual(target.position, [0.4, 0.45, 0]);

  const excluded = nearestBeamEnd(document, [0.405, 0.45, 0.005], 0.08, {
    beamId: target.beamId,
    end: target.end,
  });
  assert.equal(excluded, null, 'the same welded node must not leak back through a second beam identity');
});

test('nearest surface resolves a concrete host part and remains stable under unrelated topology', () => {
  const base = createSeedMachine();
  const query = [0.1, 0.53, 0.01];
  const before = nearestBeamSurface(base, query, 0.2);
  assert.ok(before);
  assert.equal(before.beamId, 'b1');
  assert.ok(before.distance < 0.03);

  const expanded = structuredClone(base);
  expanded.nodes.push(
    { id: 'n90', position: [4, 0.45, 4] },
    { id: 'n91', position: [5, 0.45, 4] },
  );
  expanded.beams.push({ id: 'b90', a: 'n90', b: 'n91', roll: 0, thickness: 0.12, density: 420 });
  expanded.nextIds.node = 92;
  expanded.nextIds.beam = 91;

  const after = nearestBeamSurface(expanded, query, 0.2);
  assert.equal(after.beamId, before.beamId);
  assert.deepEqual(after.localNormal, before.localNormal);
  assert.deepEqual(after.localPosition, before.localPosition);
});
