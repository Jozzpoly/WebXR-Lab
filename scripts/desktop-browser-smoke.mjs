import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import {
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  extendFromBeamEnd,
  rehostPoweredWheel,
} from '../src/core/machine-document.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { proposePoweredWheelPlacement } from '../src/input/wheel-placement.js';

const HOST = '127.0.0.1';
const VITE_PORT = 4175;
const CDP_PORT = 9223;
const PAGE_URL = `http://${HOST}:${VITE_PORT}/`;
const MACHINE_WORLD_OFFSET = new THREE.Vector3(0, 0.72 + 0.45, -0.78);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function waitForJson(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      for (const listener of listeners) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const listener = (params) => {
        clearTimeout(timer);
        const current = this.events.get(method) ?? [];
        this.events.set(method, current.filter((candidate) => candidate !== listener));
        resolve(params);
      };
      const timer = setTimeout(() => {
        const current = this.events.get(method) ?? [];
        this.events.set(method, current.filter((candidate) => candidate !== listener));
        reject(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      const current = this.events.get(method) ?? [];
      current.push(listener);
      this.events.set(method, current);
    });
  }

  async evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate failed');
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function stopProcess(process, timeoutMs = 1200) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  process.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => process.once('exit', resolve)),
    wait(timeoutMs),
  ]);
  if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL');
}

function snapPoint(point, size = 0.25) {
  return point.map((value) => Math.round(value / size) * size);
}

function makeCamera(rect) {
  const camera = new THREE.PerspectiveCamera(58, rect.width / rect.height, 0.03, 50);
  camera.position.set(2.45, 2.15, 2.45);
  camera.lookAt(0, 1.08, -0.78);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

function projectMachine(point, camera, rect) {
  const projected = new THREE.Vector3(...point).add(MACHINE_WORLD_OFFSET).project(camera);
  return {
    x: rect.x + (projected.x + 1) * 0.5 * rect.width,
    y: rect.y + (1 - projected.y) * 0.5 * rect.height,
  };
}

function buildBeamMeshes(document) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const meshes = [];
  for (const island of compileMachine(document).islands) {
    for (const beam of island.beams) {
      const mesh = new THREE.Mesh(geometry);
      mesh.position.set(...beam.machinePosition).add(MACHINE_WORLD_OFFSET);
      mesh.quaternion.set(...beam.machineRotation);
      mesh.scale.set(beam.length, beam.thickness, beam.thickness);
      mesh.userData.beamId = beam.id;
      mesh.updateMatrixWorld(true);
      meshes.push(mesh);
    }
  }
  return meshes;
}

function beamSurfaceAtScreen(document, screen, camera, rect) {
  const ndc = new THREE.Vector2(
    ((screen.x - rect.x) / rect.width) * 2 - 1,
    -((screen.y - rect.y) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(buildBeamMeshes(document), false)[0];
  if (!hit?.face) return null;
  const geometryLocal = hit.object.worldToLocal(hit.point.clone());
  return {
    beamId: hit.object.userData.beamId,
    localPosition: [
      geometryLocal.x * hit.object.scale.x,
      geometryLocal.y * hit.object.scale.y,
      geometryLocal.z * hit.object.scale.z,
    ],
    localNormal: hit.face.normal.toArray(),
  };
}

async function mouseClick(client, point) {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function mouseDrag(client, from, to) {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 5; i += 1) {
    const t = i / 5;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      button: 'left',
      buttons: 1,
    });
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
}

async function elementCenter(client, selector) {
  return client.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, width: r.width, height: r.height, disabled: Boolean(element.disabled) };
  })()`);
}

async function clickElement(client, selector) {
  const center = await elementCenter(client, selector);
  if (!center || center.width <= 0 || center.height <= 0 || center.disabled) {
    throw new Error(`${selector} is not interactable: ${JSON.stringify(center)}`);
  }
  await mouseClick(client, center);
}

async function readUi(client) {
  return client.evaluate(`(() => ({
    mode: document.querySelector('#modeBadge')?.textContent ?? null,
    truth: document.querySelector('#truthLine')?.textContent ?? null,
    detail: document.querySelector('#detailLine')?.textContent ?? null,
    beams: Number(document.querySelector('#beamCount')?.textContent),
    wheels: Number(document.querySelector('#wheelCount')?.textContent),
    selectedWheel: document.querySelector('#selectedWheelLabel')?.textContent ?? null,
    componentEditorVisible: !document.querySelector('#componentEditor')?.hidden,
  }))()`);
}

async function waitForUi(client, predicate, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await readUi(client);
    if (predicate(last)) return last;
    await wait(50);
  }
  throw new Error(`${label}: timed out. Last UI state: ${JSON.stringify(last)}`);
}

async function requireCanvasPoint(client, point, label) {
  const hit = await client.evaluate(`document.elementFromPoint(${point.x}, ${point.y})?.tagName ?? null`);
  if (hit !== 'CANVAS') throw new Error(`${label}: projected point is intercepted by ${hit ?? 'nothing'} at ${JSON.stringify(point)}`);
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error('No system Chrome/Chromium binary found on CI runner');

  const profile = mkdtempSync(join(tmpdir(), 'riftworks-desktop-'));
  const vite = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', HOST, '--port', String(VITE_PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chromeProcess = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,900',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let viteStderr = '';
  let chromeStderr = '';
  vite.stderr.on('data', (chunk) => { viteStderr += chunk.toString(); });
  chromeProcess.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

  let client = null;
  try {
    await waitForHttp(PAGE_URL);
    await waitForJson(`http://${HOST}:${CDP_PORT}/json/version`);
    const targets = await waitForJson(`http://${HOST}:${CDP_PORT}/json/list`);
    const page = targets.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome exposed no debuggable page target');

    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: PAGE_URL });
    await loaded;

    const initial = await waitForUi(client, (ui) => ui.mode === 'BUILD' && ui.beams === 0 && ui.wheels === 0, 'blank desktop workshop');
    const rect = await client.evaluate(`(() => {
      const r = document.querySelector('canvas')?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
    })()`);
    if (!rect?.width || !rect?.height) throw new Error('desktop canvas is unavailable');
    const camera = makeCamera(rect);
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();

    let mirror = createEmptyMachine();
    const beamStart = [-0.25, 0, 0.25];
    const rawBeamEnd = new THREE.Vector3(...beamStart).addScaledVector(cameraRight, 0.72).toArray();
    const beamEnd = snapPoint(rawBeamEnd);
    const beamStartScreen = projectMachine(beamStart, camera, rect);
    const beamEndScreen = projectMachine(rawBeamEnd, camera, rect);
    await requireCanvasPoint(client, beamStartScreen, 'beam create start');
    await requireCanvasPoint(client, beamEndScreen, 'beam create end');
    await mouseDrag(client, beamStartScreen, beamEndScreen);
    await waitForUi(client, (ui) => ui.beams === 1 && ui.detail?.startsWith('Created b1'), 'real mouse beam creation');
    mirror = createBeam(mirror, beamStart, beamEnd);

    const beamCenter = beamStart.map((value, index) => (value + beamEnd[index]) * 0.5);
    const beamCenterScreen = projectMachine(beamCenter, camera, rect);
    await mouseClick(client, beamCenterScreen);
    await waitForUi(client, (ui) => ui.truth?.includes('Selected b1'), 'real mouse beam selection');

    const outward = new THREE.Vector3(...beamEnd).sub(new THREE.Vector3(...beamStart)).normalize();
    const extendHandle = new THREE.Vector3(...beamEnd).addScaledVector(outward, 0.12 * 1.15).toArray();
    const rawExtensionEnd = new THREE.Vector3(...beamEnd).addScaledVector(cameraRight, 0.58).toArray();
    const extensionEnd = snapPoint(rawExtensionEnd);
    const extendHandleScreen = projectMachine(extendHandle, camera, rect);
    const extensionEndScreen = projectMachine(rawExtensionEnd, camera, rect);
    await requireCanvasPoint(client, extendHandleScreen, 'extend handle');
    await requireCanvasPoint(client, extensionEndScreen, 'extend target');
    await mouseDrag(client, extendHandleScreen, extensionEndScreen);
    await waitForUi(client, (ui) => ui.beams === 2 && ui.detail?.includes('Extended b1'), 'real mouse beam extension');
    mirror = extendFromBeamEnd(mirror, 'b1', 'b', extensionEnd);

    await clickElement(client, '#wheelToolButton');
    const b1 = compileMachine(mirror).islands.flatMap((island) => island.beams).find((beam) => beam.id === 'b1');
    if (!b1) throw new Error('mirror b1 missing before wheel placement');
    const beamProbe = projectMachine(b1.machinePosition, camera, rect);
    await requireCanvasPoint(client, beamProbe, 'wheel beam probe');
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: beamProbe.x, y: beamProbe.y });
    await wait(100);

    const surface = beamSurfaceAtScreen(mirror, beamProbe, camera, rect);
    if (!surface) throw new Error('could not resolve mirrored beam surface for wheel preview');
    const candidate = proposePoweredWheelPlacement(mirror, surface.beamId, surface.localPosition, surface.localNormal);
    let previewDoc = attachPoweredWheel(mirror, candidate.hostBeamId, {
      mount: candidate.mount,
      motorVelocity: candidate.motorVelocity,
    });
    const previewWheel = compileMachine(previewDoc).components.at(-1);
    if (!previewWheel) throw new Error('mirror wheel preview missing');
    const previewScreen = projectMachine(previewWheel.center, camera, rect);
    await requireCanvasPoint(client, previewScreen, 'wheel preview');
    await mouseClick(client, previewScreen);
    await waitForUi(client, (ui) => ui.wheels === 1 && ui.detail?.startsWith('Powered wheel mounted on'), 'real mouse wheel placement');
    mirror = previewDoc;

    const authoredWheel = compileMachine(mirror).components.find((component) => component.id === 'c1');
    const b2 = compileMachine(mirror).islands.flatMap((island) => island.beams).find((beam) => beam.id === 'b2');
    if (!authoredWheel || !b2) throw new Error('mirror wheel/b2 missing before direct rehost');
    const wheelScreen = projectMachine(authoredWheel.center, camera, rect);
    const rehostProbe = projectMachine(b2.machinePosition, camera, rect);
    await requireCanvasPoint(client, wheelScreen, 'existing wheel');
    await requireCanvasPoint(client, rehostProbe, 'wheel rehost target');

    const rehostSurface = beamSurfaceAtScreen(mirror, rehostProbe, camera, rect);
    if (!rehostSurface || rehostSurface.beamId !== 'b2') {
      throw new Error(`mirror rehost ray did not resolve b2: ${JSON.stringify(rehostSurface)}`);
    }
    const rehostCandidate = proposePoweredWheelPlacement(mirror, rehostSurface.beamId, rehostSurface.localPosition, rehostSurface.localNormal);
    await mouseDrag(client, wheelScreen, rehostProbe);
    const rehostUi = await waitForUi(client,
      (ui) => ui.wheels === 1 && ui.selectedWheel?.includes('c1 · host b2') && ui.detail?.includes('moved from b1 to b2'),
      'real mouse direct wheel rehost');
    mirror = rehostPoweredWheel(mirror, 'c1', rehostCandidate.hostBeamId, rehostCandidate.mount);

    await clickElement(client, '#runButton');
    await waitForUi(client, (ui) => ui.mode === 'RUN' && ui.beams === 2 && ui.wheels === 1, 'desktop RUN entry');
    await wait(350);
    await clickElement(client, '#runButton');
    const stopped = await waitForUi(client,
      (ui) => ui.mode === 'BUILD' && ui.beams === 2 && ui.wheels === 1 && ui.detail?.startsWith('STOP: simulation-world motion discarded'),
      'desktop STOP authored restoration');

    console.log('Desktop browser rehearsal PASS · 7/7');
    console.log('blank -> beam-create -> beam-select -> beam-extend -> wheel-place -> direct-wheel-rehost -> run-stop-authority');
    console.log(`Final UI: ${JSON.stringify(stopped)}`);
    console.log(`Rehost UI: ${JSON.stringify(rehostUi)}`);
    console.log(`Initial UI: ${JSON.stringify(initial)}`);
  } catch (error) {
    if (viteStderr.trim()) console.error(`\n[vite stderr]\n${viteStderr.slice(-4000)}`);
    if (chromeStderr.trim()) console.error(`\n[chrome stderr]\n${chromeStderr.slice(-6000)}`);
    throw error;
  } finally {
    client?.close();
    await Promise.allSettled([stopProcess(vite), stopProcess(chromeProcess)]);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // CI workspace is ephemeral; cleanup must never mask browser evidence.
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
