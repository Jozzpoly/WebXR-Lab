import { attachPoweredWheel } from './machine-document.js';

export function createPoweredCartMachine() {
  let document = {
    version: 1,
    revision: 0,
    nextIds: { node: 5, beam: 6, component: 1 },
    nodes: [
      { id: 'n1', position: [-0.45, 0.45, 0.4] },
      { id: 'n2', position: [0.45, 0.45, 0.4] },
      { id: 'n3', position: [-0.45, 0.45, -0.4] },
      { id: 'n4', position: [0.45, 0.45, -0.4] },
    ],
    beams: [
      { id: 'b1', a: 'n1', b: 'n2', thickness: 0.1, density: 320 },
      { id: 'b2', a: 'n3', b: 'n4', thickness: 0.1, density: 320 },
      { id: 'b3', a: 'n1', b: 'n3', thickness: 0.1, density: 320 },
      { id: 'b4', a: 'n2', b: 'n4', thickness: 0.1, density: 320 },
      { id: 'b5', a: 'n1', b: 'n4', thickness: 0.08, density: 260 },
    ],
    components: [],
  };

  const wheel = (nodeId, side) => {
    document = attachPoweredWheel(document, nodeId, {
      axis: [1, 0, 0],
      side,
      radius: 0.24,
      width: 0.11,
      mountOffset: 0.16,
      density: 520,
      motorVelocity: 8,
      motorDamping: 2.4,
    });
  };

  wheel('n1', -1);
  wheel('n2', 1);
  wheel('n3', -1);
  wheel('n4', 1);
  return document;
}
