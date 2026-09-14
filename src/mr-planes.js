import * as THREE from 'three';
import './style.css';

const BUILD_LABEL = 'F2-MR-P2';
const ROOM_CAPTURE_ARM_SECONDS = 3;
const MAX_PROBES = 12;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="hud">
    <section class="panel">
      <p class="eyebrow">WebXR Lab · ${BUILD_LABEL}</p>
      <h1>Room Planes</h1>
      <p class="lead">Isolated spatial-data spike: Quest passthrough + local-floor + plane detection + deliberate hits on detected real surfaces.</p>
      <div class="status" id="status"></div>
      <p class="controls">Trigger: mark a detected surface · If no planes appear after ~3s, squeeze grip once to request Quest room capture.</p>
    </section>
    <div class="game-readout">
      <strong id="planeCount">0</strong><span>detected planes</span>
    </div>
  </div>`;

const statusEl = document.querySelector('#status');
const planeCountEl = document.querySelector('#planeCount');
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
setStatus('planes', 'Plane detection: requires spatial-data permission');
setStatus('controllers', 'Controllers: waiting for MR session');
setStatus('capture', 'Room capture: not armed yet');
setStatus('session', 'MR session: idle');

let immersiveArSupported = null;
let currentSession = null;
let sessionStartSeconds = 0;
let roomCaptureRequested = false;
let maxPlaneCount = 0;
let probeHits = 0;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 50);
camera.position.set(0, 1.6, 3.4);
const desktopCameraState = {
  position: camera.position.clone(),
  quaternion: camera.quaternion.clone()
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
app.prepend(renderer.domElement);

function createSessionButton() {
  const button = document.createElement('button');
  button.id = 'VRButton';
  button.textContent = 'CHECKING MR…';
  button.disabled = true;
  document.body.appendChild(button);

  async function start() {
    if (!navigator.xr || immersiveArSupported !== true || currentSession) return;
    button.disabled = true;
    button.textContent = 'STARTING PLANES…';
    setStatus('session', 'MR session: requesting plane-detection…');

    let session = null;
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local-floor', 'plane-detection']
      });
      currentSession = session;
      session.addEventListener('end', () => {
        if (currentSession === session) currentSession = null;
        button.textContent = 'START PLANES';
        button.disabled = false;
      }, { once: true });

      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
      button.textContent = 'STOP PLANES';
      button.disabled = false;
    } catch (error) {
      console.warn('Plane session start failed', error);
      if (currentSession === session) currentSession = null;
      setStatus('session', `Plane session: start failed (${error?.name ?? 'error'})`, 'bad');
      setStatus('planes', 'Plane detection: unavailable, denied or room permission blocked', 'bad');
      button.textContent = 'START PLANES';
      button.disabled = immersiveArSupported !== true;
      if (session) {
        try { await session.end(); } catch {}
      }
    }
  }

  button.addEventListener('click', async () => {
    if (!currentSession) {
      await start();
      return;
    }
    try { await currentSession.end(); } catch {}
  });

  return button;
}

const sessionButton = createSessionButton();

if (!('xr' in navigator)) {
  setStatus('webxr', 'WebXR API: unavailable', 'bad');
  setStatus('ar', 'immersive-ar: unavailable', 'bad');
  sessionButton.textContent = 'MR NOT AVAILABLE';
} else {
  setStatus('webxr', 'WebXR API: available', 'ok');
  navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
    immersiveArSupported = supported;
    setStatus('ar', `immersive-ar: ${supported ? 'supported' : 'not supported'}`, supported ? 'ok' : 'bad');
    sessionButton.disabled = !supported;
    sessionButton.textContent = supported ? 'START PLANES' : 'MR NOT SUPPORTED';
  }).catch((error) => {
    setStatus('ar', `immersive-ar: support check failed (${error?.name ?? 'error'})`, 'bad');
    sessionButton.textContent = 'MR CHECK FAILED';
  });
}

scene.add(new THREE.HemisphereLight(0xd9efff, 0x203047, 1.8));
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(2, 5, 2);
scene.add(key);

const originBeacon = new THREE.Group();
originBeacon.position.set(0, 0.02, -1.5);
scene.add(originBeacon);
const originRing = new THREE.Mesh(
  new THREE.RingGeometry(0.28, 0.3, 48),
  new THREE.MeshBasicMaterial({ color: 0x4de4ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
);
originRing.rotation.x = -Math.PI / 2;
originBeacon.add(originRing);
const originPillar = new THREE.Mesh(
  new THREE.CylinderGeometry(0.018, 0.018, 0.55, 8),
  new THREE.MeshBasicMaterial({ color: 0x4de4ff, transparent: true, opacity: 0.55 })
);
originPillar.position.y = 0.275;
originBeacon.add(originPillar);

const planeVisuals = new Map();
const planeMeshes = [];
const connectedHands = new Map();
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
const tempDirection = new THREE.Vector3();
const tempOrigin = new THREE.Vector3();
const probeGeometry = new THREE.SphereGeometry(0.035, 10, 7);
const probeMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf68 });
const probes = [];

function disposePlaneVisual(record) {
  const meshIndex = planeMeshes.indexOf(record.fill);
  if (meshIndex >= 0) planeMeshes.splice(meshIndex, 1);
  record.group.remove(record.fill, record.outline);
  scene.remove(record.group);
  record.fill.geometry.dispose();
  record.fill.material.dispose();
  record.outline.geometry.dispose();
  record.outline.material.dispose();
}

function polygonGeometry(polygon, indexed = true) {
  const vertices = [];
  for (const point of polygon) vertices.push(point.x, point.y, point.z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  if (indexed && polygon.length >= 3) {
    const indices = [];
    for (let i = 1; i < polygon.length - 1; i++) indices.push(0, i, i + 1);
    geometry.setIndex(indices);
  }
  return geometry;
}

function planeColor(plane) {
  if (plane.orientation === 'horizontal') return 0x54e9ff;
  if (plane.orientation === 'vertical') return 0xff70d2;
  return 0xc59aff;
}

function createPlaneVisual(plane) {
  const color = planeColor(plane);
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;

  const fill = new THREE.Mesh(
    polygonGeometry(plane.polygon, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  fill.userData.xrPlane = plane;
  group.add(fill);

  const outline = new THREE.LineLoop(
    polygonGeometry(plane.polygon, false),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  group.add(outline);

  scene.add(group);
  planeMeshes.push(fill);
  const record = { group, fill, outline, lastChangedTime: plane.lastChangedTime ?? 0 };
  planeVisuals.set(plane, record);
  return record;
}

function refreshPlaneGeometry(plane, record) {
  const changed = plane.lastChangedTime ?? 0;
  if (changed === record.lastChangedTime) return;
  record.fill.geometry.dispose();
  record.outline.geometry.dispose();
  record.fill.geometry = polygonGeometry(plane.polygon, true);
  record.outline.geometry = polygonGeometry(plane.polygon, false);
  record.lastChangedTime = changed;
}

function updatePlanes(frame) {
  const detected = frame.detectedPlanes;
  if (detected === undefined) {
    setStatus('planes', 'Plane detection: feature requested but frame API not exposed', 'bad');
    return 0;
  }

  const active = new Set(detected);
  for (const [plane, record] of [...planeVisuals]) {
    if (active.has(plane)) continue;
    disposePlaneVisual(record);
    planeVisuals.delete(plane);
  }

  const referenceSpace = renderer.xr.getReferenceSpace();
  let visibleCount = 0;
  for (const plane of active) {
    const record = planeVisuals.get(plane) ?? createPlaneVisual(plane);
    refreshPlaneGeometry(plane, record);
    const pose = referenceSpace ? frame.getPose(plane.planeSpace, referenceSpace) : null;
    if (!pose) {
      record.group.visible = false;
      continue;
    }
    record.group.visible = true;
    record.group.matrix.fromArray(pose.transform.matrix);
    record.group.matrixWorldNeedsUpdate = true;
    visibleCount += 1;
  }

  maxPlaneCount = Math.max(maxPlaneCount, active.size);
  planeCountEl.textContent = String(active.size);
  if (active.size > 0) {
    setStatus('planes', `Plane detection: ${active.size} current · ${maxPlaneCount} max`, 'ok');
    setStatus('capture', 'Room capture: not needed — spatial data is present', 'ok');
  }
  return active.size;
}

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

function markSurface(controller) {
  controller.updateWorldMatrix(true, false);
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  tempDirection.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
  tempOrigin.setFromMatrixPosition(controller.matrixWorld);

  raycaster.set(tempOrigin, tempDirection);
  raycaster.far = 12;
  const hit = raycaster.intersectObjects(planeMeshes, false)[0];
  if (!hit) {
    setStatus('interaction', 'Surface probe: trigger fired, no detected plane hit', 'pending');
    return;
  }

  const marker = new THREE.Mesh(probeGeometry, probeMaterial);
  marker.position.copy(hit.point);
  scene.add(marker);
  probes.push(marker);
  probeHits += 1;
  if (probes.length > MAX_PROBES) scene.remove(probes.shift());
  setStatus('interaction', `Surface probe: ${probeHits} deliberate plane hit${probeHits === 1 ? '' : 's'}`, 'ok');
}

async function requestRoomCapture() {
  const session = currentSession;
  if (!session || roomCaptureRequested) return;
  const elapsed = performance.now() * 0.001 - sessionStartSeconds;
  if (elapsed < ROOM_CAPTURE_ARM_SECONDS || planeVisuals.size > 0) return;

  const capture = session.initiateRoomCapture;
  if (typeof capture !== 'function') {
    setStatus('capture', 'Room capture: helper unavailable on this runtime', 'bad');
    return;
  }

  roomCaptureRequested = true;
  setStatus('capture', 'Room capture: requested — follow Quest system UI', 'pending');
  try {
    await capture.call(session);
    setStatus('capture', 'Room capture: system flow completed; waiting for planes…', 'pending');
  } catch (error) {
    setStatus('capture', `Room capture: failed/cancelled (${error?.name ?? 'error'})`, 'bad');
  }
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
    new THREE.LineBasicMaterial({ color: i === 0 ? 0x62ddff : 0xff7bd4, transparent: true, opacity: 0.65 })
  );
  line.scale.z = 8;
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
  controller.addEventListener('selectstart', () => markSurface(controller));
  controller.addEventListener('squeezestart', () => { requestRoomCapture(); });

  scene.add(controller, grip);
}

renderer.xr.addEventListener('sessionstart', () => {
  sessionStartSeconds = performance.now() * 0.001;
  roomCaptureRequested = false;
  maxPlaneCount = 0;
  probeHits = 0;
  setStatus('session', 'Plane session: active', 'ok');
  setStatus('planes', 'Plane detection: warming up — wait at least 3 seconds…');
  setStatus('capture', 'Room capture: wait for existing planes first');
  setStatus('interaction', 'Surface probe: waiting for a detected plane');
  refreshControllerStatus();
});

renderer.xr.addEventListener('sessionend', () => {
  connectedHands.clear();
  refreshControllerStatus();
  for (const [plane, record] of [...planeVisuals]) {
    disposePlaneVisual(record);
    planeVisuals.delete(plane);
  }
  for (const marker of probes) scene.remove(marker);
  probes.length = 0;
  planeCountEl.textContent = '0';
  camera.position.copy(desktopCameraState.position);
  camera.quaternion.copy(desktopCameraState.quaternion);
  camera.updateMatrixWorld(true);
  setStatus('session', `Plane session: ended · max planes ${maxPlaneCount} · surface hits ${probeHits}`, 'ok');
  setStatus('capture', roomCaptureRequested ? 'Room capture: was requested this session' : 'Room capture: not requested');
});

const clock = new THREE.Clock();
let lastPlaneUpdate = 0;
function animate(_time, frame) {
  const dt = Math.min(clock.getDelta(), 0.05);
  originRing.rotation.z += dt * 0.55;

  if (frame) {
    const nowMs = performance.now();
    if (nowMs - lastPlaneUpdate > 120) {
      lastPlaneUpdate = nowMs;
      const count = updatePlanes(frame);
      const elapsed = nowMs * 0.001 - sessionStartSeconds;
      if (count === 0 && elapsed >= ROOM_CAPTURE_ARM_SECONDS && !roomCaptureRequested) {
        if (typeof currentSession?.initiateRoomCapture === 'function') {
          setStatus('capture', 'Room capture: no planes yet — squeeze grip once to request setup', 'pending');
        } else {
          setStatus('capture', 'Room capture: no planes; helper unavailable', 'bad');
        }
      }
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
