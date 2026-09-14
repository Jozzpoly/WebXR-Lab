import * as THREE from 'three';

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d8f6ff';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export class WorkspaceGrabHandle {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(0, 0.14, 0.58);

    this.railMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f6378,
      emissive: 0x0b2c38,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.55,
    });
    this.rail = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.075, 0.075), this.railMaterial);
    this.rail.castShadow = true;
    this.group.add(this.rail);

    const capGeometry = new THREE.BoxGeometry(0.08, 0.13, 0.13);
    const capMaterial = new THREE.MeshStandardMaterial({ color: 0x6dd9f5, roughness: 0.28, metalness: 0.5 });
    for (const x of [-0.49, 0.49]) {
      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.position.x = x;
      cap.castShadow = true;
      this.group.add(cap);
    }

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.66, 0.12),
      new THREE.MeshBasicMaterial({ map: makeLabel('GRAB WORKSPACE'), transparent: true, depthWrite: false }),
    );
    label.position.set(0, 0.13, 0.045);
    this.group.add(label);
  }

  containsWorldPoint(worldPoint, padding = 0.13) {
    this.group.updateWorldMatrix(true, false);
    const local = this.group.worldToLocal(worldPoint.clone());
    return Math.abs(local.x) <= 0.54 + padding &&
      Math.abs(local.y) <= 0.08 + padding &&
      Math.abs(local.z) <= 0.08 + padding;
  }

  setActive(active) {
    this.railMaterial.color.setHex(active ? 0x36b7d5 : 0x1f6378);
    this.railMaterial.emissive.setHex(active ? 0x17667b : 0x0b2c38);
    this.railMaterial.emissiveIntensity = active ? 1.35 : 0.8;
  }
}
