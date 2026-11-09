import { describe, expect, it, vi } from "vitest";
import { makeClient } from "./helpers.js";

const ok = () => Promise.resolve(new Response(null, { status: 200 }));

function urlOf(fetchImpl) {
  return fetchImpl.mock.calls[0][0];
}

describe("resolveURL", () => {
  it("joins baseURL", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl, { baseURL: "https://api.app.test/v1" });
    await c.get("/users");
    expect(urlOf(fetchImpl)).toBe("https://api.app.test/v1/users");
  });

  it("handles a trailing slash on baseURL", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl, { baseURL: "https://api.app.test/v1/" });
    await c.get("users");
    expect(urlOf(fetchImpl)).toBe("https://api.app.test/v1/users");
  });

  it("keeps absolute URLs", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl, {
      baseURL: "https://api.app.test",
      allowedOrigins: ["https://ext.test"],
    });
    await c.get("https://ext.test/x");
    expect(urlOf(fetchImpl)).toBe("https://ext.test/x");
  });

  it("strips the hash", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x#section");
    expect(urlOf(fetchImpl)).toBe("https://a.test/x");
  });

  it("appends array params as repeated keys", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x", { a: 1, b: [2, 3] });
    expect(urlOf(fetchImpl)).toBe("https://a.test/x?a=1&b=2&b=3");
  });

  it("accepts URLSearchParams", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x", new URLSearchParams({ a: "1" }));
    expect(urlOf(fetchImpl)).toBe("https://a.test/x?a=1");
  });

  it("rejects unsupported protocols", async () => {
    const c = makeClient(vi.fn(ok));
    await expect(c.get("file:///etc/passwd")).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });

  it("adds a cache buster", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x", undefined, { bustCache: true });
    expect(urlOf(fetchImpl)).toMatch(/[?&]_=\d+/);
  });

  it("sends data as JSON for POST", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.post("https://a.test/x", { name: "ada" });
    const init = fetchImpl.mock.calls[0][1];
    expect(init.body).toBe('{"name":"ada"}');
    expect(init.headers["content-type"]).toBe("application/json; charset=utf-8");
  });
});
