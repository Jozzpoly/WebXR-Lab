import * as THREE from 'three';
import { BUILD_Y } from '../view/scene.js';

export function attachDesktopBuilder({ view, getDocument, isBuildMode, commitExtend, getGridEnabled, getTool, pickComponent }) {
  const canvas = view.renderer.domElement;
  const state = { startId: null, lastPoint: null, pointerId: null };

  const snap = (point) => {
    if (!getGridEnabled()) return point;
    const size = 0.25;
    return new THREE.Vector3(
      Math.round(point.x / size) * size,
      BUILD_Y,
      Math.round(point.z / size) * size,
    );
  };

  const update = (event) => {
    if (!state.startId || !isBuildMode() || getTool() !== 'beam') return;
    const point = view.pointOnBuildPlane(event.clientX, event.clientY);
    if (!point) return;
    const snapped = snap(point);
    const doc = getDocument();
    const targetId = view.nearestNode(doc, snapped, 0.16, state.startId);
    const end = targetId
      ? new THREE.Vector3(...doc.nodes.find((node) => node.id === targetId).position)
      : snapped;
    const start = doc.nodes.find((node) => node.id === state.startId)?.position;
    if (!start) return;
    state.lastPoint = end.clone();
    view.showGhost(start, end.toArray(), true);
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !isBuildMode() || getTool() !== 'beam') return;
    const componentId = pickComponent?.(event.clientX, event.clientY)
      ?? view.componentInteractionLayer?.pickPointer(event.clientX, event.clientY)
      ?? null;
    if (componentId) return;
    const startId = view.pickNode(event.clientX, event.clientY);
    if (!startId) return;
    state.startId = startId;
    state.pointerId = event.pointerId;
    state.lastPoint = null;
    canvas.setPointerCapture(event.pointerId);
    update(event);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', update);

  const finish = (event) => {
    if (state.pointerId !== event.pointerId || !state.startId) return;
    const doc = getDocument();
    const point = state.lastPoint;
    if (point) {
      const targetId = view.nearestNode(doc, point, 0.16, state.startId);
      commitExtend(state.startId, point.toArray(), targetId);
    }
    view.hideGhost();
    state.startId = null;
    state.pointerId = null;
    state.lastPoint = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };

  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return () => {
    canvas.removeEventListener('pointermove', update);
  };
}
