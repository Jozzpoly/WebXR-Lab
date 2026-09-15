export const WORKSPACE_WORLD_POSITION = Object.freeze([0, 0.72, -0.78]);
export const MACHINE_PRESENTATION_OFFSET = Object.freeze([0, 0.45, 0]);

const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

function requireVec3(point, label) {
  if (!finiteVec3(point)) throw new Error(`${label} must be a finite vec3`);
}

export function machinePointToWorkspace(point) {
  requireVec3(point, 'machine point');
  return point.map((value, index) => value + MACHINE_PRESENTATION_OFFSET[index]);
}

export function workspacePointToMachine(point) {
  requireVec3(point, 'workspace point');
  return point.map((value, index) => value - MACHINE_PRESENTATION_OFFSET[index]);
}
