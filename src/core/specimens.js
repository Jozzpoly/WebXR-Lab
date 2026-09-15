import { attachPoweredWheel, createBeam, createEmptyMachine } from './machine-document.js';

export function createPoweredCartMachine() {
  let document = createEmptyMachine();
  document = createBeam(document, [-0.45, 0, 0.4], [0.45, 0, 0.4], {
    thickness: 0.1,
    density: 320,
  });
  document = createBeam(document, [-0.45, 0, -0.4], [0.45, 0, -0.4], {
    thickness: 0.1,
    density: 320,
  });
  document = createBeam(document, [-0.45, 0, 0.4], [-0.45, 0, -0.4], {
    startTargetBeamEnd: { beamId: 'b1', end: 'a' },
    endTargetBeamEnd: { beamId: 'b2', end: 'a' },
    thickness: 0.1,
    density: 320,
  });
  document = createBeam(document, [0.45, 0, 0.4], [0.45, 0, -0.4], {
    startTargetBeamEnd: { beamId: 'b1', end: 'b' },
    endTargetBeamEnd: { beamId: 'b2', end: 'b' },
    thickness: 0.1,
    density: 320,
  });
  document = createBeam(document, [-0.45, 0, 0.4], [0.45, 0, -0.4], {
    startTargetBeamEnd: { beamId: 'b1', end: 'a' },
    endTargetBeamEnd: { beamId: 'b2', end: 'b' },
    thickness: 0.08,
    density: 260,
  });

  const wheel = (hostBeamId, along, localSide) => {
    document = attachPoweredWheel(document, hostBeamId, {
      mount: {
        position: [along, 0, localSide * 0.05],
        axis: [0, 0, localSide],
      },
      radius: 0.24,
      width: 0.11,
      mountGap: 0.015,
      density: 520,
      // Mirrored outward axle vectors require mirrored signed motor speeds
      // to express one coherent machine-space drive direction.
      motorVelocity: 8 * localSide,
      motorDamping: 2.4,
    });
  };

  // b3/b4 both run from front to rear. Their local +Z points toward world +X,
  // so the left rail mounts outward on -Z and the right rail on +Z.
  wheel('b3', -0.32, -1);
  wheel('b4', -0.32, 1);
  wheel('b3', 0.32, -1);
  wheel('b4', 0.32, 1);
  return document;
}
