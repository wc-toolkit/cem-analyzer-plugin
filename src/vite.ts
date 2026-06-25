import type { Plugin } from "vite";
import {
  AnalyzerRunner,
  assertConfigSatisfied,
  resolveAnalyzerConfig,
  shouldTrigger,
  type CemAnalyzerCoreOptions,
} from "./shared.js";

/** Minimal Vite config shape used by this plugin. */
interface ViteResolvedConfig {
  root: string;
  command: "build" | "serve";
}

/** Minimal Vite dev server shape used by this plugin. */
interface ViteDevServer {
  config: { logger: { warn(msg: string): void } };
  watcher: {
    on(event: "add" | "change" | "unlink", handler: (path: string) => void): void;
  };
}

export interface CemAnalyzerPluginOptions extends CemAnalyzerCoreOptions {
  /**
   * Whether to run the analyzer in Vite serve (dev) mode.
   * @default true
   */
  runInServe?: boolean;
}

/**
 * Vite/Rollup/Rolldown plugin that runs the Custom Elements Manifest (CEM)
 * analyzer as part of your build pipeline.
 *
 * - **Vite build**: runs once at build start.
 * - **Vite dev server**: runs on startup and reruns on file changes (debounced).
 * - **Rollup/Rolldown build**: runs once at build start.
 * - **Rollup/Rolldown watch**: reruns on file changes (debounced) via `watchChange`.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { cemAnalyzerPlugin } from "cem-analyzer-plugin";
 *
 * export default defineConfig({
 *   plugins: [cemAnalyzerPlugin({ globs: ["src/**\/*.ts"] })],
 * });
 * ```
 */
export function cemAnalyzerPlugin(options: CemAnalyzerPluginOptions = {}): Plugin {
  const runInServe = options.runInServe ?? true;

  let root = process.cwd();
  let isViteServe = false;
  let configInitialized = false;
  let runner: AnalyzerRunner | undefined;
  let warnedAboutWatch = false;

  const initialize = (): void => {
    if (configInitialized) return;
    configInitialized = true;

    const resolvedAnalyzerConfig = resolveAnalyzerConfig(root, options.config);
    assertConfigSatisfied(options, resolvedAnalyzerConfig);
    runner = new AnalyzerRunner(root, options, resolvedAnalyzerConfig);
  };

  return {
    name: "cem-analyzer-plugin",
    enforce: "pre",

    configResolved(config: ViteResolvedConfig) {
      root = config.root;
      isViteServe = config.command === "serve";
      initialize();
    },

    async buildStart() {
      // Rollup/Rolldown: configResolved is never called, so initialize here
      initialize();

      if (!isViteServe) {
        await runner!.run();
      }
    },

    // Rollup/Rolldown watch mode
    watchChange(id: string) {
      if (isViteServe) return;
      if (!shouldTrigger(id)) return;
      runner!.scheduleRun();
    },

    closeWatcher() {
      runner?.cancelScheduledRun();
    },

    configureServer(server: ViteDevServer) {
      if (!runInServe) {
        return;
      }

      if (options.watch && !warnedAboutWatch) {
        warnedAboutWatch = true;
        server.config.logger.warn(
          "[cem-analyzer-plugin] `watch` option is ignored in Vite serve mode; plugin handles watch reruns."
        );
      }

      void runner!.run();

      const queueRun = (filePath: string): void => {
        if (!shouldTrigger(filePath)) {
          return;
        }
        runner!.scheduleRun();
      };

      server.watcher.on("add", queueRun);
      server.watcher.on("change", queueRun);
      server.watcher.on("unlink", queueRun);
    },
  };
}

export default cemAnalyzerPlugin;