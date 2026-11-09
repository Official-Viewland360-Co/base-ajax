/**
 * Fails the release when the runtime `VERSION` constant, the source banner or
 * the type-definition header drifts away from `package.json#version`.
 *
 * The version is kept in source (not injected at build time) so the sourcemaps
 * keep their full `sourcesContent` and `src/baseAjax.js` stays directly usable
 * as a UMD file; this script makes the duplication safe instead.
 *
 * Usage: node scripts/check-version.mjs
 */
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const pkg = JSON.parse(read("package.json"));

const targets = [
  ["src/baseAjax.js", /const VERSION = "([^"]+)"/],
  ["src/baseAjax.js", /\* BaseAjax v([0-9][^\s]*)/],
  ["types/baseAjax.d.ts", /\* Type definitions for BaseAjax v([0-9][^\s]*)/],
];

let failed = false;

for (const [file, pattern] of targets) {
  const match = read(file).match(pattern);
  const found = match?.[1];
  const ok = found === pkg.version;
  console.log(`${ok ? "OK" : "FAIL"} ${file}: ${found ?? "<missing>"} (package.json: ${pkg.version})`);
  if (!ok) failed = true;
}

if (failed) {
  console.error("Version mismatch. Update the sources above to match package.json before publishing.");
  process.exitCode = 1;
}
