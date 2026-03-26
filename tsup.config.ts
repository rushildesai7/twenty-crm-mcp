import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "index.ts",
    serve: "serve.ts",
  },
  format: "esm",
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  target: "node18",
  platform: "node",
  sourcemap: false,
  clean: true,
  banner: {
    // tsup bundles to ESM but some deps use require(); this shim handles it
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});
