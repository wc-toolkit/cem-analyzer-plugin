import { existsSync } from "node:fs";
import { extname, isAbsolute, resolve } from "node:path";
import { execa } from "execa";

const DEFAULT_CONFIG_NAMES = [
  "custom-elements-manifest.config.mjs",
  "custom-elements-manifest.config.js",
  "custom-elements-manifest.config.ts",
] as const;

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".mts",
  ".cts",
  ".jsx",
  ".tsx",
]);

/** Callback signature for `overrideModuleCreation`, matching the CEM analyzer API. */
type OverrideModuleCreation = (args: { ts: unknown; globs: string[] }) => unknown[];

/** Factory function that returns a CEM analyzer plugin instance. */
type AnalyzerPluginFactory = () => unknown;

export interface AnalyzerRunnerHooks {
  onError?: (error: Error) => void;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function formatCemCommand(args: string[]): string {
  return `cem ${args.join(" ")}`;
}

function createAnalyzerRunError(root: string, args: string[], error: unknown): Error {
  const normalizedError = toError(error);
  const code = (normalizedError as { code?: string }).code;
  const base =
    `[cem-analyzer-plugin] Failed to run "${formatCemCommand(args)}". ` +
    `Working directory: ${root}`;

  if (code === "ENOENT") {
    const hints = [
      "Install @custom-elements-manifest/analyzer in this workspace so the local `cem` binary is available.",
      "If your process runs with a minimal PATH (some GUI tools/CI setups), ensure local package binaries are discoverable.",
    ];

    if (process.versions.pnp) {
      hints.push(
        "Yarn Plug'n'Play was detected. Ensure @custom-elements-manifest/analyzer is declared in the workspace where this plugin runs."
      );
    }

    return new Error(`${base}\n${hints.map((hint) => `- ${hint}`).join("\n")}`, {
      cause: normalizedError,
    });
  }

  return new Error(`${base}\n${normalizedError.message}`, {
    cause: normalizedError,
  });
}

/**
 * Options shared across all bundler integrations (Vite, Rollup, Rolldown, webpack).
 *
 * CEM analyzer CLI options (`globs`, `exclude`, `outdir`, etc.) are passed
 * through directly to the analyzer. Plugin-specific options (`debounceMs`,
 * etc.) control how the bundler integration behaves, and are extended per
 * bundler where needed (e.g. Vite's `runInServe`).
 */
export interface CemAnalyzerCoreOptions {
  /** Path to a CEM analyzer config file. Absolute or relative to project root. */
  config?: string;

  /** Glob patterns for source files to analyze. */
  globs?: string[];
  /** Glob patterns to exclude from analysis. */
  exclude?: string[];
  /** Directory to write `custom-elements.json` into. */
  outdir?: string;
  /** Run the analyzer in dev mode. */
  dev?: boolean;
  /** Enable CEM analyzer's built-in file watcher (ignored — integration handles watch reruns). */
  watch?: boolean;
  /** Include dependencies in the manifest. */
  dependencies?: boolean;
  /** Include `package.json` data in the manifest. */
  packagejson?: boolean;
  /** Enable the LitElement plugin. */
  litelement?: boolean;
  /** Enable the Catalyst plugin. */
  catalyst?: boolean;
  /** Enable the Fast plugin. */
  fast?: boolean;
  /** Enable the Stencil plugin. */
  stencil?: boolean;
  /** Resolution options passed to the analyzer. */
  resolutionOptions?: Record<string, unknown>;
  /**
   * CEM analyzer plugins to load. Requires a config file — provide `config`
   * or add `custom-elements-manifest.config.{mjs,js,ts}` to the project root.
   */
  plugins?: AnalyzerPluginFactory[];
  /**
   * Override how the analyzer creates modules. Requires a config file — provide
   * `config` or add `custom-elements-manifest.config.{mjs,js,ts}` to the project root.
   */
  overrideModuleCreation?: OverrideModuleCreation;

  /**
   * Debounce delay in milliseconds between file changes and re-runs.
   * @default 120
   */
  debounceMs?: number;
}

/**
 * Resolves the absolute path to the CEM analyzer config file.
 *
 * If `explicitConfig` is provided, it is resolved relative to `root` (or used
 * as-is if absolute) and validated to exist. Otherwise, the default config
 * file names are checked in order and the first match is returned.
 *
 * @returns The absolute config path, or `undefined` if none is found.
 * @throws If an explicit config path is given but the file does not exist.
 */
export function resolveAnalyzerConfig(root: string, explicitConfig?: string): string | undefined {
  if (explicitConfig) {
    const resolvedConfig = isAbsolute(explicitConfig)
      ? explicitConfig
      : resolve(root, explicitConfig);

    if (!existsSync(resolvedConfig)) {
      throw new Error(`[cem-analyzer-plugin] Config file not found: ${resolvedConfig}`);
    }

    return resolvedConfig;
  }

  for (const fileName of DEFAULT_CONFIG_NAMES) {
    const absolutePath = resolve(root, fileName);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return undefined;
}

/**
 * Returns `true` if any options require a CEM analyzer config file to be
 * present (`plugins` or `overrideModuleCreation`).
 */
export function hasConfigOnlyOptions(options: CemAnalyzerCoreOptions): boolean {
  return Boolean(options.plugins?.length || options.overrideModuleCreation);
}

/**
 * Throws if the given options require a config file but none was resolved.
 * Call this after `resolveAnalyzerConfig`, in each bundler's init hook.
 */
export function assertConfigSatisfied(
  options: CemAnalyzerCoreOptions,
  resolvedAnalyzerConfig: string | undefined
): void {
  if (!resolvedAnalyzerConfig && hasConfigOnlyOptions(options)) {
    throw new Error(
      "[cem-analyzer-plugin] `plugins` and `overrideModuleCreation` require a config file. " +
        "Provide `config`, or add custom-elements-manifest.config.{mjs,js,ts} to project root."
    );
  }
}

/**
 * Converts {@link CemAnalyzerCoreOptions} into CLI arguments for
 * `cem analyze`.
 */
export function toCliArgs(options: CemAnalyzerCoreOptions): string[] {
  const args: string[] = [];

  if (options.globs?.length) {
    args.push("--globs", ...options.globs);
  }

  if (options.exclude?.length) {
    args.push("--exclude", ...options.exclude);
  }

  if (options.outdir) {
    args.push("--outdir", options.outdir);
  }

  if (options.dev) {
    args.push("--dev");
  }

  if (options.dependencies) {
    args.push("--dependencies");
  }

  if (options.packagejson) {
    args.push("--packagejson");
  }

  if (options.litelement) {
    args.push("--litelement");
  }

  if (options.catalyst) {
    args.push("--catalyst");
  }

  if (options.fast) {
    args.push("--fast");
  }

  if (options.stencil) {
    args.push("--stencil");
  }

  if (options.resolutionOptions) {
    args.push("--resolutionOptions", JSON.stringify(options.resolutionOptions));
  }

  return args;
}

/**
 * Returns `true` if a changed/added/removed file path should trigger a
 * re-run of the analyzer.
 *
 * Excludes the analyzer's own output file (to avoid self-triggering loops)
 * and matches the CEM analyzer config file plus any recognized source
 * extension.
 */
export function shouldTrigger(filePath: string): boolean {
  if (filePath.endsWith("custom-elements.json")) {
    return false;
  }

  if (filePath.includes("custom-elements-manifest.config.")) {
    return true;
  }

  return SOURCE_EXTENSIONS.has(extname(filePath));
}

/** A debounced, re-entrancy-safe runner for the `cem analyze` CLI command. */
export class AnalyzerRunner {
  #root: string;
  #options: CemAnalyzerCoreOptions;
  #resolvedAnalyzerConfig: string | undefined;
  #debounceMs: number;
  #onError: (error: Error) => void;

  #runInFlight = false;
  #queuedRun = false;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    root: string,
    options: CemAnalyzerCoreOptions,
    resolvedAnalyzerConfig: string | undefined,
    hooks: AnalyzerRunnerHooks = {}
  ) {
    this.#root = root;
    this.#options = options;
    this.#resolvedAnalyzerConfig = resolvedAnalyzerConfig;
    this.#debounceMs = options.debounceMs ?? 120;
    this.#onError = hooks.onError ?? ((error) => console.error(error.message));
  }

  /** Runs the analyzer immediately, coalescing overlapping calls. */
  async run(): Promise<void> {
    if (this.#runInFlight) {
      this.#queuedRun = true;
      return;
    }

    this.#runInFlight = true;
    try {
      do {
        this.#queuedRun = false;

        const args = ["analyze"];
        if (this.#resolvedAnalyzerConfig) {
          args.push("--config", this.#resolvedAnalyzerConfig);
        }
        args.push(...toCliArgs(this.#options));

        try {
          await execa("cem", args, {
            cwd: this.#root,
            preferLocal: true,
            stdio: "inherit",
          });
        } catch (error: unknown) {
          throw createAnalyzerRunError(this.#root, args, error);
        }
      } while (this.#queuedRun);
    } finally {
      this.#runInFlight = false;
    }
  }

  /** Schedules a debounced run; safe to call repeatedly in quick succession. */
  scheduleRun(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
    }
    this.#timer = setTimeout(() => {
      void this.run().catch((error: unknown) => {
        this.#onError(toError(error));
      });
    }, this.#debounceMs);
  }

  /** Clears any pending debounced run without executing it. */
  cancelScheduledRun(): void {
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
  }
}