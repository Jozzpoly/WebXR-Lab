import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { attachDesktopBuilder } from '../src/input/desktop-builder.js';
import { attachDesktopComponents } from '../src/input/desktop-components.js';
import { createBeam, createEmptyMachine } from '../src/core/machine-document.js';

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

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
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

function withWindowHub(run) {
  const previousWindow = globalThis.window;
  const windowHub = new EventHub();
  globalThis.window = windowHub;
  try {
    run(windowHub);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('desktop structural creation is cancelled when Space changes BUILD/RUN context mid-drag', () => {
  withWindowHub((windowHub) => {
    const canvas = new FakeCanvas();
    const xr = new EventHub();
    xr.isPresenting = false;
    let commits = 0;

    const view = {
      renderer: { domElement: canvas, xr },
      componentInteractionLayer: null,
      pickBeamSurface: () => null,
      pointOnBuildPlane: () => new THREE.Vector3(0.1, 0, 0.1),
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
      commitCreateBeam() { commits += 1; },
      commitMoveBeamEnd() {},
      commitExtendBeamEnd() {},
    });

    canvas.emit('pointerdown', pointer({ pointerId: 41, buttons: 1 }));
    assert.equal(canvas.hasPointerCapture(41), true, 'precondition: structural drag owns pointer capture');

    windowHub.emit('keydown', { code: 'Space', key: ' ', ctrlKey: false, metaKey: false });
    assert.equal(canvas.hasPointerCapture(41), false, 'context change must release stale structural pointer ownership');

    canvas.emit('pointerup', pointer({ pointerId: 41 }));
    assert.equal(commits, 0, 'a cancelled pre-context-change drag must not commit later');
    detach();
  });
});

test('desktop pending wheel placement is cancelled when tool context changes mid-click', () => {
  withWindowHub((windowHub) => {
    const canvas = new FakeCanvas();
    const xr = new EventHub();
    xr.isPresenting = false;
    const machine = createBeam(createEmptyMachine(), [-0.5, 0, 0], [0.5, 0, 0]);
    let commits = 0;

    const componentLayer = {
      pickPointer: () => null,
      pickPreviewPointer: () => true,
    };
    const view = {
      renderer: { domElement: canvas, xr },
      pickBeamSurface: () => ({
        beamId: 'b1',
        localPosition: [0, 0.06, 0],
        localNormal: [0, 1, 0],
      }),
    };

    const detach = attachDesktopComponents({
      view,
      componentLayer,
      getDocument: () => machine,
      isBuildMode: () => true,
      getTool: () => 'powered-wheel',
      commitPoweredWheel() { commits += 1; },
      previewPoweredWheel() {},
      previewPoweredWheelRehost() {},
      commitPoweredWheelRehost() {},
      clearPoweredWheelPreview() {},
      selectComponent() {},
    });

    canvas.emit('pointermove', pointer({ pointerId: 42 }));
    canvas.emit('pointerdown', pointer({ pointerId: 42, buttons: 1 }));
    windowHub.emit('keydown', { code: 'Digit1', key: '1', ctrlKey: false, metaKey: false });
    canvas.emit('pointerup', pointer({ pointerId: 42 }));

    assert.equal(commits, 0, 'wheel click begun in the old tool context must not commit after the context changes');
    detach();
  });
});
