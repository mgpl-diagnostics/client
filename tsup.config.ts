import { defineConfig } from "tsup";

export default defineConfig([
  // plain SDK — usable from server components, workers, Node scripts, any framework
  { entry: { index: "src/index.ts" }, format: ["esm"], dts: true, target: "es2020", platform: "browser", clean: true },
  // React hooks — marked as a client module for Next.js
  {
    entry: { react: "src/react.tsx" },
    format: ["esm"],
    dts: true,
    target: "es2020",
    platform: "browser",
    external: ["react", "./index", "./index.js"],
    banner: { js: '"use client";' },
  },
]);
