import { proposePoweredWheelPlacement } from './wheel-placement.js';

const DRAG_THRESHOLD_PX = 6;

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
  let componentDrag = null;

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
    if (updateComponentDrag(event)) return;

    if (!isBuildMode() || getTool() !== 'powered-wheel') {
      clearPreview();
      return;
    }

    if (componentLayer.pickPointer(event.clientX, event.clientY)) {
      clearPreview();
      return;
    }

    if (previewCandidate && componentLayer.pickPreviewPointer(event.clientX, event.clientY)) return;

    previewCandidate = candidateAtPointer(event);
    previewPoweredWheel(previewCandidate);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isBuildMode()) return;

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

    const candidate = previewCandidate;
    clearPreview();
    commitPoweredWheel(candidate);
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const finishComponentDrag = (event, cancelled = false) => {
    if (!componentDrag || componentDrag.pointerId !== event.pointerId) return;
    updateComponentDrag(event);
    const drag = componentDrag;
    if (!cancelled && drag.active && drag.candidate) {
      commitPoweredWheelRehost(drag.componentId, drag.candidate);
    }
    clearComponentDrag();
    event.preventDefault();
  };

  const onPointerLeave = () => {
    if (!componentDrag) clearPreview();
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', (event) => finishComponentDrag(event, false));
  canvas.addEventListener('pointercancel', (event) => finishComponentDrag(event, true));
  canvas.addEventListener('pointerleave', onPointerLeave);
  return () => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  };
}
