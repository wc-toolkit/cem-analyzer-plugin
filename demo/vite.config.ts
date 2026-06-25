import { defineConfig } from "vite";
import { cemAnalyzerPlugin } from "@wc-toolkit/cem-analyzer-plugin/vite";

export default defineConfig({
  plugins: [
    cemAnalyzerPlugin({
      globs: ["src/**/*.ts"],
    }),
  ],
});
