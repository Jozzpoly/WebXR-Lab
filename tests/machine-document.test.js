import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  createBeam,
  editPoweredWheel,
  extendFromBeamEnd,
  machineFingerprint,
  removeComponent,
  validateMachine,
} from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

const normalize = (v) => {
  const len = Math.hypot(...v);
  return v.map((value) => value / len);
};

function rotatePositiveX([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y + w * z),
    2 * (x * z - w * y),
  ];
}

function rawSingleBeamDocument(a, b) {
  return {
    version: 2,
    revision: 0,
    nextIds: { node: 3, beam: 2, component: 1 },
    nodes: [
      { id: 'n1', position: a },
      { id: 'n2', position: b },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', roll: 0, thickness: 0.12, density: 420 },
    ],
    components: [],
  };
}

const mount = (axis = [0, 0, 1]) => ({ position: [0, 0, 0.06], axis });

test('part-first single beam is valid and compiles to one rigid island', () => {
  const document = createSingleBeamMachine();
  assert.deepEqual(validateMachine(document), []);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 1);
  assert.equal(plan.islands[0].beams.length, 1);
  assert.deepEqual(plan.components, []);
});

test('extendFromBeamEnd is immutable and creates welded topology', () => {
  const original = createSingleBeamMachine();
  const before = machineFingerprint(original);
  const next = extendFromBeamEnd(original, 'b1', 'b', [0.9, 0.45, -1.2]);
  assert.equal(machineFingerprint(original), before);
  assert.equal(next.nodes.length, 3);
  assert.equal(next.beams.length, 2);
  assert.equal(next.beams[1].roll, 0);
  assert.equal(next.revision, original.revision + 1);
  assert.equal(compileMachine(next).islands.length, 1);
});

test('connecting existing beam ends does not duplicate an existing structural connection', () => {
  const document = createSingleBeamMachine();
  const next = extendFromBeamEnd(
    document,
    'b1',
    'a',
    [0.4, 0.45, 0],
    { beamId: 'b1', end: 'b' },
  );
  assert.strictEqual(next, document);
});

test('disconnected authored parts compile into separate rigid islands', () => {
  let document = createSingleBeamMachine();
  document = extendFromBeamEnd(document, 'b1', 'b', [0.9, 0.45, -1.45]);
  document = createBeam(document, [-0.5, 0.45, -2.2], [0.1, 0.45, -2.2]);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 2);
});

test('compileMachine does not mutate authored truth', () => {
  const document = createSingleBeamMachine();
  const before = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.sourceFingerprint, before);
  assert.equal(machineFingerprint(document), before);
});

test('authored validation rejects geometrically degenerate structural beams', () => {
  const document = rawSingleBeamDocument([0, 1, 0], [0.01, 1, 0]);
  assert.match(validateMachine(document).join('\n'), /shorter than/);
  assert.throws(() => compileMachine(document), /shorter than/);
});

test('compiled beam rotation maps local +X onto authored direction', () => {
  const cases = [
    [[0, 0, 0], [1, 0, 0]],
    [[0, 0, 0], [-1, 0, 0]],
    [[0, 0, 0], [0, 1, 0]],
    [[0.3, -0.2, 0.4], [1.1, 0.8, -0.7]],
  ];

  for (const [a, b] of cases) {
    const beam = compileMachine(createSingleBeamMachine(a, b)).islands[0].beams[0];
    const actual = normalize(rotatePositiveX(beam.localRotation));
    const expected = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const dot = actual[0] * expected[0] + actual[1] * expected[1] + actual[2] * expected[2];
    assert.ok(dot > 0.999999, `compiled axis diverged from authored direction: dot=${dot}`);
  }
});

test('powered wheel authoring is immutable and compiles against the structural host beam', () => {
  const original = createSingleBeamMachine();
  const before = machineFingerprint(original);
  const next = attachPoweredWheel(original, 'b1', { mount: mount([0, 0, 2]), motorVelocity: 7 });

  assert.equal(machineFingerprint(original), before);
  assert.equal(next.components.length, 1);
  assert.equal(next.revision, original.revision + 1);
  assert.equal(next.components[0].hostBeamId, 'b1');
  assert.deepEqual(next.components[0].mount.axis, [0, 0, 1]);

  const wheel = compileMachine(next).components[0];
  assert.equal(wheel.kind, 'powered-wheel');
  assert.equal(wheel.hostBeamId, 'b1');
  assert.equal(wheel.hostIslandId, 'island-1');
  assert.deepEqual(wheel.axis, [0, 0, 1]);
  assert.equal(wheel.motorVelocity, 7);
  assert.deepEqual(wheel.hostAnchorMachine, [0, 0.45, 0.06]);
});

test('powered wheel requires a real structural host beam and non-zero mount axis', () => {
  assert.throws(() => attachPoweredWheel(createSingleBeamMachine(), 'missing', { mount: mount() }), /host beam/);
  assert.throws(() => attachPoweredWheel(createSingleBeamMachine(), 'b1', { mount: mount([0, 0, 0]) }), /non-zero/);
});

test('powered-wheel editing preserves identity, authored immutability and explicit mount intent', () => {
  const original = attachPoweredWheel(createSingleBeamMachine(), 'b1', { mount: mount(), motorVelocity: 8 });
  const before = machineFingerprint(original);
  const id = original.components[0].id;

  const flippedMount = { position: [...original.components[0].mount.position], axis: [0, 0, -1] };
  const next = editPoweredWheel(original, id, { mount: flippedMount, motorVelocity: -8 });

  assert.equal(machineFingerprint(original), before);
  assert.equal(next.components[0].id, id);
  assert.deepEqual(next.components[0].mount.axis, [0, 0, -1]);
  assert.equal(next.components[0].motorVelocity, -8);
  assert.equal(next.revision, original.revision + 1);
  const compiled = compileMachine(next).components[0];
  assert.equal(compiled.id, id);
  assert.equal(compiled.motorVelocity, -8);
  assert.deepEqual(compiled.mountAxis, [0, 0, -1]);
});

test('powered-wheel editing rejects fields that would silently change component identity or host', () => {
  const document = attachPoweredWheel(createSingleBeamMachine(), 'b1', { mount: mount() });
  const id = document.components[0].id;
  assert.throws(() => editPoweredWheel(document, id, { hostBeamId: 'b2' }), /unsupported powered-wheel edit field/);
  assert.throws(() => editPoweredWheel(document, id, { nodeId: 'n2' }), /unsupported powered-wheel edit field/);
  assert.throws(() => editPoweredWheel(document, id, { mount: mount([0, 0, 0]) }), /non-zero/);
});

test('component removal is immutable and leaves authored ids monotonic', () => {
  const original = attachPoweredWheel(createSingleBeamMachine(), 'b1', { mount: mount() });
  const before = machineFingerprint(original);
  const removedId = original.components[0].id;
  const next = removeComponent(original, removedId);

  assert.equal(machineFingerprint(original), before);
  assert.equal(next.components.length, 0);
  assert.equal(next.revision, original.revision + 1);
  assert.equal(next.nextIds.component, original.nextIds.component);

  const readded = attachPoweredWheel(next, 'b1', { mount: mount([0, 0, -1]) });
  assert.notEqual(readded.components[0].id, removedId);
});
