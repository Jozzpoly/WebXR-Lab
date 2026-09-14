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

function makeButton(y) {
  const group = new THREE.Group();
  group.position.y = y;

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(BUTTON_W, BUTTON_H, BUTTON_D),
    new THREE.MeshStandardMaterial({ color: 0x183040, roughness: 0.42, metalness: 0.24 }),
  );
  hit.castShadow = true;
  group.add(hit);

  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(BUTTON_W * 0.88, BUTTON_H * 0.68),
    new THREE.MeshBasicMaterial({ map: makeLabel(''), transparent: true, depthWrite: false }),
  );
  labelMesh.position.z = BUTTON_D * 0.5 + 0.002;
  group.add(labelMesh);

  return { group, hit, labelMesh, action: null, label: null };
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

    this.titleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.56, 0.11),
      new THREE.MeshBasicMaterial({ map: makeLabel('RIFTWORKS'), transparent: true, depthWrite: false }),
    );
    this.titleMesh.position.set(0, 0.32, 0.005);
    this.group.add(this.titleMesh);

    this.slots = [0.16, -0.02, -0.20, -0.38].map((y) => {
      const slot = makeButton(y);
      this.group.add(slot.group);
      return slot;
    });

    this.hovered = null;
    this.setState({ tool: 'beam', mode: 'build', canUndo: false, selectedComponentId: null });
  }

  getHitTargets() {
    return this.slots.map((slot) => slot.hit);
  }

  getActionWorldPosition(action, target = new THREE.Vector3()) {
    const slot = this.slots.find((candidate) => candidate.action === action);
    if (!slot) return null;
    slot.hit.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(slot.hit.matrixWorld);
  }

  setHover(action) {
    this.hovered = action;
    this.#refreshMaterials();
  }

  setState({ tool, mode, canUndo, selectedComponentId = null }) {
    this.tool = tool;
    this.mode = mode;
    this.canUndo = canUndo;
    this.selectedComponentId = selectedComponentId;

    const editMode = mode === 'build' && Boolean(selectedComponentId);
    const definitions = editMode
      ? [
          ['wheel-flip', 'FLIP SIDE'],
          ['wheel-reverse', 'REVERSE'],
          ['wheel-delete', 'DELETE'],
          ['wheel-done', 'DONE'],
        ]
      : [
          ['beam', 'BEAM'],
          ['powered-wheel', 'WHEEL'],
          ['run-toggle', mode === 'run' ? 'STOP' : 'RUN'],
          ['undo', 'UNDO'],
        ];

    definitions.forEach(([slotAction, label], index) => this.#setSlot(this.slots[index], slotAction, label));
    this.#setTitle(editMode ? `WHEEL ${selectedComponentId}` : 'RIFTWORKS');
    this.#refreshMaterials();
  }

  #setTitle(label) {
    if (this.titleLabel === label) return;
    this.titleLabel = label;
    this.titleMesh.material.map.dispose();
    this.titleMesh.material.map = makeLabel(label);
    this.titleMesh.material.needsUpdate = true;
  }

  #setSlot(slot, action, label) {
    slot.action = action;
    slot.hit.userData.spatialAction = action;
    if (slot.label === label) return;
    slot.label = label;
    slot.labelMesh.material.map.dispose();
    slot.labelMesh.material.map = makeLabel(label);
    slot.labelMesh.material.needsUpdate = true;
  }

  #refreshMaterials() {
    for (const slot of this.slots) {
      const action = slot.action;
      const activeTool = action === this.tool;
      const hovered = action === this.hovered;
      const disabled = action === 'undo' && !this.canUndo;
      let color = 0x183040;
      if (disabled) color = 0x11171b;
      else if (action === 'wheel-delete') color = hovered ? 0x8f3f35 : 0x5b2a28;
      else if (activeTool) color = 0x176d86;
      else if (action === 'run-toggle' && this.mode === 'run') color = 0x8a3e24;
      else if (action === 'wheel-done') color = hovered ? 0x26715f : 0x1d594d;
      else if (hovered) color = 0x245f72;
      slot.hit.material.color.setHex(color);
      slot.hit.material.emissive.setHex(activeTool || hovered ? 0x0b2630 : 0x000000);
      slot.hit.material.emissiveIntensity = activeTool || hovered ? 0.75 : 0;
    }
  }
}
