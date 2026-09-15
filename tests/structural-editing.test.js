import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  extendFromBeamEnd,
  machineFingerprint,
  moveBeamEnd,
} from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

const almost = (a, b, epsilon = 1e-9) => Math.abs(a - b) <= epsilon;

test('moving a beam end edits the real structural part without exposing node identity', () => {
  const original = createSingleBeamMachine();
  const fingerprint = machineFingerprint(original);
  const next = moveBeamEnd(original, 'b1', 'b', [0.8, 0, 0]);

  assert.equal(machineFingerprint(original), fingerprint);
  const movedNodeId = next.beams.find((beam) => beam.id === 'b1').b;
  assert.deepEqual(next.nodes.find((node) => node.id === movedNodeId).position, [0.8, 0, 0]);
  assert.equal(next.revision, original.revision + 1);
  assert.ok(almost(compileMachine(next).islands[0].beams[0].length, 1.2));
});

test('moving a shared beam end preserves welded topology', () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0, -0.7]);
  const next = moveBeamEnd(document, 'b1', 'b', [0.65, 0, 0.15]);
  const sharedNodeId = next.beams.find((beam) => beam.id === 'b1').b;
  const extension = next.beams.find((beam) => beam.id === 'b2');

  assert.equal(extension.a, sharedNodeId);
  assert.deepEqual(next.nodes.find((node) => node.id === sharedNodeId).position, [0.65, 0, 0.15]);
  assert.equal(compileMachine(next).islands.length, 1);
});

test('host-mounted components preserve their relative longitudinal anchor when a beam is resized', () => {
  let document = createSingleBeamMachine();
  document = attachPoweredWheel(document, 'b1', {
    mount: { position: [0.3, 0.06, 0], axis: [0, 1, 0] },
  });
  const originalWheel = document.components[0];
  const originalBeamLength = 0.8;
  const originalFraction = originalWheel.mount.position[0] / originalBeamLength;

  const next = moveBeamEnd(document, 'b1', 'b', [0.8, 0, 0]);
  const nextWheel = next.components[0];
  const nextBeamLength = 1.2;

  assert.ok(almost(nextWheel.mount.position[0] / nextBeamLength, originalFraction));
  assert.deepEqual(nextWheel.mount.axis, originalWheel.mount.axis);

  const compiled = compileMachine(next).components[0];
  assert.ok(Number.isFinite(compiled.center[0]));
});

test('extending from a beam end creates a new structural part while keeping topology internal', () => {
  const document = createSingleBeamMachine();
  const next = extendFromBeamEnd(document, 'b1', 'b', [0.4, 0, -0.75]);

  assert.equal(next.beams.length, 2);
  assert.equal(next.nodes.length, 3);
  assert.equal(next.beams[1].a, next.beams[0].b);
  assert.deepEqual(next.nodes.find((node) => node.id === next.beams[1].b).position, [0.4, 0, -0.75]);
});

test('structural edits refuse degenerate geometry instead of corrupting authored truth', () => {
  const document = createSingleBeamMachine();
  const next = moveBeamEnd(document, 'b1', 'b', [-0.36, 0, 0]);
  assert.strictEqual(next, document);
  assert.equal(machineFingerprint(next), machineFingerprint(document));
});
