# API reference

[← Back to the README](../README.md)

## Imports and support

```js
import {
  monsterAvatar,
  monsterAvatarDataUri,
  monsterTraits,
  restoreAvatar,
  traitSchema,
  traitCompatibility,
  normalizeName,
  hash32,
  VERSION,
} from 'monster-avatar';
```

CommonJS supports the same named functions:

```js
const { monsterAvatar } = require('monster-avatar');
```

For a plain browser script, copy `dist/monster-avatar.js` from the installed package into your public assets and load it with `<script src="/monster-avatar.js"></script>`. Its functions are available on `window.MonsterAvatar`. Tools that resolve package exports can access that bundle as `monster-avatar/browser`.

Generation requires Node 18+ or a modern browser supporting `Object.hasOwn`. No DOM is required for the library. `crypto.randomUUID()` is an optional application-side way to generate a seed, not a requirement of the renderer. The editor's clipboard and random-seed controls work best on localhost or HTTPS.

## Generation

### `monsterAvatar(seed?, options?)`

Returns:

```ts
{
  svg: string;
  traits: MonsterTraits & { key: string; hue: number; tilt: number };
  colors: { body: string; accent: string; background: string; ink: string };
  config: AvatarConfig;
}
```

`traits` and `colors` describe the resolved result. `config` records the explicit input choices for storage. Omitted traits and colors are generated from independent seeded streams.

### `monsterAvatarDataUri(seed?, options?)`

Accepts the same options and returns `data:image/svg+xml;charset=utf-8,...` with URI-encoded markup. Use it as an image source. Your site's Content Security Policy must permit `data:` images for this approach.

### `monsterTraits(seed?, options?)`

Resolves the discrete traits without drawing an SVG. Returns those traits plus `key`; it does not add the rendered `hue` or `tilt` metadata.

## Options

| Option | Default | Accepted values |
| --- | --- | --- |
| `seedMode` | `'name'` | `'name'` or `'raw'` |
| `size` | `100` | A positive finite number; sets SVG width and height |
| `theme` | `'light'` | `'light'` or `'dark'`; controls the generated background palette |
| `traits` | `{}` | Partial overrides from the table below |
| `colors` | `{}` | Partial `body`, `accent`, `background`, and `ink` overrides |
| `idPrefix` | Derived from the seed | Starts with a letter; then letters, digits, `_`, or `-` |

The viewBox is always `0 0 100 100`. A round crop is an application styling choice, not part of the returned square SVG.

Name mode converts the seed to a string, applies Unicode NFKC normalization, trims it, lowercases it, and collapses whitespace. Null, undefined, and blank names use the shared `?` key. Raw mode requires a nonempty string and preserves it exactly. The modes are not separate namespaces: an already-normalized raw seed may match the same name seed.

Use an immutable string ID when name changes should not affect an avatar. Seeds and hashes do not guarantee visual uniqueness and are not cryptographic identifiers. Saved configurations contain the original seed, so choose identifiers appropriate for your application's storage and sharing.

## Traits

| Field | Choices |
| --- | --- |
| `kind` | `blob`, `bust` |
| `eyes` | `pair`, `cyclops`, `triple`, `visor`, `stalks` |
| `eyeStyle` | `round`, `dot`, `sleepy`, `happy`, `wide`, `slit`, `angry`, `lashes` |
| `mouth` | `smile`, `grin`, `fangs`, `teeth`, `o`, `flat`, `wavy`, `cat`, `tongue`, `beak` |
| `top` | `none`, `horns`, `antennae`, `ears-round`, `ears-pointy`, `ears-floppy`, `sprout`, `tuft`, `curl`, `fin`, `stalks` |
| `hat` | `none`, `beanie`, `cap`, `crown`, `party`, `tophat`, `bow`, `flower`, `halo`, `headband`, `headphones` |
| `face` | `none`, `glasses`, `shades`, `monocle`, `mustache`, `bandaid` |
| `neck` | `none`, `scarf`, `bowtie`, `bandana`, `collar`, `beads` |
| `earring` | `false`, `true` |
| `pattern` | `none`, `spots`, `stripes`, `belly`, `patch`, `freckles`, `gradient` |
| `cheeks` | `false`, `true` |
| `backdrop` | `disc`, `none`, `rings`, `dots`, `rays` |

Omit a field to keep it automatic. `'none'` is an explicit choice for fields that support it; it is different from omitting the field. `backdrop: 'none'` removes the background pattern, not the background fill. Eye style affects drawn eyes, not the visor. Geometry remains procedural.

### Compatibility and errors

Explicit choices take priority over generated choices. The resolver changes the fewest generated traits needed, with deterministic tie-breaking. Legacy default combinations are preserved until a related trait is explicitly changed.

Stalk eyes require the stalk top feature. Hats have a list of compatible top features. Glasses require paired eyes; shades work with paired or cyclops eyes; monocles and eye patches require eyes on the face. Earrings cannot combine with floppy ears or headphones.

- Invalid values, unknown option keys, and malformed input objects throw `TypeError`.
- Mutually incompatible explicit choices throw `RangeError`.
- Unsupported saved generator versions throw `RangeError`.

A picker should catch these errors and help the user change the conflicting selection. Do not silently remove an explicit user choice.

## Colors

All four fields accept `#RGB` or `#RRGGBB` strings, case-insensitively. Arbitrary CSS colors and URLs are not accepted.

| Field | Effect |
| --- | --- |
| `body` | Main body fill; derives body shade and highlight |
| `accent` | Accent fill; derives accent shade and secondary accent |
| `background` | Base backdrop fill; derives pattern color using the theme |
| `ink` | Outline and facial ink color |

Unspecified palette colors remain generated. Changing a color does not change the procedural geometry. The returned `colors` values may be HSL strings when generated; store input overrides through `config`, rather than passing resolved palette values back as options.

## Persistence

### `restoreAvatar(config, presentation?)`

Accepts a saved `AvatarConfig` and optional `{ size, idPrefix }`. Returns an `AvatarResult` with the same fields as `monsterAvatar`.

```ts
interface AvatarConfig {
  version: 1;
  seed: string;
  seedMode: 'name' | 'raw';
  theme: 'light' | 'dark';
  traits: Partial<MonsterTraits>;
  colors: Colors;
}
```

Save the `config` returned by generation, and round-trip it through JSON. Presentation settings are supplied separately. Unknown versions are rejected rather than reinterpreted using a different generator. Retain a compatible renderer or store the SVG itself when exact preservation across future versions matters.

## Schema and utilities

- `traitSchema`: frozen entries with `label`, `type` (`'enum'` or `'boolean'`), and `values`.
- `traitCompatibility`: frozen rules with two `traits` names and an `allowed` array of corresponding value pairs.
- `normalizeName(seed)`: exposes the default name-normalization behavior.
- `hash32(string)`: a non-cryptographic 32-bit hash; does not itself describe all rendering streams.
- `VERSION`: generator/configuration version, currently `1`. Separate from the npm package version.

TypeScript exports include `MonsterTraits`, `MonsterOptions`, `AvatarResult`, `AvatarConfig`, `Colors`, `Presentation`, `Seed`, `SeedMode`, `Theme`, and `HexColor`.

## Inline SVGs and accessibility

Data URI images isolate SVG IDs by document. If you insert SVG markup directly into a page, give each instance a distinct `idPrefix`, including repeated copies of the same avatar. Default prefixes are deterministic, not unique per render. Use stable instance prefixes for server/client rendering.

The library validates prefixes and colors, and seeds are not inserted into SVG markup. Provide accessible names in your app: use `alt` on an image, or appropriate labeling on an inline SVG. Decorative avatars beside a visible username can use empty alternative text.
