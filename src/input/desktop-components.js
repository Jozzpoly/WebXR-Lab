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

  const onPointerMove = (event) => {
    if (!isBuildMode() || getTool() !== 'powered-wheel') {
      clearPoweredWheelPreview();
      return;
    }
    if (componentLayer.pickPointer(event.clientX, event.clientY)) {
      clearPoweredWheelPreview();
      return;
    }
    previewPoweredWheel(candidateAtPointer(event));
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isBuildMode()) return;

    const componentId = componentLayer.pickPointer(event.clientX, event.clientY);
    if (componentId) {
      clearPoweredWheelPreview();
      selectComponent(componentId);
      event.preventDefault();
      return;
    }

    if (getTool() !== 'powered-wheel') return;
    const candidate = candidateAtPointer(event);
    if (!candidate) return;
    clearPoweredWheelPreview();
    commitPoweredWheel(candidate);
    event.preventDefault();
  };

  const onPointerLeave = () => clearPoweredWheelPreview();

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerleave', onPointerLeave);
  return () => {
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  };
}
