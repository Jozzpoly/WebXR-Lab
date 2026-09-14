export const DEFAULT_WORKSPACE_BOUNDS = {
  min: [-0.65, 0.52, -1.05],
  max: [0.65, 0.95, -0.62],
};

const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function beginWorkspaceTranslation(workspacePosition, gripWorldPosition) {
  if (!finiteVec3(workspacePosition) || !finiteVec3(gripWorldPosition)) {
    throw new Error('workspace translation requires finite vec3 inputs');
  }
  return {
    workspaceStart: [...workspacePosition],
    gripStart: [...gripWorldPosition],
  };
}

export function updateWorkspaceTranslation(drag, gripWorldPosition, bounds = DEFAULT_WORKSPACE_BOUNDS) {
  if (!drag || !finiteVec3(drag.workspaceStart) || !finiteVec3(drag.gripStart) || !finiteVec3(gripWorldPosition)) {
    throw new Error('workspace translation drag is invalid');
  }
  if (!finiteVec3(bounds?.min) || !finiteVec3(bounds?.max)) {
    throw new Error('workspace translation bounds must contain finite min/max vec3');
  }

  return drag.workspaceStart.map((value, index) => clamp(
    value + gripWorldPosition[index] - drag.gripStart[index],
    bounds.min[index],
    bounds.max[index],
  ));
}
