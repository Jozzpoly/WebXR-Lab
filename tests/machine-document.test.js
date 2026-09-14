import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedMachine, extendFromNode, machineFingerprint, validateMachine } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

test('seed machine is valid and compiles to one rigid island', () => {
  const document = createSeedMachine();
  assert.deepEqual(validateMachine(document), []);
  const plan = compileMachine(document);
  assert.equal(plan.islands.length, 1);
  assert.equal(plan.islands[0].beams.length, 1);
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
