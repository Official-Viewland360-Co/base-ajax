import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/baseAjax.js"), "utf8");

/**
 * `src/baseAjax.js` publishes the core API on `globalThis.BaseAjax` in every
 * module format. Re-evaluating the file simulates a second copy of the library
 * (the core and the combined entry) loading in the same process, which used to
 * throw when the first copy had already frozen the global singleton.
 */
describe("global singleton", () => {
  it("does not modify the frozen core API that is already on the global", () => {
    const existing = globalThis.BaseAjax;
    expect(Object.isExtensible(existing)).toBe(false);

    expect(() => window.eval(source)).not.toThrow();

    expect(globalThis.BaseAjax).toBe(existing);
    expect(typeof globalThis.BaseAjax.createClient).toBe("function");
  });

  it("merges the core API into the extensible namespace of a UMD bundle", () => {
    const existing = globalThis.BaseAjax;
    const namespace = {};
    globalThis.BaseAjax = namespace;
    try {
      window.eval(source);

      expect(globalThis.BaseAjax).toBe(namespace);
      expect(typeof namespace.createClient).toBe("function");
      expect(typeof namespace.ApiError).toBe("function");
      expect(typeof namespace.VERSION).toBe("string");
    } finally {
      globalThis.BaseAjax = existing;
    }
  });
});
