import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ComponentInteractionLayer } from '../src/view/component-interaction-layer.js';
import { MACHINE_PRESENTATION_OFFSET, WORKSPACE_WORLD_POSITION } from '../src/view/authoring-space.js';

const RECT = { x: 0, y: 0, width: 1280, height: 900 };

function makeView() {
  const camera = new THREE.PerspectiveCamera(58, RECT.width / RECT.height, 0.03, 50);
  camera.position.set(2.45, 2.15, 2.45);
  camera.lookAt(0, 1.08, -0.78);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const workspaceRoot = new THREE.Group();
  workspaceRoot.position.set(...WORKSPACE_WORLD_POSITION);
  const machineAuthoringRoot = new THREE.Group();
  machineAuthoringRoot.position.set(...MACHINE_PRESENTATION_OFFSET);
  workspaceRoot.add(machineAuthoringRoot);
  workspaceRoot.updateWorldMatrix(true, true);

  return {
    camera,
    workspaceRoot,
    machineAuthoringRoot,
    renderer: {
      domElement: {
        getBoundingClientRect: () => RECT,
      },
    },
  };
}

function machinePointToScreen(view, point) {
  const world = view.machineAuthoringRoot.localToWorld(new THREE.Vector3(...point));
  const projected = world.project(view.camera);
  return {
    x: RECT.x + (projected.x + 1) * 0.5 * RECT.width,
    y: RECT.y + (1 - projected.y) * 0.5 * RECT.height,
  };
}

const wheel = {
  id: 'c1',
  kind: 'powered-wheel',
  center: [0.08, 0, -0.04],
  colliderRotation: [0, 0, 0, 1],
  radius: 0.26,
  width: 0.12,
  motorVelocity: 8,
};

test('wheel preview center is a stable pointer target without waiting for a render frame', () => {
  const view = makeView();
  const layer = new ComponentInteractionLayer(view);

  layer.showPreview(wheel);
  const screen = machinePointToScreen(view, wheel.center);

  assert.equal(layer.hasPreview(), true);
  assert.equal(layer.pickPreviewPointer(screen.x, screen.y), true);
});

test('freshly synced authored component proxy is pointer-pickable without waiting for a render frame', () => {
  const view = makeView();
  const layer = new ComponentInteractionLayer(view);

  layer.sync({ components: [wheel] });
  const screen = machinePointToScreen(view, wheel.center);

  assert.equal(layer.pickPointerHit(screen.x, screen.y)?.componentId, wheel.id);
});
