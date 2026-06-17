# @dyallab/docs

Centralized documentation package for HenKaiPan ASPM. Published to GitHub Packages.

## Install

```bash
npm install @dyallab/docs --registry=https://npm.pkg.github.com
```

Requires a `.npmrc` with GitHub auth:

```
@dyallab:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Usage

```ts
import { selfHosted, app, landing } from '@dyallab/docs';

// Path to markdown file
const path = selfHosted.quickstart;

// Read raw content
import { readFileSync } from 'fs';
const content = readFileSync(path, 'utf-8');
```

### Astro (direct import)

```astro
---
import quickstart from '@dyallab/docs/self-hosted/quickstart.md';
---

<article set:html={quickstart.compiledContent()} />
```

## Structure

```
src/
├── self-hosted/
│   ├── quickstart.md
│   ├── kubernetes.md
│   ├── production.md
│   ├── backup.md
│   └── operations.md
├── app/
│   ├── user-guide/        # 10 files (01-introduction → 10-system)
│   └── architecture/
│       ├── ci-cd/         # 6 files (github-actions → quickstart)
│       ├── ci-cd-integration.md
│       ├── mcp-integration.md
│       └── queue-architecture.md
└── landing/
    └── design.md
```

## Versioning

[Semantic Versioning](https://semver.org/):
- **Major**: Breaking changes to exported paths
- **Minor**: New documentation added
- **Patch**: Fixes, clarifications

## Development

```bash
pnpm install
pnpm build          # tsc → dist/
pnpm publish        # --registry=https://npm.pkg.github.com
```
