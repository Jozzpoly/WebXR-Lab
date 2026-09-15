const runtimeId = __RIFTWORKS_RUNTIME_ID__;

Object.defineProperty(window, '__RIFTWORKS_RUNTIME_ID__', {
  value: runtimeId,
  configurable: false,
  enumerable: false,
  writable: false,
});

document.documentElement.dataset.riftworksRuntime = runtimeId;

const badge = document.createElement('div');
badge.id = 'runtimeBuildBadge';
badge.textContent = `RUNTIME ${runtimeId}`;
badge.title = 'Deterministic fingerprint of runtime-bearing Riftworks source';
badge.setAttribute('aria-label', `Riftworks runtime ${runtimeId}`);
Object.assign(badge.style, {
  position: 'fixed',
  right: '10px',
  bottom: '10px',
  zIndex: '10000',
  padding: '4px 7px',
  border: '1px solid rgba(160, 190, 210, 0.32)',
  borderRadius: '5px',
  background: 'rgba(6, 10, 15, 0.78)',
  color: 'rgba(205, 225, 238, 0.72)',
  font: '10px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  letterSpacing: '0.04em',
  pointerEvents: 'none',
  userSelect: 'none',
});
document.body.appendChild(badge);
