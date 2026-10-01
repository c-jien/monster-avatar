const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const api = require('../monster-avatar.js');
const { monsterAvatar, monsterTraits, monsterAvatarDataUri, restoreAvatar, traitSchema, traitCompatibility } = api;

test('preserves 140 pre-refactor SVG fixtures in both themes', () => {
  for (const f of require('./fixtures/defaults.json')) {
    const svg = monsterAvatar(f.seed, { theme: f.theme }).svg;
    assert.equal(createHash('sha256').update(svg).digest('hex'), f.sha256, `${f.seed} ${f.theme}`);
  }
});
test('raw seeds preserve case, whitespace and Unicode; names normalize', () => {
  assert.equal(monsterAvatar('  Alice  ').svg, monsterAvatar('alice').svg);
  for (const pair of [['Alice', 'alice'], [' x ', 'x'], ['Ａ', 'A']]) {
    assert.notEqual(monsterAvatar(pair[0], { seedMode: 'raw' }).svg, monsterAvatar(pair[1], { seedMode: 'raw' }).svg);
  }
  assert.throws(() => monsterAvatar('', { seedMode: 'raw' }), /nonempty/);
  assert.throws(() => monsterAvatar(42, { seedMode: 'raw' }), /nonempty/);
});
test('every public trait value can be explicitly selected across seeds', () => {
  for (const seed of ['Ian Cheng', 'a', 'b', 'c', 'd', '🦖', '東京']) {
    for (const [key, { values }] of Object.entries(traitSchema)) for (const value of values) {
      const result = monsterAvatar(seed, { traits: { [key]: value } });
      assert.equal(result.traits[key], value, `${seed} ${key}=${value}`);
      assert.doesNotMatch(result.svg, /NaN|Infinity|undefined/);
      assert.equal(restoreAvatar(result.config).svg, result.svg);
    }
  }
});
test('explicit compatibility pairs succeed or report conflicts', () => {
  for (const { traits: [a, b], allowed } of traitCompatibility) {
    for (const x of traitSchema[a].values) for (const y of traitSchema[b].values) {
      const run = () => monsterTraits('compatibility', { traits: { [a]: x, [b]: y } });
      if (allowed.some(([p,q]) => p === x && q === y)) {
        const traits = run(); assert.equal(traits[a], x); assert.equal(traits[b], y);
      } else assert.throws(run, /Incompatible traits/, `${a}=${x}, ${b}=${y}`);
    }
  }
  assert.throws(() => monsterAvatar('a', { traits: { hat: 'crown', eyes: 'stalks' } }), /Incompatible/);
});
test('mouth overrides leave unrelated traits and palette alone', () => {
  for (let i = 0; i < 100; i++) {
    const before = monsterAvatar(String(i));
    const after = monsterAvatar(String(i), { traits: { mouth: 'smile' } });
    assert.deepEqual(after.traits, { ...before.traits, mouth: 'smile' });
    assert.deepEqual(after.colors, before.colors);
  }
});
test('colors override base fills with derived shading but do not change geometry', () => {
  const before = monsterAvatar('palette');
  const colors = { body: '#f0a', accent: '#abcdef', background: '#123456', ink: '#000' };
  const after = monsterAvatar('palette', { colors });
  assert.deepEqual(after.colors, colors);
  const geometry = svg => [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(geometry(before.svg), geometry(after.svg));
  assert.match(after.svg, /fill="#f0a"/);
  assert.notDeepEqual(before.colors, after.colors);
  assert.equal(restoreAvatar(after.config).svg, after.svg);
});
test('saved configuration is independent, serializable and versioned', () => {
  const options = { seedMode: 'raw', theme: 'dark', traits: { hat: 'crown' }, colors: { body: '#39a' }, size: 48, idPrefix: 'original' };
  const result = monsterAvatar('Case-Sensitive', options);
  const config = JSON.parse(JSON.stringify(result.config));
  assert.equal(restoreAvatar(config, { size: 48, idPrefix: 'original' }).svg, result.svg);
  options.traits.hat = 'none'; options.colors.body = '#000';
  assert.equal(result.config.traits.hat, 'crown'); assert.equal(result.config.colors.body, '#39a');
  assert.throws(() => restoreAvatar({ ...config, version: 2 }), /Unsupported/);
  assert.throws(() => restoreAvatar({ ...config, traits: undefined }), /plain object/);
  assert.throws(() => restoreAvatar(config, { seedMode: 'name' }), /Unknown/);
});
test('rejects malformed options and SVG attribute injection', () => {
  for (const options of [null, [], { size: 0 }, { size: Infinity }, { size: '1" onload="alert(1)' }, { idPrefix: 'x"/>' }, { idPrefix: 'foo:bar' }, { theme: 'wat' }, { seedMode: 'wat' }, { traits: [] }, { traits: { mouth: 'invalid' } }, { traits: { cheeks: 'true' } }, { traits: { key: 'injected' } }, { colors: { ink: 'url(https://example.com)' } }, { colors: { body: '#1234' } }, { colours: {} }, JSON.parse('{"__proto__":{}}')]) {
    assert.throws(() => monsterAvatar('seed', options), TypeError, JSON.stringify(options));
  }
  assert.doesNotMatch(monsterAvatar('<script>alert(1)</script>').svg, /<script/);
});
test('SVG IDs and data URIs are safe for image usage', () => {
  const a = monsterAvatar('ids', { idPrefix: 'one', traits: { hat: 'party', pattern: 'gradient', backdrop: 'dots', mouth: 'grin' } }).svg;
  const b = monsterAvatar('ids', { idPrefix: 'two', traits: { hat: 'party', pattern: 'gradient', backdrop: 'dots', mouth: 'grin' } }).svg;
  const ids = svg => [...svg.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set([...ids(a), ...ids(b)]).size, ids(a).length + ids(b).length);
  for (const match of a.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids(a).includes(match[1]));
  assert.equal(decodeURIComponent(monsterAvatarDataUri('ids').split(',')[1]), monsterAvatar('ids').svg);
});
test('browser global works without a DOM and metadata is immutable', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(require.resolve('../monster-avatar.js'), 'utf8'), context);
  assert.equal(context.MonsterAvatar.monsterAvatar('same').svg, monsterAvatar('same').svg);
  assert.ok(Object.isFrozen(traitSchema.hat.values));
  assert.ok(Object.isFrozen(traitCompatibility[0].allowed));
});
