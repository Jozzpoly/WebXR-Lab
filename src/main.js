import './style.css';
import {
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  editPoweredWheel,
  extendFromBeamEnd,
  machineFingerprint,
  moveBeamEnd,
  rehostPoweredWheel,
  removeBeam,
  removeComponent,
} from './core/machine-document.js';
import { translateStructuralIsland } from './core/structural-translation.js';
import { createPoweredCartMachine } from './core/specimens.js';
import { compileMachine } from './runtime/compile-machine.js';
import { MACHINE_YARD_WORLD, resolveRunSpawn } from './runtime/machine-yard-world.js';
import { RapierMachineRuntime } from './runtime/rapier-runtime.js';
import { RiftworksScene } from './view/scene.js';
import { ComponentInteractionLayer } from './view/component-interaction-layer.js';
import { StructuralInteractionLayer } from './view/structural-interaction-layer.js';
import { attachDesktopBuilder } from './input/desktop-builder.js';
import { attachDesktopComponents } from './input/desktop-components.js';
import { poweredWheelPlacementMatches } from './input/wheel-placement.js';
import { installXrEmulationIfNeeded } from './xr/emulation.js';
import { installIwerRehearsal } from './xr/rehearsal.js';
import { setupXrConstruction } from './xr/setup-xr.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="app-shell">
    <div id="viewport" class="viewport"></div>
    <header class="topbar">
      <div>
        <p class="eyebrow">Riftworks · R0 foundation reset</p>
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
          <button id="flipWheelButton" disabled>MIRROR MOUNT</button>
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
          <button id="resetButton" disabled>CLEAR WORKSHOP</button>
          <button id="gridButton" class="active" disabled>GRID 25 cm</button>
        </div>
        <div class="metrics">
          <span>internal joints <b id="nodeCount">–</b></span>
          <span>beams <b id="beamCount">–</b></span>
          <span>wheels <b id="wheelCount">–</b></span>
          <span>islands <b id="islandCount">–</b></span>
        </div>
        <p class="hint"><b>Desktop:</b> drag empty workspace → create beam · drag a beam body → move its welded island · endpoint handles reshape/extend · drag an existing wheel onto another beam face → rehost same part · WHEEL ghost click mounts new wheel · Delete removes selection · RMB orbit · Space RUN/STOP.</p>
        <p class="hint"><b>XR/IWER:</b> trigger selects nearest authored object; grip + material hand movement rehosts a wheel, while a squeeze without movement remains selection.</p>
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
const structuralLayer = new StructuralInteractionLayer(view);
const runtime = await RapierMachineRuntime.create();

let documentState = createEmptyMachine();
let mode = 'build';
let tool = 'beam';
let history = [];
let gridEnabled = true;
let followRun = true;
let activePlan = compileMachine(documentState);
let runFingerprint = null;
let selectedComponentId = null;
let selectedBeamId = null;
let wheelPreviewKey = null;
let structuralTranslationPreviewActive = false;

function selectedWheel() {
  if (!selectedComponentId) return null;
  return documentState.components.find((component) => component.id === selectedComponentId && component.kind === 'powered-wheel') ?? null;
}

function clearPoweredWheelPreview() {
  wheelPreviewKey = null;
  componentLayer.hidePreview();
}

function syncStructuralLayer() {
  structuralLayer.sync(
    documentState,
    activePlan,
    selectedBeamId,
    mode === 'build' && tool === 'beam' && !selectedComponentId,
  );
}

function updateUi(message = null) {
  const plan = mode === 'build' ? compileMachine(documentState) : activePlan;
  const selected = selectedWheel();
  const hasStructure = documentState.beams.length > 0;
  nodeCount.textContent = String(documentState.nodes.length);
  beamCount.textContent = String(documentState.beams.length);
  wheelCount.textContent = String(documentState.components.filter((component) => component.kind === 'powered-wheel').length);
  islandCount.textContent = String(plan.islands.length);
  modeBadge.textContent = mode === 'build' ? 'BUILD' : 'RUN';
  modeBadge.classList.toggle('running', mode === 'run');
  runButton.textContent = mode === 'build' ? 'RUN' : 'STOP';
  runButton.disabled = mode === 'build' && !hasStructure;
  undoButton.disabled = mode !== 'build' || history.length === 0;
  resetButton.disabled = mode !== 'build' || (!hasStructure && documentState.components.length === 0);
  gridButton.disabled = mode !== 'build';
  beamToolButton.disabled = mode !== 'build';
  wheelToolButton.disabled = mode !== 'build' || !hasStructure;
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
    ? `${selected.id} · host ${selected.hostBeamId} · axle ${selected.mount.axis.join(',')} · motor ${selected.motorVelocity}`
    : 'Powered Wheel';
  for (const button of [flipWheelButton, reverseWheelButton, deleteWheelButton, doneWheelButton]) {
    button.disabled = mode !== 'build' || !selected;
  }

  truthLine.textContent = mode === 'build'
    ? selected
      ? `Editing ${selected.id} · authored component truth`
      : selectedBeamId
        ? `Selected ${selectedBeamId} · structural part`
        : hasStructure
          ? `Machine-local authored truth · ${tool === 'beam' ? 'Beam' : 'Powered Wheel'}`
          : 'Blank authored workshop · no hidden starter geometry'
    : 'Simulation-world Rapier runtime · authored state untouched';

  detailLine.textContent = message ?? (mode === 'build'
    ? selected
      ? 'Drag this wheel onto another beam face to rehost the same authored part. MIRROR changes mount orientation and coherent drive sign; REVERSE changes motor control only.'
      : selectedBeamId && tool === 'beam'
        ? 'Drag the beam body to move its whole welded island. White handles reshape endpoints; green handles pull new beams. Delete removes the selected part.'
        : tool === 'beam'
          ? hasStructure
            ? 'Drag empty workspace to create an independent part, or drag an existing beam body to move its welded island.'
            : 'Drag directly on the empty workspace to create the first structural part.'
          : 'Hover a real beam face to preview its host-relative wheel mount; click the wheel ghost itself to commit.'
    : 'RUN uses one explicit machine-local → simulation-world spawn. Authoring workspace has no runtime authority.');

  view.updateSpatialControls({
    tool,
    mode,
    canUndo: mode === 'build' && history.length > 0,
    canRun: hasStructure,
    selectedComponentId: selected?.id ?? null,
    selectedBeamId,
  });
}

function renderAuthored() {
  structuralTranslationPreviewActive = false;
  structuralLayer.group.visible = true;
  activePlan = compileMachine(documentState);
  if (selectedComponentId && !documentState.components.some((component) => component.id === selectedComponentId)) selectedComponentId = null;
  if (selectedBeamId && !documentState.beams.some((beam) => beam.id === selectedBeamId)) selectedBeamId = null;
  view.renderAuthored(documentState, activePlan);
  componentLayer.sync(activePlan);
  componentLayer.setSelected(selectedComponentId);
  syncStructuralLayer();
}

function previewStructuralIslandTranslation(beamId, delta) {
  if (mode !== 'build' || tool !== 'beam' || selectedComponentId) return;
  const hypothetical = translateStructuralIsland(documentState, beamId, delta);
  if (hypothetical === documentState) {
    clearStructuralIslandTranslationPreview();
    return;
  }
  const previewPlan = compileMachine(hypothetical);
  view.renderAuthored(hypothetical, previewPlan);
  structuralLayer.group.visible = false;
  structuralTranslationPreviewActive = true;
}

function clearStructuralIslandTranslationPreview() {
  if (!structuralTranslationPreviewActive) return;
  view.renderAuthored(documentState, activePlan);
  structuralLayer.group.visible = true;
  syncStructuralLayer();
  structuralTranslationPreviewActive = false;
}

function commitStructuralIslandTranslation(beamId, delta) {
  clearStructuralIslandTranslationPreview();
  const next = translateStructuralIsland(documentState, beamId, delta);
  if (next === documentState) return;
  selectedBeamId = beamId;
  commitDocument(next, `Moved the welded island containing ${beamId} as one rigid authored structure. Hosted component intent stayed local to its parts.`, {
    preserveBeamSelection: true,
  });
}

function commitDocument(next, message, {
  preserveComponentSelection = false,
  preserveBeamSelection = false,
} = {}) {
  if (next === documentState || mode !== 'build') return false;
  history.push(documentState);
  documentState = next;
  if (!preserveComponentSelection) selectedComponentId = null;
  if (!preserveBeamSelection) selectedBeamId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi(message);
  return true;
}

function commitCreateBeam(startPosition, endPosition, startTargetBeamEnd = null, endTargetBeamEnd = null) {
  const beforeIds = new Set(documentState.beams.map((beam) => beam.id));
  const next = createBeam(documentState, startPosition, endPosition, { startTargetBeamEnd, endTargetBeamEnd });
  if (next === documentState) {
    updateUi('Beam creation produced no valid structural part.');
    return;
  }
  const created = next.beams.find((beam) => !beforeIds.has(beam.id)) ?? null;
  selectedBeamId = created?.id ?? null;
  commitDocument(next, created
    ? `Created ${created.id}${startTargetBeamEnd || endTargetBeamEnd ? ' with welded endpoint topology' : ' from blank workspace'}.`
    : 'Created structural part.', { preserveBeamSelection: Boolean(created) });
}

function commitMoveBeamEnd(beamId, end, position) {
  const next = moveBeamEnd(documentState, beamId, end, position);
  if (next === documentState) {
    updateUi('Beam reshape rejected: that move would create degenerate structural geometry.');
    return;
  }
  selectedBeamId = beamId;
  commitDocument(next, `Reshaped ${beamId} from its ${end.toUpperCase()} end. Mounted parts followed the host part.`, {
    preserveBeamSelection: true,
  });
}

function commitExtendBeamEnd(beamId, end, position, targetBeamEnd = null) {
  const next = extendFromBeamEnd(documentState, beamId, end, position, targetBeamEnd);
  if (next === documentState) {
    updateUi('Beam extension produced no valid new structural part.');
    return;
  }
  selectedBeamId = beamId;
  commitDocument(next, targetBeamEnd
    ? `Extended ${beamId} and welded the new member to another real beam end.`
    : `Pulled a new structural beam from ${beamId}.`, { preserveBeamSelection: true });
}

function deleteSelectedBeam() {
  if (!selectedBeamId || mode !== 'build') return;
  const id = selectedBeamId;
  selectedBeamId = null;
  commitDocument(removeBeam(documentState, id), `Deleted ${id} and any components hosted by that part. Orphan topology was cleaned automatically.`);
}

function editSelectedBeam(action) {
  if (action === 'beam-done') {
    clearBeamSelection();
    return;
  }
  if (action === 'beam-delete') deleteSelectedBeam();
}

function candidateIsDuplicate(candidate, excludedComponentId = null) {
  return Boolean(candidate && documentState.components.some((component) =>
    component.id !== excludedComponentId && poweredWheelPlacementMatches(component, candidate)));
}

function previewPoweredWheel(candidate) {
  if (mode !== 'build' || tool !== 'powered-wheel' || selectedComponentId || !candidate) {
    clearPoweredWheelPreview();
    return;
  }

  const key = `new:${documentState.revision}:${candidate.hostBeamId}:${candidate.mount.position.join(',')}:${candidate.mount.axis.join(',')}:${candidate.motorVelocity}`;
  if (wheelPreviewKey === key) return;
  wheelPreviewKey = key;

  if (candidateIsDuplicate(candidate)) {
    componentLayer.hidePreview();
    return;
  }

  const hypothetical = attachPoweredWheel(documentState, candidate.hostBeamId, {
    mount: candidate.mount,
    motorVelocity: candidate.motorVelocity,
  });
  const previewId = `c${documentState.nextIds.component}`;
  const preview = compileMachine(hypothetical).components.find((component) => component.id === previewId) ?? null;
  componentLayer.showPreview(preview);
}

function previewPoweredWheelRehost(componentId, candidate) {
  if (mode !== 'build' || !candidate) {
    clearPoweredWheelPreview();
    return;
  }
  const current = documentState.components.find((component) => component.id === componentId && component.kind === 'powered-wheel');
  if (!current || candidateIsDuplicate(candidate, componentId)) {
    componentLayer.hidePreview();
    return;
  }

  const key = `move:${documentState.revision}:${componentId}:${candidate.hostBeamId}:${candidate.mount.position.join(',')}:${candidate.mount.axis.join(',')}`;
  if (wheelPreviewKey === key) return;
  wheelPreviewKey = key;

  const hypothetical = rehostPoweredWheel(documentState, componentId, candidate.hostBeamId, candidate.mount);
  if (hypothetical === documentState) {
    componentLayer.hidePreview();
    return;
  }
  const preview = compileMachine(hypothetical).components.find((component) => component.id === componentId) ?? null;
  componentLayer.showPreview(preview);
}

function commitPoweredWheel(candidate) {
  if (mode !== 'build' || !candidate) return;
  if (candidateIsDuplicate(candidate)) {
    updateUi('That beam face already has this wheel mount. Select the existing wheel to edit it.');
    return;
  }

  const next = attachPoweredWheel(documentState, candidate.hostBeamId, {
    mount: candidate.mount,
    motorVelocity: candidate.motorVelocity,
  });
  commitDocument(next, `Powered wheel mounted on ${candidate.hostBeamId} · axle ${candidate.mount.axis.join(',')} · motor ${candidate.motorVelocity}.`);
}

function commitPoweredWheelRehost(componentId, candidate) {
  if (mode !== 'build' || !candidate) return;
  const current = documentState.components.find((component) => component.id === componentId && component.kind === 'powered-wheel');
  if (!current) return;
  if (candidateIsDuplicate(candidate, componentId)) {
    updateUi('That target mount is already occupied by another powered wheel.');
    return;
  }

  const previousHost = current.hostBeamId;
  const next = rehostPoweredWheel(documentState, componentId, candidate.hostBeamId, candidate.mount);
  if (next === documentState) {
    updateUi(`${componentId} already occupies that mount.`);
    return;
  }
  selectedComponentId = componentId;
  tool = 'powered-wheel';
  commitDocument(next, `${componentId}: moved from ${previousHost} to ${candidate.hostBeamId} while preserving component identity and motor control.`, {
    preserveComponentSelection: true,
  });
}

function selectBeam(beamId) {
  if (mode !== 'build' || !documentState.beams.some((beam) => beam.id === beamId)) return;
  tool = 'beam';
  selectedComponentId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  selectedBeamId = beamId;
  syncStructuralLayer();
  updateUi(`Selected ${beamId}. Drag its body to move the whole welded island; use endpoint handles for local structural edits.`);
}

function clearBeamSelection(message = null) {
  if (!selectedBeamId) return;
  selectedBeamId = null;
  syncStructuralLayer();
  updateUi(message ?? 'Closed structural part selection.');
}

function selectComponent(componentId) {
  if (mode !== 'build') return;
  const component = documentState.components.find((candidate) => candidate.id === componentId);
  if (!component || component.kind !== 'powered-wheel') return;
  tool = 'powered-wheel';
  selectedBeamId = null;
  syncStructuralLayer();
  selectedComponentId = componentId;
  clearPoweredWheelPreview();
  componentLayer.setSelected(componentId);
  updateUi(`Selected ${componentId}. Its authored type now owns the editing context.`);
}

function clearComponentSelection(message = null) {
  if (!selectedComponentId) return;
  selectedComponentId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  syncStructuralLayer();
  updateUi(message ?? 'Closed component editing.');
}

function mirroredWheelPatch(current) {
  const axisLength = Math.hypot(...current.mount.axis);
  const axis = current.mount.axis.map((value) => value / axisLength);
  const normalDistance = current.mount.position.reduce((sum, value, index) => sum + value * axis[index], 0);
  const position = current.mount.position.map((value, index) => value - 2 * normalDistance * axis[index]);
  return {
    mount: { position, axis: axis.map((value) => -value) },
    motorVelocity: -current.motorVelocity,
  };
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
    commitDocument(removeComponent(documentState, id), `Deleted ${id}; structural topology remains unchanged.`);
    return;
  }
  if (action === 'wheel-flip') {
    const next = editPoweredWheel(documentState, current.id, mirroredWheelPatch(current));
    commitDocument(next, `${current.id}: mirrored across host beam while preserving coherent drive intent.`, {
      preserveComponentSelection: true,
    });
    return;
  }
  if (action === 'wheel-reverse') {
    const nextVelocity = current.motorVelocity === 0 ? 8 : -current.motorVelocity;
    const next = editPoweredWheel(documentState, current.id, { motorVelocity: nextVelocity });
    commitDocument(next, `${current.id}: reversed motor direction to ${nextVelocity}.`, {
      preserveComponentSelection: true,
    });
  }
}

function selectTool(nextTool) {
  if (mode !== 'build') return;
  if (nextTool === 'powered-wheel' && documentState.beams.length === 0) {
    updateUi('Create a structural part before mounting a wheel.');
    return;
  }
  clearStructuralIslandTranslationPreview();
  selectedComponentId = null;
  selectedBeamId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  tool = nextTool;
  view.hideGhost();
  syncStructuralLayer();
  updateUi();
}

function startRun() {
  if (mode !== 'build') return;
  clearStructuralIslandTranslationPreview();
  if (documentState.beams.length === 0) {
    updateUi('RUN needs at least one authored structural part. The empty workshop remains unchanged.');
    return;
  }
  selectedComponentId = null;
  selectedBeamId = null;
  componentLayer.setSelected(null);
  clearPoweredWheelPreview();
  activePlan = compileMachine(documentState);
  syncStructuralLayer();
  const spawnPose = resolveRunSpawn(activePlan, MACHINE_YARD_WORLD);
  runFingerprint = machineFingerprint(documentState);
  runtime.start(activePlan, { environment: MACHINE_YARD_WORLD, spawnPose });
  view.createRuntimeVisual(activePlan, spawnPose);
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
    ? 'STOP: simulation-world motion discarded; authored machine restored exactly.'
    : 'AUTHORITY VIOLATION: runtime changed authored truth.');
  runFingerprint = null;
}

function toggleRun() {
  mode === 'build' ? startRun() : stopRun();
}

function undoLast() {
  if (mode !== 'build' || history.length === 0) return;
  clearStructuralIslandTranslationPreview();
  documentState = history.pop();
  selectedComponentId = null;
  selectedBeamId = null;
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
  clearStructuralIslandTranslationPreview();
  history.push(documentState);
  documentState = createPoweredCartMachine();
  selectedComponentId = null;
  selectedBeamId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi('Loaded the exact beam-mounted powered cart specimen exercised by CI.');
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
  clearStructuralIslandTranslationPreview();
  const blank = createEmptyMachine();
  if (documentState.beams.length === 0 && documentState.components.length === 0) return;
  history.push(documentState);
  documentState = blank;
  selectedComponentId = null;
  selectedBeamId = null;
  clearPoweredWheelPreview();
  renderAuthored();
  updateUi('Workshop cleared to genuine blank authored state.');
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
  if (!event.repeat && event.code === 'Escape') {
    clearStructuralIslandTranslationPreview();
    if (selectedComponentId) clearComponentSelection();
    else clearBeamSelection();
  }
  if (!event.repeat && (event.code === 'Delete' || event.code === 'Backspace') && mode === 'build') {
    if (selectedComponentId) editSelectedWheel('wheel-delete');
    else if (selectedBeamId) deleteSelectedBeam();
  }
  if (!event.repeat && event.code === 'KeyF' && mode === 'run') view.focusRuntimeNow();
  if (!event.repeat && event.code === 'Digit1') selectTool('beam');
  if (!event.repeat && event.code === 'Digit2') selectTool('powered-wheel');
});

attachDesktopBuilder({
  view,
  structuralLayer,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  getGridEnabled: () => gridEnabled,
  getTool: () => tool,
  selectBeam,
  commitCreateBeam,
  commitMoveBeamEnd,
  commitExtendBeamEnd,
  previewStructuralIslandTranslation,
  clearStructuralIslandTranslationPreview,
  commitStructuralIslandTranslation,
});
attachDesktopComponents({
  view,
  componentLayer,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  commitPoweredWheel,
  previewPoweredWheel,
  previewPoweredWheelRehost,
  commitPoweredWheelRehost,
  clearPoweredWheelPreview,
  selectComponent,
});

renderAuthored();
view.setMode('build');

const xrConstruction = setupXrConstruction({
  view,
  componentLayer,
  structuralLayer,
  getDocument: () => documentState,
  isBuildMode: () => mode === 'build',
  getTool: () => tool,
  getSelectedComponentId: () => selectedComponentId,
  getSelectedBeamId: () => selectedBeamId,
  commitCreateBeam,
  commitMoveBeamEnd,
  commitExtendBeamEnd,
  commitPoweredWheel,
  previewPoweredWheel,
  previewPoweredWheelRehost,
  commitPoweredWheelRehost,
  clearPoweredWheelPreview,
  selectBeam,
  clearBeamSelection,
  selectComponent,
  editSelectedBeam,
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

resetButton.disabled = false;
gridButton.disabled = false;
focusButton.disabled = true;
followButton.disabled = false;
beamToolButton.disabled = false;
wheelToolButton.disabled = true;
cartButton.disabled = false;
updateUi('R0 foundation reset: blank workshop and part-first authoring are active on this candidate.');

const rehearsal = installIwerRehearsal({
  emulation,
  view,
  componentLayer,
  structuralLayer,
  xrConstruction,
  getDocument: () => documentState,
  getTool: () => tool,
  getSelectedComponentId: () => selectedComponentId,
  getSelectedBeamId: () => selectedBeamId,
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
