import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST = '127.0.0.1';
const VITE_PORT = 4174;
const CDP_PORT = 9222;
const PAGE_URL = `http://${HOST}:${VITE_PORT}/?emulate=1&rehearse=1`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function waitForJson(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.events = new Map();
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) ?? [];
      for (const listener of listeners) listener(message.params);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const listener = (params) => {
        clearTimeout(timer);
        const current = this.events.get(method) ?? [];
        this.events.set(method, current.filter((candidate) => candidate !== listener));
        resolve(params);
      };
      const timer = setTimeout(() => {
        const current = this.events.get(method) ?? [];
        this.events.set(method, current.filter((candidate) => candidate !== listener));
        reject(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      const current = this.events.get(method) ?? [];
      current.push(listener);
      this.events.set(method, current);
    });
  }

  async evaluate(expression, { awaitPromise = true, returnByValue = true } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? 'Runtime.evaluate failed');
    }
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error('No system Chrome/Chromium binary found on CI runner');

  const profile = mkdtempSync(join(tmpdir(), 'riftworks-iwer-'));
  const vite = spawn(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', HOST, '--port', String(VITE_PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const chromeProcess = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--remote-allow-origins=*',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,900',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  let viteStderr = '';
  let chromeStderr = '';
  vite.stderr.on('data', (chunk) => { viteStderr += chunk.toString(); });
  chromeProcess.stderr.on('data', (chunk) => { chromeStderr += chunk.toString(); });

  let client = null;
  try {
    await waitForHttp(PAGE_URL);
    await waitForJson(`http://${HOST}:${CDP_PORT}/json/version`);
    const targets = await waitForJson(`http://${HOST}:${CDP_PORT}/json/list`);
    const page = targets.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome exposed no debuggable page target');

    client = new CdpClient(page.webSocketDebuggerUrl);
    await client.open();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    const loaded = client.once('Page.loadEventFired');
    await client.send('Page.navigate', { url: PAGE_URL });
    await loaded;

    const buttonDeadline = Date.now() + 20_000;
    let rect = null;
    while (Date.now() < buttonDeadline) {
      rect = await client.evaluate(`(() => {
        const button = document.querySelector('.xr-entry');
        if (!button) return null;
        const r = button.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, text: button.textContent };
      })()`);
      if (rect?.width > 0 && rect?.height > 0) break;
      await wait(200);
    }
    if (!rect?.width || !rect?.height) throw new Error('XR entry button did not become interactive');

    const x = rect.x + rect.width * 0.5;
    const y = rect.y + rect.height * 0.5;
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

    const rehearsalDeadline = Date.now() + 35_000;
    let result = null;
    while (Date.now() < rehearsalDeadline) {
      result = await client.evaluate('window.__riftworksXrRehearsal ?? null');
      if (result) break;
      await wait(250);
    }

    if (!result) {
      const status = await client.evaluate(`({
        title: document.title,
        body: document.body.innerText.slice(0, 2400),
        presenting: Boolean(document.querySelector('.xr-entry')?.textContent?.includes('EXIT')),
      })`);
      throw new Error(`IWER rehearsal timed out. Browser state: ${JSON.stringify(status)}`);
    }

    if (!result.pass) {
      throw new Error(`IWER rehearsal FAIL after ${result.stages?.length ?? 0} stages: ${result.error ?? 'unknown error'}`);
    }

    console.log(`IWER browser rehearsal PASS · ${result.stages.length}/${result.stages.length}`);
    console.log(result.stages.map((stage) => stage.name).join(' -> '));
  } catch (error) {
    if (viteStderr.trim()) console.error(`\n[vite stderr]\n${viteStderr.slice(-4000)}`);
    if (chromeStderr.trim()) console.error(`\n[chrome stderr]\n${chromeStderr.slice(-6000)}`);
    throw error;
  } finally {
    client?.close();
    vite.kill('SIGTERM');
    chromeProcess.kill('SIGTERM');
    rmSync(profile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
