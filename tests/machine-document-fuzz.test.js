import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertValidMachine,
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  editPoweredWheel,
  extendFromBeamEnd,
  machineFingerprint,
  moveBeamEnd,
  rehostPoweredWheel,
  removeBeam,
  removeComponent,
} from '../src/core/machine-document.js';
import { getBeamFrame } from '../src/core/beam-frame.js';
import { translateStructuralIsland } from '../src/core/structural-translation.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const choose = (random, values) => values[Math.floor(random() * values.length)];
const signed = (random, magnitude = 1) => (random() * 2 - 1) * magnitude;
const point = (random, magnitude = 1) => [signed(random, magnitude), signed(random, magnitude), signed(random, magnitude)];

function idNumber(id) {
  return Number(String(id).slice(1));
}

function mountFor(random, document, beamId) {
  const frame = getBeamFrame(document, beamId);
  const sign = random() < 0.5 ? -1 : 1;
  return {
    position: [signed(random, frame.length * 0.45), sign * frame.thickness * 0.5, 0],
    axis: [0, sign, 0],
  };
}

function assertDocumentInvariants(document, label) {
  assert.equal(assertValidMachine(document), document, `${label}: document must remain valid`);

  const referencedNodes = new Set(document.beams.flatMap((beam) => [beam.a, beam.b]));
  assert.equal(document.nodes.length, referencedNodes.size, `${label}: official operations must not leave orphan nodes`);
  for (const node of document.nodes) {
    assert.ok(referencedNodes.has(node.id), `${label}: node ${node.id} must belong to structural topology`);
  }

  const maxNode = document.nodes.reduce((max, node) => Math.max(max, idNumber(node.id)), 0);
  const maxBeam = document.beams.reduce((max, beam) => Math.max(max, idNumber(beam.id)), 0);
  const maxComponent = document.components.reduce((max, component) => Math.max(max, idNumber(component.id)), 0);
  assert.ok(document.nextIds.node > maxNode, `${label}: next node id must remain monotonic`);
  assert.ok(document.nextIds.beam > maxBeam, `${label}: next beam id must remain monotonic`);
  assert.ok(document.nextIds.component > maxComponent, `${label}: next component id must remain monotonic`);

  for (const component of document.components) {
    const frame = getBeamFrame(document, component.hostBeamId);
    assert.ok(
      Math.abs(component.mount.position[0]) <= frame.length * 0.5 + 1e-9,
      `${label}: ${component.id} longitudinal mount must stay on its host after reshape/rehost`,
    );
    const axisLength = Math.hypot(...component.mount.axis);
    assert.ok(Math.abs(axisLength - 1) <= 1e-10, `${label}: ${component.id} mount axis must stay normalized`);
  }

  const beforeCompile = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(machineFingerprint(document), beforeCompile, `${label}: compile must not mutate authored truth`);
  assert.equal(plan.components.length, document.components.length, `${label}: compile must preserve component cardinality`);
}

function mutate(random, document) {
  if (document.beams.length === 0) {
    const start = point(random, 0.7);
    const delta = point(random, 0.7);
    return createBeam(document, start, start.map((value, index) => value + delta[index] + (index === 0 ? 0.18 : 0)));
  }

  const operations = [
    'create',
    'extend',
    'move',
    'attach',
    'translate',
    'remove-beam',
  ];
  if (document.components.length > 0) operations.push('edit-wheel', 'rehost-wheel', 'remove-wheel');
  if (document.beams.length >= 14) {
    const createIndex = operations.indexOf('create');
    if (createIndex >= 0) operations.splice(createIndex, 1);
    const extendIndex = operations.indexOf('extend');
    if (extendIndex >= 0) operations.splice(extendIndex, 1);
  }
  if (document.components.length >= 10) {
    const attachIndex = operations.indexOf('attach');
    if (attachIndex >= 0) operations.splice(attachIndex, 1);
  }

  const operation = choose(random, operations);
  const beam = choose(random, document.beams);

  if (operation === 'create') {
    const start = point(random, 1.2);
    const delta = point(random, 0.8);
    const end = start.map((value, index) => value + delta[index] + (index === 0 ? 0.1 : 0));
    return createBeam(document, start, end, {
      roll: signed(random, Math.PI),
      thickness: 0.06 + random() * 0.18,
      density: 150 + random() * 900,
    });
  }

  if (operation === 'extend') {
    const end = random() < 0.5 ? 'a' : 'b';
    const frame = getBeamFrame(document, beam.id);
    const delta = point(random, 0.65);
    const sourceNode = document.nodes.find((node) => node.id === beam[end]);
    let targetBeamEnd = null;
    let targetPosition = sourceNode.position.map((value, index) => value + delta[index] + (index === 2 ? 0.12 : 0));
    if (document.beams.length > 1 && random() < 0.28) {
      const targetBeam = choose(random, document.beams.filter((candidate) => candidate.id !== beam.id));
      const targetEnd = random() < 0.5 ? 'a' : 'b';
      targetBeamEnd = { beamId: targetBeam.id, end: targetEnd };
      targetPosition = document.nodes.find((node) => node.id === targetBeam[targetEnd]).position;
    }
    void frame;
    return extendFromBeamEnd(document, beam.id, end, targetPosition, targetBeamEnd);
  }

  if (operation === 'move') {
    const end = random() < 0.5 ? 'a' : 'b';
    const node = document.nodes.find((candidate) => candidate.id === beam[end]);
    const delta = point(random, 0.35);
    const target = node.position.map((value, index) => value + delta[index]);
    return moveBeamEnd(document, beam.id, end, target);
  }

  if (operation === 'attach') {
    return attachPoweredWheel(document, beam.id, {
      mount: mountFor(random, document, beam.id),
      radius: 0.08 + random() * 0.34,
      width: 0.04 + random() * 0.18,
      mountGap: random() * 0.08,
      density: 200 + random() * 900,
      motorVelocity: signed(random, 14),
      motorDamping: random() * 3,
    });
  }

  if (operation === 'translate') {
    return translateStructuralIsland(document, beam.id, point(random, 0.5));
  }

  if (operation === 'remove-beam') {
    return removeBeam(document, beam.id);
  }

  const component = choose(random, document.components);
  if (operation === 'edit-wheel') {
    return editPoweredWheel(document, component.id, {
      motorVelocity: signed(random, 18),
      motorDamping: random() * 4,
    });
  }

  if (operation === 'rehost-wheel') {
    const host = choose(random, document.beams);
    return rehostPoweredWheel(document, component.id, host.id, mountFor(random, document, host.id));
  }

  return removeComponent(document, component.id);
}

test('deterministic authored-operation fuzzing preserves machine/document invariants', () => {
  for (let seed = 1; seed <= 48; seed += 1) {
    const random = rng(seed * 0x9e3779b1);
    let document = createEmptyMachine();
    assertDocumentInvariants(document, `seed ${seed} initial`);

    for (let step = 0; step < 90; step += 1) {
      const before = document;
      const beforeFingerprint = machineFingerprint(before);
      const beforeRevision = before.revision;
      const beforeNextIds = { ...before.nextIds };

      const next = mutate(random, before);

      assert.equal(machineFingerprint(before), beforeFingerprint, `seed ${seed} step ${step}: operation mutated its input document`);
      if (next === before) {
        assert.equal(next.revision, beforeRevision, `seed ${seed} step ${step}: no-op changed revision`);
      } else {
        assert.equal(next.revision, beforeRevision + 1, `seed ${seed} step ${step}: real authored command must advance one revision`);
      }
      assert.ok(next.nextIds.node >= beforeNextIds.node, `seed ${seed} step ${step}: node allocator regressed`);
      assert.ok(next.nextIds.beam >= beforeNextIds.beam, `seed ${seed} step ${step}: beam allocator regressed`);
      assert.ok(next.nextIds.component >= beforeNextIds.component, `seed ${seed} step ${step}: component allocator regressed`);

      document = next;
      assertDocumentInvariants(document, `seed ${seed} step ${step}`);
    }
  }
});
