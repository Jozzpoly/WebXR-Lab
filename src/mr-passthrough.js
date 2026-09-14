import * as THREE from 'three';
import './style.css';

const BUILD_LABEL = 'F2-MR-B1';
const TARGET_COUNT = 6;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="hud">
    <section class="panel">
      <p class="eyebrow">WebXR Lab · ${BUILD_LABEL}</p>
      <h1>MR Reactor Baseline</h1>
      <p class="lead">Quest passthrough proof isolated from room permissions: immersive-ar + local-floor + Touch aiming + holographic targets.</p>
      <div class="status" id="status"></div>
      <p class="controls">Start MR · Trigger: fire. Plane detection and anchors are deliberately not requested in this baseline.</p>
    </section>
    <div class="game-readout">
      <strong id="score">0 / ${TARGET_COUNT}</strong><span>MR targets hit</span>
    </div>
  </div>`;

const statusEl = document.querySelector('#status');
const scoreEl = document.querySelector('#score');
const statusRows = new Map();

function setStatus(key, label, state = 'pending') {
  let row = statusRows.get(key);
  if (!row) {
    row = document.createElement('div');
    row.className = 'status-row';
    row.innerHTML = '<span class="dot"></span><span></span>';
    statusRows.set(key, row);
    statusEl.appendChild(row);
  }
  row.querySelector('.dot').className = `dot ${state}`;
  row.querySelector('span:last-child').textContent = label;
}

setStatus('secure', window.isSecureContext ? 'Secure context: yes' : 'Secure context: no', window.isSecureContext ? 'ok' : 'bad');
setStatus('webxr', 'WebXR API: checking…');
setStatus('ar', 'immersive-ar: checking…');
setStatus('floor', 'Reference space: local-floor required');
setStatus('controllers', 'Controllers: waiting for MR session');
setStatus('session', 'MR session: idle');
setStatus('scope', 'Room data: not requested in baseline', 'ok');

let immersiveArSupported = null;
let currentSession = null;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 40);
const desktopCameraState = {
  position: new THREE.Vector3(0, 1.6, 3.4),
  quaternion: new THREE.Quaternion()
};
camera.position.copy(desktopCameraState.position);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
app.prepend(renderer.domElement);

function createMrButton() {
  const button = document.createElement('button');
  button.id = 'VRButton';
  button.textContent = 'CHECKING MR…';
  button.disabled = true;
  document.body.appendChild(button);

  async function startSession() {
    if (!navigator.xr || immersiveArSupported !== true || currentSession) return;
    button.disabled = true;
    button.textContent = 'STARTING MR…';
    setStatus('session', 'MR session: requesting immersive-ar + local-floor…');

    let session = null;
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor']
      });

      session.addEventListener('end', () => {
        if (currentSession === session) currentSession = null;
        button.textContent = 'START MR';
        button.disabled = false;
      }, { once: true });

      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      currentSession = session;
      button.textContent = 'STOP MR';
      button.disabled = false;
    } catch (error) {
      console.warn('MR session start failed', error);
      setStatus('session', `MR session: start failed (${error?.name ?? 'error'})`, 'bad');
      button.textContent = 'START MR';
      button.disabled = false;
      if (session) {
        try { await session.end(); } catch {}
      }
    }
  }

  button.addEventListener('click', async () => {
    if (!currentSession) {
      await startSession();
      return;
    }
    try {
      await currentSession.end();
    } catch {
      // Session may already be ending through the system UI.
    }
  });

  return button;
}

const mrButton = createMrButton();

if (!('xr' in navigator)) {
  setStatus('webxr', 'WebXR API: unavailable', 'bad');
  setStatus('ar', 'immersive-ar: unavailable', 'bad');
  mrButton.textContent = 'MR NOT AVAILABLE';
} else {
  setStatus('webxr', 'WebXR API: available', 'ok');
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    immersiveArSupported = supported;
    setStatus('ar', `immersive-ar: ${supported ? 'supported' : 'not supported'}`, supported ? 'ok' : 'bad');
    mrButton.disabled = !supported;
    mrButton.textContent = supported ? 'START MR' : 'MR NOT SUPPORTED';
  }).catch((error) => {
    setStatus('ar', `immersive-ar: support check failed (${error?.name ?? 'error'})`, 'bad');
    mrButton.textContent = 'MR CHECK FAILED';
  });
}

scene.add(new THREE.HemisphereLight(0xd7efff, 0x233149, 2.1));
const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(2.5, 5, 1.5);
scene.add(key);

const reactor = new THREE.Group();
reactor.position.set(0, 1.05, -1.8);
scene.add(reactor);

const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.22, 2),
  new THREE.MeshStandardMaterial({
    color: 0x50e5ff,
    emissive: 0x0a7fa0,
    emissiveIntensity: 3,
    roughness: 0.18,
    metalness: 0.4,
    transparent: true,
    opacity: 0.92
  })
);
reactor.add(core);

const coreRingA = new THREE.Mesh(
  new THREE.TorusGeometry(0.39, 0.018, 10, 48),
  new THREE.MeshBasicMaterial({ color: 0x65efff, transparent: true, opacity: 0.8 })
);
reactor.add(coreRingA);
const coreRingB = coreRingA.clone();
coreRingB.rotation.x = Math.PI / 2;
reactor.add(coreRingB);

const floorHalo = new THREE.Mesh(
  new THREE.RingGeometry(0.58, 0.61, 64),
  new THREE.MeshBasicMaterial({ color: 0x35cfff, transparent: true, opacity: 0.42, side: THREE.DoubleSide })
);
floorHalo.rotation.x = -Math.PI / 2;
floorHalo.position.set(0, 0.015, -1.8);
scene.add(floorHalo);

const targetMaterial = new THREE.MeshStandardMaterial({
  color: 0xff5f8f,
  emissive: 0x8b113f,
  emissiveIntensity: 2.6,
  roughness: 0.25,
  metalness: 0.3,
  transparent: true,
  opacity: 0.94
});

const targetLayout = [
  [-0.72, 1.2, -1.65], [0.72, 1.2, -1.65],
  [-0.58, 1.75, -1.95], [0.58, 1.75, -1.95],
  [0, 1.42, -2.35], [0, 2.05, -2.15]
];

const targets = targetLayout.map((position, index) => {
  const root = new THREE.Group();
  root.position.fromArray(position);
  root.userData.index = index;
  root.userData.active = true;

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 1), targetMaterial.clone());
  body.userData.targetRoot = root;
  root.add(body);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.012, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff77a5, transparent: true, opacity: 0.65 })
  );
  ring.userData.targetRoot = root;
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  scene.add(root);
  return root;
});

let score = 0;
const connectedHands = new Map();
const effects = [];
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
const tempDirection = new THREE.Vector3();
const tempOrigin = new THREE.Vector3();

function refreshControllerStatus() {
  const hands = [...connectedHands.values()];
  if (hands.includes('left') && hands.includes('right')) {
    setStatus('controllers', 'Controllers: left + right connected', 'ok');
  } else if (hands.length > 0) {
    setStatus('controllers', `Controllers: ${hands.join(' + ')} connected`, 'pending');
  } else {
    setStatus('controllers', 'Controllers: waiting for MR session');
  }
}

function resetTargets() {
  score = 0;
  scoreEl.textContent = `0 / ${TARGET_COUNT}`;
  for (const target of targets) {
    target.visible = true;
    target.scale.setScalar(1);
    target.userData.active = true;
  }
}

function spawnBurst(position) {
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.022 + Math.random() * 0.015),
      new THREE.MeshBasicMaterial({ color: 0xff78a6, transparent: true, opacity: 0.95 })
    );
    mesh.position.copy(position);
    scene.add(mesh);
    effects.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.6,
        (Math.random() - 0.15) * 1.2,
        (Math.random() - 0.5) * 1.6
      ),
      life: 0.38 + Math.random() * 0.18
    });
  }
}

function hitTarget(target) {
  if (!target?.userData.active) return;
  target.userData.active = false;
  score += 1;
  scoreEl.textContent = `${score} / ${TARGET_COUNT}`;
  spawnBurst(target.getWorldPosition(new THREE.Vector3()));
  target.scale.setScalar(1.55);
  setTimeout(() => {
    target.visible = false;
    if (score === TARGET_COUNT) setTimeout(resetTargets, 1200);
  }, 70);
}

function fire(controller) {
  controller.updateWorldMatrix(true, false);
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  tempDirection.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  tempOrigin.setFromMatrixPosition(controller.matrixWorld);

  raycaster.set(tempOrigin, tempDirection);
  raycaster.far = 8;
  const hit = raycaster.intersectObjects(targets.filter((target) => target.userData.active), true)[0];
  if (hit) {
    let node = hit.object;
    while (node && !node.userData?.targetRoot) node = node.parent;
    hitTarget(node?.userData?.targetRoot);
  }

  const pulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x9ef7ff })
  );
  pulse.position.copy(tempOrigin);
  scene.add(pulse);
  effects.push({ mesh: pulse, velocity: tempDirection.clone().multiplyScalar(5.5), life: 0.4 });
}

for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const grip = renderer.xr.getControllerGrip(i);
  controller.visible = false;
  grip.visible = false;

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ]),
    new THREE.LineBasicMaterial({ color: i === 0 ? 0x6be1ff : 0xff84d5, transparent: true, opacity: 0.6 })
  );
  line.scale.z = 4;
  controller.add(line);

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.075, 0.1),
    new THREE.MeshStandardMaterial({
      color: i === 0 ? 0x5bcfff : 0xff71c7,
      emissive: i === 0 ? 0x0c5678 : 0x78184f,
      emissiveIntensity: 1.1,
      roughness: 0.3,
      metalness: 0.4
    })
  );
  marker.position.z = -0.015;
  grip.add(marker);

  controller.addEventListener('connected', (event) => {
    controller.visible = true;
    grip.visible = true;
    connectedHands.set(i, event.data.handedness || 'unhanded');
    refreshControllerStatus();
  });
  controller.addEventListener('disconnected', () => {
    controller.visible = false;
    grip.visible = false;
    connectedHands.delete(i);
    refreshControllerStatus();
  });
  controller.addEventListener('selectstart', () => fire(controller));

  scene.add(controller, grip);
}

renderer.xr.addEventListener('sessionstart', () => {
  resetTargets();
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  camera.updateMatrixWorld(true);
  setStatus('floor', 'Reference space: local-floor active', 'ok');
  setStatus('session', 'MR session: active — passthrough should be visible', 'ok');
  refreshControllerStatus();
});

renderer.xr.addEventListener('sessionend', () => {
  connectedHands.clear();
  refreshControllerStatus();
  camera.position.copy(desktopCameraState.position);
  camera.quaternion.copy(desktopCameraState.quaternion);
  camera.updateMatrixWorld(true);
  setStatus('floor', 'Reference space: local-floor required');
  setStatus('session', 'MR session: ended cleanly', immersiveArSupported === false ? 'bad' : 'ok');
});

const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const now = performance.now();

  core.rotation.x += dt * 0.45;
  core.rotation.y += dt * 0.75;
  coreRingA.rotation.z += dt * 1.1;
  coreRingB.rotation.z -= dt * 0.85;

  targets.forEach((target, index) => {
    if (!target.userData.active) return;
    target.rotation.y += dt * (0.8 + index * 0.07);
    target.position.y = targetLayout[index][1] + Math.sin(now * 0.0015 + index) * 0.035;
  });

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    effect.mesh.position.addScaledVector(effect.velocity, dt);
    effect.life -= dt;
    if (effect.mesh.material.transparent) effect.mesh.material.opacity = Math.max(0, effect.life * 2.2);
    if (effect.life <= 0) {
      scene.remove(effect.mesh);
      effects.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
