import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(path.join(root, 'monster-avatar.js'), 'utf8');
const start = source.indexOf('  "use strict";');
const end = source.indexOf('  const api = {');
const exports = source.match(/  const api = \{ ([^}]+) \};/)[1];
if (start < 0 || end < start) throw new Error('Generator module wrapper has changed');
const body = source.slice(start, end);
const declaration = await readFile(path.join(root, 'index.d.ts'), 'utf8');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist'));
const banner = '/*! monster-avatar | MIT License | Copyright (c) 2026 c-jien */\n';
for (const [name, content] of Object.entries({
  'index.mjs': banner + body + `export { ${exports} };\n`,
  'index.cjs': banner + body + `module.exports = { ${exports} };\n`,
  'monster-avatar.js': banner + source,
  'index.d.ts': declaration,
  'index.d.mts': declaration,
  'index.d.cts': declaration,
})) await writeFile(path.join(root, 'dist', name), content);
console.log('Built ESM, CommonJS, browser bundle and declarations.');
