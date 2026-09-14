import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="hud">
    <section class="panel">
      <p class="eyebrow">WebXR Lab · F0</p>
      <h1>Quest presence gate</h1>
      <p class="lead">Desktop is only a preview. The real pass condition is physical Quest 2 tracking + Touch controller trigger + spatial target interaction.</p>
      <div class="status" id="status"></div>
    </section>
    <div class="game-readout"><strong id="score">0 / 8</strong><span>targets hit</span></div>
  </div>`;

const statusEl = document.querySelector('#status');
const scoreEl = document.querySelector('#score');
const statusRows = new Map();

function setStatus(key, label, state = 'pending') {
  let row = statusRows.get(key);
  if (!row) {
    row = document.createElement('div');
    row.className = 'status-row';
    row.innerHTML = `<span class="dot"></span><span></span>`;
    statusRows.set(key, row);
    statusEl.appendChild(row);
  }
  row.querySelector('.dot').className = `dot ${state}`;
  row.querySelector('span:last-child').textContent = label;
}

setStatus('secure', window.isSecureContext ? 'Secure context: yes' : 'Secure context: no (XR will be blocked)', window.isSecureContext ? 'ok' : 'bad');
setStatus('webxr', 'WebXR API: checking…');
setStatus('vr', 'immersive-vr: checking…');
setStatus('controllers', 'Controllers: waiting for XR session');

if (!('xr' in navigator)) {
  setStatus('webxr', 'WebXR API: unavailable in this browser', 'bad');
  setStatus('vr', 'immersive-vr: unavailable', 'bad');
} else {
  setStatus('webxr', 'WebXR API: available', 'ok');
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    setStatus('vr', `immersive-vr: ${supported ? 'supported' : 'not supported'}`, supported ? 'ok' : 'bad');
  }).catch(() => setStatus('vr', 'immersive-vr: support check failed', 'bad'));
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b14);
scene.fog = new THREE.Fog(0x070b14, 8, 24);

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 100);
camera.position.set(0, 1.65, 3.4);

const player = new THREE.Group();
scene.add(player);
player.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.prepend(renderer.domElement);

renderer.xr.setReferenceSpaceType('local-floor');
const vrButton = VRButton.createButton(renderer);
vrButton.id = 'VRButton';
document.body.appendChild(vrButton);

scene.add(new THREE.HemisphereLight(0xa8c8ff, 0x172032, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(3, 6, 2);
key.castShadow = true;
scene.add(key);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(7, 64),
  new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.92, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.25, 1.29, 96),
  new THREE.MeshBasicMaterial({ color: 0x3f7cff, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.006;
scene.add(ring);

const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(8, 4, 0.15),
  new THREE.MeshStandardMaterial({ color: 0x0d1320, roughness: 0.8, metalness: 0.2 })
);
backWall.position.set(0, 2, -5.1);
backWall.receiveShadow = true;
scene.add(backWall);

const targets = [];
const targetGroup = new THREE.Group();
scene.add(targetGroup);

const targetLayout = [
  [-2.2, 1.15, -3.1], [-0.75, 1.8, -3.7], [0.75, 1.25, -3.9], [2.2, 2.05, -3.2],
  [-1.7, 2.55, -4.55], [-0.25, 2.9, -4.7], [1.3, 2.55, -4.55], [0.15, 0.78, -3.2]
];

for (let i = 0; i < targetLayout.length; i++) {
  const target = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.27, 2),
    new THREE.MeshStandardMaterial({ color: 0x58d7ff, emissive: 0x0a5c87, emissiveIntensity: 1.6, roughness: 0.25, metalness: 0.25 })
  );
  target.position.fromArray(targetLayout[i]);
  target.castShadow = true;
  target.userData = { active: true, index: i, basePosition: target.position.clone() };
  targets.push(target);
  targetGroup.add(target);
}

const progressPips = [];
for (let i = 0; i < targets.length; i++) {
  const pip = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.04, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x58d7ff })
  );
  pip.position.set((i - (targets.length - 1) / 2) * 0.19, 3.35, -4.85);
  progressPips.push(pip);
  scene.add(pip);
}

const projectileGeometry = new THREE.SphereGeometry(0.035, 12, 8);
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xa9f2ff });
const projectiles = [];
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
let score = 0;
let lastRoundComplete = 0;

function resetRound() {
  score = 0;
  scoreEl.textContent = `0 / ${targets.length}`;
  for (const target of targets) {
    target.visible = true;
    target.scale.setScalar(1);
    target.position.copy(target.userData.basePosition);
    target.userData.active = true;
  }
  for (const pip of progressPips) {
    pip.material.color.setHex(0x58d7ff);
    pip.scale.setScalar(1);
  }
}

function hitTarget(target) {
  if (!target.userData.active) return;
  target.userData.active = false;
  score += 1;
  scoreEl.textContent = `${score} / ${targets.length}`;
  const pip = progressPips[target.userData.index];
  if (pip) {
    pip.material.color.setHex(0x173147);
    pip.scale.setScalar(0.75);
  }
  target.scale.setScalar(1.45);
  setTimeout(() => { target.visible = false; }, 70);
  if (score === targets.length) lastRoundComplete = performance.now();
}

function fire(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  const origin = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);

  raycaster.set(origin, direction);
  raycaster.far = 30;
  const hit = raycaster.intersectObjects(targets.filter((target) => target.userData.active), false)[0];
  if (hit) hitTarget(hit.object);

  const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
  projectile.position.copy(origin);
  projectile.userData.velocity = direction.multiplyScalar(9);
  projectile.userData.life = 1.25;
  scene.add(projectile);
  projectiles.push(projectile);

  const source = controller.userData.inputSource;
  const actuator = source?.gamepad?.hapticActuators?.[0];
  actuator?.pulse?.(0.35, 35).catch?.(() => {});
}

const xrControllers = [];
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  controller.visible = false;
  grip.visible = false;

  controller.addEventListener('selectstart', () => fire(controller));
  controller.addEventListener('connected', (event) => {
    controller.userData.inputSource = event.data;
    controller.visible = true;
    grip.visible = true;
    setStatus('controllers', 'Controllers: XR input connected', 'ok');
  });
  controller.addEventListener('disconnected', () => {
    controller.userData.inputSource = null;
    controller.visible = false;
    grip.visible = false;
    setStatus('controllers', 'Controllers: XR input disconnected', 'pending');
  });

  const handMarker = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.095, 0.13),
    new THREE.MeshStandardMaterial({
      color: i === 0 ? 0x68b7ff : 0xff79d1,
      emissive: i === 0 ? 0x153a66 : 0x641849,
      emissiveIntensity: 0.8,
      roughness: 0.35,
      metalness: 0.25
    })
  );
  handMarker.position.z = -0.02;
  grip.add(handMarker);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
  ]);
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0x9cecff, transparent: true, opacity: 0.68 })
  );
  line.scale.z = 6;
  controller.add(line);

  player.add(controller, grip);
  xrControllers.push({ controller, grip });
}

renderer.xr.addEventListener('sessionstart', () => {
  setStatus('vr', 'immersive-vr: session active', 'ok');
});

renderer.xr.addEventListener('sessionend', () => {
  for (const { controller, grip } of xrControllers) {
    controller.visible = false;
    grip.visible = false;
  }
  setStatus('controllers', 'Controllers: waiting for XR session', 'pending');
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (renderer.xr.isPresenting) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(targets.filter((target) => target.userData.active), false)[0];
  if (hit) hitTarget(hit.object);
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = performance.now() * 0.001;

  for (const target of targets) {
    if (!target.userData.active) continue;
    target.rotation.x += dt * 0.75;
    target.rotation.y += dt * 1.1;
    target.position.y = target.userData.basePosition.y + Math.sin(t * 1.8 + target.userData.index) * 0.07;
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    projectile.position.addScaledVector(projectile.userData.velocity, dt);
    projectile.userData.life -= dt;
    if (projectile.userData.life <= 0) {
      scene.remove(projectile);
      projectiles.splice(i, 1);
    }
  }

  if (score === targets.length && lastRoundComplete && performance.now() - lastRoundComplete > 1600) {
    lastRoundComplete = 0;
    resetRound();
  }

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
