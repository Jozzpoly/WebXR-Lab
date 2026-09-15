import { proposePoweredWheelPlacement } from './wheel-placement.js';

export function attachDesktopComponents({
  view,
  componentLayer,
  getDocument,
  isBuildMode,
  getTool,
  commitPoweredWheel,
  previewPoweredWheel,
  clearPoweredWheelPreview,
  selectComponent,
}) {
  const canvas = view.renderer.domElement;
  let previewCandidate = null;

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

  const onPointerMove = (event) => {
    if (!isBuildMode() || getTool() !== 'powered-wheel') {
      clearPreview();
      return;
    }

    if (componentLayer.pickPointer(event.clientX, event.clientY)) {
      clearPreview();
      return;
    }

    if (previewCandidate && componentLayer.pickPreviewPointer(event.clientX, event.clientY)) {
      return;
    }

    previewCandidate = candidateAtPointer(event);
    previewPoweredWheel(previewCandidate);
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isBuildMode()) return;

    const componentId = componentLayer.pickPointer(event.clientX, event.clientY);
    if (componentId) {
      clearPreview();
      selectComponent(componentId);
      event.preventDefault();
      return;
    }

    if (getTool() !== 'powered-wheel') return;
    if (!previewCandidate || !componentLayer.pickPreviewPointer(event.clientX, event.clientY)) return;

    const candidate = previewCandidate;
    clearPreview();
    commitPoweredWheel(candidate);
    event.preventDefault();
  };

  const onPointerLeave = () => clearPreview();

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerleave', onPointerLeave);
  return () => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  };
}
