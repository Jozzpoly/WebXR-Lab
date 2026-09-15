import { defineConfig } from 'vite';
import { computeRuntimeBuildId } from './scripts/runtime-build-id.mjs';

const runtimeBuildId = computeRuntimeBuildId();
console.log(`[riftworks] runtime ${runtimeBuildId}`);

export default defineConfig({
  define: {
    __RIFTWORKS_RUNTIME_ID__: JSON.stringify(runtimeBuildId),
  },
});
