# @wc-toolkit/cem-analyzer-plugin

## 1.0.2

### Patch Changes

- e0c430f: Improve reliability and environment portability of analyzer execution.

  - Run the local `cem` binary directly instead of hardcoding `pnpm exec`.
  - Add clearer runtime errors when analyzer execution fails, including actionable hints for missing local analyzer installs, PATH issues, and Yarn PnP setups.
  - Surface async/dev/watch errors more consistently in Vite and scheduled reruns.
  - Normalize webpack `watchPaths` to absolute paths and warn when configured paths do not exist.
  - Update stale JSDoc import examples to scoped package import paths.

## 1.0.1

### Patch Changes

- 7539e99: Fixed package name in documentation

## 1.0.0

### Major Changes

- 67ee6af: Create package
