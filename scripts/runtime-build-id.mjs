import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNTIME_INPUT_PATHS = [
  'src',
  'index.html',
  'package.json',
  'wrangler.jsonc',
  'vite.config.js',
  'scripts/runtime-build-id.mjs',
];

function collectFiles(rootDir, entry, output) {
  const absolute = join(rootDir, entry);
  if (!existsSync(absolute)) return;
  const stat = statSync(absolute);
  if (stat.isDirectory()) {
    for (const child of readdirSync(absolute).sort()) {
      collectFiles(rootDir, join(entry, child), output);
    }
    return;
  }
  if (stat.isFile()) output.push(absolute);
}

export function computeRuntimeBuildId(rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const files = [];
  for (const entry of RUNTIME_INPUT_PATHS) collectFiles(rootDir, entry, files);
  files.sort();

  const hash = createHash('sha256');
  for (const absolute of files) {
    const path = relative(rootDir, absolute).split(sep).join('/');
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(absolute));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${computeRuntimeBuildId()}\n`);
}
