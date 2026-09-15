import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const plane = new THREE.Plane();
const worldAnchor = new THREE.Vector3();
const worldHit = new THREE.Vector3();
const planeNormal = new THREE.Vector3();

export function snapMachinePoint(point, size = 0.25) {
  if (!(size > 0)) return point.clone();
  return new THREE.Vector3(
    Math.round(point.x / size) * size,
    Math.round(point.y / size) * size,
    Math.round(point.z / size) * size,
  );
}

export function pointOnCameraFacingMachinePlane(view, clientX, clientY, machineAnchor) {
  const rect = view.renderer.domElement.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, view.camera);

  view.machineToWorldPoint(machineAnchor, worldAnchor);
  view.camera.getWorldDirection(planeNormal).normalize();
  plane.setFromNormalAndCoplanarPoint(planeNormal, worldAnchor);

  if (!raycaster.ray.intersectPlane(plane, worldHit)) return null;
  return view.worldToMachinePoint(worldHit, new THREE.Vector3());
}
