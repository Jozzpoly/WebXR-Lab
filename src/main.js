import './style.css';
import { createSeedMachine, extendFromNode, machineFingerprint } from './core/machine-document.js';
import { compileMachine } from './runtime/compile-machine.js';
import { RapierMachineRuntime } from './runtime/rapier-runtime.js';
import { RiftworksScene } from './view/scene.js';
import { attachDesktopBuilder } from './input/desktop-builder.js';
import { installXrEmulationIfNeeded } from './xr/emulation.js';
import { setupXrConstruction } from './xr/setup-xr.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app-shell">
    <div id="viewport" class="viewport"></div>
    <header class="topbar">
      <div>
        <p class="eyebrow">Riftworks · B0</p>
        <h1>Machine Yard</h1>
      </div>
      <div class="status-stack">
        <span id="modeBadge" class="badge">BOOTING</span>
        <span id="xrBadge" class="badge subtle">XR: checking</span>
      </div>
    </header>
    <aside class="panel">
      <p class="panel-kicker">Construction loop</p>
      <strong id="truthLine">Loading physics…</strong>
      <p id="detailLine">Preparing authored → runtime boundary.</p>
      <div class="controls">
        <button id="runButton" class="primary" disabled>RUN</button>
        <button id="undoButton" disabled>UNDO</button>
        <button id="resetButton" disabled>RESET BUILD</button>
        <button id="gridButton" class="active" disabled>GRID 25 cm</button>
      </div>
      <div class="metrics">
        <span>nodes <b id="nodeCount">–</b></span>
        <span>beams <b id="beamCount">–</b></span>
        <span>islands <b id="islandCount">–</b></span>
      </div>
      <p class="hint"><b>Desktop:</b> LMB drag from a white socket to extend/connect. RMB orbit. Wheel zoom.</p>
      <p class="hint"><b>XR/IWER:</b> squeeze near a socket, move the hand, release. Add <code>?emulate=1</code> on desktop for IWER.</p>
      <div id="xrMount" class="xr-mount"></div>
    </aside>
  </div>
`;

const viewport = document.querySelector('#viewport');
const modeBadge = document.querySelector('#modeBadge');
const xrBadge = document.querySelector('#xrBadge');
const truthLine = document.querySelector('#truthLine');
const detailLine = document.querySelector('#detailLine');
const runButton = document.querySelector('#runButton');
const undoButton = document.querySelector('#undoButton');
const resetButton = document.querySelector('#resetButton');
const gridButton = document.querySelector('#gridButton');
const nodeCount = document.querySelector('#nodeCount');
const beamCount = document.querySelector('#beamCount');
const islandCount = document.querySelector('#islandCount');
const xrMount = document.querySelector('#xrMount');

const emulation = await installXrEmulationIfNeeded();
const view = new RiftworksScene(viewport);
const runtime = await RapierMachineRuntime.create();

let documentState = createSeedMachine();
let mode = 'build';
let history = [];
let gridEnabled = true;
let activePlan = compileMachine(documentState);
let runFingerprint = null;

function updateUi(message = null) {
  const plan = mode === 'build' ? compileMachine(documentState) : activePlan;
  nodeCount.textContent = String(documentState.nodes.length);
  beamCount.textContent = String(documentState.beams.length);
  islandCount.textContent = String(plan.islands.length);
  modeBadge.textContent = mode === 'build' ? 'BUILD' : 'RUN';
  modeBadge.classList.toggle('running', mode === 'run');
  runButton.textContent = mode === 'build' ? 'RUN' : 'STOP';
  undoButton.disabled = mode !== 'build' || history.length === 0;
  resetButton.disabled = mode !== 'build';
  gridButton.disabled = mode !== 'build';
  gridButton.classList.toggle('active', gridEnabled);
  truthLine.textContent = mode === 'build'
    ? 'Authored machine is authority.'
    : 'Disposable Rapier runtime is active.';
  detailLine.textContent = message ?? (mode === 'build'
    ? 'Drag from any socket to change topology, then RUN.'
    : 'Physics may move or collapse the machine; authored state remains untouched.');
}

function commitDocument(next, message) {
  if (next === documentState || mode !== 'build') return;
  history.push(documentState);
  documentState = next;
  activePlan = compileMachine(documentState);
  view.renderAuthored(documentState);
  updateUi(message);
}

function commitExtend(startId, endPosition, targetId) {
  const next = extendFromNode(documentState, startId, endPosition, targetId);
  commitDocument(next, targetId ? 'Connected existing sockets.' : 'Extended structure with a new socket.');
}

function startRun() {
  if (mode !== 'build') return;
  activePlan = compileMachine(documentState);
  runFingerprint = machineFingerprint(documentState);
  runtime.start(activePlan);
  view.createRuntimeVisual(activePlan);
  mode = 'run';
  view.setMode('run');
  updateUi('Compiled authored topology into fresh rigid islands.');
}

function stopRun() {
  if (mode !== 'run') return;
  runtime.stop();
  const unchanged = machineFingerprint(documentState) === runFingerprint;
  mode = 'build';
  view.setMode('build');
  view.renderAuthored(documentState);
  updateUi(unchanged
    ? 'STOP restored authored truth exactly; runtime motion was disposable.'
    : 'AUTHORITY VIOLATION: runtime changed authored truth.');
  runFingerprint = null;
}

runButton.addEventListener('click', () => mode === 'build' ? startRun() : stopRun());
undoButton.addEventListener('click', () => {
  if (mode !== 'build' || history.length === 0) return;
  documentState = history.pop();
  activePlan = compileMachine(documentState);
  view.renderAuthored(documentState);
  updateUi('Undid the last authored construction command.');
});
resetButton.addEventListener('click', () => {
  if (mode !== 'build') return;
  history.push(documentState);
  documentState = createSeedMachine();
  activePlan = compileMachine(documentState);
  view.renderAuthored(documentState);
  updateUi('Reset to the seed machine.');
});
gridButton.addEventListener('click', () => {
  gridEnabled = !gridEnabled;
  updateUi(gridEnabled ? 'Desktop placement grid enabled.' : 'Desktop placement grid disabled.');
});
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoButton.click();
  }
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    runButton.click();
  }
});

attachDesktopBuilder({
  view,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  commitExtend,
  getGridEnabled: () => gridEnabled,
});

view.renderAuthored(documentState);
view.setMode('build');

const xrConstruction = setupXrConstruction({
  view,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  commitExtend,
  mountButton: xrMount,
});

xrBadge.textContent = emulation.mode === 'iwer'
  ? 'XR: IWER emulation'
  : emulation.mode === 'native'
    ? 'XR: native immersive'
    : 'XR: browser preview';

runButton.disabled = false;
resetButton.disabled = false;
gridButton.disabled = false;
updateUi('Foundation ready. Build topology, RUN it, STOP, repeat.');

let previousTime = performance.now();
view.renderer.setAnimationLoop((time) => {
  const now = Number.isFinite(time) ? time : performance.now();
  const dt = Math.max(0, (now - previousTime) / 1000);
  previousTime = now;
  if (mode === 'run') {
    runtime.step(dt);
    view.updateRuntime(runtime.sample());
  }
  xrConstruction.update();
  view.render();
});
