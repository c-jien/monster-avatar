# Package distribution

Format: 1

## Purpose

Builds and verifies the monster-avatar npm package, documents its API and limits publication to release artifacts.

## Files

- `.gitignore`
  - Role: Excludes local artifacts, build output, dependencies, tarballs and test reports.
  - Symbols: none
  - Detail: mapped
- `LICENSE`
  - Role: Grants reuse under the MIT license.
  - Symbols: none
  - Detail: mapped
- `README.md`
  - Role: Documents installation, customization, persistence, output formats and development checks.
  - Symbols: none
  - Detail: mapped
- `package-lock.json`
  - Role: Pins development tools and their dependencies.
  - Symbols: none
  - Detail: mapped
- `package.json`
  - Role: Defines package exports, metadata, publication files and build/test lifecycle scripts.
  - Symbols: none
  - Detail: mapped
- `scripts/build.mjs`
  - Role: Derives ESM, CommonJS, browser and declaration artifacts from maintained source.
  - Symbols: none
  - Detail: mapped
- `scripts/test-package.mjs`
  - Role: Installs an actual tarball into a temporary consumer and validates formats, types and browser rendering.
  - Symbols: none
  - Detail: mapped
- `test/types.cts`
  - Role: Checks CommonJS consumer typing and invalid boolean choices.
  - Symbols: none
  - Detail: mapped
- `test/types.mts`
  - Role: Checks ESM consumer typing, schemas and rejected option shapes.
  - Symbols: none
  - Detail: mapped

## Relationships

- `package.json` -> `scripts/build.mjs`: Build and prepack commands generate distributable output.
- `package.json` -> `scripts/test-package.mjs`: Tests installed tarballs as a release check.
- `scripts/build.mjs` -> `index.d.ts`: Copies declarations into ESM and CommonJS type entry points.
- `scripts/build.mjs` -> `monster-avatar.js`: Extracts a single renderer implementation into module formats.
- `scripts/test-package.mjs` -> `external:npm`: Packs and installs the package in a temporary consumer project.
- `scripts/test-package.mjs` -> `test/types.cts`: Checks declarations after installation for CommonJS consumers.
- `scripts/test-package.mjs` -> `test/types.mts`: Checks declarations after installation for ES module consumers.

## Tests

- `scripts/test-package.mjs`: Checks exact tarball contents, installed Node formats, TypeScript consumers and a browser visual grid.
- `test/types.cts`: Checks require-based public types.
- `test/types.mts`: Checks import-based public types and expected type errors.

## Coverage

- Status: complete
- Gaps: none
- Excluded: none
