import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const url = process.env.PORTFOLIO_URL || 'http://127.0.0.1:5175/';
const widths = [320, 390, 640, 641, 768, 1024, 1025, 1280, 1440];
const port = 9333;
const browser = spawn(chrome, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=/private/tmp/codex-portfolio-responsive-test-${process.pid}`,
  'about:blank',
], { stdio: 'ignore' });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPageSocket() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
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
  const socket = new WebSocket(await getPageSocket());
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  await command(socket, 'Page.enable');
  await command(socket, 'Runtime.enable');

  for (const width of widths) {
    await command(socket, 'Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await command(socket, 'Page.navigate', { url });
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await command(socket, 'Runtime.evaluate', {
        expression: "document.readyState === 'complete' && document.querySelectorAll('.sadti-project-card').length === 7",
        returnByValue: true,
      });
      ready = result.result.value;
      if (ready) break;
      await delay(100);
    }
    if (!ready) {
      const diagnostic = await command(socket, 'Runtime.evaluate', {
        expression: `({ href: location.href, state: document.readyState, title: document.title, cards: document.querySelectorAll('.sadti-project-card').length, root: document.querySelector('#root')?.innerHTML.slice(0, 120) })`,
        returnByValue: true,
      });
      throw new Error(`${width}px: portfolio cards did not load: ${JSON.stringify(diagnostic.result.value)}`);
    }
    await delay(150);

    const evaluation = await command(socket, 'Runtime.evaluate', {
      expression: `(() => {
        const rects = [...document.querySelectorAll('.sadti-project-card')].map((card) => {
          const rect = card.getBoundingClientRect();
          const image = card.querySelector('img');
          return { left: rect.left, right: rect.right, top: rect.top + scrollY, bottom: rect.bottom + scrollY,
            width: rect.width, height: rect.height, position: getComputedStyle(card).position,
            imageLoaded: Boolean(image && image.complete && image.naturalWidth) };
        });
        const intro = [...document.querySelectorAll('.sadti-copy p')];
        const nav = innerWidth <= 640 ? document.querySelector('.mobile-corner-links') : document.querySelector('.sadti-global-header .sadti-corner-nav');
        const navRect = nav?.getBoundingClientRect();
        const portrait = document.querySelector('.sadti-global-header .sadti-portrait-link');
        const portraitRect = portrait?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          stylesheetUrl: document.querySelector('link[href*="index-CUFsaUBw.css"]')?.href || '',
          introOverflow: intro.map((paragraph) => paragraph.scrollWidth - paragraph.clientWidth),
          introRects: intro.map((paragraph) => { const rect = paragraph.getBoundingClientRect(); return { left: rect.left, right: rect.right }; }),
          nav: navRect ? { left: navRect.left, right: navRect.right, display: getComputedStyle(nav).display, visibility: getComputedStyle(nav).visibility } : null,
          portrait: portraitRect ? { width: portraitRect.width, height: portraitRect.height, display: getComputedStyle(portrait).display, visibility: getComputedStyle(portrait).visibility } : null,
          rects,
        };
      })()`,
      returnByValue: true,
    });
    const { overflow, stylesheetUrl, introOverflow, introRects, nav, portrait, rects } = evaluation.result.value;
    assert.ok(overflow <= 2, `${width}px: page overflows horizontally by ${overflow}px`);
    assert.ok(stylesheetUrl.includes('?v='), `${width}px: stylesheet URL does not invalidate stale browser caches`);
    introOverflow.forEach((amount, index) => assert.ok(amount <= 1, `${width}px: intro line ${index + 1} clips by ${amount}px`));
    introRects.forEach((rect, index) => assert.ok(rect.left >= -1 && rect.right <= width + 1, `${width}px: intro line ${index + 1} escapes the viewport`));
    assert.ok(nav && nav.display !== 'none' && nav.visibility !== 'hidden', `${width}px: primary corner navigation is not visible`);
    assert.ok(nav.left >= -1 && nav.right <= width + 1, `${width}px: primary corner navigation escapes the viewport`);
    if (width <= 1120) {
      assert.ok(portrait && (portrait.display === 'none' || portrait.visibility === 'hidden' || portrait.width === 0), `${width}px: header portrait expands into page content`);
    } else {
      assert.ok(portrait && portrait.width >= 48 && portrait.width <= 110, `${width}px: header portrait has an invalid width`);
      assert.ok(Math.abs(portrait.width - portrait.height) <= 2, `${width}px: header portrait is distorted`);
    }
    assert.equal(rects.length, 7, `${width}px: expected seven project cards`);
    rects.forEach((rect, index) => {
      assert.ok(rect.left >= -1 && rect.right <= width + 1, `${width}px: card ${index + 1} escapes the viewport`);
      assert.ok(rect.width > 0 && rect.height > 0, `${width}px: card ${index + 1} has no usable size`);
      assert.equal(rect.imageLoaded, true, `${width}px: card ${index + 1} image did not load`);
      if (width <= 1024) assert.notEqual(rect.position, 'absolute', `${width}px: card ${index + 1} still uses fragile absolute positioning`);
    });
    for (let index = 1; index < rects.length; index += 1) {
      assert.ok(rects[index].top >= rects[index - 1].bottom - 1, `${width}px: cards ${index} and ${index + 1} overlap`);
    }
  }
  console.log(`Responsive layout passed at ${widths.join(', ')}px`);
  socket.close();
} finally {
  browser.kill('SIGTERM');
}
