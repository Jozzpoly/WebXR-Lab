import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BUILD_Y = 1.12;

const beamGeometry = new THREE.BoxGeometry(1, 1, 1);
const authoredBeamMaterial = new THREE.MeshStandardMaterial({ color: 0x57b6ff, roughness: 0.42, metalness: 0.18 });
const runtimeBeamMaterial = new THREE.MeshStandardMaterial({ color: 0xffb95f, roughness: 0.5, metalness: 0.12 });
const nodeGeometry = new THREE.SphereGeometry(0.075, 18, 12);
const nodeMaterial = new THREE.MeshStandardMaterial({ color: 0xeaf5ff, emissive: 0x123148, emissiveIntensity: 0.65, roughness: 0.28 });
const ghostMaterial = new THREE.MeshBasicMaterial({ color: 0x8af7c8, transparent: true, opacity: 0.58, depthWrite: false });

function fitBeam(mesh, a, b, thickness) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const len = delta.length();
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), delta.normalize());
  mesh.scale.set(len, thickness, thickness);
}

export class RiftworksScene {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071019);
    this.scene.fog = new THREE.Fog(0x071019, 8, 18);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.03, 50);
    this.camera.position.set(3.2, 2.55, 3.4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0.9, -1.45);
    this.controls.enableDamping = true;
    this.controls.mouseButtons.LEFT = null;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 10;

    this.authoredGroup = new THREE.Group();
    this.runtimeGroup = new THREE.Group();
    this.scene.add(this.authoredGroup, this.runtimeGroup);
    this.runtimeGroup.visible = false;

    this.nodeMeshes = new Map();
    this.runtimeRoots = new Map();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.buildPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BUILD_Y);

    this.ghostBeam = new THREE.Mesh(beamGeometry, ghostMaterial);
    this.ghostBeam.visible = false;
    this.scene.add(this.ghostBeam);

    this.#buildEnvironment();
    this.#resize();
    window.addEventListener('resize', () => this.#resize());
  }

  #buildEnvironment() {
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x14202b, 1.8);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 6, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshStandardMaterial({ color: 0x17222c, roughness: 0.9, metalness: 0.04 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -1.5);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const buildGrid = new THREE.GridHelper(4, 16, 0x4cc8ff, 0x23445b);
    buildGrid.position.set(0, BUILD_Y, -1.45);
    buildGrid.material.transparent = true;
    buildGrid.material.opacity = 0.25;
    this.scene.add(buildGrid);

    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.018, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x2f6f8d, transparent: true, opacity: 0.48 }),
    );
    frame.rotation.x = Math.PI / 2;
    frame.position.set(0, BUILD_Y - 0.015, -1.45);
    this.scene.add(frame);
  }

  #resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  renderAuthored(document) {
    this.authoredGroup.clear();
    this.nodeMeshes.clear();
    const nodes = new Map(document.nodes.map((node) => [node.id, node]));

    for (const beam of document.beams) {
      const mesh = new THREE.Mesh(beamGeometry, authoredBeamMaterial);
      fitBeam(mesh, nodes.get(beam.a).position, nodes.get(beam.b).position, beam.thickness);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.authoredGroup.add(mesh);
    }

    for (const node of document.nodes) {
      const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
      mesh.position.set(...node.position);
      mesh.userData.nodeId = node.id;
      mesh.castShadow = true;
      this.nodeMeshes.set(node.id, mesh);
      this.authoredGroup.add(mesh);
    }
  }

  createRuntimeVisual(plan) {
    this.runtimeGroup.clear();
    this.runtimeRoots.clear();
    for (const island of plan.islands) {
      const root = new THREE.Group();
      root.position.set(...island.origin);
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
  }

  updateRuntime(poses) {
    for (const [id, pose] of poses) {
      const root = this.runtimeRoots.get(id);
      if (!root) continue;
      root.position.set(...pose.position);
      root.quaternion.set(...pose.rotation);
    }
  }

  setMode(mode) {
    const running = mode === 'run';
    this.authoredGroup.visible = !running;
    this.runtimeGroup.visible = running;
    this.ghostBeam.visible = false;
  }

  showGhost(start, end, valid = true) {
    fitBeam(this.ghostBeam, start, end, 0.075);
    this.ghostBeam.material.color.setHex(valid ? 0x8af7c8 : 0xff7082);
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

  pickNode(clientX, clientY) {
    this.#setPointer(clientX, clientY);
    const hits = this.raycaster.intersectObjects([...this.nodeMeshes.values()], false);
    return hits[0]?.object.userData.nodeId ?? null;
  }

  pointOnBuildPlane(clientX, clientY) {
    this.#setPointer(clientX, clientY);
    const point = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.buildPlane, point) ? point : null;
  }

  nearestNode(document, point, radius = 0.16, excludedId = null) {
    let best = null;
    let bestDistance = radius;
    for (const node of document.nodes) {
      if (node.id === excludedId) continue;
      const distance = point.distanceTo(new THREE.Vector3(...node.position));
      if (distance <= bestDistance) {
        best = node.id;
        bestDistance = distance;
      }
    }
    return best;
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
