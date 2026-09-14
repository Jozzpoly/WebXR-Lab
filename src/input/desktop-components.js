export function attachDesktopComponents({ view, isBuildMode, getTool, commitPoweredWheel }) {
  const canvas = view.renderer.domElement;

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isBuildMode() || getTool() !== 'powered-wheel') return;
    const nodeId = view.pickNode(event.clientX, event.clientY);
    if (!nodeId) return;
    commitPoweredWheel(nodeId);
    event.preventDefault();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  return () => canvas.removeEventListener('pointerdown', onPointerDown);
}
