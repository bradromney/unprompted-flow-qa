import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "vite-plugin": "src/vite-plugin.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ["react", "react-dom", "react/jsx-runtime"],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    outExtension: () => ({ js: ".mjs" }),
    platform: "node",
    target: "node20",
    sourcemap: true,
    treeshake: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
    clean: false,
  },
]);
