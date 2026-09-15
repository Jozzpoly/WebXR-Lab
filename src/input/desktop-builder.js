import * as THREE from 'three';
import { MIN_BEAM_LENGTH } from '../core/machine-document.js';
import { beamEndPosition, nearestBeamEnd } from './structural-placement.js';
import { BUILD_Y } from '../view/scene.js';

export function attachDesktopBuilder({
  view,
  structuralLayer,
  getDocument,
  isBuildMode,
  getGridEnabled,
  getTool,
  pickComponent,
  selectBeam,
  clearBeamSelection,
  commitMoveBeamEnd,
  commitExtendBeamEnd,
}) {
  const canvas = view.renderer.domElement;
  const state = {
    handle: null,
    pointerId: null,
    lastPoint: null,
    targetBeamEnd: null,
  };

  const snap = (point) => {
    if (!getGridEnabled()) return point;
    const size = 0.25;
    return new THREE.Vector3(
      Math.round(point.x / size) * size,
      BUILD_Y,
      Math.round(point.z / size) * size,
    );
  };

  const updateDrag = (event) => {
    if (!state.handle || !isBuildMode() || getTool() !== 'beam') return;
    const point = view.pointOnBuildPlane(event.clientX, event.clientY);
    if (!point) return;

    const doc = getDocument();
    const snapped = snap(point);
    const start = beamEndPosition(doc, state.handle.beamId, state.handle.end);
    const opposite = beamEndPosition(doc, state.handle.beamId, state.handle.end === 'a' ? 'b' : 'a');
    if (!start || !opposite) return;

    state.targetBeamEnd = null;
    let end = snapped.toArray();
    if (state.handle.kind === 'extend') {
      const target = nearestBeamEnd(doc, end, 0.16, {
        beamId: state.handle.beamId,
        end: state.handle.end,
      });
      if (target) {
        state.targetBeamEnd = { beamId: target.beamId, end: target.end };
        end = target.position;
      }
    }

    const previewStart = state.handle.kind === 'move' ? opposite : start;
    const length = Math.hypot(
      end[0] - previewStart[0],
      end[1] - previewStart[1],
      end[2] - previewStart[2],
    );
    state.lastPoint = [...end];
    view.showGhost(previewStart, end, length >= MIN_BEAM_LENGTH);
  };

  const beginDrag = (handle, event) => {
    state.handle = handle;
    state.pointerId = event.pointerId;
    state.lastPoint = null;
    state.targetBeamEnd = null;
    canvas.setPointerCapture(event.pointerId);
    updateDrag(event);
    event.preventDefault();
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !isBuildMode() || getTool() !== 'beam') return;

    const componentId = pickComponent?.(event.clientX, event.clientY)
      ?? view.componentInteractionLayer?.pickPointer(event.clientX, event.clientY)
      ?? null;
    if (componentId) return;

    const handle = structuralLayer.pickPointer(event.clientX, event.clientY);
    if (handle) {
      beginDrag(handle, event);
      return;
    }

    const beamHit = view.pickBeamSurface(event.clientX, event.clientY);
    if (beamHit?.beamId) {
      selectBeam(beamHit.beamId);
      event.preventDefault();
      return;
    }

    clearBeamSelection();
  });

  canvas.addEventListener('pointermove', updateDrag);

  const finish = (event) => {
    if (state.pointerId !== event.pointerId || !state.handle) return;

    if (state.lastPoint) {
      if (state.handle.kind === 'move') {
        commitMoveBeamEnd(state.handle.beamId, state.handle.end, state.lastPoint);
      } else {
        commitExtendBeamEnd(
          state.handle.beamId,
          state.handle.end,
          state.lastPoint,
          state.targetBeamEnd,
        );
      }
    }

    view.hideGhost();
    state.handle = null;
    state.pointerId = null;
    state.lastPoint = null;
    state.targetBeamEnd = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return () => {
    canvas.removeEventListener('pointermove', updateDrag);
  };
}
