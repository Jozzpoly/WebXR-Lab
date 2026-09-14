const BUILD_LABEL = 'F1-A4';

window.__WEBXR_F1_DIAGNOSTICS__ ??= {};
window.__WEBXR_F1_DIAGNOSTICS__.build = BUILD_LABEL;

let mountedRow = null;

function ensureMounted() {
  const eyebrow = document.querySelector('.eyebrow');
  if (eyebrow && !eyebrow.textContent.includes(BUILD_LABEL)) {
    eyebrow.textContent = `WebXR Lab · ${BUILD_LABEL}`;
  }

  const status = document.querySelector('.status');
  if (!status) return null;
  if (mountedRow?.isConnected) return mountedRow;

  const row = document.createElement('div');
  row.className = 'status-row';
  row.dataset.telemetry = 'f1-a4';
  row.innerHTML = '<span class="dot pending"></span><span>A4 throw telemetry: armed</span>';
  status.appendChild(row);
  mountedRow = row;
  return row;
}

function render() {
  const row = ensureMounted();
  if (!row) return;

  const dot = row.querySelector('.dot');
  const label = row.querySelector('span:last-child');
  const physics = window.__WEBXR_F1_DIAGNOSTICS__?.physics;
  if (!physics) {
    dot.className = 'dot pending';
    label.textContent = 'A4 throw telemetry: waiting for Rapier';
    return;
  }

  const fallback = physics.fallbackLinearReleases ?? 0;
  const native = physics.nativeLinearReleases ?? 0;
  const releases = physics.releases ?? 0;
  const grabs = physics.grabs ?? 0;
  const speed = Number(physics.lastLinearSpeed ?? 0);

  dot.className = `dot ${grabs > 0 ? 'ok' : 'pending'}`;
  label.textContent = `A4 grab/throw: grabs ${grabs} · releases ${releases} · velocity native ${native} / fallback ${fallback} · last ${speed.toFixed(2)} m/s`;
}

render();
setInterval(render, 300);
