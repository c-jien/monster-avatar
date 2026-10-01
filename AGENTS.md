# Monster Avatar: guide for coding agents

This file covers using the npm package in an application and maintaining this repository. The [README](README.md) is the human-facing starting point; [docs/API.md](docs/API.md) contains the complete API reference. Follow the user's requested scope.

## Integrating the package

1. Install `monster-avatar` with the application's existing package manager.
2. Prefer `monsterAvatarDataUri(id, { seedMode: 'raw' })` for ordinary image sources. Raw seeds must be nonempty strings; use a stable user ID, converting numbers explicitly.
3. Keep uploaded photos as the primary image. Use the generated avatar when a photo is absent. Add meaningful alternative text, or empty alt text when the nearby username already provides the label.
4. Create random seeds once, outside render functions. Persist them and share the same seed between server and client. Do not use render-time randomness or counters to establish avatar identity.
5. Read `traitSchema` for supported choices. Pass selections through `traits` and `colors`; omit fields to return them to automatic. Treat `false` and `'none'` as explicit selections.
6. Save `result.config`, not `result.traits` or the resolved color strings. Recreate it with `restoreAvatar(config, { size, idPrefix })`.
7. Catch validation and compatibility errors at user-editing boundaries. Show actionable feedback instead of discarding an explicit choice.

```js
import { monsterAvatarDataUri, monsterAvatar, restoreAvatar } from 'monster-avatar';

const src = user.photoUrl || monsterAvatarDataUri(String(user.id), {
  seedMode: 'raw',
});

const result = monsterAvatar(String(user.id), {
  seedMode: 'raw',
  traits: { hat: 'crown', eyes: 'cyclops' },
  colors: { body: '#b7a5e6' },
});
const stored = JSON.stringify(result.config);
const restored = restoreAvatar(JSON.parse(stored), { size: 64 });
```

Do not invent API names, trait values, React components, PNG exports, transparent-background options, or a hosted rendering endpoint. The package renders SVG and has no runtime dependencies. `backdrop: 'none'` removes a pattern, not the background fill. TypeScript declarations are included.

## Contracts to preserve

- Default seed mode is name normalization: NFKC, trim, lowercase, and collapsed whitespace. Raw mode preserves a nonempty string exactly. Name and raw modes are not separate namespaces.
- The same seed, generator version and options produce repeatable output. Different seeds are not guaranteed to look unique. Hashes are not cryptographic identities.
- Explicit traits win over automatic choices. Incompatible explicit choices throw `RangeError`; malformed input and unknown fields throw `TypeError`.
- Color inputs are `#RGB` or `#RRGGBB` only. Resolved colors can be HSL; they are not a valid replacement for stored color overrides.
- Inline SVG instances need distinct `idPrefix` values. Prefixes start with a letter and contain only letters, digits, underscores, or hyphens. Use stable values for server/client rendering. Data URI images avoid document-wide ID collisions.
- Configurations contain generator `version: 1`, `seed`, `seedMode`, `theme`, `traits`, and `colors`. `size` and `idPrefix` are separate presentation settings. Reject unsupported versions rather than guessing a migration.
- The npm version and generator version serve different purposes. Do not change either simply to regenerate documentation.

## Working on this repository

- Never add eyebrow text to UI unless explicitly requested.
- Inspect `FEATURE_MAP.md` and relevant `feature-map/*.md` before codebase work, and verify affected facts against source. Apply the global feature-map skill when available. Reconcile affected maps during writable work; planning and reviews consult only.
- `monster-avatar.js` is the single maintained renderer. `scripts/build.mjs` derives ESM, CommonJS, browser bundles and declarations under ignored `dist/`.
- `index.d.ts` describes the public API. Keep it aligned when behavior or exported types change.
- `index.html` and `demo.js` form the framework-free browser editor. Run `npm run dev` to serve it on loopback port 4173.
- `docs/images/` contains committed showcase assets generated from the real renderer by `npm run docs:images`. Edit `scripts/generate-showcase.mjs` to change compositions. Never replace these with illustrations that misrepresent package output.
- Keep README instructions concise and task-oriented. Put exhaustive contracts in `docs/API.md` and agent-specific guidance here.
- Preserve seeded default appearances and independent trait streams. Do not replace fixture hashes merely to make a rendering regression pass. Changes to existing output need an explicit compatibility decision.
- No runtime dependencies are required. Keep tooling in development dependencies. Commit `package-lock.json`; do not commit credentials, local `.npmrc`, dependencies, build output, tarballs, or test reports.
- Check the npm `files` allowlist when adding published documentation. Update the expected file inventory in `scripts/test-package.mjs` when that allowlist changes. Keep secrets and development-only files out of the tarball.
- Never assume a GitHub owner or remote URL. Read `git remote -v`. Do not create remotes, publish npm versions, or push commits unless the user requests that work.

## Verification

Run checks appropriate to the changed behavior:

```sh
npm ci
npm test
npm run test:types
npx playwright install chromium
npm run test:browser
npm run test:package
```

Installed Chrome can be used with `PLAYWRIGHT_CHANNEL=chrome` for the browser and package commands. Browser tests start a server on port 4173; stop the development server first. Package tests use a separate temporary consumer and an ephemeral port.

For docs or asset changes, regenerate affected showcase images, verify local Markdown links and image rendering, and inspect package contents if published files changed. Avoid rerunning unrelated renderer tests for prose-only edits. Run the installed feature-map skill's `scripts/validate_feature_map.py` against the project root after updating maps; also check their source accuracy.

Before a requested release, run the full release checks, inspect `npm pack --dry-run`, confirm the target npm identity, and publish only a new package version. A previous published version is immutable. Browser authorization or 2FA must be completed by the account owner. Never put credentials, tokens, recovery codes, or authentication challenges in committed files.
