# Browser playground

Format: 1

## Purpose

Provides a responsive avatar editor, galleries, SVG export and configuration import/export for trying the public API.

## Files

- `demo.js`
  - Role: Wires labeled controls, previews, shuffle, configuration persistence and SVG actions.
  - Symbols: `avatar`, `renderGallery`, `renderHero`, `shuffleGallery`, `syncControls`
  - Detail: mapped
- `index.html`
  - Role: Provides the editor layout, gallery and explanatory content.
  - Symbols: none
  - Detail: mapped
- `playwright.config.cjs`
  - Role: Configures Chromium browser tests and a local test server.
  - Symbols: none
  - Detail: mapped
- `scripts/serve.mjs`
  - Role: Serves the local demo on loopback port 4173.
  - Symbols: none
  - Detail: mapped
- `test/browser/editor.spec.cjs`
  - Role: Exercises editing, saved state, validation, browser modules, SVG decoding and mobile layout.
  - Symbols: none
  - Detail: mapped

## Relationships

- `demo.js` -> `monster-avatar.js:monsterAvatar`: Draws preview, size samples and galleries through the public API.
- `demo.js` -> `monster-avatar.js:restoreAvatar`: Imports a saved configuration before updating editor state.
- `demo.js` -> `monster-avatar.js:traitSchema`: Builds controls from the exported choices and labels.
- `index.html` -> `demo.js`: Loads editor event handling.
- `index.html` -> `monster-avatar.js`: Loads the browser global generator.
- `playwright.config.cjs` -> `scripts/serve.mjs`: Starts a loopback server for browser tests through npm run dev.
- `test/browser/editor.spec.cjs` -> `index.html`: Tests the editor and captures light, dark and mobile views.

## Tests

- `test/browser/editor.spec.cjs`: Covers overrides, shuffle, save/restore, error states, SVG decoding, original output in the browser and responsive layout.

## Coverage

- Status: complete
- Gaps: none
- Excluded: none
