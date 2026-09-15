import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachDesktopBuilder } from '../src/input/desktop-builder.js';
import { attachDesktopComponents } from '../src/input/desktop-components.js';

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

function pointer({ pointerId = 1, clientX = 100, clientY = 100, button = 0, buttons = 0 } = {}) {
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

test('desktop component adapter is inert while immersive XR owns transient input', () => {
  const canvas = new FakeCanvas();
  const xr = new EventHub();
  xr.isPresenting = true;
  let beamPicks = 0;
  let componentPicks = 0;
  let previewCalls = 0;
  let clearCalls = 0;

  const view = {
    renderer: { domElement: canvas, xr },
    pickBeamSurface() {
      beamPicks += 1;
      return null;
    },
  };
  const componentLayer = {
    pickPointer() {
      componentPicks += 1;
      return null;
    },
    pickPreviewPointer() {
      componentPicks += 1;
      return false;
    },
  };

  const detach = attachDesktopComponents({
    view,
    componentLayer,
    getDocument: () => ({ beams: [], components: [] }),
    isBuildMode: () => true,
    getTool: () => 'powered-wheel',
    commitPoweredWheel() {},
    previewPoweredWheel() { previewCalls += 1; },
    previewPoweredWheelRehost() { previewCalls += 1; },
    commitPoweredWheelRehost() {},
    clearPoweredWheelPreview() { clearCalls += 1; },
    selectComponent() {},
  });

  canvas.emit('pointermove', pointer());

  assert.equal(beamPicks, 0, 'inactive desktop adapter must not raycast XR-owned authoring state');
  assert.equal(componentPicks, 0, 'inactive desktop adapter must not inspect XR-owned component state');
  assert.equal(previewCalls, 0, 'inactive desktop adapter must not author a preview');
  assert.equal(clearCalls, 0, 'inactive desktop adapter must not clear the XR-owned preview');

  detach();
});

test('desktop structural pointercancel discards the drag instead of committing it', () => {
  const canvas = new FakeCanvas();
  const xr = new EventHub();
  xr.isPresenting = false;
  let commitCreates = 0;
  let ghostVisible = false;

  const view = {
    renderer: { domElement: canvas, xr },
    componentInteractionLayer: null,
    pickBeamSurface: () => null,
    pointOnBuildPlane: () => new THREE.Vector3(0.13, 0, 0.19),
    showGhost() { ghostVisible = true; },
    hideGhost() { ghostVisible = false; },
  };
  const structuralLayer = { pickPointer: () => null };

  const detach = attachDesktopBuilder({
    view,
    structuralLayer,
    getDocument: () => ({ nodes: [], beams: [] }),
    isBuildMode: () => true,
    getGridEnabled: () => false,
    getTool: () => 'beam',
    selectBeam() {},
    commitCreateBeam() { commitCreates += 1; },
    commitMoveBeamEnd() {},
    commitExtendBeamEnd() {},
  });

  canvas.emit('pointerdown', pointer({ pointerId: 7, buttons: 1 }));
  assert.equal(canvas.hasPointerCapture(7), true);
  assert.equal(ghostVisible, true);

  canvas.emit('pointercancel', pointer({ pointerId: 7 }));

  assert.equal(commitCreates, 0, 'system cancellation must never become an authored create command');
  assert.equal(canvas.hasPointerCapture(7), false);
  assert.equal(ghostVisible, false);

  detach();
});

test('XR session start cancels an outgoing desktop structural drag before XR takes ownership', () => {
  const canvas = new FakeCanvas();
  const xr = new EventHub();
  xr.isPresenting = false;
  let commitCreates = 0;

  const view = {
    renderer: { domElement: canvas, xr },
    componentInteractionLayer: null,
    pickBeamSurface: () => null,
    pointOnBuildPlane: () => new THREE.Vector3(0.2, 0, 0.2),
    showGhost() {},
    hideGhost() {},
  };

  const detach = attachDesktopBuilder({
    view,
    structuralLayer: { pickPointer: () => null },
    getDocument: () => ({ nodes: [], beams: [] }),
    isBuildMode: () => true,
    getGridEnabled: () => false,
    getTool: () => 'beam',
    selectBeam() {},
    commitCreateBeam() { commitCreates += 1; },
    commitMoveBeamEnd() {},
    commitExtendBeamEnd() {},
  });

  canvas.emit('pointerdown', pointer({ pointerId: 11, buttons: 1 }));
  assert.equal(canvas.hasPointerCapture(11), true);

  xr.isPresenting = true;
  xr.emit('sessionstart');
  assert.equal(canvas.hasPointerCapture(11), false);

  xr.isPresenting = false;
  canvas.emit('pointerup', pointer({ pointerId: 11 }));
  assert.equal(commitCreates, 0, 'a drag cancelled at XR handoff must not resume and commit after the session transition');

  detach();
});
