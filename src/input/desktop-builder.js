import * as THREE from 'three';
import { MIN_BEAM_LENGTH } from '../core/machine-document.js';
import { nearestAuthoredHit } from './authored-picking.js';
import { pointOnCameraFacingMachinePlane, snapMachinePoint } from './desktop-spatial-drag.js';
import { beamEndPosition, nearestBeamEnd } from './structural-placement.js';

export function attachDesktopBuilder({
  view,
  structuralLayer,
  getDocument,
  isBuildMode,
  getGridEnabled,
  getTool,
  selectBeam,
  commitCreateBeam,
  commitMoveBeamEnd,
  commitExtendBeamEnd,
}) {
  const canvas = view.renderer.domElement;
  const state = {
    operation: null,
    pointerId: null,
    dragAnchor: null,
    startPoint: null,
    startTargetBeamEnd: null,
    lastPoint: null,
    targetBeamEnd: null,
  };

  const isDesktopActive = () => !view.renderer.xr.isPresenting;
  const snap = (point) => getGridEnabled() ? snapMachinePoint(point, 0.25) : point.clone();

  const clearState = (pointerId = state.pointerId) => {
    view.hideGhost();
    state.operation = null;
    state.pointerId = null;
    state.dragAnchor = null;
    state.startPoint = null;
    state.startTargetBeamEnd = null;
    state.lastPoint = null;
    state.targetBeamEnd = null;
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const updateDrag = (event) => {
    if (!isDesktopActive() || !state.operation || !state.dragAnchor || !isBuildMode() || getTool() !== 'beam') return;
    const point = pointOnCameraFacingMachinePlane(
      view,
      event.clientX,
      event.clientY,
      new THREE.Vector3(...state.dragAnchor),
    );
    if (!point) return;

    const doc = getDocument();
    const snapped = snap(point);
    state.targetBeamEnd = null;
    let end = snapped.toArray();

    if (state.operation.kind === 'create') {
      const target = nearestBeamEnd(doc, end, 0.16, state.startTargetBeamEnd);
      if (target) {
        state.targetBeamEnd = { beamId: target.beamId, end: target.end };
        end = target.position;
      }
      const start = state.startPoint;
      const length = Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
      state.lastPoint = [...end];
      view.showGhost(start, end, length >= MIN_BEAM_LENGTH);
      return;
    }

    const handle = state.operation.handle;
    const start = beamEndPosition(doc, handle.beamId, handle.end);
    const opposite = beamEndPosition(doc, handle.beamId, handle.end === 'a' ? 'b' : 'a');
    if (!start || !opposite) return;

    if (handle.kind === 'extend') {
      const target = nearestBeamEnd(doc, end, 0.16, {
        beamId: handle.beamId,
        end: handle.end,
      });
      if (target) {
        state.targetBeamEnd = { beamId: target.beamId, end: target.end };
        end = target.position;
      }
    }

    const previewStart = handle.kind === 'move' ? opposite : start;
    const length = Math.hypot(
      end[0] - previewStart[0],
      end[1] - previewStart[1],
      end[2] - previewStart[2],
    );
    state.lastPoint = [...end];
    view.showGhost(previewStart, end, length >= MIN_BEAM_LENGTH);
  };

  const beginHandleDrag = (handle, event) => {
    const anchor = beamEndPosition(getDocument(), handle.beamId, handle.end);
    if (!anchor) return;
    state.operation = { kind: 'handle', handle };
    state.pointerId = event.pointerId;
    state.dragAnchor = [...anchor];
    state.lastPoint = null;
    state.targetBeamEnd = null;
    canvas.setPointerCapture(event.pointerId);
    updateDrag(event);
    event.preventDefault();
  };

  const beginFreeCreate = (point, event) => {
    const doc = getDocument();
    const snapped = snap(point);
    const target = nearestBeamEnd(doc, snapped.toArray(), 0.16);
    state.startTargetBeamEnd = target ? { beamId: target.beamId, end: target.end } : null;
    state.startPoint = target ? [...target.position] : snapped.toArray();
    state.dragAnchor = [...state.startPoint];
    state.operation = { kind: 'create' };
    state.pointerId = event.pointerId;
    state.lastPoint = [...state.startPoint];
    state.targetBeamEnd = null;
    canvas.setPointerCapture(event.pointerId);
    view.showGhost(state.startPoint, state.startPoint, false);
    event.preventDefault();
  };

  const onPointerDown = (event) => {
    if (!isDesktopActive() || event.button !== 0 || !isBuildMode()) return;

    const componentLayer = view.componentInteractionLayer;
    if (getTool() === 'powered-wheel' && componentLayer?.pickPreviewPointer(event.clientX, event.clientY)) return;

    if (getTool() === 'beam') {
      const handle = structuralLayer.pickPointer(event.clientX, event.clientY);
      if (handle) {
        beginHandleDrag(handle, event);
        event.stopImmediatePropagation();
        return;
      }
    }

    const authoredHit = nearestAuthoredHit(
      view.pickBeamSurface(event.clientX, event.clientY),
      componentLayer?.pickPointerHit(event.clientX, event.clientY) ?? null,
    );

    if (authoredHit?.kind === 'component') return;

    if (authoredHit?.kind === 'beam') {
      selectBeam(authoredHit.beamId);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (getTool() !== 'beam') return;
    const point = view.pointOnBuildPlane(event.clientX, event.clientY);
    if (point) beginFreeCreate(point, event);
  };

  const finish = (event, cancelled = false) => {
    if (!isDesktopActive() || state.pointerId !== event.pointerId || !state.operation) return;

    if (!cancelled && state.lastPoint) {
      if (state.operation.kind === 'create') {
        commitCreateBeam(
          state.startPoint,
          state.lastPoint,
          state.startTargetBeamEnd,
          state.targetBeamEnd,
        );
      } else {
        const handle = state.operation.handle;
        if (handle.kind === 'move') {
          commitMoveBeamEnd(handle.beamId, handle.end, state.lastPoint);
        } else {
          commitExtendBeamEnd(
            handle.beamId,
            handle.end,
            state.lastPoint,
            state.targetBeamEnd,
          );
        }
      }
    }

    clearState(event.pointerId);
  };

  const onPointerUp = (event) => finish(event, false);
  const onPointerCancel = (event) => finish(event, true);
  const onContextMenu = (event) => event.preventDefault();
  const onXrSessionStart = () => clearState();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', updateDrag);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('contextmenu', onContextMenu);
  view.renderer.xr.addEventListener('sessionstart', onXrSessionStart);

  return () => {
    clearState();
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', updateDrag);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('contextmenu', onContextMenu);
    view.renderer.xr.removeEventListener('sessionstart', onXrSessionStart);
  };
}
