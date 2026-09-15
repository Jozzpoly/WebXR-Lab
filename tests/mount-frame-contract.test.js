import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPoweredWheel, createSeedMachine, extendFromNode } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

const near = (actual, expected, eps = 1e-8) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= eps, `${actual} != ${expected}`));
};

const sideMount = Object.freeze({
  position: [0, 0, 0.06],
  axis: [0, 0, 1],
});

function compileMountedSeed(document = createSeedMachine()) {
  const mounted = attachPoweredWheel(document, 'b1', {
    mount: sideMount,
    width: 0.12,
    mountGap: 0.02,
    motorVelocity: 8,
  });
  return { document: mounted, component: compileMachine(mounted).components[0] };
}

test('powered wheel mount is authored against a host beam frame, not a structural node or machine centroid', () => {
  const { document, component } = compileMountedSeed();
  const authored = document.components[0];

  assert.equal(authored.hostBeamId, 'b1');
  assert.deepEqual(authored.mount.position, sideMount.position);
  assert.deepEqual(authored.mount.axis, sideMount.axis);
  assert.equal('nodeId' in authored, false);
  assert.equal('side' in authored, false);

  assert.equal(component.hostBeamId, 'b1');
  near(component.axis, [0, 0, 1]);
  near(component.hostAnchorMachine, [0, 0.45, 0.06]);
  near(component.center, [0, 0.45, 0.14]);
});

test('unrelated topology cannot rotate or move an existing host-relative wheel mount', () => {
  const baseline = compileMountedSeed().component;

  let changed = createSeedMachine();
  changed = extendFromNode(changed, 'n2', [0.4, 0.45, -3.0]);
  changed = extendFromNode(changed, 'n3', [2.6, 0.45, -3.0]);
  const after = compileMountedSeed(changed).component;

  near(after.axis, baseline.axis);
  near(after.hostAnchorMachine, baseline.hostAnchorMachine);
  near(after.center, baseline.center);
});

test('beam roll is durable authored orientation and rotates the wheel mount frame with the host part', () => {
  const document = createSeedMachine();
  document.beams[0].roll = Math.PI / 2;
  const { component } = compileMountedSeed(document);

  near(component.axis, [0, -1, 0]);
  near(component.hostAnchorMachine, [0, 0.39, 0]);
  near(component.center, [0, 0.31, 0]);
});
