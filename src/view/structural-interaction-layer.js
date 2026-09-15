import * as THREE from 'three';

const selectionGeometry = new THREE.BoxGeometry(1, 1, 1);
const moveGeometry = new THREE.SphereGeometry(0.055, 16, 10);
const extendGeometry = new THREE.OctahedronGeometry(0.055, 0);

const selectionMaterial = new THREE.MeshBasicMaterial({
  color: 0x70e9ff,
  wireframe: true,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});
const moveMaterial = new THREE.MeshStandardMaterial({
  color: 0xe8f7ff,
  emissive: 0x2e91b8,
  emissiveIntensity: 0.35,
  roughness: 0.24,
  metalness: 0.18,
});
const extendMaterial = new THREE.MeshStandardMaterial({
  color: 0x7ef2c2,
  emissive: 0x17634f,
  emissiveIntensity: 0.55,
  roughness: 0.28,
  metalness: 0.12,
});

const sub = (a, b) => new THREE.Vector3(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export class StructuralInteractionLayer {
  constructor(view) {
    this.view = view;
    this.group = new THREE.Group();
    this.view.workspaceRoot.add(this.group);

    this.selection = new THREE.Mesh(selectionGeometry, selectionMaterial);
    this.selection.visible = false;
    this.group.add(this.selection);

    this.handles = new THREE.Group();
    this.group.add(this.handles);
    this.targets = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.selectedBeamId = null;
  }

  sync(document, plan, selectedBeamId, enabled = true) {
    this.handles.clear();
    this.targets = [];
    this.selectedBeamId = enabled ? selectedBeamId : null;

    if (!this.selectedBeamId) {
      this.selection.visible = false;
      return;
    }

    const authored = document.beams.find((beam) => beam.id === this.selectedBeamId);
    const compiled = plan.islands.flatMap((island) => island.beams).find((beam) => beam.id === this.selectedBeamId);
    if (!authored || !compiled) {
      this.selection.visible = false;
      this.selectedBeamId = null;
      return;
    }

    this.selection.position.set(...compiled.machinePosition);
    this.selection.quaternion.set(...compiled.machineRotation);
    this.selection.scale.set(
      compiled.length + 0.035,
      compiled.thickness + 0.035,
      compiled.thickness + 0.035,
    );
    this.selection.visible = true;

    const nodes = new Map(document.nodes.map((node) => [node.id, node.position]));
    for (const end of ['a', 'b']) {
      const position = nodes.get(authored[end]);
      const opposite = nodes.get(authored[end === 'a' ? 'b' : 'a']);
      if (!position || !opposite) continue;

      const outward = sub(position, opposite).normalize();
      const move = new THREE.Mesh(moveGeometry, moveMaterial);
      move.position.set(...position);
      move.userData.structuralHandle = { kind: 'move', beamId: authored.id, end };
      this.handles.add(move);
      this.targets.push(move);

      const extend = new THREE.Mesh(extendGeometry, extendMaterial);
      extend.position.set(...position).addScaledVector(outward, Math.max(0.12, authored.thickness * 1.15));
      extend.rotation.set(Math.PI * 0.25, Math.PI * 0.25, 0);
      extend.userData.structuralHandle = { kind: 'extend', beamId: authored.id, end };
      this.handles.add(extend);
      this.targets.push(extend);
    }
  }

  #setPointer(clientX, clientY) {
    const rect = this.view.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.view.camera);
  }

  pickPointer(clientX, clientY) {
    this.#setPointer(clientX, clientY);
    const hit = this.raycaster.intersectObjects(this.targets, false)[0];
    return hit?.object.userData.structuralHandle ?? null;
  }

  pickController(controller) {
    controller.updateWorldMatrix(true, false);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
    this.raycaster.set(origin, direction);
    const hit = this.raycaster.intersectObjects(this.targets, false)[0];
    return hit?.object.userData.structuralHandle ?? null;
  }

  nearest(localPoint, radius = 0.13) {
    let best = null;
    let bestDistance = radius;
    for (const target of this.targets) {
      const distance = localPoint.distanceTo(target.position);
      if (distance <= bestDistance) {
        best = target.userData.structuralHandle;
        bestDistance = distance;
      }
    }
    return best;
  }

  getHandleLocalPosition(handle, target = new THREE.Vector3()) {
    const mesh = this.targets.find((candidate) => {
      const data = candidate.userData.structuralHandle;
      return data?.kind === handle?.kind && data?.beamId === handle?.beamId && data?.end === handle?.end;
    });
    return mesh ? target.copy(mesh.position) : null;
  }
}
