import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBeam, createEmptyMachine } from '../src/core/machine-document.js';
import { setupXrConstruction } from '../src/xr/setup-xr.js';

class FakeXr extends THREE.EventDispatcher {
  constructor() {
    super();
    this.isPresenting = true;
    this.controllers = [new THREE.Group(), new THREE.Group()];
    this.grips = [new THREE.Group(), new THREE.Group()];
  }

  setReferenceSpaceType() {}

  getController(index) {
    return this.controllers[index];
  }

  getControllerGrip(index) {
    return this.grips[index];
  }
}

function fakeElement(tag) {
  const element = {
    tagName: String(tag).toUpperCase(),
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    children: [],
    width: 0,
    height: 0,
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        fillText() {},
        measureText() { return { width: 0 }; },
        set fillStyle(_value) {},
        set font(_value) {},
        set textAlign(_value) {},
        set textBaseline(_value) {},
      };
    },
  };
  return element;
}

function installDomShim() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  globalThis.window = { isSecureContext: true };
  globalThis.document = { createElement: fakeElement };
  return () => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  };
}

test('XR trigger context change cancels an in-flight structural grip before RUN/STOP can revive it', () => {
  const restoreDom = installDomShim();
  try {
    const xr = new FakeXr();
    const scene = new THREE.Scene();
    const workspaceRoot = new THREE.Group();
    scene.add(workspaceRoot);

    const spatialPanel = {
      group: new THREE.Group(),
      setHover() {},
    };
    workspaceRoot.add(spatialPanel.group);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 50);
    const controls = { enabled: true, target: new THREE.Vector3(), update() {} };
    const right = xr.controllers[0];
    const left = xr.controllers[1];
    const rightGrip = xr.grips[0];
    rightGrip.position.set(0.5, 0, 0);

    let mode = 'build';
    let moveCommits = 0;
    let ghostShows = 0;
    const machine = createBeam(createEmptyMachine(), [-0.5, 0, 0], [0.5, 0, 0]);

    const view = {
      renderer: { xr },
      scene,
      workspaceRoot,
      spatialPanel,
      camera,
      controls,
      pickSpatialAction(controller) {
        return controller === left ? 'run-toggle' : null;
      },
      worldToMachinePoint(point, target = new THREE.Vector3()) {
        return target.copy(point);
      },
      machineToWorldPoint(point, target = new THREE.Vector3()) {
        return target.copy(point);
      },
      pickBeamSurfaceController() { return null; },
      showGhost() { ghostShows += 1; },
      hideGhost() {},
    };

    const componentLayer = {
      nearest() { return null; },
      pickControllerHit() { return null; },
    };
    const structuralLayer = {
      nearest() { return { kind: 'move', beamId: 'b1', end: 'b' }; },
      getHandleMachinePosition() { return null; },
    };
    const mountButton = { appendChild() {} };

    setupXrConstruction({
      view,
      componentLayer,
      structuralLayer,
      getDocument: () => machine,
      isBuildMode: () => mode === 'build',
      getTool: () => 'beam',
      getSelectedComponentId: () => null,
      getSelectedBeamId: () => 'b1',
      commitCreateBeam() {},
      commitMoveBeamEnd() { moveCommits += 1; },
      commitExtendBeamEnd() {},
      commitPoweredWheel() {},
      previewPoweredWheel() {},
      previewPoweredWheelRehost() {},
      commitPoweredWheelRehost() {},
      clearPoweredWheelPreview() {},
      selectBeam() {},
      clearBeamSelection() {},
      selectComponent() {},
      editSelectedBeam() {},
      editSelectedWheel() {},
      selectTool() {},
      toggleRun() { mode = mode === 'build' ? 'run' : 'build'; },
      undo() {},
      mountButton,
    });

    right.dispatchEvent({ type: 'squeezestart' });
    assert.ok(ghostShows > 0, 'precondition: right-hand squeeze must start a live structural drag');

    left.dispatchEvent({ type: 'selectstart' });
    assert.equal(mode, 'run', 'left-hand trigger must enter RUN');
    left.dispatchEvent({ type: 'selectstart' });
    assert.equal(mode, 'build', 'second trigger must STOP back to BUILD');

    rightGrip.position.set(0.72, 0, 0);
    right.dispatchEvent({ type: 'squeezeend' });
    assert.equal(moveCommits, 0, 'a pre-RUN structural drag must never commit after RUN/STOP changes context');
  } finally {
    restoreDom();
  }
});
