import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  rehostPoweredWheel,
} from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';

test('powered wheel can move to a different host beam without losing authored identity or mechanics', () => {
  let document = createEmptyMachine();
  document = createBeam(document, [-0.7, 0.4, 0], [0.1, 0.4, 0]);
  document = createBeam(document, [0.5, 0.7, -0.3], [0.5, 0.7, 0.5]);
  document = attachPoweredWheel(document, 'b1', {
    mount: { position: [0.1, 0.06, 0], axis: [0, 1, 0] },
    motorVelocity: -6,
  });

  const before = structuredClone(document.components[0]);
  const nextComponentId = document.nextIds.component;
  const moved = rehostPoweredWheel(document, 'c1', 'b2', {
    position: [-0.12, 0, 0.06],
    axis: [0, 0, 2],
  });

  assert.equal(document.components[0].hostBeamId, 'b1');
  assert.equal(moved.components[0].id, before.id);
  assert.equal(moved.components[0].hostBeamId, 'b2');
  assert.deepEqual(moved.components[0].mount.position, [-0.12, 0, 0.06]);
  assert.deepEqual(moved.components[0].mount.axis, [0, 0, 1]);
  assert.equal(moved.components[0].motorVelocity, before.motorVelocity);
  assert.equal(moved.components[0].radius, before.radius);
  assert.equal(moved.nextIds.component, nextComponentId);

  const compiled = compileMachine(moved).components.find((component) => component.id === 'c1');
  assert.equal(compiled.hostBeamId, 'b2');
});

test('powered wheel rehost is a no-op when host and normalized mount are already unchanged', () => {
  let document = createEmptyMachine();
  document = createBeam(document, [-0.4, 0.4, 0], [0.4, 0.4, 0]);
  document = attachPoweredWheel(document, 'b1', {
    mount: { position: [0, 0.06, 0], axis: [0, 1, 0] },
  });

  const same = rehostPoweredWheel(document, 'c1', 'b1', {
    position: [0, 0.06, 0],
    axis: [0, 2, 0],
  });
  assert.equal(same, document);
});
