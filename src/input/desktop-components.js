export function attachDesktopComponents({
  view,
  componentLayer,
  isBuildMode,
  getTool,
  commitPoweredWheel,
  previewPoweredWheel,
  clearPoweredWheelPreview,
  selectComponent,
}) {
  const canvas = view.renderer.domElement;

  const onPointerMove = (event) => {
    if (!isBuildMode() || getTool() !== 'powered-wheel') {
      clearPoweredWheelPreview();
      return;
    }
    if (componentLayer.pickPointer(event.clientX, event.clientY)) {
      clearPoweredWheelPreview();
      return;
    }
    const nodeId = view.pickNode(event.clientX, event.clientY);
    previewPoweredWheel(nodeId);
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
    const nodeId = view.pickNode(event.clientX, event.clientY);
    if (!nodeId) return;
    clearPoweredWheelPreview();
    commitPoweredWheel(nodeId);
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
