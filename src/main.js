import './style.css';
import { attachPoweredWheel, createSeedMachine, extendFromNode, machineFingerprint } from './core/machine-document.js';
import { createPoweredCartMachine } from './core/specimens.js';
import { compileMachine } from './runtime/compile-machine.js';
import { RapierMachineRuntime } from './runtime/rapier-runtime.js';
import { RiftworksScene } from './view/scene.js';
import { attachDesktopBuilder } from './input/desktop-builder.js';
import { attachDesktopComponents } from './input/desktop-components.js';
import { inferPoweredWheelPlacement } from './input/wheel-placement.js';
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
      <div class="toolstrip" aria-label="Construction tools">
        <button id="beamToolButton" class="tool active" disabled><span>1</span> BEAM</button>
        <button id="wheelToolButton" class="tool" disabled><span>2</span> POWERED WHEEL</button>
      </div>
      <button id="cartButton" class="specimen-button" disabled>LOAD CI-PROVEN CART SPECIMEN</button>
      <div class="controls">
        <button id="runButton" class="primary" disabled>RUN</button>
        <button id="undoButton" disabled>UNDO</button>
        <button id="resetButton" disabled>RESET BUILD</button>
        <button id="gridButton" class="active" disabled>GRID 25 cm</button>
      </div>
      <div class="metrics">
        <span>nodes <b id="nodeCount">–</b></span>
        <span>beams <b id="beamCount">–</b></span>
        <span>wheels <b id="wheelCount">–</b></span>
        <span>islands <b id="islandCount">–</b></span>
      </div>
      <p class="hint"><b>Beam:</b> LMB drag from a white socket. <b>Wheel:</b> choose Powered Wheel, then click a socket. RMB orbit. Space RUN/STOP.</p>
      <p class="hint"><b>Smoke:</b> load the CI-proven cart to isolate browser/presentation from builder quality.</p>
      <p class="hint"><b>XR/IWER:</b> squeeze near a socket. Active tool is shared with desktop. Add <code>?emulate=1</code> for IWER.</p>
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
const beamToolButton = document.querySelector('#beamToolButton');
const wheelToolButton = document.querySelector('#wheelToolButton');
const cartButton = document.querySelector('#cartButton');
const nodeCount = document.querySelector('#nodeCount');
const beamCount = document.querySelector('#beamCount');
const wheelCount = document.querySelector('#wheelCount');
const islandCount = document.querySelector('#islandCount');
const xrMount = document.querySelector('#xrMount');

const emulation = await installXrEmulationIfNeeded();
const view = new RiftworksScene(viewport);
const runtime = await RapierMachineRuntime.create();

let documentState = createSeedMachine();
let mode = 'build';
let tool = 'beam';
let history = [];
let gridEnabled = true;
let activePlan = compileMachine(documentState);
let runFingerprint = null;

function updateUi(message = null) {
  const plan = mode === 'build' ? compileMachine(documentState) : activePlan;
  nodeCount.textContent = String(documentState.nodes.length);
  beamCount.textContent = String(documentState.beams.length);
  wheelCount.textContent = String(documentState.components.filter((component) => component.kind === 'powered-wheel').length);
  islandCount.textContent = String(plan.islands.length);
  modeBadge.textContent = mode === 'build' ? 'BUILD' : 'RUN';
  modeBadge.classList.toggle('running', mode === 'run');
  runButton.textContent = mode === 'build' ? 'RUN' : 'STOP';
  undoButton.disabled = mode !== 'build' || history.length === 0;
  resetButton.disabled = mode !== 'build';
  gridButton.disabled = mode !== 'build';
  beamToolButton.disabled = mode !== 'build';
  wheelToolButton.disabled = mode !== 'build';
  cartButton.disabled = mode !== 'build';
  gridButton.classList.toggle('active', gridEnabled);
  beamToolButton.classList.toggle('active', tool === 'beam');
  wheelToolButton.classList.toggle('active', tool === 'powered-wheel');
  truthLine.textContent = mode === 'build'
    ? `Authored machine is authority · ${tool === 'beam' ? 'Beam tool' : 'Powered Wheel tool'}`
    : 'Disposable Rapier runtime is active.';
  detailLine.textContent = message ?? (mode === 'build'
    ? (tool === 'beam'
      ? 'Drag from any socket to change structural topology.'
      : 'Click a structural socket; axis and mount side are proposed, then stored explicitly.')
    : 'Physics owns evaluated motion; authored state remains untouched.');
}

function renderAuthored() {
  activePlan = compileMachine(documentState);
  view.renderAuthored(documentState, activePlan);
}

function commitDocument(next, message) {
  if (next === documentState || mode !== 'build') return;
  history.push(documentState);
  documentState = next;
  renderAuthored();
  updateUi(message);
}

function commitExtend(startId, endPosition, targetId) {
  const next = extendFromNode(documentState, startId, endPosition, targetId);
  commitDocument(next, targetId ? 'Connected existing sockets.' : 'Extended structure with a new socket.');
}

function commitPoweredWheel(nodeId) {
  if (mode !== 'build') return;
  const placement = inferPoweredWheelPlacement(documentState, nodeId);
  const duplicate = documentState.components.some((component) =>
    component.kind === 'powered-wheel' &&
    component.nodeId === nodeId &&
    component.side === placement.side &&
    component.axis.every((value, index) => value === placement.axis[index]));
  if (duplicate) {
    updateUi('That socket already has this powered-wheel placement.');
    return;
  }

  const next = attachPoweredWheel(documentState, nodeId, placement);
  commitDocument(next, `Powered wheel attached at ${nodeId} · axis ${placement.axis.join(',')} · side ${placement.side > 0 ? '+' : '−'}.`);
}

function selectTool(nextTool) {
  if (mode !== 'build') return;
  tool = nextTool;
  view.hideGhost();
  updateUi();
}

function startRun() {
  if (mode !== 'build') return;
  activePlan = compileMachine(documentState);
  runFingerprint = machineFingerprint(documentState);
  runtime.start(activePlan);
  view.createRuntimeVisual(activePlan);
  mode = 'run';
  view.setMode('run');
  updateUi(`Compiled ${activePlan.islands.length} rigid island(s) and ${activePlan.components.length} mechanical component(s).`);
}

function stopRun() {
  if (mode !== 'run') return;
  runtime.stop();
  const unchanged = machineFingerprint(documentState) === runFingerprint;
  mode = 'build';
  view.setMode('build');
  renderAuthored();
  updateUi(unchanged
    ? 'STOP restored authored truth exactly; runtime motion was disposable.'
    : 'AUTHORITY VIOLATION: runtime changed authored truth.');
  runFingerprint = null;
}

beamToolButton.addEventListener('click', () => selectTool('beam'));
wheelToolButton.addEventListener('click', () => selectTool('powered-wheel'));
cartButton.addEventListener('click', () => {
  if (mode !== 'build') return;
  history.push(documentState);
  documentState = createPoweredCartMachine();
  renderAuthored();
  updateUi('Loaded the exact cart specimen exercised by the headless locomotion test. Press RUN.');
});
runButton.addEventListener('click', () => mode === 'build' ? startRun() : stopRun());
undoButton.addEventListener('click', () => {
  if (mode !== 'build' || history.length === 0) return;
  documentState = history.pop();
  renderAuthored();
  updateUi('Undid the last authored construction command.');
});
resetButton.addEventListener('click', () => {
  if (mode !== 'build') return;
  history.push(documentState);
  documentState = createSeedMachine();
  renderAuthored();
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
  if (!event.repeat && event.code === 'Digit1') selectTool('beam');
  if (!event.repeat && event.code === 'Digit2') selectTool('powered-wheel');
});

attachDesktopBuilder({
  view,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  commitExtend,
  getGridEnabled: () => gridEnabled,
  getTool: () => tool,
});
attachDesktopComponents({
  view,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  commitPoweredWheel,
});

renderAuthored();
view.setMode('build');

const xrConstruction = setupXrConstruction({
  view,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  commitExtend,
  commitPoweredWheel,
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
beamToolButton.disabled = false;
wheelToolButton.disabled = false;
cartButton.disabled = false;
updateUi('B0 builder ready. Make topology, add real wheels, RUN, STOP, rebuild.');

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
