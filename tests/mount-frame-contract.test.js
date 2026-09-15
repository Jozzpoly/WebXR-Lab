import test from 'node:test';
import assert from 'node:assert/strict';
import { attachPoweredWheel, extendFromBeamEnd } from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

const near = (actual, expected, eps = 1e-8) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= eps, `${actual} != ${expected}`));
};

const sideMount = Object.freeze({
  position: [0, 0, 0.06],
  axis: [0, 0, 1],
});

function compileMountedPart(document = createSingleBeamMachine()) {
  const mounted = attachPoweredWheel(document, 'b1', {
    mount: sideMount,
    width: 0.12,
    mountGap: 0.02,
    motorVelocity: 8,
  });
  return { document: mounted, component: compileMachine(mounted).components[0] };
}

test('powered wheel mount is authored against a host beam frame, not a structural node or machine centroid', () => {
  const { document, component } = compileMountedPart();
  const authored = document.components[0];

  assert.equal(authored.hostBeamId, 'b1');
  assert.deepEqual(authored.mount.position, sideMount.position);
  assert.deepEqual(authored.mount.axis, sideMount.axis);
  assert.equal('nodeId' in authored, false);
  assert.equal('side' in authored, false);

  assert.equal(component.hostBeamId, 'b1');
  near(component.axis, [0, 0, 1]);
  near(component.hostAnchorMachine, [0, 0, 0.06]);
  near(component.center, [0, 0, 0.14]);
});

test('unrelated part-first topology cannot rotate or move an existing host-relative wheel mount', () => {
  const baseline = compileMountedPart().component;

  let changed = createSingleBeamMachine();
  changed = extendFromBeamEnd(changed, 'b1', 'b', [0.4, 0, -3.0]);
  changed = extendFromBeamEnd(changed, 'b2', 'b', [2.6, 0, -3.0]);
  const after = compileMountedPart(changed).component;

  near(after.axis, baseline.axis);
  near(after.hostAnchorMachine, baseline.hostAnchorMachine);
  near(after.center, baseline.center);
});

test('beam roll is durable authored orientation and rotates the wheel mount frame with the host part', () => {
  const document = createSingleBeamMachine();
  document.beams[0].roll = Math.PI / 2;
  const { component } = compileMountedPart(document);

  near(component.axis, [0, -1, 0]);
  near(component.hostAnchorMachine, [0, -0.06, 0]);
  near(component.center, [0, -0.14, 0]);
});
