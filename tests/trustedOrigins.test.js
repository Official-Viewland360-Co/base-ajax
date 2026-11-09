import { describe, expect, it, vi } from "vitest";
import { makeClient } from "./helpers.js";

const ok = () => Promise.resolve(new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } }));

describe("origin trust", () => {
  it("refuses to send a token to an untrusted origin", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await expect(
      c.get("https://evil.test/x", undefined, { token: "secret", withAuth: true }),
    ).rejects.toMatchObject({ code: "UNTRUSTED_ORIGIN" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the token to the same origin", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x", undefined, { token: "secret", withAuth: true });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer secret");
  });

  it("trusts extra allowedOrigins", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl, { allowedOrigins: ["https://p.test"] });
    await c.get("https://p.test/x", undefined, { token: "t", withAuth: true });
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toBe("Bearer t");
  });

  it("uses credentials=omit for untrusted origins", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://other.test/x");
    expect(fetchImpl.mock.calls[0][1].credentials).toBe("omit");
  });

  it("uses credentials=include for trusted origins", async () => {
    const fetchImpl = vi.fn(ok);
    const c = makeClient(fetchImpl);
    await c.get("https://a.test/x");
    expect(fetchImpl.mock.calls[0][1].credentials).toBe("include");
  });

  it("rejects unknown HTTP methods", async () => {
    const c = makeClient(vi.fn(ok));
    await expect(c.request({ url: "https://a.test/x", method: "TRACE" })).rejects.toMatchObject({
      code: "INVALID_REQUEST",
    });
  });
});
