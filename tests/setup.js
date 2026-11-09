/**
 * Loads the UMD core for its side effect of exposing `globalThis.BaseAjax`.
 * Every test imports this indirectly through the vitest setup file.
 */
import "../src/baseAjax.js";

if (!globalThis.BaseAjax) {
  throw new Error("BaseAjax failed to expose globalThis.BaseAjax.");
}
