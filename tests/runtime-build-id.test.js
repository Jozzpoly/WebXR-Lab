import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeRuntimeBuildId } from '../scripts/runtime-build-id.mjs';

function write(root, path, content) {
  const absolute = join(root, path);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content);
}

function seedRuntime(root) {
  write(root, 'src/main.js', 'export const answer = 1;\n');
  write(root, 'index.html', '<main id="app"></main>\n');
  write(root, 'package.json', '{"type":"module"}\n');
  write(root, 'wrangler.jsonc', '{"assets":{"directory":"./dist"}}\n');
  write(root, 'vite.config.js', 'export default {};\n');
  write(root, 'scripts/runtime-build-id.mjs', '// fingerprint implementation\n');
}

test('runtime build id is stable and ignores documentation-only changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'riftworks-runtime-id-'));
  seedRuntime(root);

  const first = computeRuntimeBuildId(root);
  write(root, 'README.md', '# changed docs only\n');
  write(root, 'docs/FOUNDATION_RESET.md', 'changed docs only\n');
  const second = computeRuntimeBuildId(root);

  assert.match(first, /^[0-9a-f]{12}$/);
  assert.equal(second, first);
  assert.equal(computeRuntimeBuildId(root), first);
});

test('runtime build id changes when executable source changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'riftworks-runtime-id-'));
  seedRuntime(root);

  const first = computeRuntimeBuildId(root);
  write(root, 'src/main.js', 'export const answer = 2;\n');
  const second = computeRuntimeBuildId(root);

  assert.notEqual(second, first);
});
