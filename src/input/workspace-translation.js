const finiteVec3 = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);

export function beginWorkspaceTranslation(workspacePosition, gripWorldPosition) {
  if (!finiteVec3(workspacePosition) || !finiteVec3(gripWorldPosition)) {
    throw new Error('workspace translation requires finite vec3 inputs');
  }
  return {
    workspaceStart: [...workspacePosition],
    gripStart: [...gripWorldPosition],
  };
}

export function updateWorkspaceTranslation(drag, gripWorldPosition) {
  if (!drag || !finiteVec3(drag.workspaceStart) || !finiteVec3(drag.gripStart) || !finiteVec3(gripWorldPosition)) {
    throw new Error('workspace translation drag is invalid');
  }
  return drag.workspaceStart.map((value, index) => value + gripWorldPosition[index] - drag.gripStart[index]);
}
