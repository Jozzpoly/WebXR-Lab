import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachPoweredWheel,
  createBeam,
  createEmptyMachine,
  extendFromBeamEnd,
  machineFingerprint,
} from '../src/core/machine-document.js';
import { getBeamFrame } from '../src/core/beam-frame.js';
import { compileMachine } from '../src/runtime/compile-machine.js';
import { MACHINE_YARD_WORLD, resolveRunSpawn } from '../src/runtime/machine-yard-world.js';
import { RapierMachineRuntime } from '../src/runtime/rapier-runtime.js';

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const signed = (random, magnitude = 1) => (random() * 2 - 1) * magnitude;
const choose = (random, values) => values[Math.floor(random() * values.length)];

function buildMachine(seed) {
  const random = rng(seed * 0x85ebca6b);
  let document = createEmptyMachine();
  const beamCount = 1 + Math.floor(random() * 7);

  for (let index = 0; index < beamCount; index += 1) {
    const makeConnected = document.beams.length > 0 && random() < 0.68;
    if (makeConnected) {
      const host = choose(random, document.beams);
      const end = random() < 0.5 ? 'a' : 'b';
      const hostNodeId = host[end];
      const hostNode = document.nodes.find((node) => node.id === hostNodeId);
      const offset = [
        signed(random, 0.8) + 0.14,
        signed(random, 0.45),
        signed(random, 0.8),
      ];
      const target = hostNode.position.map((value, axis) => value + offset[axis]);
      const next = extendFromBeamEnd(document, host.id, end, target);
      if (next !== document) document = next;
      continue;
    }

    const cluster = index % 3;
    const start = [
      cluster * 0.9 + signed(random, 0.35),
      signed(random, 0.35),
      signed(random, 0.55),
    ];
    const end = [
      start[0] + 0.18 + signed(random, 0.75),
      start[1] + signed(random, 0.45),
      start[2] + signed(random, 0.75),
    ];
    const next = createBeam(document, start, end, {
      roll: signed(random, Math.PI),
      thickness: 0.07 + random() * 0.13,
      density: 180 + random() * 850,
    });
    if (next !== document) document = next;
  }

  const wheelCount = Math.floor(random() * Math.min(6, document.beams.length + 2));
  for (let index = 0; index < wheelCount; index += 1) {
    const host = choose(random, document.beams);
    const frame = getBeamFrame(document, host.id);
    const faceAxis = random() < 0.2 ? 0 : (random() < 0.5 ? 1 : 2);
    const sign = random() < 0.5 ? -1 : 1;
    const extents = [frame.length * 0.5, frame.thickness * 0.5, frame.thickness * 0.5];
    const position = [
      signed(random, frame.length * 0.42),
      signed(random, frame.thickness * 0.35),
      signed(random, frame.thickness * 0.35),
    ];
    position[faceAxis] = sign * extents[faceAxis];
    const axis = [0, 0, 0];
    axis[faceAxis] = sign;

    document = attachPoweredWheel(document, host.id, {
      mount: { position, axis },
      radius: 0.09 + random() * 0.25,
      width: 0.05 + random() * 0.14,
      mountGap: random() * 0.06,
      density: 250 + random() * 850,
      motorVelocity: signed(random, 14),
      motorDamping: 0.4 + random() * 3,
    });
  }

  return document;
}

function assertFinitePose(pose, label) {
  for (const [field, values] of Object.entries({
    position: pose.position,
    rotation: pose.rotation,
    linearVelocity: pose.linearVelocity,
    angularVelocity: pose.angularVelocity,
  })) {
    assert.ok(values.every(Number.isFinite), `${label}: ${field} must stay finite, got ${values}`);
  }
}

test('Rapier survives varied legal authored machines without NaN, crash or authored mutation', async () => {
  const runtime = await RapierMachineRuntime.create();
  try {
    for (let seed = 1; seed <= 24; seed += 1) {
      const document = buildMachine(seed);
      const authoredBefore = machineFingerprint(document);
      const plan = compileMachine(document);
      const spawnPose = resolveRunSpawn(plan, MACHINE_YARD_WORLD);

      runtime.start(plan, { environment: MACHINE_YARD_WORLD, spawnPose });
      const expectedBodies = plan.islands.length + plan.components.length;
      assert.equal(runtime.sample().size, expectedBodies, `seed ${seed}: every compiled island/component needs a runtime body`);

      for (let step = 0; step < 180; step += 1) {
        runtime.step(1 / 90);
        if (step % 15 !== 0 && step !== 179) continue;
        const poses = runtime.sample();
        assert.equal(poses.size, expectedBodies, `seed ${seed} step ${step}: runtime body cardinality changed`);
        for (const [id, pose] of poses) assertFinitePose(pose, `seed ${seed} step ${step} ${id}`);
      }

      assert.equal(machineFingerprint(document), authoredBefore, `seed ${seed}: RUN must not mutate authored truth`);
      runtime.stop();
      assert.equal(runtime.sample().size, 0, `seed ${seed}: STOP must discard runtime bodies`);
    }
  } finally {
    runtime.stop();
  }
});
