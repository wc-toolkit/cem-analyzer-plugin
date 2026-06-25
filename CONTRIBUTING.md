# Contributing

Thanks for contributing to `cem-analyzer-plugin`.

## Prerequisites

- Node.js 20+
- Git

## Getting started

1. Fork and clone the repository.
2. Install dependencies:

```sh
npm install
```

3. Build once to verify setup:

```sh
npm run build
```

## Development workflow

1. Create a feature branch.
2. Make your changes in `src/`.
3. Run quality checks before committing:

```sh
npm run lint
npm run typecheck
npm run format
npm run build
```

## Git hooks (Husky)

This project uses Husky with a pre-commit hook that runs:

```sh
npm run lint && npm run typecheck
```

If hooks are not installed yet, run:

```sh
npm run prepare
```

Note: Husky requires a `.git` repository. If you see `.git can't be found`, initialize or clone with Git first.

## Coding guidelines

- Keep changes focused and minimal.
- Preserve existing TypeScript style and project structure.
- Avoid introducing new tooling unless necessary.
- Update docs when behavior or public API changes.

## Pull requests

1. Ensure all checks pass locally.
2. Include a clear description of what changed and why.
3. Link related issues when relevant.
4. Keep PRs small and reviewable.
