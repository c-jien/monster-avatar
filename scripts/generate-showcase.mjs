import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { monsterAvatar } = require('../monster-avatar.js');
const directory = new URL('../docs/images/', import.meta.url);
await mkdir(directory, { recursive: true });

function avatar(seed, options, x, y, size, id) {
  const svg = monsterAvatar(seed, { ...options, size, idPrefix: id }).svg;
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 100 100"><defs><clipPath id="${id}-round"><circle cx="50" cy="50" r="49"/></clipPath></defs><g clip-path="url(#${id}-round)">${svg.replace(/^<svg[^>]+>|<\/svg>$/g, '')}</g></svg>`;
}
function frame(title, description, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${height}" viewBox="0 0 1200 ${height}" role="img" aria-labelledby="title description">
<title id="title">${title}</title>
<desc id="description">${description}</desc>
<rect width="1200" height="${height}" rx="28" fill="#f6f3ec"/>
${content}
</svg>\n`;
}
const samples = [
  ['Ian Cheng', {}],
  ['Orbit', { traits: { kind: 'bust', eyes: 'cyclops', mouth: 'smile', hat: 'crown' }, colors: { body: '#cfb7f0' } }],
  ['Fern', { traits: { top: 'sprout', hat: 'none', eyes: 'pair' }, colors: { body: '#bdd885' } }],
  ['Nova', { traits: { eyes: 'stalks', top: 'stalks', hat: 'none' }, colors: { body: '#9ecee1' } }],
  ['Lumi', { traits: { hat: 'beanie', mouth: 'fangs' }, colors: { body: '#f2c275' } }],
  ['Pip', { traits: { kind: 'bust', hat: 'flower', eyes: 'pair', eyeStyle: 'happy' }, colors: { body: '#eea4bb' } }],
  ['Echo', { traits: { kind: 'bust', hat: 'headphones', eyes: 'pair', mouth: 'grin' }, colors: { body: '#aab1e8' } }],
  ['Moss', { traits: { top: 'horns', hat: 'none', pattern: 'spots' }, colors: { body: '#c6df9a' } }],
  ['Cleo', { traits: { hat: 'bow', eyes: 'pair', eyeStyle: 'lashes' }, colors: { body: '#e6ace0' } }],
  ['Ziggy', { traits: { kind: 'bust', eyes: 'triple', hat: 'none' }, colors: { body: '#edb090' } }],
  ['Bean', { traits: { kind: 'bust', top: 'ears-round', face: 'glasses', hat: 'none' }, colors: { body: '#91cdb5' } }],
  ['Pixel', { traits: { eyes: 'visor', hat: 'cap' }, colors: { body: '#abcee0' } }],
  ['Sunny', { traits: { hat: 'party', eyes: 'pair', mouth: 'tongue' }, colors: { body: '#f0d789' } }],
  ['Wren', { traits: { kind: 'bust', top: 'ears-pointy', hat: 'none', mouth: 'cat' }, colors: { body: '#d3b1e6' } }],
];
const grid = samples.map(([seed, options], i) => avatar(seed, options, 51 + (i % 7) * 158, 37 + Math.floor(i / 7) * 160, 150, `cover-${i}`)).join('\n');
await writeFile(new URL('showcase.svg', directory), frame('Meet the monsters', 'Fourteen actual Monster Avatar outputs, mixing soft colors, body shapes, eyes, hats and accessories.', 384, grid));
const variants = [
  ['Automatic', {}],
  ['Add a crown', { traits: { hat: 'crown' } }],
  ['Make it a cyclops', { traits: { hat: 'crown', eyes: 'cyclops' } }],
  ['Choose your colors', { traits: { hat: 'crown', eyes: 'cyclops' }, colors: { body: '#bbaceb', background: '#272b46', accent: '#f1be72' } }],
];
const strip = variants.map(([label, options], i) => avatar('Ian Cheng', options, 70 + i * 300, 28, 160, `custom-${i}`) + `\n<text x="${150+i*300}" y="223" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="18" font-weight="500" fill="#34342f">${label}</text>`).join('\n');
await writeFile(new URL('customization.svg', directory), frame('One seed, your choices', 'The same seed with automatic traits, a crown, one eye, and finally custom colors.', 260, strip));
console.log('Generated docs/images/showcase.svg and customization.svg from the public API.');
