import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  createBeam,
  extendFromBeamEnd,
  machineFingerprint,
} from '../src/core/machine-document.js';
import { translateStructuralIsland } from '../src/core/structural-translation.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

function positionsById(document) {
  return new Map(document.nodes.map((node) => [node.id, [...node.position]]));
}

test('translating a welded island moves every connected structural node by one machine-space delta', () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0.2, -0.7]);
  document = attachPoweredWheel(document, 'b2', {
    mount: { position: [0.18, 0.08, 0], axis: [0, 1, 0] },
  });

  const originalFingerprint = machineFingerprint(document);
  const before = positionsById(document);
  const wheelBefore = structuredClone(document.components[0]);
  const delta = [0.55, 0.25, -0.35];
  const next = translateStructuralIsland(document, 'b1', delta);

  assert.equal(machineFingerprint(document), originalFingerprint, 'translation must not mutate authored input');
  assert.equal(next.revision, document.revision + 1);
  for (const node of next.nodes) {
    assert.deepEqual(node.position, before.get(node.id).map((value, index) => value + delta[index]));
  }
  assert.deepEqual(next.components[0], wheelBefore, 'host-local component intent must not be rewritten by whole-island translation');
  assert.equal(compileMachine(next).islands.length, 1);
});

test('translating one welded island leaves an unrelated structural island exactly in place', () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0, -0.65]);
  document = createBeam(document, [1.8, 0.15, 0.2], [2.45, 0.15, 0.2]);

  const separateBeam = document.beams.find((beam) => beam.id === 'b3');
  const separateNodeIds = [separateBeam.a, separateBeam.b];
  const before = positionsById(document);
  const next = translateStructuralIsland(document, 'b1', [-0.3, 0.4, 0.25]);

  for (const nodeId of separateNodeIds) {
    assert.deepEqual(next.nodes.find((node) => node.id === nodeId).position, before.get(nodeId));
  }
  assert.equal(compileMachine(next).islands.length, 2);
});

test('zero welded-island translation is an authored no-op', () => {
  const document = createSingleBeamMachine();
  assert.strictEqual(translateStructuralIsland(document, 'b1', [0, 0, 0]), document);
});

test('welded-island translation rejects invalid targets and deltas', () => {
  const document = createSingleBeamMachine();
  assert.throws(() => translateStructuralIsland(document, 'missing', [1, 0, 0]), /unknown beam/);
  assert.throws(() => translateStructuralIsland(document, 'b1', [1, Number.NaN, 0]), /finite vec3/);
});
