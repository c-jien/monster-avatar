const { test, expect } = require('@playwright/test');

test('customizes, shuffles, exports and restores without browser errors', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#grid .cell')).toHaveCount(60);
  await page.locator('#trait-mouth').selectOption('fangs');
  await page.locator('#auto-body').uncheck();
  await page.locator('#color-body').fill('#ff55aa');
  await page.locator('#shuffle').click();
  await expect(page.locator('#trait-mouth')).toHaveValue('fangs');
  await expect(page.locator('#color-body')).toHaveValue('#ff55aa');
  await page.locator('#export').click();
  const config = await page.locator('#configuration').inputValue();
  const before = await page.locator('#big').innerHTML();
  expect(JSON.parse(config).traits.mouth).toBe('fangs');
  await page.locator('#reset').click();
  await expect(page.locator('#trait-mouth')).toHaveValue('');
  await page.locator('#import').click();
  await expect(page.locator('#big')).toHaveJSProperty('innerHTML', before);
  await page.locator('#configuration').fill('{bad json');
  await page.locator('#import').click();
  await expect(page.locator('#status')).toContainText('Could not import');
  expect(errors).toEqual([]);
});

test('explains explicit conflicts and raw empty seeds', async ({ page }) => {
  await page.goto('/');
  await page.locator('#trait-eyes').selectOption('stalks');
  await page.locator('#trait-hat').selectOption('crown');
  await expect(page.locator('#status')).toContainText('Incompatible traits');
  await expect(page.locator('#export')).toBeDisabled();
  await page.locator('#trait-hat').selectOption('');
  await expect(page.locator('#export')).toBeEnabled();
  await page.locator('#seed-mode').selectOption('raw');
  await page.locator('#name').fill('');
  await expect(page.locator('#status')).toContainText('nonempty');
  await page.locator('#name').fill('User123');
  await expect(page.locator('#big svg')).toHaveCount(1);
});

test('browser ESM, browser bundle, SVG parsing and image decoding work', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const esm = await import('/dist/index.mjs');
    const fixtures = await (await fetch('/test/fixtures/defaults.json')).json();
    const hashes = [];
    for (const fixture of fixtures) {
      const svg = esm.monsterAvatar(fixture.seed, { theme: fixture.theme }).svg;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(svg));
      hashes.push([...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('') === fixture.sha256);
    }
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/dist/monster-avatar.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
    for (const [key, schema] of Object.entries(esm.traitSchema)) for (const value of schema.values) {
      const svg = esm.monsterAvatar('browser', { traits: { [key]: value } }).svg;
      if (new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')) throw new Error(`Invalid SVG: ${key}=${value}`);
      const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await image.decode();
    }
    return { matching: hashes.every(Boolean), sameBundle: window.MonsterAvatar.monsterAvatar('same').svg === esm.monsterAvatar('same').svg };
  });
  expect(result).toEqual({ matching: true, sameBundle: true });
});

test('mobile editor fits and visual samples cover light and dark themes', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('desktop-light.png'), fullPage: true });
  await page.locator('#theme').click();
  await page.screenshot({ path: testInfo.outputPath('desktop-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('mobile-dark.png'), fullPage: true });
});
