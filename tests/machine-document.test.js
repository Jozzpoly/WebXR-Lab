import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPoweredWheel, createSeedMachine, extendFromNode, machineFingerprint, validateMachine } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

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

function singleBeamDocument(a, b) {
  return {
    version: 1,
    revision: 0,
    nextIds: { node: 3, beam: 2, component: 1 },
    nodes: [
      { id: 'n1', position: a },
      { id: 'n2', position: b },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', thickness: 0.12, density: 420 },
    ],
    components: [],
  };
}

test('seed machine is valid and compiles to one rigid island', () => {
  const document = createSeedMachine();
  assert.deepEqual(validateMachine(document), []);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 1);
  assert.equal(plan.islands[0].beams.length, 1);
  assert.deepEqual(plan.components, []);
});

test('extendFromNode is immutable and creates topology', () => {
  const original = createSeedMachine();
  const before = machineFingerprint(original);
  const next = extendFromNode(original, 'n2', [0.9, 1.12, -1.2]);
  assert.equal(machineFingerprint(original), before);
  assert.equal(next.nodes.length, 3);
  assert.equal(next.beams.length, 2);
  assert.equal(next.revision, 1);
  assert.equal(compileMachine(next).islands.length, 1);
});

test('connecting existing sockets does not duplicate an existing beam', () => {
  const document = createSeedMachine();
  const next = extendFromNode(document, 'n1', document.nodes[1].position, 'n2');
  assert.strictEqual(next, document);
});

test('disconnected structures compile into separate rigid islands', () => {
  let document = createSeedMachine();
  document = extendFromNode(document, 'n2', [0.9, 1.12, -1.45]);
  document = structuredClone(document);
  document.nodes.push({ id: 'n99', position: [-0.5, 1.12, -2.2] });
  document.nodes.push({ id: 'n100', position: [0.1, 1.12, -2.2] });
  document.beams.push({ id: 'b99', a: 'n99', b: 'n100', thickness: 0.12, density: 420 });
  document.nextIds.node = 101;
  document.nextIds.beam = 100;
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 2);
});

test('compileMachine does not mutate authored truth', () => {
  const document = createSeedMachine();
  const before = machineFingerprint(document);
  const plan = compileMachine(document);
  assert.equal(plan.sourceFingerprint, before);
  assert.equal(machineFingerprint(document), before);
});

test('authored validation rejects geometrically degenerate structural beams', () => {
  const document = singleBeamDocument([0, 1, 0], [0.01, 1, 0]);
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
    const beam = compileMachine(singleBeamDocument(a, b)).islands[0].beams[0];
    const actual = normalize(rotatePositiveX(beam.localRotation));
    const expected = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const dot = actual[0] * expected[0] + actual[1] * expected[1] + actual[2] * expected[2];
    assert.ok(dot > 0.999999, `compiled axis diverged from authored direction: dot=${dot}`);
  }
});

test('powered wheel authoring is immutable and compiles against the structural host island', () => {
  const original = createSeedMachine();
  const before = machineFingerprint(original);
  const next = attachPoweredWheel(original, 'n1', { axis: [0, 0, 2], motorVelocity: 7 });

  assert.equal(machineFingerprint(original), before);
  assert.equal(next.components.length, 1);
  assert.equal(next.revision, 1);

  const wheel = compileMachine(next).components[0];
  assert.equal(wheel.kind, 'powered-wheel');
  assert.equal(wheel.hostIslandId, 'island-1');
  assert.deepEqual(wheel.axis, [0, 0, 1]);
  assert.equal(wheel.motorVelocity, 7);
  assert.deepEqual(wheel.hostAnchorLocal, [-0.4, 0, 0]);
});

test('powered wheel requires a real structural host and non-zero axis', () => {
  const isolated = createSeedMachine();
  isolated.nodes.push({ id: 'n3', position: [0, 1, -2] });
  isolated.nextIds.node = 4;
  assert.throws(() => attachPoweredWheel(isolated, 'n3'), /structural node/);
  assert.throws(() => attachPoweredWheel(createSeedMachine(), 'n1', { axis: [0, 0, 0] }), /non-zero/);
});
