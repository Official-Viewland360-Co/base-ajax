import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "./helpers.js";

describe("security", () => {
  it("redacts sensitive query params from logs", async () => {
    const lines = [];
    const logger = {
      debug: (line) => lines.push(line),
      info: (line) => lines.push(line),
      warn: (line) => lines.push(line),
      error: (line) => lines.push(line),
    };
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const c = makeClient(fetchImpl, { logLevel: "debug", logger });
    await c.get("https://a.test/x", { access_token: "SECRET", q: "visible" });

    const dump = lines.join("\n");
    expect(dump).toContain("request:start");
    expect(dump).toContain("visible");
    expect(dump).not.toContain("SECRET");
  });

  it("keeps secrets out of ApiError.toJSON()", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })));
    const c = makeClient(fetchImpl);
    const error = await c.get("https://a.test/x", { access_token: "SECRET" }).catch((e) => e);
    expect(error).toBeInstanceOf(globalThis.BaseAjax.ApiError);
    expect(JSON.stringify(error.toJSON())).not.toContain("SECRET");
  });

  it("refuses function payloads", async () => {
    const c = makeClient(vi.fn(() => Promise.resolve(jsonResponse({}))));
    await expect(c.post("https://a.test/x", () => {})).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("does not accept unknown options silently forever", async () => {
    const warnings = [];
    const c = makeClient(vi.fn(() => Promise.resolve(jsonResponse({}))), {
      logLevel: "warn",
      logger: { warn: (line) => warnings.push(line) },
    });
    await c.get("https://a.test/x", undefined, { typoOption: true });
    await c.get("https://a.test/y", undefined, { typoOption: true });
    expect(warnings.filter((line) => line.includes("typoOption"))).toHaveLength(1);
  });
});
