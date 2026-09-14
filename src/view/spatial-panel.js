import * as THREE from 'three';

const BUTTON_W = 0.52;
const BUTTON_H = 0.15;
const BUTTON_D = 0.045;

function makeLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f4fbff';
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function makeButton(action, label, y) {
  const group = new THREE.Group();
  group.position.y = y;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(BUTTON_W, BUTTON_H, BUTTON_D),
    new THREE.MeshStandardMaterial({ color: 0x183040, roughness: 0.42, metalness: 0.24 }),
  );
  hit.userData.spatialAction = action;
  hit.userData.baseColor = 0x183040;
  hit.castShadow = true;
  group.add(hit);

  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W * 0.88, BUTTON_H * 0.68),
    new THREE.MeshBasicMaterial({ map: makeLabel(label), transparent: true, depthWrite: false }),
  );
  labelMesh.position.z = BUTTON_D * 0.5 + 0.002;
  group.add(labelMesh);

  return { group, hit, labelMesh };
}

export class SpatialToolPanel {
  constructor() {
    this.group = new THREE.Group();
    this.group.position.set(-1.05, 0.66, 0.08);

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.82, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0b1720, roughness: 0.55, metalness: 0.28 }),
    );
    back.position.z = -0.045;
    back.castShadow = true;
    this.group.add(back);

    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.11),
      new THREE.MeshBasicMaterial({ map: makeLabel('RIFTWORKS'), transparent: true, depthWrite: false }),
    );
    title.position.set(0, 0.32, 0.005);
    this.group.add(title);

    this.buttons = new Map();
    const definitions = [
      ['beam', 'BEAM', 0.16],
      ['powered-wheel', 'WHEEL', -0.02],
      ['run-toggle', 'RUN', -0.20],
      ['undo', 'UNDO', -0.38],
    ];
    for (const [action, label, y] of definitions) {
      const button = makeButton(action, label, y);
      this.buttons.set(action, button);
      this.group.add(button.group);
    }

    this.hovered = null;
  }

  getHitTargets() {
    return [...this.buttons.values()].map((button) => button.hit);
  }

  setHover(action) {
    this.hovered = action;
    this.#refreshMaterials();
  }

  setState({ tool, mode, canUndo }) {
    this.tool = tool;
    this.mode = mode;
    this.canUndo = canUndo;

    const runButton = this.buttons.get('run-toggle');
    const desired = mode === 'run' ? 'STOP' : 'RUN';
    if (runButton.currentLabel !== desired) {
      runButton.currentLabel = desired;
      runButton.labelMesh.material.map.dispose();
      runButton.labelMesh.material.map = makeLabel(desired);
      runButton.labelMesh.material.needsUpdate = true;
    }
    this.#refreshMaterials();
  }

  #refreshMaterials() {
    for (const [action, button] of this.buttons) {
      const activeTool = action === this.tool;
      const hovered = action === this.hovered;
      const disabled = action === 'undo' && !this.canUndo;
      let color = 0x183040;
      if (disabled) color = 0x11171b;
      else if (activeTool) color = 0x176d86;
      else if (action === 'run-toggle' && this.mode === 'run') color = 0x8a3e24;
      else if (hovered) color = 0x245f72;
      button.hit.material.color.setHex(color);
      button.hit.material.emissive.setHex(activeTool || hovered ? 0x0b2630 : 0x000000);
      button.hit.material.emissiveIntensity = activeTool || hovered ? 0.75 : 0;
    }
  }
}
