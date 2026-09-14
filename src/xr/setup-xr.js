import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const rayGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1.8),
]);
const rayMaterial = new THREE.LineBasicMaterial({ color: 0x81e6ff, transparent: true, opacity: 0.85 });
const gripGeometry = new THREE.BoxGeometry(0.045, 0.09, 0.13);
const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x243849, roughness: 0.48, metalness: 0.32 });

export function setupXrConstruction({ view, getDocument, isBuildMode, commitExtend, mountButton }) {
  view.renderer.xr.setReferenceSpaceType('local-floor');
  const desktopPosition = view.camera.position.clone();
  const desktopQuaternion = view.camera.quaternion.clone();
  view.renderer.xr.addEventListener('sessionstart', () => {
    view.controls.enabled = false;
    view.camera.position.set(0, 0, 0);
    view.camera.quaternion.identity();
    view.camera.updateMatrixWorld(true);
  });
  view.renderer.xr.addEventListener('sessionend', () => {
    view.camera.position.copy(desktopPosition);
    view.camera.quaternion.copy(desktopQuaternion);
    view.camera.updateMatrixWorld(true);
    view.controls.enabled = true;
    view.controls.update();
    view.hideGhost();
  });

  const hands = [];

  for (let index = 0; index < 2; index += 1) {
    const controller = view.renderer.xr.getController(index);
    const grip = view.renderer.xr.getControllerGrip(index);
    const ray = new THREE.Line(rayGeometry, rayMaterial);
    const marker = new THREE.Mesh(gripGeometry, gripMaterial);
    controller.add(ray);
    grip.add(marker);
    controller.visible = false;
    grip.visible = false;
    view.scene.add(controller, grip);

    const state = { startId: null, end: new THREE.Vector3() };
    const worldPoint = new THREE.Vector3();

    controller.addEventListener('connected', () => {
      controller.visible = true;
      grip.visible = true;
    });
    controller.addEventListener('disconnected', () => {
      controller.visible = false;
      grip.visible = false;
      state.startId = null;
      view.hideGhost();
    });

    controller.addEventListener('squeezestart', () => {
      if (!isBuildMode()) return;
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(worldPoint);
      const startId = view.nearestNode(getDocument(), worldPoint, 0.18);
      if (!startId) return;
      state.startId = startId;
      state.end.copy(worldPoint);
    });

    controller.addEventListener('squeezeend', () => {
      if (!state.startId || !isBuildMode()) return;
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(worldPoint);
      const doc = getDocument();
      const targetId = view.nearestNode(doc, worldPoint, 0.18, state.startId);
      const end = targetId
        ? doc.nodes.find((node) => node.id === targetId).position
        : worldPoint.toArray();
      commitExtend(state.startId, end, targetId);
      state.startId = null;
      view.hideGhost();
    });

    hands.push({ grip, state, worldPoint });
  }

  const button = VRButton.createButton(view.renderer, { requiredFeatures: ['local-floor'] });
  button.classList.add('xr-entry');
  mountButton.appendChild(button);

  return {
    update() {
      if (!isBuildMode()) return;
      for (const hand of hands) {
        if (!hand.state.startId) continue;
        hand.grip.updateWorldMatrix(true, false);
        hand.grip.getWorldPosition(hand.worldPoint);
        const doc = getDocument();
        const targetId = view.nearestNode(doc, hand.worldPoint, 0.18, hand.state.startId);
        const end = targetId
          ? doc.nodes.find((node) => node.id === targetId).position
          : hand.worldPoint.toArray();
        const start = doc.nodes.find((node) => node.id === hand.state.startId)?.position;
        if (start) view.showGhost(start, end, true);
      }
    },
  };
}
