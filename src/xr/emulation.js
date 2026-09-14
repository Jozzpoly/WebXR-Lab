export async function installXrEmulationIfNeeded() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('emulate') === '1';
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  let nativeImmersive = false;
  try {
    nativeImmersive = Boolean(await navigator.xr?.isSessionSupported?.('immersive-vr'));
  } catch {
    nativeImmersive = false;
  }

  if (nativeImmersive || (!explicit && !local)) {
    return { mode: nativeImmersive ? 'native' : 'none', device: null };
  }

  const [{ XRDevice, metaQuest3 }, { DevUI }] = await Promise.all([
    import('iwer'),
    import('@iwer/devui'),
  ]);
  const device = new XRDevice(metaQuest3);
  device.installRuntime();
  const devui = new DevUI(device);
  return { mode: 'iwer', device, devui };
}
