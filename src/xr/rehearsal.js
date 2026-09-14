import * as THREE from 'three';
import { machineFingerprint } from '../core/machine-document.js';

const TRIGGER = 'trigger';
const SQUEEZE = 'squeeze';
const frames = (count = 2) => new Promise((resolve) => {
  const step = () => {
    if (count-- <= 0) resolve();
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
});

function requireState(condition, message) {
  if (!condition) throw new Error(message);
}

function aimController(controller, from, target) {
  const direction = target.clone().sub(from).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
  controller.position.set(from.x, from.y, from.z);
  controller.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
}

async function setPose(device, controller, position, target = null) {
  if (target) aimController(controller, position, target);
  else {
    controller.position.set(position.x, position.y, position.z);
    controller.quaternion.set(0, 0, 0, 1);
  }
  device.notifyStateChange();
  await frames(3);
}

async function pulse(device, controller, button) {
  controller.updateButtonValue(button, 1);
  device.notifyStateChange();
  await frames(3);
  controller.updateButtonValue(button, 0);
  device.notifyStateChange();
  await frames(3);
}

export function installIwerRehearsal({
  emulation,
  view,
  componentLayer,
  xrConstruction,
  getDocument,
  getTool,
  getSelectedComponentId,
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
  const rayOrigin = new THREE.Vector3(0.28, 1.38, -0.12);

  const run = async () => {
    if (running) return;
    running = true;
    const authoredAtStart = machineFingerprint(getDocument());
    const workspaceStart = view.workspaceRoot.position.clone();
    device.controlMode = 'programmatic';
    device.notifyStateChange();

    try {
      await frames(6);
      requireState(getMode() === 'build', 'rehearsal must start in BUILD');
      requireState(getDocument().components.length === 0, 'rehearsal expects a fresh seed machine');
      mark('fresh-build');

      await setPose(device, controller, rayOrigin, actionTarget('powered-wheel'));
      await pulse(device, controller, TRIGGER);
      requireState(getTool() === 'powered-wheel', 'trigger ray did not select WHEEL');
      mark('ray-tool-select');

      const node = getDocument().nodes[0];
      requireState(node, 'seed socket missing');
      const nodeWorld = view.workspaceRoot.localToWorld(new THREE.Vector3(...node.position));
      await setPose(device, controller, nodeWorld);
      await frames(4);
      requireState(componentLayer.hasPreview(), 'grip proximity did not produce wheel preview');
      mark('pre-placement-preview');

      await pulse(device, controller, SQUEEZE);
      requireState(getDocument().components.length === 1, 'squeeze did not author one powered wheel');
      const wheelId = getDocument().components[0].id;
      mark('squeeze-place');

      const wheelWorld = componentLayer.getWorldPosition(wheelId, new THREE.Vector3());
      requireState(wheelWorld, 'placed wheel interaction proxy missing');
      await setPose(device, controller, wheelWorld);
      await pulse(device, controller, SQUEEZE);
      requireState(getSelectedComponentId() === wheelId, 'direct squeeze did not select existing wheel');
      mark('direct-component-select');

      const beforeReverse = getDocument().components.find((component) => component.id === wheelId);
      requireState(beforeReverse, 'selected wheel disappeared before edit');
      const velocityBefore = beforeReverse.motorVelocity;
      await setPose(device, controller, rayOrigin, actionTarget('wheel-reverse'));
      await pulse(device, controller, TRIGGER);
      const afterReverse = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterReverse?.id === wheelId && afterReverse.motorVelocity === -velocityBefore, 'REVERSE did not preserve identity and invert motor velocity');

      const sideBefore = afterReverse.side;
      await setPose(device, controller, rayOrigin, actionTarget('wheel-flip'));
      await pulse(device, controller, TRIGGER);
      const afterFlip = getDocument().components.find((component) => component.id === wheelId);
      requireState(afterFlip?.id === wheelId && afterFlip.side === -sideBefore, 'FLIP did not preserve identity and invert mount side');
      mark('contextual-wheel-edit');

      await setPose(device, controller, rayOrigin, actionTarget('wheel-done'));
      await pulse(device, controller, TRIGGER);
      requireState(getSelectedComponentId() === null, 'DONE did not close component editing');

      const authoredBeforeWorkspaceMove = machineFingerprint(getDocument());
      const handleWorld = xrConstruction.getWorkspaceHandleWorldPosition(new THREE.Vector3());
      requireState(handleWorld, 'workspace handle is unavailable');
      await setPose(device, controller, handleWorld);
      controller.updateButtonValue(SQUEEZE, 1);
      device.notifyStateChange();
      await frames(3);
      controller.position.x += 0.16;
      device.notifyStateChange();
      await frames(5);
      controller.updateButtonValue(SQUEEZE, 0);
      device.notifyStateChange();
      await frames(3);
      requireState(view.workspaceRoot.position.distanceTo(workspaceStart) > 0.08, 'workspace grip did not translate WorkspaceRoot');
      requireState(machineFingerprint(getDocument()) === authoredBeforeWorkspaceMove, 'workspace movement mutated authored machine truth');
      mark('workspace-grab');

      const authoredBeforeRun = machineFingerprint(getDocument());
      await setPose(device, controller, rayOrigin, actionTarget('run-toggle'));
      await pulse(device, controller, TRIGGER);
      requireState(getMode() === 'run', 'trigger ray did not enter RUN');
      await frames(8);
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'RUN mutated authored truth');

      await setPose(device, controller, rayOrigin, actionTarget('run-toggle'));
      await pulse(device, controller, TRIGGER);
      requireState(getMode() === 'build', 'trigger ray did not STOP back to BUILD');
      requireState(machineFingerprint(getDocument()) === authoredBeforeRun, 'STOP did not preserve edited authored truth');
      mark('run-stop-authority');

      const changedFromSeed = machineFingerprint(getDocument()) !== authoredAtStart;
      requireState(changedFromSeed, 'rehearsal authored no durable edit');
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
      await frames(2);
      const session = view.renderer.xr.getSession();
      if (session) await session.end();
      running = false;
    }
  };

  view.renderer.xr.addEventListener('sessionstart', () => {
    run();
  });
  report('XR rehearsal armed. Enter VR once; IWER will execute the bounded controller-path rehearsal automatically.');
  return { enabled: true, stages };
}
