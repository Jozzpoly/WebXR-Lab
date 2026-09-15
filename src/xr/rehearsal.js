import * as THREE from 'three';
import { machineFingerprint } from '../core/machine-document.js';
import { beamEndPosition } from '../input/structural-placement.js';

const TRIGGER = 'trigger';
const SQUEEZE = 'squeeze';
const XR_FRAME_TIMEOUT_MS = 2500;
const GRIP_POSE_TOLERANCE = 0.005;
const GRIP_ROUND_TRIP_TOLERANCE = 0.01;

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

async function readGripWorld(view, handedness = 'right', label = 'grip-pose') {
  const session = view.renderer.xr.getSession();
  const referenceSpace = view.renderer.xr.getReferenceSpace();
  if (!session || !referenceSpace) throw new Error(`${label}: XR session/reference space unavailable`);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label}: timed out waiting for XR grip pose`));
    }, XR_FRAME_TIMEOUT_MS);

    session.requestAnimationFrame((_time, frame) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      const inputSource = Array.from(session.inputSources).find((source) => source.handedness === handedness);
      if (!inputSource?.gripSpace) {
        reject(new Error(`${label}: ${handedness} controller gripSpace unavailable`));
        return;
      }
      const pose = frame.getPose(inputSource.gripSpace, referenceSpace);
      if (!pose) {
        reject(new Error(`${label}: ${handedness} controller grip pose unavailable`));
        return;
      }
      const { x, y, z } = pose.transform.position;
      resolve(new THREE.Vector3(x, y, z));
    });
  });
}

async function setGripPose(view, device, controller, desiredWorld, label = 'set-grip-pose') {
  await setPose(view, device, controller, desiredWorld, null, `${label}: target-ray-seed`);
  const firstGrip = await readGripWorld(view, 'right', `${label}: first-grip`);
  controller.position.add(desiredWorld.clone().sub(firstGrip));
  device.notifyStateChange();
  await xrFrames(view, 3, `${label}: corrected-settle`);
  const settledGrip = await readGripWorld(view, 'right', `${label}: settled-grip`);
  const error = settledGrip.distanceTo(desiredWorld);
  requireState(error <= GRIP_POSE_TOLERANCE,
    `${label}: IWER grip calibration missed desired world pose by ${error.toFixed(4)} m`);
  return settledGrip;
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
  await setGripPose(view, device, controller, from, `${label}: start-pose`);
  controller.updateButtonValue(SQUEEZE, 1);
  device.notifyStateChange();
  await xrFrames(view, 4, `${label}: grip-press`);
  const startGripWorld = await readGripWorld(view, 'right', `${label}: pressed-grip`);
  await setGripPose(view, device, controller, to, `${label}: move-pose`);
  controller.updateButtonValue(SQUEEZE, 0);
  device.notifyStateChange();
  await xrFrames(view, 4, `${label}: grip-release`);
  const endGripWorld = await readGripWorld(view, 'right', `${label}: released-grip`);
  return { startGripWorld, endGripWorld };
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
  if (params.get('rehearse') !== '1' || emulation.mode !== 'iwer' || !emulation.device) return { enabled: false };

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
    window.__riftworksXrRehearsalTrace = { phase, mode: getMode(), stages: stages.map((stage) => stage.name) };
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
  const workspaceToWorld = (local) => view.workspaceToWorldPoint(new THREE.Vector3(...local), new THREE.Vector3());
  const machineToWorld = (local) => view.machineToWorldPoint(new THREE.Vector3(...local), new THREE.Vector3());
  const rayOrigin = new THREE.Vector3(0.28, 1.38, -0.12);

  const selectBeamByVisiblePoint = async (beamId, fraction, originWorkspace, label) => {
    const a = beamEndPosition(getDocument(), beamId, 'a');
    const b = beamEndPosition(getDocument(), beamId, 'b');
    requireState(a && b, `${label}: beam endpoints unavailable`);
    const point = machineToWorld([
      a[0] + (b[0] - a[0]) * fraction,
      a[1] + (b[1] - a[1]) * fraction,
      a[2] + (b[2] - a[2]) * fraction,
    ]);
    const origin = workspaceToWorld(originWorkspace);
    await setPose(view, device, controller, origin, point, `${label}: aim`);
    await pulse(view, device, controller, TRIGGER, `${label}: select`);
    requireState(getSelectedBeamId() === beamId, `${label}: real beam could not be selected from a visible surface`);
  };

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
      requireState(getTool() === 'beam', 'blank workshop must start with BEAM authoring active');
      requireState(getDocument().components.length === 0, 'rehearsal expects no components');
      requireState(getDocument().beams.length === 0, 'rehearsal expects a genuinely blank workshop');
      requireState(getDocument().nodes.length === 0, 'blank workshop must not hide starter topology');
      mark('blank-workshop');

      const firstStart = machineToWorld([-0.36, 0, 0]);
      const firstEnd = machineToWorld([0.36, 0, 0]);
      const firstDrag = await dragGrip(view, device, controller, firstStart, firstEnd, 'first-beam-create');
      requireState(getDocument().beams.length === 1, 'blank-space grip drag did not author the first beam');
      requireState(getDocument().nodes.length === 2, 'first beam should own exactly two internal endpoints');
      requireState(getDocument().nodes.every((node) => Math.abs(node.position[1]) <= GRIP_POSE_TOLERANCE),
        'XR workbench presentation height leaked into authored machine-local Y');
      const seed = getDocument().beams[0];
      const authoredStart = machineToWorld(beamEndPosition(getDocument(), seed.id, 'a'));
      const authoredEnd = machineToWorld(beamEndPosition(getDocument(), seed.id, 'b'));
      const forwardError = Math.max(
        authoredStart.distanceTo(firstDrag.startGripWorld),
        authoredEnd.distanceTo(firstDrag.endGripWorld),
      );
      const reverseError = Math.max(
        authoredStart.distanceTo(firstDrag.endGripWorld),
        authoredEnd.distanceTo(firstDrag.startGripWorld),
      );
      const gripRoundTripError = Math.min(forwardError, reverseError);
      requireState(gripRoundTripError <= GRIP_ROUND_TRIP_TOLERANCE,
        `XR grip-space → machine → world round-trip drifted by ${gripRoundTripError.toFixed(4)} m`);
      mark('machine-local-authority');
      mark('beam-create');

      await selectBeamByVisiblePoint(seed.id, 0.5, [0.75, 0.72, 0.45], 'seed-beam');
      requireState(structuralLayer.selectedBeamId === seed.id, 'selected beam did not expose structural handles');
      mark('part-select');

      const b = beamEndPosition(getDocument(), seed.id, 'b');
      const extendHandle = { kind: 'extend', beamId: seed.id, end: 'b' };
      const extendFrom = xrConstruction.getBeamHandleWorldPosition(extendHandle, new THREE.Vector3());
      requireState(extendFrom, 'extend handle world pose missing');
      const extendTo = machineToWorld([b[0], b[1], b[2] - 0.45]);
      await dragGrip(view, device, controller, extendFrom, extendTo, 'beam-extend');
      requireState(getDocument().beams.length === 2, 'EXTEND handle did not author a second structural beam');
      mark('beam-extend');

      const extension = getDocument().beams.find((beam) => beam.id !== seed.id);
      requireState(extension, 'new structural beam identity missing');
      const extensionB = beamEndPosition(getDocument(), extension.id, 'b');
      await selectBeamByVisiblePoint(extension.id, 0.75, [0.75, 0.70, -0.20], 'extension-beam');

      const moveHandle = { kind: 'move', beamId: extension.id, end: 'b' };
      const moveFrom = xrConstruction.getBeamHandleWorldPosition(moveHandle, new THREE.Vector3());
      requireState(moveFrom, 'move handle world pose missing');
      const movedTargetMachine = [extensionB[0] + 0.18, extensionB[1], extensionB[2] - 0.12];
      await dragGrip(view, device, controller, moveFrom, machineToWorld(movedTargetMachine), 'beam-reshape');
      const movedEnd = beamEndPosition(getDocument(), extension.id, 'b');
      requireState(Math.hypot(movedEnd[0] - extensionB[0], movedEnd[1] - extensionB[1], movedEnd[2] - extensionB[2]) > 0.1,
        'MOVE handle did not materially reshape the structural part');
      mark('beam-reshape');

      await setPose(view, device, controller, rayOrigin, actionTarget('beam-done'), 'beam-done-aim');
      await pulse(view, device, controller, TRIGGER, 'beam-done');
      requireState(getSelectedBeamId() === null, 'BEAM DONE did not close structural selection');
      mark('beam-context-close');

      await setPose(view, device, controller, rayOrigin, actionTarget('powered-wheel'), 'wheel-tool-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-tool-select');
      requireState(getTool() === 'powered-wheel', 'trigger ray did not select WHEEL');
      mark('ray-tool-select');

      const seedAfterEditA = beamEndPosition(getDocument(), seed.id, 'a');
      const seedAfterEditB = beamEndPosition(getDocument(), seed.id, 'b');
      const wheelProbeMachine = [
        (seedAfterEditA[0] + seedAfterEditB[0]) * 0.5,
        (seedAfterEditA[1] + seedAfterEditB[1]) * 0.5,
        (seedAfterEditA[2] + seedAfterEditB[2]) * 0.5 + 0.1,
      ];
      const wheelProbe = machineToWorld(wheelProbeMachine);
      await setGripPose(view, device, controller, wheelProbe, 'wheel-probe');
      await xrFrames(view, 4, 'wheel-preview');
      requireState(componentLayer.hasPreview(), 'beam-surface proximity did not produce wheel preview');
      mark('surface-mount-preview');

      await pulse(view, device, controller, SQUEEZE, 'wheel-place');
      requireState(getDocument().components.length === 1, 'squeeze did not author one powered wheel');
      const wheelId = getDocument().components[0].id;
      mark('squeeze-place');

      const wheelWorld = componentLayer.getWorldPosition(wheelId, new THREE.Vector3());
      requireState(wheelWorld, 'placed wheel interaction proxy missing');
      await setGripPose(view, device, controller, wheelWorld, 'wheel-existing-probe');
      await pulse(view, device, controller, SQUEEZE, 'wheel-existing-select');
      requireState(getSelectedComponentId() === wheelId, 'direct squeeze did not select existing wheel');
      mark('direct-component-select');

      const beforeRehost = structuredClone(getDocument().components.find((component) => component.id === wheelId));
      const rehostA = beamEndPosition(getDocument(), extension.id, 'a');
      const rehostB = beamEndPosition(getDocument(), extension.id, 'b');
      const rehostTarget = machineToWorld([
        (rehostA[0] + rehostB[0]) * 0.5,
        (rehostA[1] + rehostB[1]) * 0.5 + 0.13,
        (rehostA[2] + rehostB[2]) * 0.5,
      ]);
      await dragGrip(view, device, controller, wheelWorld, rehostTarget, 'wheel-direct-rehost');
      const afterRehost = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterRehost?.id === wheelId, 'direct wheel drag replaced authored identity');
      requireState(afterRehost.hostBeamId === extension.id, 'direct wheel drag did not rehost onto the target beam');
      requireState(afterRehost.motorVelocity === beforeRehost.motorVelocity, 'direct spatial move silently rewired motor control');
      requireState(getSelectedComponentId() === wheelId, 'direct wheel rehost lost component selection');
      mark('direct-component-rehost');

      const beforeReverse = structuredClone(afterRehost);
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-reverse'), 'wheel-reverse-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-reverse');
      const afterReverse = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterReverse?.id === wheelId && afterReverse.motorVelocity === -beforeReverse.motorVelocity,
        'REVERSE did not preserve identity and invert motor velocity');

      const beforeMirror = structuredClone(afterReverse);
      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-flip'), 'wheel-mirror-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-mirror');
      const afterMirror = getDocument().components.find((component) => component.id === wheelId);
      const axisDot = beforeMirror.mount.axis.reduce((sum, value, index) => sum + value * afterMirror.mount.axis[index], 0);
      requireState(afterMirror?.id === wheelId && axisDot < -0.99 && afterMirror.motorVelocity === -beforeMirror.motorVelocity,
        'MIRROR did not preserve identity while mirroring axle and coherent motor intent');
      mark('contextual-wheel-edit');

      await setPose(view, device, controller, rayOrigin, actionTarget('wheel-done'), 'wheel-done-aim');
      await pulse(view, device, controller, TRIGGER, 'wheel-done');
      requireState(getSelectedComponentId() === null, 'DONE did not close component editing');

      const authoredBeforeWorkspaceMove = machineFingerprint(getDocument());
      const handleWorld = xrConstruction.getWorkspaceHandleWorldPosition(new THREE.Vector3());
      await setGripPose(view, device, controller, handleWorld, 'workspace-handle-pose');
      controller.updateButtonValue(SQUEEZE, 1);
      device.notifyStateChange();
      await xrFrames(view, 3, 'workspace-grab: press');
      controller.position.x += 0.16;
      device.notifyStateChange();
      await xrFrames(view, 5, 'workspace-grab: move');
      controller.updateButtonValue(SQUEEZE, 0);
      device.notifyStateChange();
      await xrFrames(view, 3, 'workspace-grab: release');
      requireState(view.workspaceRoot.position.distanceTo(workspaceStart) > 0.08, 'workspace grip did not translate WorkspaceRoot in BUILD');
      requireState(machineFingerprint(getDocument()) === authoredBeforeWorkspaceMove, 'workspace movement mutated authored machine truth');
      mark('workspace-grab');

      const authoredBeforeRun = machineFingerprint(getDocument());
      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'), 'enter-run-aim');
      await pulse(view, device, controller, TRIGGER, 'enter-run');
      requireState(getMode() === 'run', 'trigger ray did not enter RUN');
      await xrFrames(view, 8, 'run-observe');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'RUN mutated authored truth');

      const workspaceDuringRun = view.workspaceRoot.position.clone();
      const oldHandleWorld = xrConstruction.getWorkspaceHandleWorldPosition(new THREE.Vector3());
      await dragGrip(view, device, controller, oldHandleWorld, oldHandleWorld.clone().add(new THREE.Vector3(0.2, 0, 0)), 'run-workspace-rejection');
      requireState(view.workspaceRoot.position.distanceTo(workspaceDuringRun) < 1e-6, 'RUN must reject authoring workspace translation');
      mark('run-workspace-isolation');

      await setPose(view, device, controller, rayOrigin, actionTarget('run-toggle'), 'stop-run-aim');
      await pulse(view, device, controller, TRIGGER, 'stop-run');
      requireState(getMode() === 'build', 'trigger ray did not STOP back to BUILD');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'STOP did not preserve edited authored truth');
      mark('run-stop-authority');

      await selectBeamByVisiblePoint(extension.id, 0.55, [0.75, 0.70, -0.20], 'delete-wheel-host-beam');
      await setPose(view, device, controller, rayOrigin, actionTarget('beam-delete'), 'delete-host-aim');
      await pulse(view, device, controller, TRIGGER, 'delete-host');
      requireState(getDocument().beams.length === 1, 'beam DELETE did not remove the selected structural part');
      requireState(getDocument().components.length === 0, 'deleting the current wheel host left a dangling powered wheel');
      mark('beam-delete-cascade');

      const remaining = getDocument().beams[0];
      await selectBeamByVisiblePoint(remaining.id, 0.55, [0.75, 0.72, 0.45], 'delete-final-beam');
      await setPose(view, device, controller, rayOrigin, actionTarget('beam-delete'), 'delete-final-aim');
      await pulse(view, device, controller, TRIGGER, 'delete-final');
      requireState(getDocument().beams.length === 0, 'deleting final beam did not return to blank structure');
      requireState(getDocument().nodes.length === 0, 'blank return left orphan topology');
      requireState(getDocument().components.length === 0, 'blank return left components');
      mark('blank-return');

      requireState(machineFingerprint(getDocument()) !== authoredAtStart,
        'lifecycle should advance authored revision/id provenance even after returning to blank geometry');
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

  view.renderer.xr.addEventListener('sessionstart', () => { run(); });
  publishTrace('armed');
  report('XR rehearsal armed. Enter VR once; IWER will execute the blank-workshop part lifecycle automatically.');
  return { enabled: true, stages };
}
