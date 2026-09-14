import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { PhysicsSystem } from './physics.js';
import { SpatialSynth } from './spatial-audio.js';
import './style.css';

const BUILD_LABEL = 'F1-A3';
const MAX_CORE_HEALTH = 6;
const TOTAL_WAVES = 3;

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="hud">
    <section class="panel">
      <p class="eyebrow">WebXR Lab · ${BUILD_LABEL}</p>
      <h1>Reactor Defense</h1>
      <p class="lead">Physical Quest 2 WebXR is proven. F1 now combines Rapier physics, near grab/throw, dual blasters, positional synth audio and a three-wave reactor defense loop.</p>
      <div class="status" id="status"></div>
      <p class="controls">Trigger: fire · Grip/squeeze: grab + throw · Orange orbs near the player are the easiest grab test.</p>
    </section>
    <div class="game-readout">
      <strong id="score">0</strong><span id="readoutLabel">score · wave 0 / 3</span>
    </div>
  </div>`;

const statusEl = document.querySelector('#status');
const scoreEl = document.querySelector('#score');
const readoutLabelEl = document.querySelector('#readoutLabel');
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

setStatus('secure', window.isSecureContext ? 'Secure context: yes' : 'Secure context: no', window.isSecureContext ? 'ok' : 'bad');
setStatus('webxr', 'WebXR API: checking…');
setStatus('vr', 'immersive-vr: checking…');
setStatus('physics', 'Rapier 3D: loading…');
setStatus('audio', 'Positional audio: preparing…');
setStatus('controllers', 'Controllers: waiting for XR session');
setStatus('game', 'Game: preparing F1 arena…');

let immersiveVrSupported = null;
if (!('xr' in navigator)) {
  setStatus('webxr', 'WebXR API: unavailable', 'bad');
  setStatus('vr', 'immersive-vr: unavailable', 'bad');
} else {
  setStatus('webxr', 'WebXR API: available', 'ok');
  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    immersiveVrSupported = supported;
    setStatus('vr', `immersive-vr: ${supported ? 'supported' : 'not supported'}`, supported ? 'ok' : 'bad');
  }).catch(() => setStatus('vr', 'immersive-vr: support check failed', 'bad'));
}

boot().catch((error) => {
  console.error(error);
  setStatus('game', `Boot failed: ${error?.message ?? error}`, 'bad');
});

async function boot() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);
  scene.fog = new THREE.Fog(0x050914, 10, 25);

  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 1.65, 3.8);
  const desktopCameraState = {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    scale: camera.scale.clone()
  };

  const player = new THREE.Group();
  scene.add(player);
  player.add(camera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
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

  const physics = await PhysicsSystem.create();
  setStatus('physics', 'Rapier 3D: ready', 'ok');

  const audio = new SpatialSynth(camera, scene);
  setStatus('audio', 'Positional audio: armed (unlocks on interaction)', 'ok');

  scene.add(new THREE.HemisphereLight(0x9ec8ff, 0x0c1322, 1.65));
  const key = new THREE.DirectionalLight(0xe7f5ff, 2.1);
  key.position.set(3.5, 7, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  scene.add(key);

  const accentLight = new THREE.PointLight(0x39c9ff, 4.5, 8, 2);
  accentLight.position.set(0, 1.2, -2.3);
  scene.add(accentLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.MeshStandardMaterial({ color: 0x111a2a, roughness: 0.82, metalness: 0.18 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  physics.addFixedBox({ x: 0, y: -0.16, z: -1 }, { x: 6, y: 0.16, z: 6 }, { friction: 0.95 });

  const arenaRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.22, 96),
    new THREE.MeshBasicMaterial({ color: 0x286fff, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  arenaRing.rotation.x = -Math.PI / 2;
  arenaRing.position.y = 0.008;
  scene.add(arenaRing);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(11, 4.5, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x0d1422, roughness: 0.72, metalness: 0.28 })
  );
  backWall.position.set(0, 2.25, -7.2);
  backWall.receiveShadow = true;
  scene.add(backWall);
  physics.addFixedBox({ x: 0, y: 2.25, z: -7.2 }, { x: 5.5, y: 2.25, z: 0.09 });

  for (const x of [-5.5, 5.5]) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.2, 8.5),
      new THREE.MeshStandardMaterial({ color: 0x0b111e, roughness: 0.8, metalness: 0.18 })
    );
    wall.position.set(x, 1.6, -2.9);
    wall.receiveShadow = true;
    scene.add(wall);
    physics.addFixedBox({ x, y: 1.6, z: -2.9 }, { x: 0.09, y: 1.6, z: 4.25 });
  }

  const core = new THREE.Group();
  core.position.set(0, 0.95, -2.65);
  scene.add(core);

  const coreShell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 3),
    new THREE.MeshStandardMaterial({
      color: 0x4ae7ff,
      emissive: 0x0b95be,
      emissiveIntensity: 2.8,
      roughness: 0.16,
      metalness: 0.42
    })
  );
  coreShell.castShadow = true;
  core.add(coreShell);

  const coreRingA = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.035, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x69eaff, transparent: true, opacity: 0.75 })
  );
  core.add(coreRingA);
  const coreRingB = coreRingA.clone();
  coreRingB.rotation.x = Math.PI / 2;
  core.add(coreRingB);

  const coreHealthPips = [];
  for (let i = 0; i < MAX_CORE_HEALTH; i++) {
    const pip = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.06, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x62f4c8 })
    );
    pip.position.set((i - (MAX_CORE_HEALTH - 1) / 2) * 0.19, 0.78, 0);
    core.add(pip);
    coreHealthPips.push(pip);
  }

  const wavePips = [];
  for (let i = 0; i < TOTAL_WAVES; i++) {
    const pip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08),
      new THREE.MeshBasicMaterial({ color: 0x24425f })
    );
    pip.position.set((i - 1) * 0.24, 0.98, 0);
    core.add(pip);
    wavePips.push(pip);
  }

  const physicsShootables = [];
  const crateMaterial = new THREE.MeshStandardMaterial({
    color: 0x377da6,
    emissive: 0x071b2c,
    emissiveIntensity: 0.75,
    roughness: 0.48,
    metalness: 0.48
  });
  const orbMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0a94f,
    emissive: 0x7d3305,
    emissiveIntensity: 1.55,
    roughness: 0.28,
    metalness: 0.2
  });

  function createCrate(x, y, z, scale = 0.46) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale, scale, scale), crateMaterial.clone());
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    const entry = physics.addDynamicBox(mesh, { x: scale / 2, y: scale / 2, z: scale / 2 }, {
      density: 1.25,
      restitution: 0.12,
      friction: 0.78,
      kind: 'crate'
    });
    mesh.userData.physicsEntry = entry;
    physicsShootables.push(mesh);
    return entry;
  }

  function createEnergyOrb(x, y, z, radius = 0.18) {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), orbMaterial.clone());
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const entry = physics.addDynamicBall(mesh, radius, {
      density: 0.7,
      restitution: 0.52,
      friction: 0.45,
      kind: 'energy-orb'
    });
    mesh.userData.physicsEntry = entry;
    physicsShootables.push(mesh);
    return entry;
  }

  function createOrbPedestal(x, z) {
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.78, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x182b42, roughness: 0.48, metalness: 0.62 })
    );
    pedestal.position.set(x, 0.39, z);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    scene.add(pedestal);
    physics.addFixedBox({ x, y: 0.39, z }, { x: 0.21, y: 0.39, z: 0.21 }, { friction: 0.8 });
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.27, 0.018, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffa84d, transparent: true, opacity: 0.65 })
    );
    halo.rotation.x = Math.PI / 2;
    halo.position.set(x, 0.82, z);
    scene.add(halo);
    createEnergyOrb(x, 1.01, z, 0.18);
  }

  const cratePositions = [
    [-1.55, 0.25, -1.1], [-2.05, 0.25, -1.55], [-2.55, 0.25, -2.0],
    [1.65, 0.25, -1.25], [2.1, 0.25, -1.75], [2.55, 0.25, -2.15],
    [2.25, 0.72, -2.15], [-2.25, 0.72, -2.1]
  ];
  for (const [x, y, z] of cratePositions) createCrate(x, y, z);
  createOrbPedestal(-0.55, -0.63);
  createOrbPedestal(0.55, -0.63);
  createEnergyOrb(0.9, 0.22, -1.55);

  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();
  const tempDirection = new THREE.Vector3();
  const tempOrigin = new THREE.Vector3();
  const tempPosition = new THREE.Vector3();
  const tempQuaternion = new THREE.Quaternion();
  const tempScale = new THREE.Vector3();
  const desiredGrabMatrix = new THREE.Matrix4();
  const projectiles = [];
  const enemyBolts = [];
  const effects = [];
  const drones = [];
  const droneRoots = [];
  const controllers = [];
  const connectedHands = new Map();

  let score = 0;
  let coreHealth = MAX_CORE_HEALTH;
  let currentWave = 0;
  let waveSpawnRemaining = 0;
  let waveSpawnTimer = 0;
  let nextWaveTimer = 0;
  let gameState = 'ready';
  let desktopStarted = false;
  let droneId = 0;

  function updateReadout() {
    scoreEl.textContent = String(score);
    readoutLabelEl.textContent = `score · wave ${currentWave} / ${TOTAL_WAVES}`;
  }

  function refreshControllerStatus() {
    const hands = [...connectedHands.values()];
    if (hands.includes('left') && hands.includes('right')) {
      setStatus('controllers', 'Controllers: left + right connected', 'ok');
    } else if (hands.length > 0) {
      setStatus('controllers', `Controllers: ${hands.join(' + ')}; waiting for second`, 'pending');
    } else {
      setStatus('controllers', 'Controllers: waiting for XR session');
    }
  }

  function haptic(controllerState, intensity = 0.25, duration = 35) {
    try {
      const source = controllerState.controller.userData.inputSource;
      const actuator = source?.gamepad?.hapticActuators?.[0];
      const result = actuator?.pulse?.(intensity, duration);
      result?.catch?.(() => {});
    } catch {
      // Optional feedback only.
    }
  }

  function pulseBoth(intensity = 0.3, duration = 50) {
    for (const state of controllers) haptic(state, intensity, duration);
  }

  function spawnPulse(origin, direction, color = 0x9ff4ff, speed = 14) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 7),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(origin);
    scene.add(mesh);
    projectiles.push({ mesh, velocity: direction.clone().multiplyScalar(speed), life: 0.7 });
  }

  function spawnBurst(position, color = 0x67e5ff, count = 10) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.035 + Math.random() * 0.025),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 })
      );
      mesh.position.copy(position);
      scene.add(mesh);
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        Math.random() * 2.1,
        (Math.random() - 0.5) * 2.4
      );
      effects.push({ mesh, velocity, life: 0.42 + Math.random() * 0.25 });
    }
  }

  function makeDrone(isElite = false) {
    const root = new THREE.Group();
    const radius = isElite ? 0.48 : 0.31;
    const body = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 2),
      new THREE.MeshStandardMaterial({
        color: isElite ? 0xff884d : 0xff4f72,
        emissive: isElite ? 0x8e2507 : 0x680b27,
        emissiveIntensity: 2.2,
        roughness: 0.28,
        metalness: 0.46
      })
    );
    body.castShadow = true;
    root.add(body);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.35, 0.035, 8, 32),
      new THREE.MeshBasicMaterial({ color: isElite ? 0xffc15c : 0xff6684, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    root.add(ring);

    root.position.set((Math.random() - 0.5) * 8.2, 1.05 + Math.random() * 2.05, -6.35 + Math.random() * 0.7);
    scene.add(root);

    const drone = {
      id: ++droneId,
      root,
      body,
      ring,
      radius,
      hp: isElite ? 4 : 1,
      speed: isElite ? 0.58 : 0.72 + Math.random() * 0.24,
      fireTimer: 1.2 + Math.random() * 1.9,
      phase: Math.random() * Math.PI * 2,
      dead: false,
      elite: isElite
    };
    root.userData.drone = drone;
    body.userData.drone = drone;
    ring.userData.drone = drone;
    drones.push(drone);
    droneRoots.push(root);
    return drone;
  }

  function removeDrone(drone) {
    drone.dead = true;
    scene.remove(drone.root);
    const droneIndex = drones.indexOf(drone);
    if (droneIndex >= 0) drones.splice(droneIndex, 1);
    const rootIndex = droneRoots.indexOf(drone.root);
    if (rootIndex >= 0) droneRoots.splice(rootIndex, 1);
  }

  function damageDrone(drone, amount, impactPosition) {
    if (!drone || drone.dead) return;
    drone.hp -= amount;
    drone.body.material.emissiveIntensity = 5.5;
    setTimeout(() => {
      if (!drone.dead) drone.body.material.emissiveIntensity = 2.2;
    }, 70);
    const impact = impactPosition ?? drone.root.position;
    spawnBurst(impact, drone.elite ? 0xffb45e : 0xff5b83, drone.elite ? 14 : 9);
    audio.hit(impact);
    if (drone.hp <= 0) {
      score += drone.elite ? 500 : 120;
      updateReadout();
      spawnBurst(drone.root.position, drone.elite ? 0xffbb5d : 0xff4b78, drone.elite ? 28 : 17);
      audio.explosion(drone.root.position, drone.elite);
      removeDrone(drone);
    }
  }

  function damageCore(amount = 1) {
    if (gameState !== 'playing') return;
    coreHealth = Math.max(0, coreHealth - amount);
    for (let i = 0; i < coreHealthPips.length; i++) {
      coreHealthPips[i].material.color.setHex(i < coreHealth ? 0x62f4c8 : 0x382033);
      coreHealthPips[i].scale.setScalar(i < coreHealth ? 1 : 0.72);
    }
    accentLight.intensity = 8;
    setTimeout(() => { accentLight.intensity = 4.5; }, 90);
    const coreWorld = core.getWorldPosition(new THREE.Vector3());
    audio.coreHit(coreWorld);
    pulseBoth(0.32, 55);
    if (coreHealth <= 0) {
      gameState = 'failed';
      setStatus('game', 'Game: reactor lost — resetting…', 'bad');
      nextWaveTimer = 3.2;
    }
  }

  function removeEnemyBolt(bolt) {
    scene.remove(bolt.mesh);
    const index = enemyBolts.indexOf(bolt);
    if (index >= 0) enemyBolts.splice(index, 1);
  }

  function clearCombatObjects() {
    for (const drone of [...drones]) removeDrone(drone);
    for (const bolt of [...enemyBolts]) removeEnemyBolt(bolt);
    for (const pulse of projectiles) scene.remove(pulse.mesh);
    projectiles.length = 0;
    for (const effect of effects) scene.remove(effect.mesh);
    effects.length = 0;
  }

  function resetGame(startImmediately = true) {
    for (const state of controllers) {
      if (state.grab) endGrab(state);
    }
    clearCombatObjects();
    physics.resetDynamicBodies();
    score = 0;
    coreHealth = MAX_CORE_HEALTH;
    currentWave = 0;
    waveSpawnRemaining = 0;
    waveSpawnTimer = 0;
    nextWaveTimer = startImmediately ? 3.4 : 0;
    gameState = startImmediately ? 'between-waves' : 'ready';
    for (const pip of coreHealthPips) {
      pip.material.color.setHex(0x62f4c8);
      pip.scale.setScalar(1);
    }
    for (const pip of wavePips) pip.material.color.setHex(0x24425f);
    setStatus('game', startImmediately ? 'Game: reactor online — orient, grab, then defend' : 'Game: ready', 'ok');
    updateReadout();
  }

  function startWave(wave) {
    currentWave = wave;
    gameState = 'playing';
    wavePips[wave - 1]?.material.color.setHex(0x5ee8ff);
    waveSpawnRemaining = 2 + wave * 2;
    waveSpawnTimer = 0.35;
    setStatus('game', `Game: wave ${wave} active`, 'ok');
    updateReadout();
  }

  function finishWaveIfReady() {
    if (gameState !== 'playing' || waveSpawnRemaining > 0 || drones.length > 0) return;
    if (currentWave >= TOTAL_WAVES) {
      gameState = 'won';
      setStatus('game', 'Game: reactor defended — victory', 'ok');
      for (const pip of wavePips) pip.material.color.setHex(0x76ffc6);
      nextWaveTimer = 4.5;
    } else {
      gameState = 'between-waves';
      wavePips[currentWave - 1]?.material.color.setHex(0x76ffc6);
      nextWaveTimer = 2.0;
      setStatus('game', `Game: wave ${currentWave} clear`, 'ok');
    }
  }

  function spawnEnemyBolt(drone) {
    if (drone.dead || gameState !== 'playing') return;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(drone.elite ? 0.075 : 0.055, 10, 8),
      new THREE.MeshBasicMaterial({ color: drone.elite ? 0xffb33e : 0xff395f })
    );
    mesh.position.copy(drone.root.position);
    scene.add(mesh);
    const direction = core.getWorldPosition(new THREE.Vector3()).sub(mesh.position).normalize();
    const bolt = { mesh, velocity: direction.multiplyScalar(drone.elite ? 2.5 : 2.05), life: 4.5 };
    mesh.userData.enemyBolt = bolt;
    enemyBolts.push(bolt);
  }

  function findHitOwner(object) {
    let node = object;
    while (node) {
      if (node.userData?.drone) return { type: 'drone', value: node.userData.drone };
      if (node.userData?.physicsEntry) return { type: 'physics', value: node.userData.physicsEntry };
      if (node.userData?.enemyBolt) return { type: 'enemy-bolt', value: node.userData.enemyBolt };
      node = node.parent;
    }
    return null;
  }

  function fire(controllerState) {
    audio.unlock();
    controllerState.controller.updateWorldMatrix(true, false);
    tempMatrix.identity().extractRotation(controllerState.controller.matrixWorld);
    tempDirection.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
    tempOrigin.setFromMatrixPosition(controllerState.controller.matrixWorld);
    spawnPulse(tempOrigin, tempDirection);
    audio.shot(tempOrigin);

    raycaster.set(tempOrigin, tempDirection);
    raycaster.far = 30;
    const hit = raycaster.intersectObjects([
      ...droneRoots,
      ...physicsShootables,
      ...enemyBolts.map((bolt) => bolt.mesh)
    ], true)[0];
    if (hit) {
      const owner = findHitOwner(hit.object);
      if (owner?.type === 'drone') {
        damageDrone(owner.value, 1, hit.point);
        haptic(controllerState, 0.48, 45);
      } else if (owner?.type === 'physics') {
        physics.applyImpulse(owner.value, tempDirection.clone().multiplyScalar(owner.value.kind === 'energy-orb' ? 1.1 : 1.8));
        spawnBurst(hit.point, 0x7feaff, 5);
        audio.hit(hit.point);
        haptic(controllerState, 0.22, 25);
      } else if (owner?.type === 'enemy-bolt') {
        removeEnemyBolt(owner.value);
        score += 25;
        updateReadout();
        spawnBurst(hit.point, 0xff6688, 7);
        audio.hit(hit.point);
        haptic(controllerState, 0.3, 30);
      }
    } else {
      haptic(controllerState, 0.12, 18);
    }
  }

  function beginGrab(controllerState) {
    audio.unlock();
    if (controllerState.grab) return;
    controllerState.grip.updateWorldMatrix(true, false);
    tempOrigin.setFromMatrixPosition(controllerState.grip.matrixWorld);
    const entry = physics.findNearestGrabbable(tempOrigin, 0.62);
    if (!entry || !physics.beginGrab(entry, controllerState.index)) return;

    entry.mesh.updateMatrixWorld(true);
    const offset = new THREE.Matrix4().copy(controllerState.grip.matrixWorld).invert().multiply(entry.mesh.matrixWorld);
    controllerState.grab = { entry, offset };
    entry.mesh.material.emissiveIntensity = (entry.mesh.material.emissiveIntensity ?? 0) + 1.5;
    controllerState.blaster.visible = false;
    audio.grab(tempOrigin);
    haptic(controllerState, 0.35, 45);
  }

  function endGrab(controllerState) {
    const grab = controllerState.grab;
    if (!grab) return;
    const grip = controllerState.grip;
    physics.endGrab(
      grab.entry,
      grip.hasLinearVelocity ? grip.linearVelocity : null,
      grip.hasAngularVelocity ? grip.angularVelocity : null
    );
    if (grab.entry.kind === 'crate') grab.entry.mesh.material.emissiveIntensity = 0.75;
    if (grab.entry.kind === 'energy-orb') grab.entry.mesh.material.emissiveIntensity = 1.55;
    controllerState.grab = null;
    controllerState.blaster.visible = true;
    haptic(controllerState, 0.18, 25);
  }

  function updateGrab(controllerState) {
    if (!controllerState.grab) return;
    controllerState.grip.updateWorldMatrix(true, false);
    desiredGrabMatrix.copy(controllerState.grip.matrixWorld).multiply(controllerState.grab.offset);
    desiredGrabMatrix.decompose(tempPosition, tempQuaternion, tempScale);
    physics.moveGrabbed(controllerState.grab.entry, tempPosition, tempQuaternion);
  }

  function makeBlaster(color, emissive) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.105, 0.24),
      new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.25, roughness: 0.25, metalness: 0.65 })
    );
    body.position.z = -0.08;
    group.add(body);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.035, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0x1e2938, metalness: 0.8, roughness: 0.25 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.012, -0.25);
    group.add(barrel);
    const muzzle = new THREE.Mesh(
      new THREE.TorusGeometry(0.038, 0.009, 8, 20),
      new THREE.MeshBasicMaterial({ color })
    );
    muzzle.position.set(0, 0.012, -0.365);
    group.add(muzzle);
    return group;
  }

  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    const grip = renderer.xr.getControllerGrip(i);
    const blaster = makeBlaster(i === 0 ? 0x59c5ff : 0xff69ca, i === 0 ? 0x0c4f7d : 0x6e174f);
    grip.add(blaster);
    const state = { index: i, controller, grip, blaster, grab: null, handedness: 'none' };

    const handMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.085, 0.11),
      new THREE.MeshStandardMaterial({
        color: i === 0 ? 0x58b7ff : 0xff68c7,
        emissive: i === 0 ? 0x123e70 : 0x6b154d,
        emissiveIntensity: 0.8,
        roughness: 0.36,
        metalness: 0.35
      })
    );
    handMarker.position.set(0, -0.02, 0.06);
    grip.add(handMarker);

    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)
    ]);
    const line = new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: i === 0 ? 0x83d9ff : 0xff8ed7, transparent: true, opacity: 0.42 })
    );
    line.scale.z = 5.5;
    controller.add(line);

    controller.addEventListener('connected', (event) => {
      controller.userData.inputSource = event.data;
      state.handedness = event.data.handedness || 'none';
      connectedHands.set(i, state.handedness);
      refreshControllerStatus();
    });
    controller.addEventListener('disconnected', () => {
      endGrab(state);
      controller.userData.inputSource = null;
      connectedHands.delete(i);
      refreshControllerStatus();
    });
    controller.addEventListener('selectstart', () => fire(state));
    controller.addEventListener('squeezestart', () => beginGrab(state));
    controller.addEventListener('squeezeend', () => endGrab(state));

    player.add(controller, grip);
    controllers.push(state);
  }

  function updateDrones(dt, time) {
    const coreWorld = core.getWorldPosition(new THREE.Vector3());
    for (const drone of [...drones]) {
      if (drone.dead) continue;
      const toCore = tempPosition.copy(coreWorld).sub(drone.root.position);
      const distance = toCore.length();
      if (distance > 3.25) {
        toCore.normalize();
        drone.root.position.addScaledVector(toCore, drone.speed * dt);
      } else {
        drone.root.position.x += Math.sin(time * 1.7 + drone.phase) * dt * 0.22;
        drone.root.position.y += Math.sin(time * 2.1 + drone.phase) * dt * 0.12;
        drone.fireTimer -= dt;
        if (drone.fireTimer <= 0) {
          drone.fireTimer = drone.elite ? 1.35 : 2.2 + Math.random() * 1.25;
          spawnEnemyBolt(drone);
        }
      }
      drone.root.rotation.y += dt * (drone.elite ? 0.75 : 1.25);
      drone.ring.rotation.z += dt * (drone.elite ? -1.9 : 2.7);
    }
  }

  function updateEnemyBolts(dt) {
    const coreWorld = core.getWorldPosition(new THREE.Vector3());
    for (let i = enemyBolts.length - 1; i >= 0; i--) {
      const bolt = enemyBolts[i];
      bolt.mesh.position.addScaledVector(bolt.velocity, dt);
      bolt.life -= dt;
      if (bolt.mesh.position.distanceToSquared(coreWorld) < 0.28 * 0.28) {
        spawnBurst(coreWorld, 0xff4366, 12);
        removeEnemyBolt(bolt);
        damageCore(1);
      } else if (bolt.life <= 0) {
        removeEnemyBolt(bolt);
      }
    }
  }

  function updateThrownObjectHits() {
    for (const entry of physics.grabbables) {
      if (entry.heldBy !== null || !entry.body.isDynamic()) continue;
      const velocity = entry.body.linvel();
      const speedSq = velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z;
      if (speedSq < 3.2) continue;
      const objectPosition = entry.mesh.position;
      for (const drone of [...drones]) {
        const threshold = drone.radius + (entry.kind === 'energy-orb' ? 0.2 : 0.34);
        if (objectPosition.distanceToSquared(drone.root.position) < threshold * threshold) {
          damageDrone(drone, entry.kind === 'energy-orb' ? 2 : 1, objectPosition);
          physics.applyImpulse(entry, new THREE.Vector3(-velocity.x, Math.abs(velocity.y) * 0.25 + 0.6, -velocity.z).multiplyScalar(0.18));
          break;
        }
      }
    }
  }

  function updateWaveDirector(dt) {
    if (gameState === 'playing') {
      if (waveSpawnRemaining > 0) {
        waveSpawnTimer -= dt;
        if (waveSpawnTimer <= 0) {
          const isElite = currentWave === TOTAL_WAVES && waveSpawnRemaining === 1;
          makeDrone(isElite);
          waveSpawnRemaining -= 1;
          waveSpawnTimer = isElite ? 1.3 : 0.72;
        }
      }
      finishWaveIfReady();
      return;
    }

    if (gameState === 'between-waves') {
      nextWaveTimer -= dt;
      if (nextWaveTimer <= 0) startWave(currentWave + 1);
      return;
    }

    if (gameState === 'won' || gameState === 'failed') {
      nextWaveTimer -= dt;
      if (nextWaveTimer <= 0) resetGame(true);
    }
  }

  renderer.xr.addEventListener('sessionstart', () => {
    audio.unlock();
    refreshControllerStatus();
    resetGame(true);
    setStatus('vr', 'immersive-vr: session active', 'ok');
  });

  renderer.xr.addEventListener('sessionend', () => {
    for (const state of controllers) endGrab(state);
    connectedHands.clear();
    refreshControllerStatus();
    clearCombatObjects();
    physics.resetDynamicBodies();
    gameState = 'ready';
    camera.position.copy(desktopCameraState.position);
    camera.quaternion.copy(desktopCameraState.quaternion);
    camera.scale.copy(desktopCameraState.scale);
    camera.updateMatrix();
    camera.updateMatrixWorld(true);
    setStatus(
      'vr',
      immersiveVrSupported === true ? 'immersive-vr: supported (session ended)' : 'immersive-vr: session ended',
      immersiveVrSupported === false ? 'bad' : 'ok'
    );
  });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (renderer.xr.isPresenting) return;
    audio.unlock();
    if (!desktopStarted) {
      desktopStarted = true;
      resetGame(true);
    }
    const rect = renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([
      ...droneRoots,
      ...physicsShootables,
      ...enemyBolts.map((bolt) => bolt.mesh)
    ], true)[0];
    if (!hit) return;
    const owner = findHitOwner(hit.object);
    if (owner?.type === 'drone') damageDrone(owner.value, 1, hit.point);
    if (owner?.type === 'physics') physics.applyImpulse(owner.value, raycaster.ray.direction.clone().multiplyScalar(1.8));
    if (owner?.type === 'enemy-bolt') {
      removeEnemyBolt(owner.value);
      spawnBurst(hit.point, 0xff6688, 7);
    }
  });

  setStatus('game', 'Game: F1 arena ready', 'ok');
  updateReadout();

  const clock = new THREE.Clock();
  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = performance.now() * 0.001;

    for (const state of controllers) updateGrab(state);
    physics.step(dt);

    coreShell.rotation.x += dt * 0.45;
    coreShell.rotation.y += dt * 0.7;
    coreRingA.rotation.z += dt * 0.85;
    coreRingB.rotation.z -= dt * 0.7;

    updateWaveDirector(dt);
    updateDrones(dt, time);
    updateEnemyBolts(dt);
    updateThrownObjectHits();

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pulse = projectiles[i];
      pulse.mesh.position.addScaledVector(pulse.velocity, dt);
      pulse.life -= dt;
      if (pulse.life <= 0) {
        scene.remove(pulse.mesh);
        projectiles.splice(i, 1);
      }
    }

    for (let i = effects.length - 1; i >= 0; i--) {
      const effect = effects[i];
      effect.mesh.position.addScaledVector(effect.velocity, dt);
      effect.velocity.y -= 2.8 * dt;
      effect.life -= dt;
      effect.mesh.material.opacity = Math.max(0, effect.life * 2.1);
      effect.mesh.scale.multiplyScalar(Math.max(0.93, 1 - dt * 1.8));
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
}
