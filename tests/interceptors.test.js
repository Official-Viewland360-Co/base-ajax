import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "./helpers.js";

describe("interceptors", () => {
  it("lets a request interceptor mutate the config", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const c = makeClient(fetchImpl);
    c.interceptors.request.use((cfg) => {
      cfg.headers = { ...(cfg.headers || {}), "x-custom": "1" };
      return cfg;
    });
    await c.get("https://a.test/x");
    expect(fetchImpl.mock.calls[0][1].headers["x-custom"]).toBe("1");
  });

  it("lets a response interceptor transform the data", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const c = makeClient(fetchImpl, { fullResponse: true });
    c.interceptors.response.use((response) => ({
      ...response,
      data: { wrapped: response.data },
    }));
    const res = await c.get("https://a.test/x");
    expect(res.data).toEqual({ wrapped: { ok: true } });
  });

  it("lets an error interceptor recover", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })));
    const c = makeClient(fetchImpl);
    c.interceptors.error.use((error) => {
      if (error.status === 500) return { fallback: true };
      return error;
    });
    await expect(c.get("https://a.test/x")).resolves.toEqual({ fallback: true });
  });

  it("ejects an interceptor by id", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const c = makeClient(fetchImpl);
    let calls = 0;
    const id = c.interceptors.request.use((cfg) => {
      calls += 1;
      return cfg;
    });
    c.interceptors.request.eject(id);
    await c.get("https://a.test/x");
    expect(calls).toBe(0);
  });
});
