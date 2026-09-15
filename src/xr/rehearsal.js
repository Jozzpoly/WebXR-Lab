import * as THREE from 'three';
import { machineFingerprint } from '../core/machine-document.js';
import { beamEndPosition } from '../input/structural-placement.js';

const TRIGGER = 'trigger';
const SQUEEZE = 'squeeze';

function xrFrames(view, count = 2) {
  return new Promise((resolve, reject) => {
    const session = view.renderer.xr.getSession();
    if (!session) {
      reject(new Error('XR session is not active'));
      return;
    }
    const step = () => {
      if (count-- <= 0) resolve();
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

async function setPose(view, device, controller, position, target = null) {
  if (target) aimController(controller, position, target);
  else {
    controller.position.copy(position);
    controller.quaternion.set(0, 0, 0, 1);
  }
  device.notifyStateChange();
  await xrFrames(view, 3);
}

async function pulse(view, device, controller, button) {
  controller.updateButtonValue(button, 1);
  device.notifyStateChange();
  await xrFrames(view, 3);
  controller.updateButtonValue(button, 0);
  device.notifyStateChange();
  await xrFrames(view, 3);
}

async function dragGrip(view, device, controller, from, to) {
  await setPose(view, device, controller, from);
  controller.updateButtonValue(SQUEEZE, 1);
  device.notifyStateChange();
  await xrFrames(view, 4);
  controller.position.copy(to);
  device.notifyStateChange();
  await xrFrames(view, 6);
  controller.updateButtonValue(SQUEEZE, 0);
  device.notifyStateChange();
  await xrFrames(view, 4);
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
  const mark = (name) => stages.push({ name, pass: true });
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
    const authoredAtStart = machineFingerprint(getDocument());
    const workspaceStart = view.workspaceRoot.position.clone();
    device.controlMode = 'programmatic';
    device.notifyStateChange();

    try {
      await xrFrames(view, 6);
      requireState(getMode() === 'build', 'rehearsal must start in BUILD');
      requireState(getDocument().components.length === 0, 'rehearsal expects a fresh seed machine');
      requireState(getDocument().beams.length === 1, 'rehearsal expects one seed beam');
      mark('fresh-build');

      await setPose(view, device, controller, rayOrigin, actionTarget('beam'));
      await pulse(view, device, controller, TRIGGER);
      requireState(getTool() === 'beam', 'trigger ray did not select BEAM');

      const seed = getDocument().beams[0];
      const a = beamEndPosition(getDocument(), seed.id, 'a');
      const b = beamEndPosition(getDocument(), seed.id, 'b');
      requireState(a && b, 'seed beam endpoints unavailable');
      const beamCenter = toWorld([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]);
      await setPose(view, device, controller, rayOrigin, beamCenter);
      await pulse(view, device, controller, TRIGGER);
      requireState(getSelectedBeamId() === seed.id, 'trigger ray did not select the real seed beam');
      requireState(structuralLayer.selectedBeamId === seed.id, 'selected beam did not expose structural handles');
      mark('part-select');

      const extendHandle = { kind: 'extend', beamId: seed.id, end: 'b' };
      const extendFrom = xrConstruction.getBeamHandleWorldPosition(extendHandle, new THREE.Vector3());
      requireState(extendFrom, 'extend handle world pose missing');
      const extendTo = toWorld([b[0], b[1], b[2] - 0.45]);
      await dragGrip(view, device, controller, extendFrom, extendTo);
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
      await setPose(view, device, controller, partRayOrigin, extensionVisiblePoint);
      await pulse(view, device, controller, TRIGGER);
      requireState(getSelectedBeamId() === extension.id, 'new beam could not be selected from a visible surface');

      const moveHandle = { kind: 'move', beamId: extension.id, end: 'b' };
      const moveFrom = xrConstruction.getBeamHandleWorldPosition(moveHandle, new THREE.Vector3());
      requireState(moveFrom, 'move handle world pose missing');
      const movedTargetLocal = [extensionB[0] + 0.18, extensionB[1], extensionB[2] - 0.12];
      await dragGrip(view, device, controller, moveFrom, toWorld(movedTargetLocal));
      const movedEnd = beamEndPosition(getDocument(), extension.id, 'b');
      requireState(
        Math.hypot(movedEnd[0] - extensionB[0], movedEnd[1] - extensionB[1], movedEnd[2] - extensionB[2]) > 0.1,
        'MOVE handle did not materially reshape the structural part',
      );
      mark('beam-reshape');

      await setPose(view, device, controller, rayOrigin, actionTarget('powered-wheel'));
      await pulse(view, device, controller, TRIGGER);
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
      await setPose(view, device, controller, wheelProbe);
      await xrFrames(view, 4);
      requireState(componentLayer.hasPreview(), 'beam-surface proximity did not produce wheel preview');
      mark('surface-mount-preview');

      await pulse(view, device, controller, SQUEEZE);
      requireState(getDocument().components.length === 1, 'squeeze did not author one powered wheel');
      const wheelId = getDocument().components[0].id;
      mark('squeeze-place');

      const wheelWorld = componentLayer.getWorldPosition(wheelId, new THREE.Vector3());
      requireState(wheelWorld, 'placed wheel interaction proxy missing');
      await setPose(view, device, controller, wheelWorld);
      await pulse(view, device, controller, SQUEEZE);
      requireState(getSelectedComponentId() === wheelId, 'direct squeeze did not select existing wheel');
      mark('direct-component-select');

      const beforeReverse = structuredClone(getDocument().components.find((component) => component.id === wheelId));
      requireState(beforeReverse, 'selected wheel disappeared before edit');
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-reverse'));
      await pulse(view, device, controller, TRIGGER);
      const afterReverse = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterReverse?.id === wheelId && afterReverse.motorVelocity === -beforeReverse.motorVelocity, 'REVERSE did not preserve identity and invert motor velocity');

      const beforeMirror = structuredClone(afterReverse);
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-flip'));
      await pulse(view, device, controller, TRIGGER);
      const afterMirror = getDocument().components.find((component) => component.id === wheelId);
      const axisDot = beforeMirror.mount.axis.reduce((sum, value, index) => sum + value * afterMirror.mount.axis[index], 0);
      requireState(
        afterMirror?.id === wheelId && axisDot < -0.99 && afterMirror.motorVelocity === -beforeMirror.motorVelocity,
        'MIRROR did not preserve identity while mirroring axle and coherent motor intent',
      );
      mark('contextual-wheel-edit');

      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-done'));
      await pulse(view, device, controller, TRIGGER);
      requireState(getSelectedComponentId() === null, 'DONE did not close component editing');

      const authoredBeforeWorkspaceMove = machineFingerprint(getDocument());
      const handleWorld = xrConstruction.getWorkspaceHandleWorldPosition(new THREE.Vector3());
      await setPose(view, device, controller, handleWorld);
      controller.updateButtonValue(SQUEEZE, 1);
      device.notifyStateChange();
      await xrFrames(view, 3);
      controller.position.x += 0.16;
      device.notifyStateChange();
      await xrFrames(view, 5);
      controller.updateButtonValue(SQUEEZE, 0);
      device.notifyStateChange();
      await xrFrames(view, 3);
      requireState(view.workspaceRoot.position.distanceTo(workspaceStart) > 0.08, 'workspace grip did not translate WorkspaceRoot');
      requireState(machineFingerprint(getDocument()) === authoredBeforeWorkspaceMove, 'workspace movement mutated authored machine truth');
      mark('workspace-grab');

      const authoredBeforeRun = machineFingerprint(getDocument());
      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'));
      await pulse(view, device, controller, TRIGGER);
      requireState(getMode() === 'run', 'trigger ray did not enter RUN');
      await xrFrames(view, 8);
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'RUN mutated authored truth');

      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'));
      await pulse(view, device, controller, TRIGGER);
      requireState(getMode() === 'build', 'trigger ray did not STOP back to BUILD');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'STOP did not preserve edited authored truth');
      mark('run-stop-authority');

      requireState(machineFingerprint(getDocument()) !== authoredAtStart, 'rehearsal authored no durable edit');
      report(`XR rehearsal PASS · ${stages.length}/${stages.length}: ${stages.map((stage) => stage.name).join(' → ')}`);
      window.__riftworksXrRehearsal = { pass: true, stages: [...stages] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report(`XR rehearsal FAIL after ${stages.length} PASS: ${message}`);
      window.__riftworksXrRehearsal = { pass: false, stages: [...stages], error: message };
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
  report('XR rehearsal armed. Enter VR once; IWER will execute the part-first controller-path rehearsal automatically.');
  return { enabled: true, stages };
}
