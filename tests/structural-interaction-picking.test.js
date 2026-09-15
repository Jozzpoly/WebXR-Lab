import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StructuralInteractionLayer } from '../src/view/structural-interaction-layer.js';
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

test('freshly synced structural handle is pointer-pickable without waiting for a render frame', () => {
  const view = makeView();
  const layer = new StructuralInteractionLayer(view);
  const document = {
    nodes: [
      { id: 'n1', position: [-0.25, 0, 0] },
      { id: 'n2', position: [0.25, 0, 0] },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', thickness: 0.08 },
    ],
  };
  const plan = {
    islands: [{
      beams: [{
        id: 'b1',
        machinePosition: [0, 0, 0],
        machineRotation: [0, 0, 0, 1],
        length: 0.5,
        thickness: 0.08,
      }],
    }],
  };

  layer.sync(document, plan, 'b1', true);
  const handle = { kind: 'move', beamId: 'b1', end: 'a' };
  const machinePoint = layer.getHandleMachinePosition(handle, new THREE.Vector3());
  assert.ok(machinePoint);
  const screen = machinePointToScreen(view, machinePoint.toArray());

  assert.deepEqual(layer.pickPointer(screen.x, screen.y), handle);
});
