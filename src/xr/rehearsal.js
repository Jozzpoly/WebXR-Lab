import * as THREE from 'three';
import { machineFingerprint } from '../core/machine-document.js';
import { beamEndPosition } from '../input/structural-placement.js';

const TRIGGER = 'trigger';
const SQUEEZE = 'squeeze';
const XR_FRAME_TIMEOUT_MS = 2500;

function xrFrames(view, count = 2, label = 'xr-frames') {
  return new Promise((resolve, reject) => {
    const session = view.renderer.xr.getSession();
    if (!session) {
      reject(new Error(`${label}: XR session is not active`));
      return;
    }

    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label}: timed out waiting for ${count} XR frame(s)`));
    }, XR_FRAME_TIMEOUT_MS);

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };

    const step = () => {
      if (settled) return;
      if (count-- <= 0) finish();
      else session.requestAnimationFrame(step);
    };
    session.requestAnimationFrame(step);
  });
}

function requireState(condition, message) {
  if (!condition) throw new Error(message);
}

function aimController(controller, from, target) {
  const direction = target.clone().sub(from).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  controller.position.copy(from);
  controller.quaternion.copy(quaternion);
}

async function setPose(view, device, controller, position, target = null, label = 'set-pose') {
  if (target) aimController(controller, position, target);
  else {
    controller.position.copy(position);
    controller.quaternion.set(0, 0, 0, 1);
  }
  device.notifyStateChange();
  await xrFrames(view, 3, `${label}: settle`);
}

async function pulse(view, device, controller, button, label = button) {
  controller.updateButtonValue(button, 1);
  device.notifyStateChange();
  await xrFrames(view, 3, `${label}: press`);
  controller.updateButtonValue(button, 0);
  device.notifyStateChange();
  await xrFrames(view, 3, `${label}: release`);
}

async function dragGrip(view, device, controller, from, to, label = 'grip-drag') {
  await setPose(view, device, controller, from, null, `${label}: start-pose`);
  controller.updateButtonValue(SQUEEZE, 1);
  device.notifyStateChange();
  await xrFrames(view, 4, `${label}: grip-press`);
  controller.position.copy(to);
  device.notifyStateChange();
  await xrFrames(view, 6, `${label}: move`);
  controller.updateButtonValue(SQUEEZE, 0);
  device.notifyStateChange();
  await xrFrames(view, 4, `${label}: grip-release`);
}

export function installIwerRehearsal({
  emulation,
  view,
  componentLayer,
  structuralLayer,
  xrConstruction,
  getDocument,
  getTool,
  getSelectedComponentId,
  getSelectedBeamId,
  getMode,
  report,
}) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('rehearse') !== '1' || emulation.mode !== 'iwer' || !emulation.device) {
    return { enabled: false };
  }

  const device = emulation.device;
  const controller = device.controllers?.right;
  if (!controller) {
    report('XR rehearsal unavailable: IWER right controller missing.');
    return { enabled: false };
  }

  const stages = [];
  let running = false;
  let phase = 'armed';
  const publishTrace = (nextPhase) => {
    phase = nextPhase;
    window.__riftworksXrRehearsalTrace = {
      phase,
      mode: getMode(),
      stages: stages.map((stage) => stage.name),
    };
  };
  const mark = (name) => {
    stages.push({ name, pass: true });
    publishTrace(`passed:${name}`);
  };
  const actionTarget = (action) => {
    const target = view.spatialPanel.getActionWorldPosition(action, new THREE.Vector3());
    requireState(target, `spatial action ${action} is not currently available`);
    return target;
  };
  const toWorld = (local) => view.workspaceToWorldPoint(new THREE.Vector3(...local), new THREE.Vector3());
  const rayOrigin = new THREE.Vector3(0.28, 1.38, -0.12);

  const run = async () => {
    if (running) return;
    running = true;
    publishTrace('session-start');
    const authoredAtStart = machineFingerprint(getDocument());
    const workspaceStart = view.workspaceRoot.position.clone();
    device.controlMode = 'programmatic';
    device.notifyStateChange();

    try {
      publishTrace('initial-xr-frames');
      await xrFrames(view, 6, 'initial session');
      requireState(getMode() === 'build', 'rehearsal must start in BUILD');
      requireState(getDocument().components.length === 0, 'rehearsal expects a fresh seed machine');
      requireState(getDocument().beams.length === 1, 'rehearsal expects one seed beam');
      mark('fresh-build');

      await setPose(view, device, controller, rayOrigin, actionTarget('beam'), 'beam-tool-aim');
      await pulse(view, device, controller, TRIGGER, 'beam-tool-select');
      requireState(getTool() === 'beam', 'trigger ray did not select BEAM');

      const seed = getDocument().beams[0];
      const a = beamEndPosition(getDocument(), seed.id, 'a');
      const b = beamEndPosition(getDocument(), seed.id, 'b');
      requireState(a && b, 'seed beam endpoints unavailable');
      const beamCenter = toWorld([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]);
      await setPose(view, device, controller, rayOrigin, beamCenter, 'seed-beam-aim');
      await pulse(view, device, controller, TRIGGER, 'seed-beam-select');
      requireState(getSelectedBeamId() === seed.id, 'trigger ray did not select the real seed beam');
      requireState(structuralLayer.selectedBeamId === seed.id, 'selected beam did not expose structural handles');
      mark('part-select');

      const extendHandle = { kind: 'extend', beamId: seed.id, end: 'b' };
      const extendFrom = xrConstruction.getBeamHandleWorldPosition(extendHandle, new THREE.Vector3());
      requireState(extendFrom, 'extend handle world pose missing');
      const extendTo = toWorld([b[0], b[1], b[2] - 0.45]);
      await dragGrip(view, device, controller, extendFrom, extendTo, 'beam-extend');
      requireState(getDocument().beams.length === 2, 'EXTEND handle did not author a second structural beam');
      mark('beam-extend');

      const extension = getDocument().beams.find((beam) => beam.id !== seed.id);
      requireState(extension, 'new structural beam identity missing');
      const extensionA = beamEndPosition(getDocument(), extension.id, 'a');
      const extensionB = beamEndPosition(getDocument(), extension.id, 'b');
      const extensionVisiblePoint = toWorld([
        extensionA[0] + (extensionB[0] - extensionA[0]) * 0.75,
        extensionA[1] + (extensionB[1] - extensionA[1]) * 0.75,
        extensionA[2] + (extensionB[2] - extensionA[2]) * 0.75,
      ]);
      // Approach the new member from its open side. A ray from the original
      // front-of-workbench pose legitimately hits the parent beam first near
      // the welded junction; the rehearsal must not require through-object picking.
      const partRayOrigin = toWorld([0.75, 0.70, -0.20]);
      await setPose(view, device, controller, partRayOrigin, extensionVisiblePoint, 'extension-beam-aim');
      await pulse(view, device, controller, TRIGGER, 'extension-beam-select');
      requireState(getSelectedBeamId() === extension.id, 'new beam could not be selected from a visible surface');

      const moveHandle = { kind: 'move', beamId: extension.id, end: 'b' };
      const moveFrom = xrConstruction.getBeamHandleWorldPosition(moveHandle, new THREE.Vector3());
      requireState(moveFrom, 'move handle world pose missing');
      const movedTargetLocal = [extensionB[0] + 0.18, extensionB[1], extensionB[2] - 0.12];
      await dragGrip(view, device, controller, moveFrom, toWorld(movedTargetLocal), 'beam-reshape');
      const movedEnd = beamEndPosition(getDocument(), extension.id, 'b');
      requireState(
        Math.hypot(movedEnd[0] - extensionB[0], movedEnd[1] - extensionB[1], movedEnd[2] - extensionB[2]) > 0.1,
        'MOVE handle did not materially reshape the structural part',
      );
      mark('beam-reshape');

      await setPose(view, device, controller, rayOrigin, actionTarget('powered-wheel'), 'wheel-tool-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-tool-select');
      requireState(getTool() === 'powered-wheel', 'trigger ray did not select WHEEL');
      mark('ray-tool-select');

      const seedAfterEditA = beamEndPosition(getDocument(), seed.id, 'a');
      const seedAfterEditB = beamEndPosition(getDocument(), seed.id, 'b');
      const wheelProbeLocal = [
        (seedAfterEditA[0] + seedAfterEditB[0]) * 0.5,
        (seedAfterEditA[1] + seedAfterEditB[1]) * 0.5,
        (seedAfterEditA[2] + seedAfterEditB[2]) * 0.5 + 0.1,
      ];
      const wheelProbe = toWorld(wheelProbeLocal);
      await setPose(view, device, controller, wheelProbe, null, 'wheel-probe');
      await xrFrames(view, 4, 'wheel-preview');
      requireState(componentLayer.hasPreview(), 'beam-surface proximity did not produce wheel preview');
      mark('surface-mount-preview');

      await pulse(view, device, controller, SQUEEZE, 'wheel-place');
      requireState(getDocument().components.length === 1, 'squeeze did not author one powered wheel');
      const wheelId = getDocument().components[0].id;
      mark('squeeze-place');

      const wheelWorld = componentLayer.getWorldPosition(wheelId, new THREE.Vector3());
      requireState(wheelWorld, 'placed wheel interaction proxy missing');
      await setPose(view, device, controller, wheelWorld, null, 'wheel-existing-probe');
      await pulse(view, device, controller, SQUEEZE, 'wheel-existing-select');
      requireState(getSelectedComponentId() === wheelId, 'direct squeeze did not select existing wheel');
      mark('direct-component-select');

      const beforeReverse = structuredClone(getDocument().components.find((component) => component.id === wheelId));
      requireState(beforeReverse, 'selected wheel disappeared before edit');
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-reverse'), 'wheel-reverse-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-reverse');
      const afterReverse = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterReverse?.id === wheelId && afterReverse.motorVelocity === -beforeReverse.motorVelocity, 'REVERSE did not preserve identity and invert motor velocity');

      const beforeMirror = structuredClone(afterReverse);
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-flip'), 'wheel-mirror-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-mirror');
      const afterMirror = getDocument().components.find((component) => component.id === wheelId);
      const axisDot = beforeMirror.mount.axis.reduce((sum, value, index) => sum + value * afterMirror.mount.axis[index], 0);
      requireState(
        afterMirror?.id === wheelId && axisDot < -0.99 && afterMirror.motorVelocity === -beforeMirror.motorVelocity,
        'MIRROR did not preserve identity while mirroring axle and coherent motor intent',
      );
      mark('contextual-wheel-edit');

      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-done'), 'wheel-done-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-done');
      requireState(getSelectedComponentId() === null, 'DONE did not close component editing');

      const authoredBeforeWorkspaceMove = machineFingerprint(getDocument());
      const handleWorld = xrConstruction.getWorkspaceHandleWorldPosition(new THREE.Vector3());
      await setPose(view, device, controller, handleWorld, null, 'workspace-handle-pose');
      controller.updateButtonValue(SQUEEZE, 1);
      device.notifyStateChange();
      await xrFrames(view, 3, 'workspace-grab: press');
      controller.position.x += 0.16;
      device.notifyStateChange();
      await xrFrames(view, 5, 'workspace-grab: move');
      controller.updateButtonValue(SQUEEZE, 0);
      device.notifyStateChange();
      await xrFrames(view, 3, 'workspace-grab: release');
      requireState(view.workspaceRoot.position.distanceTo(workspaceStart) > 0.08, 'workspace grip did not translate WorkspaceRoot');
      requireState(machineFingerprint(getDocument()) === authoredBeforeWorkspaceMove, 'workspace movement mutated authored machine truth');
      mark('workspace-grab');

      const authoredBeforeRun = machineFingerprint(getDocument());
      publishTrace('enter-run:aim');
      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'), 'enter-run-aim');
      publishTrace('enter-run:pulse');
      await pulse(view, device, controller, TRIGGER, 'enter-run');
      publishTrace('enter-run:assert');
      requireState(getMode() === 'run', 'trigger ray did not enter RUN');
      publishTrace('run:observe');
      await xrFrames(view, 8, 'run-observe');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'RUN mutated authored truth');

      publishTrace('stop-run:aim');
      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'), 'stop-run-aim');
      publishTrace('stop-run:pulse');
      await pulse(view, device, controller, TRIGGER, 'stop-run');
      publishTrace('stop-run:assert');
      requireState(getMode() === 'build', 'trigger ray did not STOP back to BUILD');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'STOP did not preserve edited authored truth');
      mark('run-stop-authority');

      requireState(machineFingerprint(getDocument()) !== authoredAtStart, 'rehearsal authored no durable edit');
      publishTrace('pass');
      report(`XR rehearsal PASS · ${stages.length}/${stages.length}: ${stages.map((stage) => stage.name).join(' → ')}`);
      window.__riftworksXrRehearsal = { pass: true, stages: [...stages], phase };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      publishTrace(`fail:${phase}`);
      report(`XR rehearsal FAIL after ${stages.length} PASS at ${phase}: ${message}`);
      window.__riftworksXrRehearsal = { pass: false, stages: [...stages], phase, error: message };
      console.error('[Riftworks XR rehearsal]', error);
    } finally {
      controller.updateButtonValue(TRIGGER, 0);
      controller.updateButtonValue(SQUEEZE, 0);
      device.controlMode = 'manual';
      device.notifyStateChange();
      const session = view.renderer.xr.getSession();
      if (session) await session.end();
      running = false;
    }
  };

  view.renderer.xr.addEventListener('sessionstart', () => {
    run();
  });
  publishTrace('armed');
  report('XR rehearsal armed. Enter VR once; IWER will execute the part-first controller-path rehearsal automatically.');
  return { enabled: true, stages };
}
