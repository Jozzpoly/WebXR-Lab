import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeedMachine, extendFromNode } from '../src/core/machine-document.js';
import { proposePoweredWheelPlacement, proposePoweredWheelPlacementNearPoint } from '../src/input/wheel-placement.js';

const near = (actual, expected, eps = 1e-9) => {
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= eps, `${actual} != ${expected}`));
};

test('wheel placement candidate is anchored to a concrete host beam face', () => {
  const document = createSeedMachine();
  const candidate = proposePoweredWheelPlacement(document, 'b1', [0.18, 0.01, 0.2], [0, 0, 1]);

  assert.equal(candidate.hostBeamId, 'b1');
  assert.deepEqual(candidate.mount.position, [0.18, 0.01, 0.06]);
  assert.deepEqual(candidate.mount.axis, [0, 0, 1]);
  assert.equal(candidate.motorVelocity, 8);
});

test('mirrored beam faces produce explicit mirrored axle and motor signs', () => {
  const document = createSeedMachine();
  const left = proposePoweredWheelPlacement(document, 'b1', [0, 0, -0.06], [0, 0, -1]);
  const right = proposePoweredWheelPlacement(document, 'b1', [0, 0, 0.06], [0, 0, 1]);

  assert.deepEqual(left.mount.axis, [0, 0, -1]);
  assert.deepEqual(right.mount.axis, [0, 0, 1]);
  assert.equal(left.motorVelocity, -8);
  assert.equal(right.motorVelocity, 8);
  near(left.mount.axis.map((value) => value * left.motorVelocity), [0, 0, 8]);
  near(right.mount.axis.map((value) => value * right.motorVelocity), [0, 0, 8]);
});

test('unrelated topology cannot affect a host-beam surface proposal', () => {
  const baseline = proposePoweredWheelPlacement(createSeedMachine(), 'b1', [0.1, 0, -0.06], [0, 0, -1]);
  let document = createSeedMachine();
  document = extendFromNode(document, 'n2', [3.5, 0.45, -2.8]);
  document = extendFromNode(document, 'n3', [5.2, 0.45, 1.7]);
  const changed = proposePoweredWheelPlacement(document, 'b1', [0.1, 0, -0.06], [0, 0, -1]);
  assert.deepEqual(changed, baseline);
});

test('grip proximity resolves the nearest real beam surface instead of a global centroid', () => {
  const document = createSeedMachine();
  const candidate = proposePoweredWheelPlacementNearPoint(document, [0.22, 0.45, 0.11], { maxDistance: 0.2 });

  assert.ok(candidate);
  assert.equal(candidate.hostBeamId, 'b1');
  assert.deepEqual(candidate.mount.axis, [0, 0, 1]);
  assert.deepEqual(candidate.mount.position, [0.22, 0, 0.06]);
  assert.ok(candidate.distance < 0.06);
});
