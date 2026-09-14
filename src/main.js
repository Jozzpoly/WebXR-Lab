import './style.css';
import { attachPoweredWheel, createSeedMachine, editPoweredWheel, extendFromNode, machineFingerprint, removeComponent } from './core/machine-document.js';
import { createPoweredCartMachine } from './core/specimens.js';
import { compileMachine } from './runtime/compile-machine.js';
import { RapierMachineRuntime } from './runtime/rapier-runtime.js';
import { RiftworksScene } from './view/scene.js';
import { ComponentInteractionLayer } from './view/component-interaction-layer.js';
import { attachDesktopBuilder } from './input/desktop-builder.js';
import { attachDesktopComponents } from './input/desktop-components.js';
import { inferPoweredWheelPlacement } from './input/wheel-placement.js';
import { installXrEmulationIfNeeded } from './xr/emulation.js';
import { installIwerRehearsal } from './xr/rehearsal.js';
import { setupXrConstruction } from './xr/setup-xr.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app-shell">
    <div id="viewport" class="viewport"></div>
    <header class="topbar">
      <div>
        <p class="eyebrow">Riftworks · B1.2</p>
        <h1>Machine Yard</h1>
      </div>
      <div class="status-stack">
        <span id="modeBadge" class="badge">BOOTING</span>
        <span id="xrBadge" class="badge subtle">XR: checking</span>
      </div>
    </header>
    <aside class="panel">
      <p class="panel-kicker">Build · Run · Observe · Improve</p>
      <strong id="truthLine">Loading physics…</strong>
      <p id="detailLine">Preparing machine-local workspace.</p>
      <div class="toolstrip" aria-label="Construction tools">
        <button id="beamToolButton" class="tool active" disabled><span>1</span> BEAM</button>
        <button id="wheelToolButton" class="tool" disabled><span>2</span> POWERED WHEEL</button>
      </div>
      <div id="componentEditor" class="component-editor" hidden>
        <div>
          <span class="component-editor-kicker">Selected component</span>
          <strong id="selectedWheelLabel">Powered Wheel</strong>
        </div>
        <div class="controls compact-controls">
          <button id="flipWheelButton" disabled>FLIP SIDE</button>
          <button id="reverseWheelButton" disabled>REVERSE MOTOR</button>
          <button id="deleteWheelButton" disabled>DELETE</button>
          <button id="doneWheelButton" disabled>DONE</button>
        </div>
      </div>
      <div class="controls primary-controls">
        <button id="runButton" class="primary" disabled>RUN</button>
        <button id="undoButton" disabled>UNDO</button>
        <button id="focusButton" disabled>FOCUS MACHINE</button>
        <button id="followButton" class="active" disabled>FOLLOW RUN: ON</button>
      </div>
      <button id="cartButton" class="specimen-button" disabled>LOAD PROVEN CART</button>
      <details class="diagnostics">
        <summary>Build / debug controls</summary>
        <div class="controls compact-controls">
          <button id="resetButton" disabled>RESET BUILD</button>
          <button id="gridButton" class="active" disabled>GRID 25 cm</button>
        </div>
        <div class="metrics">
          <span>nodes <b id="nodeCount">–</b></span>
          <span>beams <b id="beamCount">–</b></span>
          <span>wheels <b id="wheelCount">–</b></span>
          <span>islands <b id="islandCount">–</b></span>
        </div>
        <p class="hint"><b>Desktop:</b> LMB build/place/select · RMB orbit · Space RUN/STOP · F focus · Esc close edit.</p>
        <p class="hint"><b>XR/IWER:</b> trigger selects spatial UI/components; grip builds, selects nearby wheels, or moves the workspace handle.</p>
      </details>
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
const focusButton = document.querySelector('#focusButton');
const followButton = document.querySelector('#followButton');
const beamToolButton = document.querySelector('#beamToolButton');
const wheelToolButton = document.querySelector('#wheelToolButton');
const cartButton = document.querySelector('#cartButton');
const componentEditor = document.querySelector('#componentEditor');
const selectedWheelLabel = document.querySelector('#selectedWheelLabel');
const flipWheelButton = document.querySelector('#flipWheelButton');
const reverseWheelButton = document.querySelector('#reverseWheelButton');
const deleteWheelButton = document.querySelector('#deleteWheelButton');
const doneWheelButton = document.querySelector('#doneWheelButton');
const nodeCount = document.querySelector('#nodeCount');
const beamCount = document.querySelector('#beamCount');
const wheelCount = document.querySelector('#wheelCount');
const islandCount = document.querySelector('#islandCount');
const xrMount = document.querySelector('#xrMount');

const emulation = await installXrEmulationIfNeeded();
const view = new RiftworksScene(viewport);
const componentLayer = new ComponentInteractionLayer(view);
const runtime = await RapierMachineRuntime.create();

let documentState = createSeedMachine();
let mode = 'build';
let tool = 'beam';
let history = [];
let gridEnabled = true;
let followRun = true;
let activePlan = compileMachine(documentState);
let runFingerprint = null;
let selectedComponentId = null;
let wheelPreviewKey = null;

function selectedWheel() {
  if (!selectedComponentId) return null;
  return documentState.components.find((component) => component.id === selectedComponentId && component.kind === 'powered-wheel') ?? null;
}

function clearPoweredWheelPreview() {
  wheelPreviewKey = null;
  componentLayer.hidePreview();
}

function updateUi(message = null) {
  const plan = mode === 'build' ? compileMachine(documentState) : activePlan;
  const selected = selectedWheel();
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
  focusButton.disabled = mode !== 'run';
  followButton.disabled = false;
  gridButton.classList.toggle('active', gridEnabled);
  followButton.classList.toggle('active', followRun);
  followButton.textContent = `FOLLOW RUN: ${followRun ? 'ON' : 'OFF'}`;
  beamToolButton.classList.toggle('active', tool === 'beam');
  wheelToolButton.classList.toggle('active', tool === 'powered-wheel');

  componentEditor.hidden = !selected;
  selectedWheelLabel.textContent = selected
    ? `${selected.id} · axis ${selected.axis.join(',')} · side ${selected.side > 0 ? '+' : '−'} · motor ${selected.motorVelocity}`
    : 'Powered Wheel';
  for (const button of [flipWheelButton, reverseWheelButton, deleteWheelButton, doneWheelButton]) {
    button.disabled = mode !== 'build' || !selected;
  }

  truthLine.textContent = mode === 'build'
    ? (selected ? `Editing ${selected.id} · authored truth` : `Machine-local authored truth · ${tool === 'beam' ? 'Beam' : 'Powered Wheel'}`)
    : 'Disposable Rapier runtime · authored state untouched';
  detailLine.textContent = message ?? (mode === 'build'
    ? (selected
      ? 'Edit explicit wheel intent in place. Flip side, reverse motor, delete, or finish without rebuilding topology.'
      : tool === 'beam'
        ? 'Drag from a socket. The workbench is presentation; machine coordinates stay local.'
        : 'Hover/approach a socket to preview the exact wheel axis, side and positive motor direction before commit.')
    : 'Desktop may follow for observation; XR head pose is never moved by the game.');

  view.updateSpatialControls({
    tool,
    mode,
    canUndo: mode === 'build' && history.length > 0,
    selectedComponentId: selected?.id ?? null,
  });
}

function renderAuthored() {
  activePlan = compileMachine(documentState);
  view.renderAuthored(documentState, activePlan);
  componentLayer.sync(activePlan);
  if (selectedComponentId && !documentState.components.some((component) => component.id === selectedComponentId)) {
    selectedComponentId = null;
  }
  componentLayer.setSelected(selectedComponentId);
}

function commitDocument(next, message, { preserveSelection = false } = {}) {
  if (next === documentState || mode !== 'build') return;
  history.push(documentState);
  documentState = next;
  if (!preserveSelection) selectedComponentId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi(message);
}

function commitExtend(startId, endPosition, targetId) {
  const next = extendFromNode(documentState, startId, endPosition, targetId);
  commitDocument(next, targetId ? 'Connected existing sockets.' : 'Extended structure with a new socket.');
}

function poweredWheelPlacement(nodeId) {
  if (!nodeId) return null;
  const placement = inferPoweredWheelPlacement(documentState, nodeId);
  const duplicate = documentState.components.some((component) =>
    component.kind === 'powered-wheel' &&
    component.nodeId === nodeId &&
    component.side === placement.side &&
    component.axis.every((value, index) => value === placement.axis[index]));
  return { placement, duplicate };
}

function previewPoweredWheel(nodeId) {
  if (mode !== 'build' || tool !== 'powered-wheel' || selectedComponentId || !nodeId) {
    clearPoweredWheelPreview();
    return;
  }

  const key = `${documentState.revision}:${nodeId}`;
  if (wheelPreviewKey === key) return;
  wheelPreviewKey = key;

  const info = poweredWheelPlacement(nodeId);
  if (!info || info.duplicate) {
    componentLayer.hidePreview();
    return;
  }

  const hypothetical = attachPoweredWheel(documentState, nodeId, info.placement);
  const previewId = `c${documentState.nextIds.component}`;
  const preview = compileMachine(hypothetical).components.find((component) => component.id === previewId) ?? null;
  componentLayer.showPreview(preview);
}

function commitPoweredWheel(nodeId) {
  if (mode !== 'build') return;
  const info = poweredWheelPlacement(nodeId);
  if (!info) return;
  if (info.duplicate) {
    updateUi('That socket already has this powered-wheel placement. Select the existing wheel to edit it.');
    return;
  }

  const next = attachPoweredWheel(documentState, nodeId, info.placement);
  commitDocument(next, `Powered wheel · axis ${info.placement.axis.join(',')} · side ${info.placement.side > 0 ? '+' : '−'}.`);
}

function selectComponent(componentId) {
  if (mode !== 'build') return;
  const component = documentState.components.find((candidate) => candidate.id === componentId);
  if (!component || component.kind !== 'powered-wheel') return;
  selectedComponentId = componentId;
  clearPoweredWheelPreview();
  componentLayer.setSelected(componentId);
  updateUi(`Selected ${componentId}. Its authored identity stays stable while intent is edited.`);
}

function clearComponentSelection(message = null) {
  if (!selectedComponentId) return;
  selectedComponentId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  updateUi(message ?? 'Closed component editing.');
}

function editSelectedWheel(action) {
  const current = selectedWheel();
  if (!current || mode !== 'build') return;

  if (action === 'wheel-done') {
    clearComponentSelection();
    return;
  }

  if (action === 'wheel-delete') {
    const id = current.id;
    selectedComponentId = null;
    commitDocument(removeComponent(documentState, id), `Deleted ${id}; authored topology remains unchanged.`);
    return;
  }

  if (action === 'wheel-flip') {
    const next = editPoweredWheel(documentState, current.id, { side: -current.side });
    commitDocument(next, `${current.id}: flipped mount side.`, { preserveSelection: true });
    return;
  }

  if (action === 'wheel-reverse') {
    const nextVelocity = current.motorVelocity === 0 ? 8 : -current.motorVelocity;
    const next = editPoweredWheel(documentState, current.id, { motorVelocity: nextVelocity });
    commitDocument(next, `${current.id}: reversed motor direction to ${nextVelocity}.`, { preserveSelection: true });
  }
}

function selectTool(nextTool) {
  if (mode !== 'build') return;
  selectedComponentId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  tool = nextTool;
  view.hideGhost();
  updateUi();
}

function startRun() {
  if (mode !== 'build') return;
  selectedComponentId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  activePlan = compileMachine(documentState);
  runFingerprint = machineFingerprint(documentState);
  runtime.start(activePlan);
  view.createRuntimeVisual(activePlan);
  mode = 'run';
  view.setMode('run');
  view.setRunFollow(followRun);
  updateUi(`RUN: ${activePlan.islands.length} rigid island(s), ${activePlan.components.length} mechanical component(s).`);
}

function stopRun() {
  if (mode !== 'run') return;
  runtime.stop();
  const unchanged = machineFingerprint(documentState) === runFingerprint;
  mode = 'build';
  view.setMode('build');
  renderAuthored();
  updateUi(unchanged
    ? 'STOP: evaluated motion discarded; authored machine restored exactly.'
    : 'AUTHORITY VIOLATION: runtime changed authored truth.');
  runFingerprint = null;
}

function toggleRun() {
  mode === 'build' ? startRun() : stopRun();
}

function undoLast() {
  if (mode !== 'build' || history.length === 0) return;
  documentState = history.pop();
  selectedComponentId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi('Undid the last authored construction/edit command.');
}

beamToolButton.addEventListener('click', () => selectTool('beam'));
wheelToolButton.addEventListener('click', () => selectTool('powered-wheel'));
flipWheelButton.addEventListener('click', () => editSelectedWheel('wheel-flip'));
reverseWheelButton.addEventListener('click', () => editSelectedWheel('wheel-reverse'));
deleteWheelButton.addEventListener('click', () => editSelectedWheel('wheel-delete'));
doneWheelButton.addEventListener('click', () => editSelectedWheel('wheel-done'));
cartButton.addEventListener('click', () => {
  if (mode !== 'build') return;
  history.push(documentState);
  documentState = createPoweredCartMachine();
  selectedComponentId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi('Loaded the exact powered cart specimen exercised by CI.');
});
runButton.addEventListener('click', toggleRun);
undoButton.addEventListener('click', undoLast);
focusButton.addEventListener('click', () => view.focusRuntimeNow());
followButton.addEventListener('click', () => {
  followRun = !followRun;
  view.setRunFollow(followRun);
  updateUi(`Desktop run follow ${followRun ? 'enabled' : 'disabled'}. XR is unaffected.`);
});
resetButton.addEventListener('click', () => {
  if (mode !== 'build') return;
  history.push(documentState);
  documentState = createSeedMachine();
  selectedComponentId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi('Reset to the machine-local seed structure.');
});
gridButton.addEventListener('click', () => {
  gridEnabled = !gridEnabled;
  updateUi(gridEnabled ? 'Desktop placement grid enabled.' : 'Desktop placement grid disabled.');
});
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undoLast();
  }
  if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    toggleRun();
  }
  if (!event.repeat && event.code === 'Escape') clearComponentSelection();
  if (!event.repeat && event.code === 'KeyF' && mode === 'run') view.focusRuntimeNow();
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
  componentLayer,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  commitPoweredWheel,
  previewPoweredWheel,
  clearPoweredWheelPreview,
  selectComponent,
});

renderAuthored();
view.setMode('build');

const xrConstruction = setupXrConstruction({
  view,
  componentLayer,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  getSelectedComponentId: () => selectedComponentId,
  commitExtend,
  commitPoweredWheel,
  previewPoweredWheel,
  clearPoweredWheelPreview,
  selectComponent,
  editSelectedWheel,
  selectTool,
  toggleRun,
  undo: undoLast,
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
focusButton.disabled = true;
followButton.disabled = false;
beamToolButton.disabled = false;
wheelToolButton.disabled = false;
cartButton.disabled = false;
updateUi('B1.2 ready: wheel intent is previewable before placement and editable after placement.');

const rehearsal = installIwerRehearsal({
  emulation,
  view,
  componentLayer,
  getDocument: () => documentState,
  getTool: () => tool,
  getSelectedComponentId: () => selectedComponentId,
  getMode: () => mode,
  report: (message) => { detailLine.textContent = message; },
});
if (rehearsal.enabled) xrBadge.textContent = 'XR: IWER rehearsal armed';

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
