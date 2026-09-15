import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachDesktopBuilder } from '../src/input/desktop-builder.js';
import { createSingleBeamMachine } from './helpers/machine-fixtures.js';

class EventHub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

class FakeCanvas extends EventHub {
  constructor() {
    super();
    this.captured = new Set();
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }

  setPointerCapture(pointerId) {
    this.captured.add(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captured.delete(pointerId);
  }

  hasPointerCapture(pointerId) {
    return this.captured.has(pointerId);
  }
}

function pointer({ pointerId = 1, clientX = 400, clientY = 300, button = 0, buttons = 0 } = {}) {
  return {
    pointerId,
    clientX,
    clientY,
    button,
    buttons,
    preventDefault() {},
    stopImmediatePropagation() {},
  };
}

function makeHarness() {
  const canvas = new FakeCanvas();
  const xr = new EventHub();
  xr.isPresenting = false;
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.03, 50);
  camera.position.set(0, 1.2, 3);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const machineRoot = new THREE.Group();
  machineRoot.updateWorldMatrix(true, false);
  const document = createSingleBeamMachine();
  const previews = [];
  const commits = [];
  let selections = 0;
  let clears = 0;

  const view = {
    renderer: { domElement: canvas, xr },
    camera,
    componentInteractionLayer: {
      pickPointerHit: () => null,
      pickPreviewPointer: () => false,
    },
    pickBeamSurface: () => ({
      beamId: 'b1',
      localPosition: [0, 0.06, 0],
      localNormal: [0, 1, 0],
      distance: 2,
    }),
    pointOnBuildPlane: () => null,
    machineToWorldPoint(point, target = new THREE.Vector3()) {
      return target.copy(point);
    },
    worldToMachinePoint(point, target = new THREE.Vector3()) {
      return target.copy(point);
    },
    showGhost() {},
    hideGhost() {},
  };

  const detach = attachDesktopBuilder({
    view,
    structuralLayer: { pickPointer: () => null },
    getDocument: () => document,
    isBuildMode: () => true,
    getGridEnabled: () => false,
    getTool: () => 'beam',
    selectBeam: () => { selections += 1; },
    commitCreateBeam() {},
    commitMoveBeamEnd() {},
    commitExtendBeamEnd() {},
    previewStructuralIslandTranslation: (beamId, delta) => previews.push({ beamId, delta: [...delta] }),
    clearStructuralIslandTranslationPreview: () => { clears += 1; },
    commitStructuralIslandTranslation: (beamId, delta) => commits.push({ beamId, delta: [...delta] }),
  });

  return { canvas, xr, previews, commits, detach, getSelections: () => selections, getClears: () => clears };
}

test('clicking a beam selects it without translating its welded island', () => {
  const harness = makeHarness();
  harness.canvas.emit('pointerdown', pointer({ pointerId: 4, buttons: 1 }));
  harness.canvas.emit('pointerup', pointer({ pointerId: 4 }));

  assert.equal(harness.getSelections(), 1);
  assert.equal(harness.previews.length, 0);
  assert.equal(harness.commits.length, 0);
  assert.equal(harness.canvas.hasPointerCapture(4), false);
  harness.detach();
});

test('dragging a beam body previews and commits one welded-island translation', () => {
  const harness = makeHarness();
  harness.canvas.emit('pointerdown', pointer({ pointerId: 8, buttons: 1 }));
  harness.canvas.emit('pointermove', pointer({ pointerId: 8, clientX: 455, clientY: 300, buttons: 1 }));
  harness.canvas.emit('pointerup', pointer({ pointerId: 8, clientX: 455, clientY: 300 }));

  assert.equal(harness.getSelections(), 1);
  assert.ok(harness.previews.length >= 1);
  assert.equal(harness.commits.length, 1);
  assert.equal(harness.commits[0].beamId, 'b1');
  assert.ok(Math.hypot(...harness.commits[0].delta) > 0.05);
  assert.deepEqual(harness.commits[0].delta, harness.previews.at(-1).delta);
  assert.equal(harness.canvas.hasPointerCapture(8), false);
  harness.detach();
});

test('pointercancel during a direct beam drag clears preview and never commits authored translation', () => {
  const harness = makeHarness();
  harness.canvas.emit('pointerdown', pointer({ pointerId: 12, buttons: 1 }));
  harness.canvas.emit('pointermove', pointer({ pointerId: 12, clientX: 450, clientY: 325, buttons: 1 }));
  harness.canvas.emit('pointercancel', pointer({ pointerId: 12, clientX: 450, clientY: 325 }));

  assert.ok(harness.previews.length >= 1);
  assert.equal(harness.commits.length, 0);
  assert.ok(harness.getClears() >= 1);
  assert.equal(harness.canvas.hasPointerCapture(12), false);
  harness.detach();
});
