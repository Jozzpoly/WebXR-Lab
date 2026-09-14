import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

const rayGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1.8),
]);
const rayMaterial = new THREE.LineBasicMaterial({ color: 0x81e6ff, transparent: true, opacity: 0.85 });
const gripGeometry = new THREE.BoxGeometry(0.045, 0.09, 0.13);
const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x243849, roughness: 0.48, metalness: 0.32 });

export function setupXrConstruction({
  view,
  getDocument,
  isBuildMode,
  getTool,
  commitExtend,
  commitPoweredWheel,
  selectTool,
  toggleRun,
  undo,
  mountButton,
}) {
  view.renderer.xr.setReferenceSpaceType('local-floor');
  const desktopPosition = new THREE.Vector3();
  const desktopQuaternion = new THREE.Quaternion();

  view.renderer.xr.addEventListener('sessionstart', () => {
    desktopPosition.copy(view.camera.position);
    desktopQuaternion.copy(view.camera.quaternion);
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

    const state = { startId: null };
    const worldPoint = new THREE.Vector3();
    const localPoint = new THREE.Vector3();

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

    controller.addEventListener('selectstart', () => {
      const action = view.pickSpatialAction(controller);
      if (!action) return;
      if (action === 'beam' || action === 'powered-wheel') selectTool(action);
      else if (action === 'run-toggle') toggleRun();
      else if (action === 'undo') undo();
    });

    controller.addEventListener('squeezestart', () => {
      if (!isBuildMode()) return;
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(worldPoint);
      view.worldToWorkspacePoint(worldPoint, localPoint);
      const nodeId = view.nearestNode(getDocument(), localPoint, 0.18);
      if (!nodeId) return;

      if (getTool() === 'powered-wheel') {
        commitPoweredWheel(nodeId);
        state.startId = null;
        return;
      }

      if (getTool() !== 'beam') return;
      state.startId = nodeId;
    });

    controller.addEventListener('squeezeend', () => {
      if (getTool() !== 'beam' || !state.startId || !isBuildMode()) return;
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(worldPoint);
      view.worldToWorkspacePoint(worldPoint, localPoint);
      const doc = getDocument();
      const targetId = view.nearestNode(doc, localPoint, 0.18, state.startId);
      const end = targetId
        ? doc.nodes.find((node) => node.id === targetId).position
        : localPoint.toArray();
      commitExtend(state.startId, end, targetId);
      state.startId = null;
      view.hideGhost();
    });

    hands.push({ controller, grip, state, worldPoint, localPoint });
  }

  const button = VRButton.createButton(view.renderer, { requiredFeatures: ['local-floor'] });
  button.classList.add('xr-entry');
  mountButton.appendChild(button);

  return {
    update() {
      if (isBuildMode() && getTool() === 'beam') {
        for (const hand of hands) {
          if (!hand.state.startId) continue;
          hand.grip.updateWorldMatrix(true, false);
          hand.grip.getWorldPosition(hand.worldPoint);
          view.worldToWorkspacePoint(hand.worldPoint, hand.localPoint);
          const doc = getDocument();
          const targetId = view.nearestNode(doc, hand.localPoint, 0.18, hand.state.startId);
          const end = targetId
            ? doc.nodes.find((node) => node.id === targetId).position
            : hand.localPoint.toArray();
          const start = doc.nodes.find((node) => node.id === hand.state.startId)?.position;
          if (start) view.showGhost(start, end, true);
        }
      }

      let hover = null;
      for (const hand of hands) {
        if (!hand.controller.visible) continue;
        hover = view.pickSpatialAction(hand.controller) ?? hover;
      }
      view.spatialPanel.setHover(hover);
    },
  };
}
