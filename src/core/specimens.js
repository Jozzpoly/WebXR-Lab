import { attachPoweredWheel } from './machine-document.js';

export function createPoweredCartMachine() {
  let document = {
    version: 2,
    revision: 0,
    nextIds: { node: 5, beam: 6, component: 1 },
    nodes: [
      { id: 'n1', position: [-0.45, 0.45, 0.4] },
      { id: 'n2', position: [0.45, 0.45, 0.4] },
      { id: 'n3', position: [-0.45, 0.45, -0.4] },
      { id: 'n4', position: [0.45, 0.45, -0.4] },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', roll: 0, thickness: 0.1, density: 320 },
      { id: 'b2', a: 'n3', b: 'n4', roll: 0, thickness: 0.1, density: 320 },
      { id: 'b3', a: 'n1', b: 'n3', roll: 0, thickness: 0.1, density: 320 },
      { id: 'b4', a: 'n2', b: 'n4', roll: 0, thickness: 0.1, density: 320 },
      { id: 'b5', a: 'n1', b: 'n4', roll: 0, thickness: 0.08, density: 260 },
    ],
    components: [],
  };

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
      motorVelocity: 8,
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
