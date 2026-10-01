# Feature Map

Format: 1

## Overview

Monster Avatar is a dependency-free seeded SVG avatar library with configurable traits and colors, a browser playground and npm distribution builds.

## Entry Points

- `command:npm run build`: Builds the package module formats and declarations.
- `command:npm run dev`: Serves the browser playground locally.
- `command:npm run docs:images`: Regenerates the README showcase images from the renderer.
- `command:npm run test:package`: Tests an installed package tarball.
- `command:npm test`: Runs generator regression and public API tests.
- `index.html`: Opens the browser playground.
- `monster-avatar.js:monsterAvatar`: Generates SVG with resolved traits, colors and a saved configuration.

## Features

- [Avatar generation](feature-map/generator.md): Resolves seeded traits and renders customizable SVG avatars.
- [Package distribution](feature-map/packaging.md): Builds, documents and verifies npm artifacts and consumer interfaces.
- [Browser playground](feature-map/playground.md): Demonstrates customization, persistence, image export and responsive previews.

## Cross-Feature Relationships

- `packaging` -> `generator`: Builds the renderer and declaration source into distributable formats.
- `packaging` -> `playground`: Runs browser checks as part of release verification.
- `playground` -> `generator`: Uses public generation, schema and restoration APIs.

## Coverage

- Status: complete
- Gaps: none
- Excluded: `.DS_Store`, `.Rhistory`, `.git/`, `dist/`, `monster-avatar-0.1.0.tgz`, `node_modules/`, `playwright-report/`, `test-results/`
