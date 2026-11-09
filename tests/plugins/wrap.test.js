import { describe, expect, it, vi } from "vitest";
import {
  buildCfgFromArgs,
  optionIndex,
  stableStringify,
  withoutPriority,
  wrapClient,
} from "../../src/plugins/_wrap.js";
import { jsonResponse, makeClient, ORIGIN } from "../helpers.js";

describe("plugin internals: buildCfgFromArgs", () => {
  it("maps the request() form", () => {
    expect(buildCfgFromArgs("REQUEST", ["https://x.test/a"])).toEqual({ url: "https://x.test/a" });
    expect(buildCfgFromArgs("REQUEST", [{ url: "https://x.test/a", method: "PUT" }])).toEqual({
      url: "https://x.test/a",
      method: "PUT",
    });
  });

  it("maps GET/HEAD params", () => {
    expect(buildCfgFromArgs("GET", ["https://x.test/a", { q: 1 }])).toMatchObject({
      url: "https://x.test/a",
      method: "GET",
      params: { q: 1 },
    });
  });

  it("maps body verbs", () => {
    expect(buildCfgFromArgs("POST", ["https://x.test/a", { q: 1 }, { priority: 2 }])).toMatchObject({
      url: "https://x.test/a",
      method: "POST",
      data: { q: 1 },
      priority: 2,
    });
  });

  it("maps OPTIONS (no payload argument)", () => {
    expect(buildCfgFromArgs("OPTIONS", ["https://x.test/a", { priority: 1 }])).toMatchObject({
      url: "https://x.test/a",
      method: "OPTIONS",
      priority: 1,
    });
  });
});

describe("plugin internals: optionIndex", () => {
  it("knows where the options object lives", () => {
    expect(optionIndex("REQUEST")).toBe(0);
    expect(optionIndex("OPTIONS")).toBe(1);
    expect(optionIndex("GET")).toBe(2);
    expect(optionIndex("POST")).toBe(2);
  });
});

describe("plugin internals: withoutPriority", () => {
  it("strips the hint without mutating the input", () => {
    const args = ["https://x.test/a", undefined, { priority: 5, timeout: 10 }];
    const next = withoutPriority("GET", args);
    expect(next[2]).toEqual({ timeout: 10 });
    expect(args[2]).toEqual({ priority: 5, timeout: 10 });
  });

  it("returns the same array when nothing needs stripping", () => {
    const args = ["https://x.test/a"];
    expect(withoutPriority("GET", args)).toBe(args);
  });
});

describe("plugin internals: stableStringify", () => {
  it("is insensitive to key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it("handles nested structures and non-JSON values", () => {
    expect(stableStringify({ a: [{ b: 1 }] })).toBe('{"a":[{"b":1}]}');
    const cyclic = {};
    cyclic.self = cyclic;
    expect(typeof stableStringify(cyclic)).toBe("string");
  });
});

describe("plugin internals: wrapClient", () => {
  it("forwards unknown properties and exposes extras", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const base = makeClient(fetchImpl);
    const calls = [];
    const wrapped = wrapClient(
      base,
      (fn, method) => (...args) => {
        calls.push(method);
        return fn(...args);
      },
      { marker: 42 },
    );

    expect(wrapped.marker).toBe(42);
    expect("marker" in wrapped).toBe(true);
    expect(wrapped.version).toBe(base.version);
    expect(Object.keys(wrapped)).toContain("marker");

    await wrapped.get(`${ORIGIN}/x`);
    await wrapped.request({ url: `${ORIGIN}/y` });
    expect(calls).toEqual(["GET", "REQUEST"]);
  });

  it("never mutates the wrapped client", () => {
    const base = makeClient(vi.fn());
    const wrapped = wrapClient(base, (fn) => fn, { extra: 1 });
    expect(Object.isFrozen(base)).toBe(true);
    expect(() => {
      wrapped.newProp = 1;
    }).toThrow();
  });
});
