import * as THREE from 'three';
import { beamLocalToMachinePoint, getBeamFrame } from '../core/beam-frame.js';
import { MIN_BEAM_LENGTH } from '../core/machine-document.js';
import { nearestAuthoredHit } from './authored-picking.js';
import { pointOnCameraFacingMachinePlane, snapMachinePoint } from './desktop-spatial-drag.js';
import { beamEndPosition, nearestBeamEnd } from './structural-placement.js';

const DIRECT_ISLAND_DRAG_THRESHOLD_PX = 6;

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
  previewStructuralIslandTranslation = () => {},
  clearStructuralIslandTranslationPreview = () => {},
  commitStructuralIslandTranslation = () => {},
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
  const snapDelta = (delta) => getGridEnabled() ? snapMachinePoint(delta, 0.25) : delta.clone();

  const clearState = (pointerId = state.pointerId) => {
    view.hideGhost();
    clearStructuralIslandTranslationPreview();
    state.operation = null;
    state.pointerId = null;
    state.dragAnchor = null;
    state.startPoint = null;
    state.startTargetBeamEnd = null;
    state.lastPoint = null;
    state.targetBeamEnd = null;
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const updateIslandDrag = (event) => {
    const operation = state.operation;
    if (operation?.kind !== 'island-move' || !state.dragAnchor || !state.startPoint) return false;

    const movement = Math.hypot(event.clientX - operation.startX, event.clientY - operation.startY);
    if (!operation.active && movement < DIRECT_ISLAND_DRAG_THRESHOLD_PX) return true;
    if (!operation.active) {
      operation.active = true;
      if (operation.selectionPending) {
        selectBeam(operation.beamId);
        operation.selectionPending = false;
      }
    }

    const point = pointOnCameraFacingMachinePlane(
      view,
      event.clientX,
      event.clientY,
      new THREE.Vector3(...state.dragAnchor),
    );
    if (!point) return true;

    const delta = snapDelta(point.sub(new THREE.Vector3(...state.startPoint)));
    const nextDelta = delta.toArray();
    if (state.lastPoint?.every((value, index) => value === nextDelta[index])) return true;
    state.lastPoint = nextDelta;
    previewStructuralIslandTranslation(operation.beamId, nextDelta);
    return true;
  };

  const updateDrag = (event) => {
    if (!isDesktopActive() || !state.operation || !state.dragAnchor || !isBuildMode()) return;
    if (state.operation.kind === 'island-move') {
      updateIslandDrag(event);
      return;
    }
    if (getTool() !== 'beam') return;

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

  const beginIslandDrag = (hit, event, { selectionPending = false } = {}) => {
    const frame = getBeamFrame(getDocument(), hit.beamId);
    const grabPoint = beamLocalToMachinePoint(frame, hit.localPosition);
    state.operation = {
      kind: 'island-move',
      beamId: hit.beamId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      selectionPending,
    };
    state.pointerId = event.pointerId;
    state.dragAnchor = [...grabPoint];
    state.startPoint = [...grabPoint];
    state.lastPoint = [0, 0, 0];
    state.targetBeamEnd = null;
    canvas.setPointerCapture(event.pointerId);
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
    const previewHit = getTool() === 'powered-wheel'
      && Boolean(componentLayer?.pickPreviewPointer(event.clientX, event.clientY));

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
      if (!previewHit) selectBeam(authoredHit.beamId);
      beginIslandDrag(authoredHit, event, { selectionPending: previewHit });
      event.preventDefault();
      if (!previewHit) event.stopImmediatePropagation();
      return;
    }

    if (getTool() !== 'beam') return;
    const point = view.pointOnBuildPlane(event.clientX, event.clientY);
    if (point) beginFreeCreate(point, event);
  };

  const finish = (event, cancelled = false) => {
    if (!isDesktopActive() || state.pointerId !== event.pointerId || !state.operation) return;

    if (state.operation.kind === 'island-move') {
      const operation = state.operation;
      const delta = state.lastPoint ? [...state.lastPoint] : [0, 0, 0];
      clearStructuralIslandTranslationPreview();
      const shouldCommit = !cancelled
        && operation.active
        && delta.some((value) => Math.abs(value) > 1e-9);
      clearState(event.pointerId);
      if (shouldCommit) commitStructuralIslandTranslation(operation.beamId, delta);
      return;
    }

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
