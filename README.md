# Monster Avatar

Deterministic, customizable SVG monsters for profile placeholders, team lists, and playful interfaces. Zero runtime dependencies. Works in browsers and Node, with JavaScript and TypeScript.

```sh
npm install monster-avatar
```

```js
import { monsterAvatarDataUri } from 'monster-avatar';

image.src = monsterAvatarDataUri('user_2841', { seedMode: 'raw' });
image.alt = 'User avatar';
```

Use an immutable user ID for stable placeholders. A username also works, but changing the username changes its avatar. Display an uploaded image when available; otherwise use the generated data URI. In React, pass it to a normal `<img src={...} alt="..." />`; no framework component is required.

## Customize

```js
import { monsterAvatar, traitSchema } from 'monster-avatar';

const avatar = monsterAvatar('user_2841', {
  seedMode: 'raw',
  size: 128,
  theme: 'light',
  traits: {
    kind: 'bust',
    eyes: 'cyclops',
    mouth: 'fangs',
    hat: 'crown',
    cheeks: true,
  },
  colors: {
    body: '#8acb88',
    accent: '#ed87ad',
    background: '#f4e5d4',
    ink: '#242332',
  },
});

console.log(avatar.svg, avatar.traits, avatar.config);
console.log(traitSchema.hat.values); // all supported hat choices
```

Omit a trait or color for automatic generation. Explicit choices stay fixed when you change the seed. Body, accent, and background overrides derive matching shading; outline color is used directly. Colors accept `#RGB` or `#RRGGBB`, not arbitrary CSS or external URLs. `backdrop: 'none'` removes the backdrop pattern, but retains the background fill.

Available trait fields: `kind`, `eyes`, `eyeStyle`, `mouth`, `top`, `hat`, `face`, `neck`, `earring`, `pattern`, `cheeks`, and `backdrop`. `traitSchema` exposes frozen labels, types, and allowed values. `traitCompatibility` exposes allowed pairs for related traits.

An explicit choice takes priority over generated traits. For example, selecting glasses can change an automatically generated eye layout to a pair. The resolver changes the fewest generated traits needed, with deterministic tie-breaking. Incompatible explicit choices (such as stalk eyes and a crown) throw `RangeError`; reset one of them to automatic. Invalid types, unknown fields, and unsupported values throw `TypeError`. Some details depend on the selected feature: eye style applies to drawn eyes, not the visor.

Name mode is the default: Unicode NFKC normalization, trimming, lowercase conversion, and collapsed whitespace. Empty names use a shared fallback. Raw mode preserves the exact nonempty string, including case and whitespace. These modes are not separate namespaces: an already normalized raw seed can match a name seed.

## Save and restore

```js
import { monsterAvatar, restoreAvatar } from 'monster-avatar';

const avatar = monsterAvatar('saved-user', { traits: { hat: 'beanie' } });
const saved = JSON.stringify(avatar.config);
const restored = restoreAvatar(JSON.parse(saved), { size: 64 });
```

Configurations record `version`, `seed`, `seedMode`, `theme`, and explicit `traits` and `colors`. Save `config`, not the resolved display traits. Size and SVG ID prefixes are presentation options, provided separately on restoration. Unknown generator versions are rejected instead of silently rendering a different avatar.

Version 1 keeps the original demo's default appearances. Future changes that alter seeded output require a new generator version; applications must retain a compatible renderer or save the SVG for exact long-term preservation. Distinct seeds are not guaranteed to produce unique-looking images. Seeds and hashes are not credentials or cryptographic identifiers. Seeds are included in saved configurations, so use identifiers suitable for your application's storage and sharing context.

To generate a random avatar, create a seed once and store it:

```js
const seed = crypto.randomUUID();
const avatar = monsterAvatar(seed, { seedMode: 'raw' });
```

Create the seed outside repeated renders, and share it between server rendering and the client. Shuffling means generating a new seed while keeping desired overrides.

## Output and imports

- `monsterAvatar(seed?, options?)` returns `{ svg, traits, colors, config }`.
- `monsterAvatarDataUri(seed?, options?)` returns an encoded SVG data URI.
- `monsterTraits(seed?, options?)` returns resolved discrete traits and the seed key.
- `restoreAvatar(config, { size?, idPrefix? }?)` returns the same result as `monsterAvatar`.
- `traitSchema`, `traitCompatibility`, `normalizeName`, `hash32`, and `VERSION` are also exported.

`size` must be a positive finite number and defaults to 100. The SVG has a `0 0 100 100` viewBox. Crop an image with `border-radius: 50%` for the round appearance in the demo. Geometry remains procedural rather than exposing individual coordinates.

Use data URIs with `<img>` for convenient document isolation. For inline SVGs, provide a distinct `idPrefix` per instance (including repeated avatars) so clip paths and gradients do not share IDs. Prefixes must begin with a letter and contain only letters, digits, underscores, or hyphens. Default prefixes are deterministic, not unique per render. SVG output does not include an accessible name; label the surrounding image or inline SVG in your app. Data URI images require `data:` to be permitted by your site's image CSP.

CommonJS:

```js
const { monsterAvatar } = require('monster-avatar');
```

Plain browser scripts can load the built `dist/monster-avatar.js` file, which provides `window.MonsterAvatar`. The package also exports that bundle as `monster-avatar/browser` for tooling that resolves package paths. ES module imports use a side-effect-free build. Library code requires Node 18+ or a modern browser supporting `Object.hasOwn`; no DOM is needed for generation.

## Develop and verify

```sh
npm ci
npm run dev          # http://127.0.0.1:4173
npm test
npm run test:types
npx playwright install chromium
npm run test:browser
npm pack
npm run test:package
```

Alternatively, use installed Chrome with `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`. The demo also works by opening `index.html` directly; clipboard and random-seed generation depend on browser secure-context support, so localhost is recommended.

`monster-avatar.js` is the single maintained renderer. The build generates ESM, CommonJS, browser output, and declaration copies. Tests preserve 140 baseline SVG hashes, exercise all choices and compatibility pairs, verify serialized configurations and validation, and render the browser editor. `test:package` builds and installs an actual tarball into a temporary project, checks Node and browser consumption plus TypeScript declarations, and removes the temporary project afterward. Browser tests save visual samples in ignored `test-results/`.

Before publishing, run all checks and the feature-map validator, review `npm pack --dry-run`, confirm the package name and npm account, then publish. Browser tests use Chromium by default; installed Chrome can be selected using the environment variable above. Only library builds, declarations, this README, the license, and package metadata are included.

## License

MIT © 2026 c-jien.
