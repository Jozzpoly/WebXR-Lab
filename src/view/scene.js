import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MACHINE_YARD_WORLD, resolveRunSpawn, surfaceTop, transformPoint } from '../runtime/machine-yard-world.js';
import { MACHINE_PRESENTATION_OFFSET, WORKSPACE_WORLD_POSITION } from './authoring-space.js';
import { SpatialToolPanel } from './spatial-panel.js';

const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
const authoredBeamMaterial = new THREE.MeshStandardMaterial({ color: 0x3d93b5, roughness: 0.32, metalness: 0.46 });
const runtimeBeamMaterial = new THREE.MeshStandardMaterial({ color: 0x8b9ca8, roughness: 0.4, metalness: 0.36 });
const wheelGeometry = new THREE.CylinderGeometry(1, 1, 1, 32, 1, false);
const hubGeometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1, false);
const axisGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);
const wheelMarkerGeometry = new THREE.SphereGeometry(0.045, 12, 8);
const authoredWheelMaterial = new THREE.MeshStandardMaterial({ color: 0x34586b, roughness: 0.52, metalness: 0.28 });
const runtimeWheelMaterial = new THREE.MeshStandardMaterial({ color: 0x242c33, roughness: 0.76, metalness: 0.04 });
const hubMaterial = new THREE.MeshStandardMaterial({ color: 0x9cabb4, roughness: 0.28, metalness: 0.7 });
const axisMaterial = new THREE.MeshBasicMaterial({ color: 0x62dcff, transparent: true, opacity: 0.9 });
const wheelMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd45a });
const motorArrowColor = 0xffb14f;
const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x7ef2c2, transparent: true, opacity: 0.62, depthWrite: false });

function fitBeam(mesh, a, b, thickness) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const len = delta.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
  mesh.scale.set(len, thickness, thickness);
}

function createWheelShape(component, material, showIntent = false) {
  const shape = new THREE.Group();
  shape.quaternion.set(...component.colliderRotation);

  const tire = new THREE.Mesh(wheelGeometry, material);
  tire.scale.set(component.radius, component.width, component.radius);
  tire.castShadow = true;
  tire.receiveShadow = true;
  shape.add(tire);

  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.scale.set(component.radius * 0.34, component.width * 1.16, component.radius * 0.34);
  hub.castShadow = true;
  shape.add(hub);

  const marker = new THREE.Mesh(wheelMarkerGeometry, wheelMarkerMaterial);
  marker.position.set(component.radius * 0.68, component.width * 0.56, 0);
  shape.add(marker);

  if (showIntent) {
    const axis = new THREE.Mesh(axisGeometry, axisMaterial);
    axis.scale.set(0.014, component.width + 0.26, 0.014);
    shape.add(axis);

    const sign = component.motorVelocity >= 0 ? -1 : 1;
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, sign),
      new THREE.Vector3(component.radius * 0.78, component.width * 0.65, 0),
      Math.max(0.15, component.radius * 0.72),
      motorArrowColor,
      0.07,
      0.045,
    );
    shape.add(arrow);
  }
  return shape;
}

export class RiftworksScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071019);
    this.scene.fog = new THREE.Fog(0x071019, 9, 20);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.03, 50);
    this.camera.position.set(2.45, 2.15, 2.45);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.08, -0.78);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.mouseButtons.LEFT = null;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.minDistance = 1.05;
    this.controls.maxDistance = 8;

    this.workspaceRoot = new THREE.Group();
    this.workspaceRoot.position.set(...WORKSPACE_WORLD_POSITION);
    this.scene.add(this.workspaceRoot);

    this.workspaceVisualGroup = new THREE.Group();
    this.workspaceRoot.add(this.workspaceVisualGroup);

    this.machineAuthoringRoot = new THREE.Group();
    this.machineAuthoringRoot.position.set(...MACHINE_PRESENTATION_OFFSET);
    this.workspaceRoot.add(this.machineAuthoringRoot);

    this.authoredGroup = new THREE.Group();
    this.runtimeGroup = new THREE.Group();
    this.machineAuthoringRoot.add(this.authoredGroup);
    this.scene.add(this.runtimeGroup);
    this.runtimeGroup.visible = false;

    this.beamMeshes = new Map();
    this.runtimeRoots = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.buildPlane = new THREE.Plane();
    this.tempPoint = new THREE.Vector3();
    this.tempPoint2 = new THREE.Vector3();
    this.tempNormal = new THREE.Vector3();
    this.runFocusWorld = new THREE.Vector3();
    this.runFocusCount = 0;
    this.followRun = true;
    this.mode = 'build';

    this.ghostBeam = new THREE.Mesh(beamGeometry, ghostMaterial);
    this.ghostBeam.visible = false;
    this.machineAuthoringRoot.add(this.ghostBeam);

    this.spatialPanel = new SpatialToolPanel();
    this.spatialPanel.group.visible = false;
    this.workspaceRoot.add(this.spatialPanel.group);

    this.#buildEnvironment();
    this.#buildWorkspace();
    this.#resize();
    window.addEventListener('resize', () => this.#resize());
  }

  #buildEnvironment() {
    const hemi = new THREE.HemisphereLight(0xbde6ff, 0x111921, 1.65);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.9);
    key.position.set(3.8, 6.5, 2.8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    this.scene.add(key);

    const fill = new THREE.PointLight(0x52bce9, 12, 7, 2);
    fill.position.set(-3, 2.4, 0.4);
    this.scene.add(fill);

    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111a22, roughness: 0.92, metalness: 0.02 });
    for (const surface of MACHINE_YARD_WORLD.surfaces) {
      if (!surface.visible || surface.shape !== 'box') continue;
      const geometry = new THREE.BoxGeometry(
        surface.halfExtents[0] * 2,
        surface.halfExtents[1] * 2,
        surface.halfExtents[2] * 2,
      );
      const mesh = new THREE.Mesh(geometry, floorMaterial);
      mesh.position.set(...surface.center);
      mesh.receiveShadow = true;
      mesh.userData.worldSurfaceId = surface.id;
      this.scene.add(mesh);
    }

    const floor = MACHINE_YARD_WORLD.surfaces.find((surface) => surface.id === 'room-floor');
    const gridSize = Math.min(floor.halfExtents[0] * 2, 40);
    const worldGrid = new THREE.GridHelper(gridSize, Math.round(gridSize * 2), 0x193847, 0x152733);
    worldGrid.position.y = surfaceTop(floor) + 0.003;
    worldGrid.material.transparent = true;
    worldGrid.material.opacity = 0.24;
    this.scene.add(worldGrid);
  }

  #buildWorkspace() {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.09, 1.25),
      new THREE.MeshStandardMaterial({ color: 0x182832, roughness: 0.48, metalness: 0.46 }),
    );
    deck.position.y = -0.055;
    deck.receiveShadow = true;
    deck.castShadow = true;
    this.workspaceVisualGroup.add(deck);

    const deckGrid = new THREE.GridHelper(1.78, 12, 0x44c7ef, 0x244656);
    deckGrid.position.y = 0.004;
    deckGrid.material.transparent = true;
    deckGrid.material.opacity = 0.33;
    this.workspaceVisualGroup.add(deckGrid);

    const buildGrid = new THREE.GridHelper(1.55, 10, 0x67dfff, 0x2b6178);
    buildGrid.position.y = MACHINE_PRESENTATION_OFFSET[1];
    buildGrid.material.transparent = true;
    buildGrid.material.opacity = 0.15;
    this.workspaceVisualGroup.add(buildGrid);

    const underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.82, 1.12),
      new THREE.MeshBasicMaterial({ color: 0x123c4c, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    underGlow.rotation.x = -Math.PI / 2;
    underGlow.position.y = -0.105;
    this.workspaceVisualGroup.add(underGlow);

    const cornerGeometry = new THREE.BoxGeometry(0.06, 0.14, 0.06);
    const cornerMaterial = new THREE.MeshStandardMaterial({ color: 0x4cc6e8, emissive: 0x0f5368, emissiveIntensity: 0.8, roughness: 0.3 });
    for (const x of [-0.91, 0.91]) {
      for (const z of [-0.56, 0.56]) {
        const corner = new THREE.Mesh(cornerGeometry, cornerMaterial);
        corner.position.set(x, 0.04, z);
        this.workspaceVisualGroup.add(corner);
      }
    }
  }

  #resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  worldToWorkspacePoint(worldPoint, target = new THREE.Vector3()) {
    this.workspaceRoot.updateWorldMatrix(true, false);
    return this.workspaceRoot.worldToLocal(target.copy(worldPoint));
  }

  workspaceToWorldPoint(localPoint, target = new THREE.Vector3()) {
    this.workspaceRoot.updateWorldMatrix(true, false);
    return this.workspaceRoot.localToWorld(target.copy(localPoint));
  }

  worldToMachinePoint(worldPoint, target = new THREE.Vector3()) {
    this.machineAuthoringRoot.updateWorldMatrix(true, false);
    return this.machineAuthoringRoot.worldToLocal(target.copy(worldPoint));
  }

  machineToWorldPoint(machinePoint, target = new THREE.Vector3()) {
    this.machineAuthoringRoot.updateWorldMatrix(true, false);
    return this.machineAuthoringRoot.localToWorld(target.copy(machinePoint));
  }

  renderAuthored(_document, plan) {
    this.authoredGroup.clear();
    this.beamMeshes.clear();

    for (const island of plan.islands) {
      for (const beam of island.beams) {
        const mesh = new THREE.Mesh(beamGeometry, authoredBeamMaterial);
        mesh.position.set(...beam.machinePosition);
        mesh.quaternion.set(...beam.machineRotation);
        mesh.scale.set(beam.length, beam.thickness, beam.thickness);
        mesh.userData.beamId = beam.id;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.beamMeshes.set(beam.id, mesh);
        this.authoredGroup.add(mesh);
      }
    }

    for (const component of plan.components ?? []) {
      if (component.kind !== 'powered-wheel') continue;
      const root = new THREE.Group();
      root.position.set(...component.center);
      root.add(createWheelShape(component, authoredWheelMaterial, true));
      this.authoredGroup.add(root);
    }
  }

  createRuntimeVisual(plan, spawnPose = resolveRunSpawn(plan)) {
    this.runtimeGroup.clear();
    this.runtimeRoots.clear();
    for (const island of plan.islands) {
      const root = new THREE.Group();
      root.position.set(...transformPoint(island.origin, spawnPose));
      root.quaternion.set(...spawnPose.rotation);
      for (const beam of island.beams) {
        const mesh = new THREE.Mesh(beamGeometry, runtimeBeamMaterial);
        mesh.position.set(...beam.localPosition);
        mesh.quaternion.set(...beam.localRotation);
        mesh.scale.set(beam.length, beam.thickness, beam.thickness);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        root.add(mesh);
      }
      this.runtimeRoots.set(island.id, root);
      this.runtimeGroup.add(root);
    }

    for (const component of plan.components ?? []) {
      if (component.kind !== 'powered-wheel') continue;
      const root = new THREE.Group();
      root.position.set(...transformPoint(component.center, spawnPose));
      root.quaternion.set(...spawnPose.rotation);
      root.add(createWheelShape(component, runtimeWheelMaterial, false));
      this.runtimeRoots.set(component.id, root);
      this.runtimeGroup.add(root);
    }
  }

  updateRuntime(poses) {
    this.runFocusWorld.set(0, 0, 0);
    this.runFocusCount = 0;
    for (const [id, pose] of poses) {
      const root = this.runtimeRoots.get(id);
      if (root) {
        root.position.set(...pose.position);
        root.quaternion.set(...pose.rotation);
      }
      if (id.startsWith('island-')) {
        this.runFocusWorld.add(new THREE.Vector3(...pose.position));
        this.runFocusCount += 1;
      }
    }
    if (this.runFocusCount > 0) this.runFocusWorld.multiplyScalar(1 / this.runFocusCount);
  }

  setMode(mode) {
    this.mode = mode;
    const running = mode === 'run';
    this.machineAuthoringRoot.visible = !running;
    this.workspaceVisualGroup.visible = !running;
    this.runtimeGroup.visible = running;
    this.ghostBeam.visible = false;
  }

  setRunFollow(enabled) {
    this.followRun = enabled;
  }

  focusRuntimeNow() {
    if (this.runFocusCount === 0) return;
    const delta = this.runFocusWorld.clone().sub(this.controls.target);
    this.controls.target.add(delta);
    this.camera.position.add(delta);
  }

  updateSpatialControls(state) {
    this.spatialPanel.setState(state);
  }

  pickSpatialAction(controller) {
    if (!this.spatialPanel.group.visible) return null;
    controller.updateWorldMatrix(true, false);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
    this.raycaster.set(origin, direction);
    const hit = this.raycaster.intersectObjects(this.spatialPanel.getHitTargets(), false)[0];
    return hit?.object.userData.spatialAction ?? null;
  }

  hoverSpatialAction(controller) {
    const action = this.pickSpatialAction(controller);
    this.spatialPanel.setHover(action);
    return action;
  }

  showGhost(start, end, valid = true) {
    fitBeam(this.ghostBeam, start, end, 0.075);
    this.ghostBeam.material.color.setHex(valid ? 0x7ef2c2 : 0xff7082);
    this.ghostBeam.visible = true;
  }

  hideGhost() {
    this.ghostBeam.visible = false;
  }

  #setPointer(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  #beamSurfaceFromHit(hit) {
    if (!hit?.object?.userData?.beamId || !hit.face) return null;
    const geometryLocal = hit.object.worldToLocal(hit.point.clone());
    const localPosition = [
      geometryLocal.x * hit.object.scale.x,
      geometryLocal.y * hit.object.scale.y,
      geometryLocal.z * hit.object.scale.z,
    ];
    const normal = hit.face.normal.clone().normalize();
    return {
      beamId: hit.object.userData.beamId,
      localPosition,
      localNormal: [normal.x, normal.y, normal.z],
      distance: hit.distance,
    };
  }

  pickBeamSurface(clientX, clientY) {
    this.authoredGroup.updateWorldMatrix(true, true);
    this.#setPointer(clientX, clientY);
    const hit = this.raycaster.intersectObjects([...this.beamMeshes.values()], false)[0];
    return this.#beamSurfaceFromHit(hit);
  }

  pickBeamSurfaceController(controller) {
    this.authoredGroup.updateWorldMatrix(true, true);
    controller.updateWorldMatrix(true, false);
    const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(controller.matrixWorld);
    this.raycaster.set(origin, direction);
    const hit = this.raycaster.intersectObjects([...this.beamMeshes.values()], false)[0];
    return this.#beamSurfaceFromHit(hit);
  }

  pointOnBuildPlane(clientX, clientY) {
    this.#setPointer(clientX, clientY);
    const planePoint = this.machineToWorldPoint(this.tempPoint.set(0, 0, 0), this.tempPoint2);
    this.tempNormal.set(0, 1, 0).transformDirection(this.machineAuthoringRoot.matrixWorld);
    this.buildPlane.setFromNormalAndCoplanarPoint(this.tempNormal, planePoint);
    const worldHit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.buildPlane, worldHit)) return null;
    return this.worldToMachinePoint(worldHit, worldHit);
  }

  render() {
    if (this.mode === 'run' && this.followRun && this.runFocusCount > 0 && !this.renderer.xr.isPresenting) {
      const delta = this.runFocusWorld.clone().sub(this.controls.target).multiplyScalar(0.075);
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
