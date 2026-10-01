# Avatar generation

Format: 1

## Purpose

Generates deterministic SVG monsters with validated trait and palette overrides, compatibility resolution and versioned saved configurations.

## Files

- `index.d.ts`
  - Role: Declares the public generator, options, schema and configuration types.
  - Symbols: `AvatarConfig`, `AvatarResult`, `MonsterOptions`, `MonsterTraits`
  - Detail: mapped
- `monster-avatar.js`
  - Role: Maintains the dependency-free renderer and browser/CommonJS source API.
  - Symbols: `VERSION`, `applyColors`, `generatedTraits`, `hash32`, `monsterAvatar`, `monsterAvatarDataUri`, `monsterTraits`, `normalizeName`, `resolveTraits`, `restoreAvatar`, `seedKey`, `traitCompatibility`, `traitSchema`, `validateOptions`
  - Detail: mapped
- `test/fixtures/defaults.json`
  - Role: Records 140 SHA-256 hashes of the original default renderer output in two themes.
  - Symbols: none
  - Detail: mapped
- `test/generator.test.cjs`
  - Role: Checks baseline rendering, all trait choices, conflicts, persistence, validation and DOM-free use.
  - Symbols: none
  - Detail: mapped

## Relationships

- `monster-avatar.js:monsterAvatar` -> `monster-avatar.js:resolveTraits`: Resolves seeded and explicit traits before drawing.
- `monster-avatar.js:monsterAvatarDataUri` -> `monster-avatar.js:monsterAvatar`: Encodes generated SVG for image sources.
- `monster-avatar.js:monsterTraits` -> `monster-avatar.js:resolveTraits`: Exposes the same resolved discrete traits without drawing.
- `monster-avatar.js:restoreAvatar` -> `monster-avatar.js:monsterAvatar`: Validates a saved versioned configuration and re-renders it.
- `test/generator.test.cjs` -> `monster-avatar.js`: Exercises the public API and immutable schema.
- `test/generator.test.cjs` -> `test/fixtures/defaults.json`: Compares generated SVG hashes with the original renderer.

## Tests

- `test/generator.test.cjs`: Covers determinism, options, every trait value, compatibility pairs, saved configuration round trips and safe output.

## Coverage

- Status: complete
- Gaps: none
- Excluded: none
