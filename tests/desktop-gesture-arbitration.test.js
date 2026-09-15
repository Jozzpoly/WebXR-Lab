import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachDesktopBuilder } from '../src/input/desktop-builder.js';
import { attachDesktopComponents } from '../src/input/desktop-components.js';
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

  const document = createSingleBeamMachine();
  let tool = 'powered-wheel';
  let beamSelections = 0;
  let wheelCommits = 0;
  let islandCommits = 0;
  let islandPreviews = 0;
  let wheelPreviews = 0;
  let wheelPreviewClears = 0;

  const componentLayer = {
    pickPointer: () => null,
    pickPointerHit: () => null,
    pickPreviewPointer: () => true,
  };
  const view = {
    renderer: { domElement: canvas, xr },
    camera,
    componentInteractionLayer: componentLayer,
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

  const detachBuilder = attachDesktopBuilder({
    view,
    structuralLayer: { pickPointer: () => null },
    getDocument: () => document,
    isBuildMode: () => true,
    getGridEnabled: () => false,
    getTool: () => tool,
    selectBeam() {
      beamSelections += 1;
      tool = 'beam';
    },
    commitCreateBeam() {},
    commitMoveBeamEnd() {},
    commitExtendBeamEnd() {},
    previewStructuralIslandTranslation() { islandPreviews += 1; },
    clearStructuralIslandTranslationPreview() {},
    commitStructuralIslandTranslation() { islandCommits += 1; },
  });

  const detachComponents = attachDesktopComponents({
    view,
    componentLayer,
    getDocument: () => document,
    isBuildMode: () => true,
    getTool: () => tool,
    commitPoweredWheel() { wheelCommits += 1; },
    previewPoweredWheel() { wheelPreviews += 1; },
    previewPoweredWheelRehost() {},
    commitPoweredWheelRehost() {},
    clearPoweredWheelPreview() { wheelPreviewClears += 1; },
    selectComponent() {},
  });

  return {
    canvas,
    getTool: () => tool,
    counts: () => ({ beamSelections, wheelCommits, islandCommits, islandPreviews, wheelPreviews, wheelPreviewClears }),
    detach() {
      detachComponents();
      detachBuilder();
    },
  };
}

function armWheelPreview(harness, pointerId) {
  harness.canvas.emit('pointermove', pointer({ pointerId }));
  assert.ok(harness.counts().wheelPreviews >= 1, 'wheel hover must create a candidate before arbitration');
}

test('short click on overlapping wheel preview commits the wheel without taking structural context', () => {
  const harness = makeHarness();
  armWheelPreview(harness, 21);

  harness.canvas.emit('pointerdown', pointer({ pointerId: 21, buttons: 1 }));
  harness.canvas.emit('pointerup', pointer({ pointerId: 21 }));

  const counts = harness.counts();
  assert.equal(counts.wheelCommits, 1);
  assert.equal(counts.beamSelections, 0);
  assert.equal(counts.islandPreviews, 0);
  assert.equal(counts.islandCommits, 0);
  assert.equal(harness.getTool(), 'powered-wheel');
  harness.detach();
});

test('drag through overlapping wheel preview promotes the gesture to direct welded-island movement', () => {
  const harness = makeHarness();
  armWheelPreview(harness, 22);

  harness.canvas.emit('pointerdown', pointer({ pointerId: 22, buttons: 1 }));
  harness.canvas.emit('pointermove', pointer({ pointerId: 22, clientX: 455, clientY: 300, buttons: 1 }));
  harness.canvas.emit('pointerup', pointer({ pointerId: 22, clientX: 455, clientY: 300 }));

  const counts = harness.counts();
  assert.equal(counts.wheelCommits, 0, 'drag arbitration must not accidentally stamp a wheel');
  assert.equal(counts.beamSelections, 1, 'drag must take structural context after crossing the threshold');
  assert.ok(counts.islandPreviews >= 1);
  assert.equal(counts.islandCommits, 1);
  assert.equal(harness.getTool(), 'beam');
  harness.detach();
});
