import { defineConfig } from "tsup";

// The two configs build in parallel into dist/, so neither may `clean` it: one would delete the other's
// files (react.d.ts went missing in 1.10.0–1.12.0). `npm run build` empties dist/ first instead.
export default defineConfig([
  // plain SDK — usable from server components, workers, Node scripts, any framework
  // security-kit (device signals) is bundled in, so the SDK keeps zero runtime dependencies
  {
    entry: { index: "src/index.ts", graphql: "src/graphql/index.ts" },
    format: ["esm"],
    dts: true,
    target: "es2020",
    platform: "browser",
    noExternal: ["@mgpl-diagnostics/security-kit"],
  },
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
