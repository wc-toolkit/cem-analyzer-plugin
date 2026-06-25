# CEM/Analyzer Plugin

Generate and keep `custom-elements.json` up to date by running the [Custom Elements Manifest (CEM) Analyzer](https://custom-elements-manifest.open-wc.org/analyzer/getting-started/) from your Vite, Rollup, Rolldown, or Webpack workflow.

## Install

```sh
npm install -D cem-analyzer-plugin @custom-elements-manifest/analyzer
```

## Quick start

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { cemAnalyzerPlugin } from "cem-analyzer-plugin";

export default defineConfig({
  plugins: [
    cemAnalyzerPlugin({
      // all options are optional
      // config: "custom-elements-manifest.config.ts",
      // runInServe: false,  // default: true
      // debounceMs: 200,    // default: 120
    }),
  ],
});
```

### Rollup

```js
// rollup.config.js
import { cemAnalyzerPlugin } from "cem-analyzer-plugin";

export default {
  input: "src/index.ts",
  plugins: [cemAnalyzerPlugin()],
};
```

### Rolldown

```js
// rolldown.config.js
import { cemAnalyzerPlugin } from "cem-analyzer-plugin";

export default {
  input: "src/index.ts",
  plugins: [cemAnalyzerPlugin()],
};
```

### Webpack

If your project (or Storybook) uses Webpack, a dedicated Webpack plugin is provided.

CommonJS example (webpack.config.js):

```js
// webpack.config.js
const { CemAnalyzerWebpackPlugin } = require("@wc-toolkit/cem-analyzer-plugin/webpack");

module.exports = {
  // ...
  plugins: [
    new CemAnalyzerWebpackPlugin({
      globs: ["src/**/*.ts"],
      // register extra paths for webpack's watcher if analyzed files are not
      // part of the module graph
      watchPaths: ["src"],
    }),
  ],
};
```

ESM example:

```js
// webpack.config.mjs
import { CemAnalyzerWebpackPlugin } from "@wc-toolkit/cem-analyzer-plugin/webpack";

export default {
  plugins: [new CemAnalyzerWebpackPlugin({ globs: ["src/**/*.ts"] })],
};
```

## What this plugin does

| Scenario | Behavior |
|---|---|
| Vite build | Runs once at build start |
| Vite dev server | Runs on startup, reruns on file changes (debounced) |
| Rollup/Rolldown build | Runs once at build start |
| Rollup/Rolldown watch | Reruns on file changes (debounced) |
| Webpack build | Runs once before compilation starts (beforeRun) |
| Webpack watch / Storybook (webpack builder) | Runs on initial watchRun and reruns when changed files match (debounced). Use `watchPaths` to register extra paths not in the module graph. |

> Note: The analyzer's own `watch` option is ignored in Vite serve mode — the plugin uses the bundler's watcher instead.

## Configuration

The plugin auto-discovers `custom-elements-manifest.config.{mjs,js,ts}` in the project root. You only need to set `config` if your file is in a non-standard location.

```ts
cemAnalyzerPlugin({
  config: "config/cem.config.ts", // relative to project root, or absolute
});
```

## Recipes

### LitElement project

```ts
cemAnalyzerPlugin({
  globs: ["src/**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.stories.ts"],
  litelement: true,
});
```

### Stencil project

```ts
cemAnalyzerPlugin({
  globs: ["src/components/**/*.tsx"],
  stencil: true,
});
```

### Write manifest to a specific directory

```ts
cemAnalyzerPlugin({
  outdir: "dist",
});
```

### Build only — skip dev server runs

```ts
cemAnalyzerPlugin({
  runInServe: false,
});
```

### Slow machines — increase debounce

```ts
cemAnalyzerPlugin({
  debounceMs: 500,
});
```

### Custom plugins or `overrideModuleCreation`

These options require a config file because they pass functions that cannot be serialized to CLI args. Place your logic in a config file and point to it:

```ts
// custom-elements-manifest.config.mjs  (auto-discovered)
export default {
  plugins: [myPlugin()],
};
```

```ts
// vite.config.ts — no extra options needed, config file is found automatically
cemAnalyzerPlugin();
```

> **Note:** Passing `plugins` or `overrideModuleCreation` directly to `cemAnalyzerPlugin()` without a config file will throw at startup.

## Notes

- The `watch` option is the CEM analyzer's own built-in file watcher. In Vite serve mode it is **ignored** — the plugin handles reruns itself via Vite's watcher. In Rollup/Rolldown watch mode, the plugin uses the `watchChange` hook instead.
- File changes to `custom-elements.json` itself never trigger a rerun.

## Options

The plugin accepts the CEM analyzer CLI options plus a few integration-specific flags. Common options:

- `config` (`string`) — Path to a CEM config file (absolute or relative to project root). If omitted the plugin auto-discovers `custom-elements-manifest.config.{mjs,js,ts}`.
- `globs` (`string[]`) — File glob patterns to analyze (e.g. `['src/**/*.ts']`).
- `exclude` (`string[]`) — Glob patterns to exclude from analysis.
- `outdir` (`string`) — Directory to write `custom-elements.json` into.
- `dev` (`boolean`) — Run analyzer in dev mode (passes `--dev`).
- `watch` (`boolean`) — Use the analyzer's built-in watcher. NOTE: ignored in Vite serve mode; the plugin uses the bundler watcher instead.
- `dependencies` (`boolean`) — Include dependencies in the generated manifest.
- `packagejson` (`boolean`) — Include package.json data in the manifest.
- Framework flags: `litelement`, `catalyst`, `fast`, `stencil` — enable framework-specific helpers in the analyzer.
- `resolutionOptions` (`object`) — Passed through to the analyzer's resolver.

Plugin-specific options:

- `runInServe` (`boolean`) — Whether to run the analyzer on Vite dev server start. Default: `true`.
- `debounceMs` (`number`) — Debounce delay for re-runs after file changes. Default: `120` ms.

Note: Passing `plugins` or `overrideModuleCreation` directly to the plugin without providing a config file will throw — put those functions inside your CEM config file instead.

## Contributing

For maintainer and contributor setup, development workflow, and release guidance, see [CONTRIBUTING.md](./CONTRIBUTING.md).
