import * as THREE from 'three';

const tireGeometry = new THREE.CylinderGeometry(1, 1, 1, 28, 1, false);
const hubGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false);
const proxyGeometry = new THREE.SphereGeometry(1, 12, 8);
const previewMaterial = new THREE.MeshBasicMaterial({ color: 0x6ef0cf, transparent: true, opacity: 0.34, depthWrite: false });
const previewHubMaterial = new THREE.MeshBasicMaterial({ color: 0xb8fff0, transparent: true, opacity: 0.52, depthWrite: false });
const proxyMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const selectionMaterial = new THREE.MeshBasicMaterial({ color: 0x70e9ff, wireframe: true, transparent: true, opacity: 0.72, depthWrite: false });

function createPreviewShape(component) {
  const root = new THREE.Group();
  root.position.set(...component.center);

  const shape = new THREE.Group();
  shape.quaternion.set(...component.colliderRotation);
  root.add(shape);

  const tire = new THREE.Mesh(tireGeometry, previewMaterial);
  tire.scale.set(component.radius, component.width, component.radius);
  shape.add(tire);

  const hub = new THREE.Mesh(hubGeometry, previewHubMaterial);
  hub.scale.set(component.radius * 0.34, component.width * 1.18, component.radius * 0.34);
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
    this.group = new THREE.Group();
    this.view.workspaceRoot.add(this.group);

    this.targets = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.previewRoot = new THREE.Group();
    this.previewRoot.visible = false;
    this.group.add(this.previewRoot);

    this.selection = new THREE.Mesh(proxyGeometry, selectionMaterial);
    this.selection.visible = false;
    this.group.add(this.selection);
  }

  sync(plan) {
    for (const mesh of this.targets.values()) mesh.removeFromParent();
    this.targets.clear();

    for (const component of plan.components ?? []) {
      if (component.kind !== 'powered-wheel') continue;
      const proxy = new THREE.Mesh(proxyGeometry, proxyMaterial);
      proxy.position.set(...component.center);
      const radius = Math.max(component.radius, component.width) + 0.09;
      proxy.scale.setScalar(radius);
      proxy.userData.componentId = component.id;
      proxy.userData.componentRadius = radius;
      this.targets.set(component.id, proxy);
      this.group.add(proxy);
    }
  }

  pickPointer(clientX, clientY) {
    const rect = this.view.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.view.camera);
    const hit = this.raycaster.intersectObjects([...this.targets.values()], false)[0];
    return hit?.object.userData.componentId ?? null;
  }

  pickController(controller) {
    controller.updateWorldMatrix(true, false);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
    this.raycaster.set(origin, direction);
    const hit = this.raycaster.intersectObjects([...this.targets.values()], false)[0];
    return hit?.object.userData.componentId ?? null;
  }

  nearest(localPoint, radius = 0.24) {
    let best = null;
    let bestDistance = radius;
    for (const [id, proxy] of this.targets) {
      const distance = localPoint.distanceTo(proxy.position);
      if (distance <= bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    return best;
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
    this.selection.scale.copy(target.scale).multiplyScalar(1.16);
    this.selection.visible = true;
  }
}
