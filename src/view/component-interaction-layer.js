import * as THREE from 'three';

const tireGeometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
const hubGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false);
const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x6ef0cf, transparent: true, opacity: 0.34, depthWrite: false });
const previewHubMaterial = new THREE.MeshBasicMaterial({ color: 0xb8fff0, transparent: true, opacity: 0.52, depthWrite: false });
const proxyMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const selectionMaterial = new THREE.MeshBasicMaterial({
  color: 0x70e9ff,
  wireframe: true,
  transparent: true,
  opacity: 0.72,
  depthWrite: false,
  depthTest: false,
});

function createPreviewShape(component) {
  const root = new THREE.Group();
  root.position.set(...component.center);

  const shape = new THREE.Group();
  shape.quaternion.set(...component.colliderRotation);
  root.add(shape);

  const tire = new THREE.Mesh(tireGeometry, previewMaterial);
  tire.scale.set(component.radius, component.width, component.radius);
  tire.userData.wheelPreviewTarget = true;
  shape.add(tire);

  const hub = new THREE.Mesh(hubGeometry, previewHubMaterial);
  hub.scale.set(component.radius * 0.34, component.width * 1.18, component.radius * 0.34);
  hub.userData.wheelPreviewTarget = true;
  shape.add(hub);

  const axis = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -component.width - 0.16, 0),
    component.width * 2 + 0.32,
    0x66dcff,
    0.06,
    0.035,
  );
  shape.add(axis);

  const sign = component.motorVelocity >= 0 ? -1 : 1;
  const motor = new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, sign),
    new THREE.Vector3(component.radius * 0.78, component.width * 0.62, 0),
    Math.max(0.15, component.radius * 0.72),
    0xffb14f,
    0.07,
    0.045,
  );
  shape.add(motor);

  return root;
}

export class ComponentInteractionLayer {
  constructor(view) {
    this.view = view;
    this.view.componentInteractionLayer = this;
    this.group = new THREE.Group();
    this.view.machineAuthoringRoot.add(this.group);

    this.targets = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.previewRoot = new THREE.Group();
    this.previewRoot.visible = false;
    this.group.add(this.previewRoot);

    this.selection = new THREE.Mesh(tireGeometry, selectionMaterial);
    this.selection.visible = false;
    this.selection.renderOrder = 30;
    this.group.add(this.selection);
  }

  sync(plan) {
    for (const mesh of this.targets.values()) mesh.removeFromParent();
    this.targets.clear();

    for (const component of plan.components ?? []) {
      if (component.kind !== 'powered-wheel') continue;
      const proxy = new THREE.Mesh(tireGeometry, proxyMaterial);
      proxy.position.set(...component.center);
      proxy.quaternion.set(...component.colliderRotation);
      proxy.scale.set(component.radius * 1.05, component.width * 1.2, component.radius * 1.05);
      proxy.userData.componentId = component.id;
      proxy.userData.componentRadius = Math.max(component.radius, component.width) + 0.09;
      this.targets.set(component.id, proxy);
      this.group.add(proxy);
    }
  }

  #pointerRay(clientX, clientY) {
    const rect = this.view.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.view.camera);
  }

  pickPointerHit(clientX, clientY) {
    this.#pointerRay(clientX, clientY);
    const hit = this.raycaster.intersectObjects([...this.targets.values()], false)[0];
    return hit ? { componentId: hit.object.userData.componentId, distance: hit.distance } : null;
  }

  pickPointer(clientX, clientY) {
    return this.pickPointerHit(clientX, clientY)?.componentId ?? null;
  }

  pickPreviewPointer(clientX, clientY) {
    if (!this.previewRoot.visible) return false;
    this.previewRoot.updateWorldMatrix(true, true);
    this.#pointerRay(clientX, clientY);
    const hits = this.raycaster.intersectObject(this.previewRoot, true);
    return hits.some((hit) => hit.object.userData.wheelPreviewTarget === true);
  }

  pickControllerHit(controller) {
    controller.updateWorldMatrix(true, false);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
    this.raycaster.set(origin, direction);
    const hit = this.raycaster.intersectObjects([...this.targets.values()], false)[0];
    return hit ? { componentId: hit.object.userData.componentId, distance: hit.distance } : null;
  }

  pickController(controller) {
    return this.pickControllerHit(controller)?.componentId ?? null;
  }

  nearest(machinePoint, minimumRadius = 0.24) {
    let best = null;
    let bestDistance = Infinity;
    for (const [id, proxy] of this.targets) {
      const reach = Math.max(minimumRadius, proxy.userData.componentRadius ?? 0);
      const distance = machinePoint.distanceTo(proxy.position);
      if (distance <= reach && distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
  }

  getWorldPosition(componentId, target = new THREE.Vector3()) {
    const proxy = this.targets.get(componentId);
    if (!proxy) return null;
    proxy.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(proxy.matrixWorld);
  }

  hasPreview() {
    return this.previewRoot.visible && this.previewRoot.children.length > 0;
  }

  showPreview(component) {
    this.previewRoot.clear();
    if (!component) {
      this.previewRoot.visible = false;
      return;
    }
    this.previewRoot.add(createPreviewShape(component));
    this.previewRoot.visible = true;
  }

  hidePreview() {
    this.previewRoot.visible = false;
    this.previewRoot.clear();
  }

  setSelected(componentId) {
    const target = componentId ? this.targets.get(componentId) : null;
    if (!target) {
      this.selection.visible = false;
      return;
    }
    this.selection.position.copy(target.position);
    this.selection.quaternion.copy(target.quaternion);
    this.selection.scale.copy(target.scale).multiplyScalar(1.08);
    this.selection.visible = true;
  }
}
