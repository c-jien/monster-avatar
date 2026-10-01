# Monster Avatar

A JavaScript library for generating configurable SVG monster avatars from a name or ID. Supports profile-image placeholders, user-selected traits and colors, and saved avatar configurations.

![Fourteen monster avatars showing different colors, shapes, eyes, hats, and accessories.](docs/images/showcase.svg)

[npm package](https://www.npmjs.com/package/monster-avatar) · [MIT license](LICENSE) · JavaScript + TypeScript · Zero runtime dependencies

[Quick start](#quick-start) · [Customization](#customization) · [Save and restore](#save-and-restore) · [API reference](docs/API.md) · [For your agent](#for-your-agent)

## Key features

- **Deterministic generation:** the same seed, generator version, and options produce the same avatar.
- **Configurable appearance:** override body shape, facial features, accessories, patterns, and colors. Unspecified values are generated from the seed.
- **SVG output:** generate SVG markup or data URIs for image elements, inline rendering, and file export.
- **Saved configurations:** serialize avatar settings as JSON and restore them with a compatible generator version.
- **Browser and Node support:** includes ESM, CommonJS, a browser script, and TypeScript declarations, with no runtime dependencies.

## Quick start

```sh
npm install monster-avatar
```

```js
import { monsterAvatarDataUri } from 'monster-avatar';

const image = document.createElement('img');
image.src = monsterAvatarDataUri('user_2841', { seedMode: 'raw' });
image.alt = 'Your avatar';
image.width = 64;
image.height = 64;
image.style.borderRadius = '50%';
document.body.append(image);
```

`monsterAvatarDataUri` returns an SVG data URI suitable for the `src` attribute of an image element. Avatars are generated locally in the browser or in Node.js.

### Profile-image fallback

Use a generated avatar when the user has no uploaded profile image:

```js
const avatarUrl = user.photoUrl || monsterAvatarDataUri(user.id, {
  seedMode: 'raw',
});
```

Use an immutable user ID to preserve the avatar when a username changes. Raw mode requires a string; convert numeric IDs with `String(user.id)`.

### Seed selection

| Input | Seed mode | Behavior |
| --- | --- | --- |
| Display name | Default, or `seedMode: 'name'` | `"  Alice  "` and `"alice"` produce the same avatar. |
| User ID or hash string | `seedMode: 'raw'` | Case and whitespace are preserved exactly. The string must be nonempty. |

Generation is deterministic, but different seeds are not guaranteed to produce visually distinct avatars.

## Customization

Pass trait and color overrides in the options object. Unspecified values remain determined by the seed.

![The same avatar seed with automatic traits, a crown, a single eye, and custom colors.](docs/images/customization.svg)

```js
import { monsterAvatar } from 'monster-avatar';

const avatar = monsterAvatar('Ian Cheng', {
  traits: {
    hat: 'crown',
    eyes: 'cyclops',
  },
  colors: {
    body: '#bbaceb',
    background: '#272b46',
    accent: '#f1be72',
  },
});

console.log(avatar.svg);    // Generated SVG markup
console.log(avatar.config); // Serializable avatar configuration
```

Trait options include body shape, eye layout and style, mouth, top features, hats, face and neck accessories, earrings, patterns, cheeks, and backdrop. Color options include body, accent, background, and outline (`ink`). Related shades are derived automatically.

Omit a field to use its generated value. Colors accept `#RGB` or `#RRGGBB`. See the [trait reference](docs/API.md#traits) for supported values.

### Avatar picker controls

Use `traitSchema` to populate controls with supported trait values:

```js
import { traitSchema, monsterAvatar } from 'monster-avatar';

const hats = traitSchema.hat.values;
const avatar = monsterAvatar('user_2841', {
  seedMode: 'raw',
  traits: { hat: hats[1] },
});
```

Explicit trait selections take priority over generated values. For example, selecting glasses can change a generated eye layout to a pair. Incompatible explicit selections, such as a crown and stalk eyes, throw `RangeError`. Handle the error in the editor and prompt the user to change or clear a conflicting selection. `traitCompatibility` provides the supported combinations.

### Random generation

```js
const seed = crypto.randomUUID();
const avatar = monsterAvatar(seed, {
  seedMode: 'raw',
  traits: { hat: 'beanie' },
});
```

Generate and persist the seed when creating an avatar. To randomize an existing avatar, replace its seed while retaining any selected trait and color overrides. Reuse the saved seed on subsequent renders, including across server and client rendering.

## Save and restore

Store `avatar.config` as JSON alongside the user's profile:

```js
import { monsterAvatar, restoreAvatar } from 'monster-avatar';

const avatar = monsterAvatar('user_2841', {
  seedMode: 'raw',
  traits: { hat: 'beanie' },
});

const saved = JSON.stringify(avatar.config);

// Restore the saved configuration:
const restored = restoreAvatar(JSON.parse(saved), { size: 128 });
console.log(restored.svg);
```

The configuration contains the seed, generator version, theme, and explicit trait and color overrides. Persist `config`; the resolved `traits` object is intended for inspection. Supply size and inline SVG ID prefixes separately when restoring.

Restoration requires a supported generator version. Retain a compatible renderer to reproduce saved configurations, or store the generated SVG to preserve the image independently of future library versions.

## Output formats

| Output | API |
| --- | --- |
| Image source | `monsterAvatarDataUri(seed, options)` |
| SVG markup | `monsterAvatar(seed, options).svg` |
| Resolved trait values | `monsterTraits(seed, options)` |
| Restored avatar | `restoreAvatar(config, presentation)` |
| Editor choices and compatibility rules | `traitSchema` and `traitCompatibility` |

SVGs have a `0 0 100 100` viewBox and default width and height of 100. Set `size` to change the output dimensions, or use CSS to size the image element. Apply `border-radius: 50%` for the circular crop shown in the examples.

Data URI images isolate SVG IDs within each image document. For inline SVGs, supply a distinct `idPrefix` for each instance to avoid ID collisions. Provide alternative text or accessible labels in the consuming application.

The [API reference](docs/API.md) covers all options, validation, inline IDs, browser support, and import formats.

## Local editor

From a checkout of this repository:

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173** to configure avatars, preview them at different sizes, browse generated samples, and export SVGs or configurations.

## For your agent

[AGENTS.md](AGENTS.md) provides package integration instructions, API contracts, and repository maintenance guidance for coding agents.

Example task:

> Read AGENTS.md, then use monster-avatar for profile-image fallbacks. Keep uploaded photos, seed generated avatars from a stable user ID, and preserve the same seed between server and client.

Reference the local file when working from a checkout, or link to the guide in a task description.

## Contributing

The renderer source is `monster-avatar.js`. Files in `dist/` are generated by `npm run build`; make changes in the source files and rebuild.

```sh
npm test                  # Generator, customization, and saved configurations
npm run test:types        # ESM and CommonJS TypeScript consumers
npx playwright install chromium
npm run test:browser      # Editor, SVG decoding, and responsive layout
npm run test:package      # Install and verify an actual npm tarball
npm run docs:images       # Regenerate the README showcase from the real API
```

If Chrome is already installed, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` and `PLAYWRIGHT_CHANNEL=chrome npm run test:package` can use it instead of downloading Chromium. Stop `npm run dev` before running browser tests, which start their own server on port 4173.

The regression suite checks 140 baseline SVG outputs to detect changes to default appearances. See [AGENTS.md](AGENTS.md#working-on-this-repository) for source layout and contributor checks.

## License

[MIT](LICENSE) © 2026 c-jien.
