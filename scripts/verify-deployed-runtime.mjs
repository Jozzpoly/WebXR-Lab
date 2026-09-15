import { computeRuntimeBuildId } from './runtime-build-id.mjs';

const previewUrl = process.env.RIFTWORKS_PREVIEW_URL;
if (!previewUrl) throw new Error('RIFTWORKS_PREVIEW_URL is required');

const expected = computeRuntimeBuildId();
const attempts = Number(process.env.RIFTWORKS_PREVIEW_ATTEMPTS ?? 4);
const delayMs = Number(process.env.RIFTWORKS_PREVIEW_DELAY_MS ?? 15000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assetUrls(html, baseUrl) {
  const urls = new Set();
  const pattern = /(?:src|href)=["']([^"']+\.js(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const url = new URL(match[1], baseUrl);
    if (url.origin === new URL(baseUrl).origin) urls.add(url.href);
  }
  return [...urls];
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent': 'riftworks-preview-attribution/1',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

async function probe() {
  const root = new URL(previewUrl);
  root.searchParams.set('riftworks_runtime_probe', `${Date.now()}`);
  const html = await fetchText(root.href);
  const sources = [html];

  for (const assetUrl of assetUrls(html, root.href)) {
    sources.push(await fetchText(assetUrl));
  }

  if (sources.some((source) => source.includes(expected))) {
    console.log(`[riftworks] PREVIEW ATTRIBUTION PASS · ${previewUrl} serves runtime ${expected}`);
    return true;
  }

  const observed = new Set();
  for (const source of sources) {
    for (const match of source.matchAll(/RUNTIME[^0-9a-f]{0,32}([0-9a-f]{12})/gi)) observed.add(match[1]);
  }
  console.error(`[riftworks] preview attribution mismatch · expected ${expected} · observed ${[...observed].join(', ') || 'no runtime id'}`);
  return false;
}

let lastError = null;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    if (await probe()) process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`[riftworks] preview probe attempt ${attempt}/${attempts} failed: ${error.message}`);
  }
  if (attempt < attempts) await sleep(delayMs);
}

if (lastError) console.error(`[riftworks] preview attribution remains UNPROVEN: ${lastError.message}`);
process.exit(1);
