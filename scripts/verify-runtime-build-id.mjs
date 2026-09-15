import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeRuntimeBuildId } from './runtime-build-id.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const expected = computeRuntimeBuildId(root);

if (!existsSync(dist)) throw new Error('dist/ is missing; build Riftworks before verifying the runtime fingerprint');

const files = [];
function collect(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const child of readdirSync(path).sort()) collect(join(path, child));
  } else if (stat.isFile()) {
    files.push(path);
  }
}
collect(dist);

const embedded = files.some((path) => {
  const content = readFileSync(path);
  return content.includes(Buffer.from(expected));
});

if (!embedded) throw new Error(`production bundle does not contain expected Riftworks runtime ID ${expected}`);
console.log(`[riftworks] verified production runtime ${expected}`);
