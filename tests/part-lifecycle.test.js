import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  machineFingerprint,
  removeBeam,
  validateMachine,
} from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

test('an empty workshop is valid authored truth and compiles without runtime islands', () => {
  const document = createEmptyMachine();
  assert.deepEqual(validateMachine(document), []);
  assert.deepEqual(document.nodes, []);
  assert.deepEqual(document.beams, []);
  assert.deepEqual(document.components, []);
  assert.deepEqual(compileMachine(document).islands, []);
});

test('first beam can be authored from blank machine space without public node prerequisites', () => {
  const empty = createEmptyMachine();
  const before = machineFingerprint(empty);
  const next = createBeam(empty, [-0.35, 0, 0], [0.45, 0, 0]);

  assert.equal(machineFingerprint(empty), before);
  assert.equal(next.beams.length, 1);
  assert.equal(next.nodes.length, 2);
  assert.equal(next.beams[0].id, 'b1');
  assert.equal(next.revision, 1);
  assert.equal(compileMachine(next).islands.length, 1);
});

test('free beam creation can weld directly onto existing physical beam ends', () => {
  let document = createBeam(createEmptyMachine(), [-0.4, 0, 0], [0.4, 0, 0]);
  const existingEnd = { beamId: 'b1', end: 'b' };
  document = createBeam(
    document,
    [0.4, 0, 0],
    [0.4, 0, -0.65],
    { startTargetBeamEnd: existingEnd },
  );

  assert.equal(document.beams.length, 2);
  assert.equal(document.nodes.length, 3, 'welded start must reuse topology instead of creating an overlapping node');
  assert.equal(document.beams[1].a, document.beams[0].b);
  assert.equal(compileMachine(document).islands.length, 1);
});

test('removing a structural part removes hosted components and only orphaned topology', () => {
  let document = createBeam(createEmptyMachine(), [-0.5, 0, 0], [0.3, 0, 0]);
  document = createBeam(document, [0.3, 0, 0], [0.3, 0, -0.7], {
    startTargetBeamEnd: { beamId: 'b1', end: 'b' },
  });
  document = attachPoweredWheel(document, 'b2', {
    mount: { position: [0, 0.06, 0], axis: [0, 1, 0] },
  });
  const sharedNode = document.beams[0].b;
  const nextComponentId = document.nextIds.component;

  const next = removeBeam(document, 'b2');
  assert.equal(next.beams.length, 1);
  assert.equal(next.components.length, 0, 'components hosted by a deleted part must not become dangling authored truth');
  assert.ok(next.nodes.some((node) => node.id === sharedNode), 'shared welded topology must survive while another beam still references it');
  assert.equal(next.nodes.length, 2, 'only the now-orphaned free endpoint should be removed');
  assert.equal(next.nextIds.component, nextComponentId, 'ids remain monotonic and are never recycled');
});

test('deleting the final beam returns to a valid blank workshop', () => {
  const document = createBeam(createEmptyMachine(), [-0.4, 0, 0], [0.4, 0, 0]);
  const nextBeamId = document.nextIds.beam;
  const nextNodeId = document.nextIds.node;
  const blank = removeBeam(document, 'b1');

  assert.deepEqual(blank.beams, []);
  assert.deepEqual(blank.nodes, []);
  assert.deepEqual(blank.components, []);
  assert.deepEqual(validateMachine(blank), []);
  assert.equal(blank.nextIds.beam, nextBeamId);
  assert.equal(blank.nextIds.node, nextNodeId);
});

test('degenerate free creation is rejected without leaving orphan topology', () => {
  const empty = createEmptyMachine();
  const next = createBeam(empty, [0, 0, 0], [0.01, 0, 0]);
  assert.strictEqual(next, empty);
  assert.deepEqual(next.nodes, []);
  assert.deepEqual(next.beams, []);
});
