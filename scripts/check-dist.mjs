// Fails the build when a file named in package.json "exports" is missing from dist/.
// tsup builds the two configs in tsup.config.ts in parallel; a `clean` inside them once deleted
// dist/react.d.ts after it was written, and 1.10.0–1.12.0 shipped without it.
import { existsSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const files = new Set([pkg.main, pkg.types]);
for (const entry of Object.values(pkg.exports)) {
  if (typeof entry === "string") files.add(entry);
  else for (const file of Object.values(entry)) files.add(file);
}
const missing = [...files].filter((file) => file.startsWith("./dist/") && !existsSync(new URL(`../${file}`, import.meta.url)));
if (missing.length) {
  console.error(`dist is missing files named in package.json: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`dist has all ${files.size} files named in package.json`);
