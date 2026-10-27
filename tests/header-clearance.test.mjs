import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5175';
const routes = ['/', '/tree-of-faith/', '/christmas/', '/who-is-jesus/', '/social-video/', '/kimzii/', '/google-maps/', '/illustration/', '/about/', '/contact/'];
const widths = [390, 510, 640, 641, 768, 1024, 1280];
const port = 9555;
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=/private/tmp/codex-portfolio-header-clearance-${process.pid}`,
  'about:blank',
], { stdio: 'ignore' });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocket() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      const page = pages.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await delay(100);
  }
  throw new Error('Chrome debugging endpoint did not start');
}

let sequence = 0;
const pending = new Map();
function command(socket, method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

try {
  const socket = new WebSocket(await pageSocket());
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const pair = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) pair.reject(new Error(message.error.message));
    else pair.resolve(message.result);
  });
  await command(socket, 'Page.enable');
  await command(socket, 'Runtime.enable');

  for (const route of routes) {
    for (const width of widths) {
      await command(socket, 'Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await command(socket, 'Page.navigate', { url: `${base}${route}` });
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const state = await command(socket, 'Runtime.evaluate', {
          expression: "document.readyState === 'complete' && Boolean(document.querySelector('.sadti-global-header'))",
          returnByValue: true,
        });
        ready = state.result.value;
        if (ready) break;
        await delay(100);
      }
      assert.equal(ready, true, `${route} at ${width}px did not load`);
      await command(socket, 'Runtime.evaluate', { expression: 'scrollTo(0, 0)' });
      await delay(150);

      const measurement = await command(socket, 'Runtime.evaluate', {
        expression: `(() => {
          const visible = (node) => {
            const style = getComputedStyle(node), rect = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
          };
          const index = document.querySelector('.sadti-list-header').getBoundingClientRect();
          const surface = document.querySelector('.project-page,.home-page,.about-page,.contact-page,.info-page');
          const candidates = [...surface.querySelectorAll('img,video,h1,h2,h3,.sadti-copy,.sadti-project-card,.about-copy,.contact-heading,.contact-form,.project-positioned')]
            .filter(visible)
            .map((node) => node.getBoundingClientRect())
            .filter((rect) => rect.bottom > index.bottom)
            .sort((a, b) => a.top - b.top);
          return {
            labels:[...document.querySelectorAll('.sadti-list-header a')].map((link) => link.textContent.trim()),
            clearance:candidates[0] ? candidates[0].top - index.bottom : null,
            overflow:document.documentElement.scrollWidth - innerWidth,
          };
        })()`,
        returnByValue: true,
      });
      const { labels, clearance, overflow } = measurement.result.value;
      assert.deepEqual(labels, ['PRODUCT DESIGN', 'CAMPAIGN DIRECTION', 'MOTION DIRECTION', 'CREATIVE DIRECTION', 'BRAND DESIGN', 'UX & ACCESSIBILITY', 'ILLUSTRATION'], `${route} at ${width}px has inconsistent index labels`);
      assert.ok(clearance === null || clearance >= 32, `${route} at ${width}px begins only ${clearance}px below the portfolio index`);
      assert.ok(overflow <= 2, `${route} at ${width}px overflows horizontally by ${overflow}px`);
    }
  }
  console.log(`Header clearance passed on ${routes.length} routes at ${widths.join(', ')}px`);
  socket.close();
} finally {
  browser.kill('SIGTERM');
}
