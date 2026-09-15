import { proposePoweredWheelPlacement } from './wheel-placement.js';

const DRAG_THRESHOLD_PX = 6;

function changesDesktopAuthoringContext(event) {
  if ((event.ctrlKey || event.metaKey) && String(event.key ?? '').toLowerCase() === 'z') return true;
  return ['Space', 'Escape', 'Delete', 'Backspace', 'Digit1', 'Digit2'].includes(event.code);
}

export function attachDesktopComponents({
  view,
  componentLayer,
  getDocument,
  isBuildMode,
  getTool,
  commitPoweredWheel,
  previewPoweredWheel,
  previewPoweredWheelRehost,
  commitPoweredWheelRehost,
  clearPoweredWheelPreview,
  selectComponent,
}) {
  const canvas = view.renderer.domElement;
  let previewCandidate = null;
  let pendingPlacement = null;
  let componentDrag = null;
  const devTrace = {
    pointerMoves: 0,
    lastPointer: null,
    lastBranch: 'idle',
    lastCandidate: null,
  };

  const isDesktopActive = () => !view.renderer.xr.isPresenting;

  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    window.__riftworksDesktopInputEvidence = Object.freeze({
      snapshot: () => ({
        pointerMoves: devTrace.pointerMoves,
        lastPointer: devTrace.lastPointer ? { ...devTrace.lastPointer } : null,
        lastBranch: devTrace.lastBranch,
        lastCandidate: devTrace.lastCandidate ? {
          hostBeamId: devTrace.lastCandidate.hostBeamId,
          mount: {
            position: [...devTrace.lastCandidate.mount.position],
            axis: [...devTrace.lastCandidate.mount.axis],
          },
          motorVelocity: devTrace.lastCandidate.motorVelocity,
        } : null,
        tool: getTool(),
        buildMode: isBuildMode(),
      }),
    });
  }

  const candidateAtPointer = (event) => {
    const hit = view.pickBeamSurface(event.clientX, event.clientY);
    if (!hit) return null;
    return proposePoweredWheelPlacement(
      getDocument(),
      hit.beamId,
      hit.localPosition,
      hit.localNormal,
    );
  };

  const clearPreview = () => {
    previewCandidate = null;
    clearPoweredWheelPreview();
  };

  const clearComponentDrag = () => {
    const pointerId = componentDrag?.pointerId ?? null;
    componentDrag = null;
    clearPoweredWheelPreview();
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const cancelDesktopTransient = () => {
    previewCandidate = null;
    pendingPlacement = null;
    const pointerId = componentDrag?.pointerId ?? null;
    componentDrag = null;
    clearPoweredWheelPreview();
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  };

  const updatePendingPlacement = (event) => {
    if (!pendingPlacement || pendingPlacement.pointerId !== event.pointerId) return false;
    const movement = Math.hypot(event.clientX - pendingPlacement.startX, event.clientY - pendingPlacement.startY);
    if (movement < DRAG_THRESHOLD_PX) return true;
    pendingPlacement = null;
    clearPreview();
    return true;
  };

  const updateComponentDrag = (event) => {
    if (!componentDrag || componentDrag.pointerId !== event.pointerId) return false;
    const movement = Math.hypot(event.clientX - componentDrag.startX, event.clientY - componentDrag.startY);
    if (!componentDrag.active && movement < DRAG_THRESHOLD_PX) return true;

    componentDrag.active = true;
    componentDrag.candidate = candidateAtPointer(event);
    previewPoweredWheelRehost(componentDrag.componentId, componentDrag.candidate);
    return true;
  };

  const onPointerMove = (event) => {
    devTrace.pointerMoves += 1;
    devTrace.lastPointer = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, buttons: event.buttons };
    devTrace.lastCandidate = null;

    if (!isDesktopActive()) {
      devTrace.lastBranch = 'xr-owned';
      return;
    }

    if (updatePendingPlacement(event)) {
      devTrace.lastBranch = pendingPlacement ? 'pending-wheel-click' : 'wheel-click-cancelled-by-drag';
      return;
    }

    if (updateComponentDrag(event)) {
      devTrace.lastBranch = 'component-drag';
      return;
    }

    if (!isBuildMode() || getTool() !== 'powered-wheel') {
      devTrace.lastBranch = 'inactive-tool';
      clearPreview();
      return;
    }

    if (componentLayer.pickPointer(event.clientX, event.clientY)) {
      devTrace.lastBranch = 'existing-component';
      clearPreview();
      return;
    }

    if (previewCandidate && componentLayer.pickPreviewPointer(event.clientX, event.clientY)) {
      devTrace.lastBranch = 'holding-preview';
      devTrace.lastCandidate = previewCandidate;
      return;
    }

    previewCandidate = candidateAtPointer(event);
    devTrace.lastCandidate = previewCandidate;
    devTrace.lastBranch = previewCandidate ? 'beam-candidate' : 'no-beam-candidate';
    previewPoweredWheel(previewCandidate);
  };

  const onPointerDown = (event) => {
    if (!isDesktopActive() || event.button !== 0 || !isBuildMode()) return;

    const componentId = componentLayer.pickPointer(event.clientX, event.clientY);
    if (componentId) {
      clearPreview();
      selectComponent(componentId);
      componentDrag = {
        componentId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        candidate: null,
      };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (getTool() !== 'powered-wheel') return;
    if (!previewCandidate || !componentLayer.pickPreviewPointer(event.clientX, event.clientY)) return;

    pendingPlacement = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      candidate: previewCandidate,
    };
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const finishPendingPlacement = (event, cancelled = false) => {
    if (!pendingPlacement || pendingPlacement.pointerId !== event.pointerId) return false;
    const pending = pendingPlacement;
    const movement = Math.hypot(event.clientX - pending.startX, event.clientY - pending.startY);
    pendingPlacement = null;
    const shouldCommit = !cancelled
      && movement < DRAG_THRESHOLD_PX
      && isBuildMode()
      && getTool() === 'powered-wheel';
    clearPreview();
    if (shouldCommit) commitPoweredWheel(pending.candidate);
    event.preventDefault();
    return true;
  };

  const finishComponentDrag = (event, cancelled = false) => {
    if (!isDesktopActive() || !componentDrag || componentDrag.pointerId !== event.pointerId) return false;
    updateComponentDrag(event);
    const drag = componentDrag;
    if (!cancelled && drag.active && drag.candidate) {
      commitPoweredWheelRehost(drag.componentId, drag.candidate);
    }
    clearComponentDrag();
    event.preventDefault();
    return true;
  };

  const onPointerUp = (event) => {
    if (!isDesktopActive()) return;
    if (finishPendingPlacement(event, false)) return;
    finishComponentDrag(event, false);
  };
  const onPointerCancel = (event) => {
    if (!isDesktopActive()) return;
    if (finishPendingPlacement(event, true)) return;
    finishComponentDrag(event, true);
  };
  const onPointerLeave = () => {
    if (!isDesktopActive()) return;
    if (!componentDrag && !pendingPlacement) clearPreview();
  };
  const onXrSessionStart = () => cancelDesktopTransient();
  const onKeyDown = (event) => {
    if (!isDesktopActive() || !changesDesktopAuthoringContext(event)) return;
    if (previewCandidate || pendingPlacement || componentDrag) cancelDesktopTransient();
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  view.renderer.xr.addEventListener('sessionstart', onXrSessionStart);
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKeyDown);

  return () => {
    cancelDesktopTransient();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    view.renderer.xr.removeEventListener('sessionstart', onXrSessionStart);
    if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeyDown);
  };
}
