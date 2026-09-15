import { createBeam, createEmptyMachine } from '../../src/core/machine-document.js';

export function createSingleBeamMachine(
  start = [-0.4, 0, 0],
  end = [0.4, 0, 0],
  options = {},
) {
  return createBeam(createEmptyMachine(), start, end, options);
}
