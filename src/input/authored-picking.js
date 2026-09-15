export function nearestAuthoredHit(beamHit, componentHit) {
  if (!beamHit && !componentHit) return null;
  if (!componentHit) return { kind: 'beam', ...beamHit };
  if (!beamHit) return { kind: 'component', ...componentHit };

  if (componentHit.distance < beamHit.distance) {
    return { kind: 'component', ...componentHit };
  }
  return { kind: 'beam', ...beamHit };
}

export function pickNearestAuthoredPointer(view, componentLayer, clientX, clientY) {
  return nearestAuthoredHit(
    view.pickBeamSurface(clientX, clientY),
    componentLayer.pickPointerHit(clientX, clientY),
  );
}

export function pickNearestAuthoredController(view, componentLayer, controller) {
  return nearestAuthoredHit(
    view.pickBeamSurfaceController(controller),
    componentLayer.pickControllerHit(controller),
  );
}
