import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import {
  AnalyzerRunner,
  assertConfigSatisfied,
  resolveAnalyzerConfig,
  shouldTrigger,
  type CemAnalyzerCoreOptions,
} from "./shared.js";

/**
 * Minimal webpack `Compiler` shape used by this plugin. Avoids a hard
 * dependency on the `webpack` package's types so consumers can bring their
 * own webpack version (4/5).
 */
interface WebpackCompiler {
  options: { context?: string };
  hooks: {
    beforeRun: {
      tapPromise(name: string, fn: (compiler: WebpackCompiler) => Promise<void>): void;
    };
    watchRun: {
      tapPromise(name: string, fn: (compiler: WebpackCompiler) => Promise<void>): void;
    };
    afterCompile: {
      tap(name: string, fn: (compilation: WebpackCompilation) => void): void;
    };
    watchClose: { tap(name: string, fn: () => void): void };
    shutdown: { tapPromise(name: string, fn: () => Promise<void>): void };
  };
  modifiedFiles?: ReadonlySet<string>;
  removedFiles?: ReadonlySet<string>;
}

interface WebpackCompilation {
  fileDependencies: { add(path: string): void };
}

export interface CemAnalyzerWebpackPluginOptions extends CemAnalyzerCoreOptions {
  /**
   * Additional file/directory paths to register as webpack file dependencies,
   * so that webpack's watcher picks up changes to them even if they aren't
   * otherwise part of the compiled module graph (e.g. source files analyzed
   * by CEM but not imported into any webpack entry point).
   *
   * Without this, `watchRun`'s `modifiedFiles`/`removedFiles` will only ever
   * contain paths webpack already watches for its own bundling purposes.
   */
  watchPaths?: string[];
}

/**
 * Webpack plugin that runs the Custom Elements Manifest (CEM) analyzer as
 * part of your build pipeline.
 *
 * - **One-off build** (`webpack` / `compiler.run()`): runs once before the
 *   compilation starts, via `beforeRun`.
 * - **Watch mode** (`webpack --watch` / `compiler.watch()`): runs once on the
 *   first `watchRun`, then reruns (debounced) whenever a modified or removed
 *   file matches {@link shouldTrigger}.
 *
 * Because webpack only reports changes to files it already watches as part
 * of the module graph, pass `watchPaths` if your analyzed source files
 * aren't otherwise imported by the webpack build — e.g. a CEM-only `src/`
 * directory.
 *
 * @example
 * ```js
 * // webpack.config.js
 * const { CemAnalyzerWebpackPlugin } = require("@wc-toolkit/cem-analyzer-plugin/webpack");
 *
 * module.exports = {
 *   plugins: [
 *     new CemAnalyzerWebpackPlugin({
 *       globs: ["src/**\/*.ts"],
 *       watchPaths: ["src"],
 *     }),
 *   ],
 * };
 * ```
 */
export class CemAnalyzerWebpackPlugin {
  static #pluginName = "CemAnalyzerWebpackPlugin";

  #options: CemAnalyzerWebpackPluginOptions;
  #runner: AnalyzerRunner | undefined;
  #hasRunInitially = false;

  constructor(options: CemAnalyzerWebpackPluginOptions = {}) {
    this.#options = options;
  }

  apply(compiler: WebpackCompiler): void {
    const root = compiler.options.context ?? process.cwd();

    const resolvedAnalyzerConfig = resolveAnalyzerConfig(root, this.#options.config);
    assertConfigSatisfied(this.#options, resolvedAnalyzerConfig);
    this.#runner = new AnalyzerRunner(root, this.#options, resolvedAnalyzerConfig, {
      onError: (error) => {
        console.error(error.message);
      },
    });

    const { watchPaths = [] } = this.#options;
    const normalizedWatchPaths = watchPaths.map((path) =>
      isAbsolute(path) ? path : resolve(root, path)
    );
    const missingWatchPaths = normalizedWatchPaths.filter((path) => !existsSync(path));

    if (missingWatchPaths.length) {
      console.warn(
        `[cem-analyzer-plugin] Some watchPaths do not exist and may never trigger re-runs: ${missingWatchPaths.join(", ")}`
      );
    }

    // One-off build: `webpack` / `compiler.run()`
    compiler.hooks.beforeRun.tapPromise(CemAnalyzerWebpackPlugin.#pluginName, async () => {
      this.#hasRunInitially = true;
      await this.#runner!.run();
    });

    // Watch mode: fires before the initial compile and before every recompile
    compiler.hooks.watchRun.tapPromise(
      CemAnalyzerWebpackPlugin.#pluginName,
      async (comp) => {
        if (!this.#hasRunInitially) {
          this.#hasRunInitially = true;
          await this.#runner!.run();
          return;
        }

        const changed = [
          ...(comp.modifiedFiles ?? []),
          ...(comp.removedFiles ?? []),
        ];

        if (changed.some(shouldTrigger)) {
          this.#runner!.scheduleRun();
        }
      }
    );

    // Register extra paths so webpack's watcher reports changes to files
    // that aren't otherwise part of the compiled module graph.
    if (watchPaths.length) {
      compiler.hooks.afterCompile.tap(
        CemAnalyzerWebpackPlugin.#pluginName,
        (compilation) => {
          for (const path of normalizedWatchPaths) {
            compilation.fileDependencies.add(path);
          }
        }
      );
    }

    compiler.hooks.watchClose.tap(CemAnalyzerWebpackPlugin.#pluginName, () => {
      this.#runner?.cancelScheduledRun();
    });

    compiler.hooks.shutdown.tapPromise(CemAnalyzerWebpackPlugin.#pluginName, async () => {
      this.#runner?.cancelScheduledRun();
    });
  }
}

export default CemAnalyzerWebpackPlugin;