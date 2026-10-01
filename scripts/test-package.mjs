import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { chromium } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), 'monster-avatar-package-'));
const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let browser, server;
try {
  run(process.execPath, ['scripts/build.mjs']);
  const [pack] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary]));
  const expected = ['LICENSE', 'README.md', 'dist/index.cjs', 'dist/index.d.cts', 'dist/index.d.mts', 'dist/index.d.ts', 'dist/index.mjs', 'dist/monster-avatar.js', 'package.json'];
  assert.deepEqual(pack.files.map(f => f.path).sort(), expected);
  writeFileSync(path.join(temporary, 'package.json'), JSON.stringify({ name: 'avatar-consumer', private: true }));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', path.join(temporary, pack.filename)], temporary);
  const check = `const assert = require('node:assert/strict');
    const cjs = require('monster-avatar');
    import('monster-avatar').then(esm => {
      const opts = { traits: { hat: 'crown' }, colors: { body: '#85bf91' } };
      assert.equal(cjs.monsterAvatar('installed', opts).svg, esm.monsterAvatar('installed', opts).svg);
      assert.equal(esm.restoreAvatar(esm.monsterAvatar('installed', opts).config).svg, esm.monsterAvatar('installed', opts).svg);
      assert.equal(require('monster-avatar/package.json').version, '0.1.0');
    });`;
  run(process.execPath, ['-e', check], temporary);
  for (const filename of ['types.mts', 'types.cts']) writeFileSync(path.join(temporary, filename), readFileSync(path.join(root, 'test', filename)));
  run(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022', 'types.mts', 'types.cts'], temporary);
  const dist = path.join(temporary, 'node_modules/monster-avatar/dist');
  server = http.createServer((req, res) => {
    if (req.url === '/index.mjs' || req.url === '/monster-avatar.js') {
      res.setHeader('Content-Type', 'text/javascript'); res.end(readFileSync(path.join(dist, req.url.slice(1))));
    } else {
      res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body><h1>Installed package samples</h1><main></main></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const api = await import('/index.mjs');
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/monster-avatar.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
    if (api.monsterAvatar('installed').svg !== window.MonsterAvatar.monsterAvatar('installed').svg) throw Error('Browser formats differ');
    document.body.style.cssText = 'font:14px system-ui;background:#f7f7f5;margin:28px;';
    document.querySelector('main').style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:20px;';
    for (const theme of ['light', 'dark']) for (const kind of api.traitSchema.kind.values) for (const hat of api.traitSchema.hat.values) {
      const figure = document.createElement('figure'); figure.style.margin = '0';
      const img = new Image(96, 96); img.style.borderRadius = '50%';
      img.src = api.monsterAvatarDataUri(`qa-${hat}`, { theme, traits: { kind, hat } });
      await img.decode();
      const label = document.createElement('figcaption'); label.textContent = `${theme} ${kind} ${hat}`;
      figure.append(img, label); document.querySelector('main').append(figure);
    }
  });
  mkdirSync(path.join(root, 'test-results'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'test-results/package-grid.png'), fullPage: true });
  console.log(`Verified ${pack.name}@${pack.version}: ${pack.files.length} files, ${pack.size} bytes packed; installed ESM, CommonJS, TypeScript and browser consumers passed.`);
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(temporary, { recursive: true, force: true });
}
