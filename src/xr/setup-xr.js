import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { MIN_BEAM_LENGTH } from '../core/machine-document.js';
import { beamEndPosition, nearestBeamEnd, nearestBeamSurface } from '../input/structural-placement.js';
import { proposePoweredWheelPlacementNearPoint } from '../input/wheel-placement.js';
import { beginWorkspaceTranslation, updateWorkspaceTranslation } from '../input/workspace-translation.js';
import { WorkspaceGrabHandle } from '../view/workspace-handle.js';

const rayGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 0, -1.8),
]);
const rayMaterial = new THREE.LineBasicMaterial({ color: 0x81e6ff, transparent: true, opacity: 0.85 });
const gripGeometry = new THREE.BoxGeometry(0.045, 0.09, 0.13);
const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x243849, roughness: 0.48, metalness: 0.32 });

export function setupXrConstruction({
  view,
  componentLayer,
  structuralLayer,
  getDocument,
  isBuildMode,
  getTool,
  getSelectedComponentId,
  getSelectedBeamId,
  commitMoveBeamEnd,
  commitExtendBeamEnd,
  commitPoweredWheel,
  previewPoweredWheel,
  clearPoweredWheelPreview,
  selectBeam,
  clearBeamSelection,
  selectComponent,
  editSelectedWheel,
  selectTool,
  toggleRun,
  undo,
  mountButton,
}) {
  view.renderer.xr.setReferenceSpaceType('local-floor');
  const desktopPosition = new THREE.Vector3();
  const desktopQuaternion = new THREE.Quaternion();
  const desktopTarget = new THREE.Vector3();
  const workspaceAtSessionStart = new THREE.Vector3();
  const workspaceDelta = new THREE.Vector3();

  const workspaceHandle = new WorkspaceGrabHandle();
  view.workspaceRoot.add(workspaceHandle.group);
  workspaceHandle.group.visible = false;
  view.spatialPanel.group.visible = false;
  let workspaceGrabHand = null;
  let workspaceDrag = null;

  const releaseWorkspace = () => {
    workspaceGrabHand = null;
    workspaceDrag = null;
    workspaceHandle.setActive(false);
  };

  const clearStructuralDrag = (state) => {
    state.structuralDrag = null;
    state.lastPoint = null;
    state.targetBeamEnd = null;
    view.hideGhost();
  };

  view.renderer.xr.addEventListener('sessionstart', () => {
    desktopPosition.copy(view.camera.position);
    desktopQuaternion.copy(view.camera.quaternion);
    desktopTarget.copy(view.controls.target);
    workspaceAtSessionStart.copy(view.workspaceRoot.position);
    view.controls.enabled = false;
    view.camera.position.set(0, 0, 0);
    view.camera.quaternion.identity();
    view.camera.updateMatrixWorld(true);
    view.spatialPanel.group.visible = true;
    workspaceHandle.group.visible = isBuildMode();
  });
  view.renderer.xr.addEventListener('sessionend', () => {
    releaseWorkspace();
    clearPoweredWheelPreview();
    for (const hand of hands) clearStructuralDrag(hand.state);
    view.spatialPanel.group.visible = false;
    workspaceHandle.group.visible = false;
    workspaceDelta.copy(view.workspaceRoot.position).sub(workspaceAtSessionStart);
    view.camera.position.copy(desktopPosition).add(workspaceDelta);
    view.camera.quaternion.copy(desktopQuaternion);
    view.controls.target.copy(desktopTarget).add(workspaceDelta);
    view.camera.updateMatrixWorld(true);
    view.controls.enabled = true;
    view.controls.update();
    view.hideGhost();
  });

  const hands = [];

  const updateStructuralDrag = (hand) => {
    const drag = hand.state.structuralDrag;
    if (!drag) return;

    hand.grip.updateWorldMatrix(true, false);
    hand.grip.getWorldPosition(hand.worldPoint);
    view.worldToWorkspacePoint(hand.worldPoint, hand.localPoint);

    const doc = getDocument();
    const start = beamEndPosition(doc, drag.beamId, drag.end);
    const opposite = beamEndPosition(doc, drag.beamId, drag.end === 'a' ? 'b' : 'a');
    if (!start || !opposite) return;

    hand.state.targetBeamEnd = null;
    let end = hand.localPoint.toArray();
    if (drag.kind === 'extend') {
      const target = nearestBeamEnd(doc, end, 0.18, { beamId: drag.beamId, end: drag.end });
      if (target) {
        hand.state.targetBeamEnd = { beamId: target.beamId, end: target.end };
        end = target.position;
      }
    }

    const previewStart = drag.kind === 'move' ? opposite : start;
    const length = Math.hypot(
      end[0] - previewStart[0],
      end[1] - previewStart[1],
      end[2] - previewStart[2],
    );
    hand.state.lastPoint = [...end];
    view.showGhost(previewStart, end, length >= MIN_BEAM_LENGTH);
  };

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

    const state = { structuralDrag: null, lastPoint: null, targetBeamEnd: null };
    const worldPoint = new THREE.Vector3();
    const localPoint = new THREE.Vector3();

    controller.addEventListener('connected', () => {
      controller.visible = true;
      grip.visible = true;
    });
    controller.addEventListener('disconnected', () => {
      controller.visible = false;
      grip.visible = false;
      clearStructuralDrag(state);
      if (workspaceGrabHand === index) releaseWorkspace();
      clearPoweredWheelPreview();
    });

    controller.addEventListener('selectstart', () => {
      if (workspaceGrabHand !== null) return;
      const action = view.pickSpatialAction(controller);
      if (action) {
        if (action === 'beam' || action === 'powered-wheel') selectTool(action);
        else if (action === 'run-toggle') toggleRun();
        else if (action === 'undo') undo();
        else if (action.startsWith('wheel-')) editSelectedWheel(action);
        return;
      }

      if (!isBuildMode()) return;
      const componentId = componentLayer.pickController(controller);
      if (componentId) {
        selectComponent(componentId);
        return;
      }

      if (getTool() === 'beam') {
        const surface = view.pickBeamSurfaceController(controller);
        if (surface?.beamId) selectBeam(surface.beamId);
      }
    });

    controller.addEventListener('squeezestart', () => {
      grip.updateWorldMatrix(true, false);
      grip.getWorldPosition(worldPoint);

      if (isBuildMode() && workspaceGrabHand === null && workspaceHandle.containsWorldPoint(worldPoint)) {
        workspaceGrabHand = index;
        workspaceDrag = beginWorkspaceTranslation(view.workspaceRoot.position.toArray(), worldPoint.toArray());
        workspaceHandle.setActive(true);
        clearStructuralDrag(state);
        clearPoweredWheelPreview();
        return;
      }

      if (workspaceGrabHand !== null || !isBuildMode()) return;
      view.worldToWorkspacePoint(worldPoint, localPoint);

      const componentId = componentLayer.nearest(localPoint, 0.24);
      if (componentId) {
        clearStructuralDrag(state);
        clearPoweredWheelPreview();
        selectComponent(componentId);
        return;
      }
      if (getSelectedComponentId()) return;

      if (getTool() === 'powered-wheel') {
        const candidate = proposePoweredWheelPlacementNearPoint(getDocument(), localPoint.toArray(), { maxDistance: 0.22 });
        if (!candidate) return;
        clearPoweredWheelPreview();
        commitPoweredWheel(candidate);
        return;
      }

      if (getTool() !== 'beam') return;

      const handle = structuralLayer.nearest(localPoint, 0.14);
      if (handle) {
        state.structuralDrag = handle;
        state.lastPoint = null;
        state.targetBeamEnd = null;
        clearPoweredWheelPreview();
        updateStructuralDrag({ grip, state, worldPoint, localPoint });
        return;
      }

      const nearSurface = nearestBeamSurface(getDocument(), localPoint.toArray(), 0.18);
      if (nearSurface?.beamId) selectBeam(nearSurface.beamId);
    });

    controller.addEventListener('squeezeend', () => {
      if (workspaceGrabHand === index) {
        releaseWorkspace();
        return;
      }
      if (workspaceGrabHand !== null || !state.structuralDrag || !isBuildMode()) return;

      updateStructuralDrag({ grip, state, worldPoint, localPoint });
      const drag = state.structuralDrag;
      const point = state.lastPoint;
      if (point) {
        if (drag.kind === 'move') {
          commitMoveBeamEnd(drag.beamId, drag.end, point);
        } else {
          commitExtendBeamEnd(drag.beamId, drag.end, point, state.targetBeamEnd);
        }
      }
      clearStructuralDrag(state);
    });

    hands.push({ controller, grip, state, worldPoint, localPoint });
  }

  const button = VRButton.createButton(view.renderer, { requiredFeatures: ['local-floor'] });
  button.classList.add('xr-entry');
  mountButton.appendChild(button);

  return {
    getWorkspaceHandleWorldPosition(target = new THREE.Vector3()) {
      workspaceHandle.group.updateWorldMatrix(true, false);
      return target.setFromMatrixPosition(workspaceHandle.group.matrixWorld);
    },
    getBeamHandleWorldPosition(handle, target = new THREE.Vector3()) {
      const local = structuralLayer.getHandleLocalPosition(handle, target);
      if (!local) return null;
      return view.workspaceToWorldPoint(local, target);
    },
    update() {
      workspaceHandle.group.visible = view.renderer.xr.isPresenting && isBuildMode();
      if (!isBuildMode() && workspaceGrabHand !== null) releaseWorkspace();

      if (workspaceGrabHand !== null && workspaceDrag) {
        clearPoweredWheelPreview();
        const hand = hands[workspaceGrabHand];
        hand.grip.updateWorldMatrix(true, false);
        hand.grip.getWorldPosition(hand.worldPoint);
        const nextPosition = updateWorkspaceTranslation(workspaceDrag, hand.worldPoint.toArray());
        view.workspaceRoot.position.fromArray(nextPosition);
        view.workspaceRoot.updateMatrixWorld(true);
      } else if (isBuildMode() && getTool() === 'beam') {
        clearPoweredWheelPreview();
        let dragging = false;
        for (const hand of hands) {
          if (!hand.state.structuralDrag) continue;
          dragging = true;
          updateStructuralDrag(hand);
        }
        if (!dragging && !getSelectedBeamId()) view.hideGhost();
      } else if (isBuildMode() && getTool() === 'powered-wheel' && !getSelectedComponentId()) {
        let previewCandidate = null;
        for (const hand of hands) {
          if (!hand.grip.visible) continue;
          hand.grip.updateWorldMatrix(true, false);
          hand.grip.getWorldPosition(hand.worldPoint);
          view.worldToWorkspacePoint(hand.worldPoint, hand.localPoint);
          if (componentLayer.nearest(hand.localPoint, 0.24)) continue;
          const candidate = proposePoweredWheelPlacementNearPoint(getDocument(), hand.localPoint.toArray(), { maxDistance: 0.22 });
          if (!candidate) continue;
          if (!previewCandidate || candidate.distance < previewCandidate.distance) previewCandidate = candidate;
        }
        previewPoweredWheel(previewCandidate);
      } else {
        clearPoweredWheelPreview();
      }

      let hover = null;
      if (workspaceGrabHand === null) {
        for (const hand of hands) {
          if (!hand.controller.visible) continue;
          hover = view.pickSpatialAction(hand.controller) ?? hover;
        }
      }
      view.spatialPanel.setHover(hover);
    },
  };
}
