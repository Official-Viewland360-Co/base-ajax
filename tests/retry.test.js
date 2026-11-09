import { describe, expect, it, vi } from "vitest";
import { jsonResponse, makeClient } from "./helpers.js";

const status = (code) => Promise.resolve(new Response(null, { status: code }));

describe("retry policy", () => {
  it("does not retry a successful call", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const c = makeClient(fetchImpl, { retry: { count: 3, delay: 1, jitter: false } });
    await expect(c.get("https://a.test/x")).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 503 and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => status(503))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const c = makeClient(fetchImpl, { retry: { count: 2, delay: 1, jitter: false } });
    await expect(c.get("https://a.test/x")).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("exhausts the retries and throws the last error", async () => {
    const fetchImpl = vi.fn(() => status(503));
    const c = makeClient(fetchImpl, { retry: { count: 1, delay: 1, jitter: false } });
    await expect(c.get("https://a.test/x")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 503,
      attempts: 2,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST by default", async () => {
    const fetchImpl = vi.fn(() => status(503));
    const c = makeClient(fetchImpl, { retry: { count: 3, delay: 1, jitter: false } });
    await expect(c.post("https://a.test/x", { a: 1 })).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries POST when an idempotency key is supplied", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => status(503))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const c = makeClient(fetchImpl, { retry: { count: 1, delay: 1, jitter: false } });
    await expect(
      c.post("https://a.test/x", { a: 1 }, { idempotencyKey: true }),
    ).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("honours Retry-After", async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(() =>
      Promise.resolve(new Response(null, { status: 429, headers: { "retry-after": "0.08" } })),
    );
    fetchImpl.mockImplementationOnce(() => Promise.resolve(jsonResponse({ ok: 1 })));

    const c = makeClient(fetchImpl, {
      retry: { count: 1, delay: 1, jitter: false, respectRetryAfter: true },
    });
    const startedAt = Date.now();
    await expect(c.get("https://a.test/x")).resolves.toEqual({ ok: 1 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(60);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("accepts the legacy numeric retry shorthand", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(() => status(500))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const c = makeClient(fetchImpl, { retry: 1 });
    await expect(c.get("https://a.test/x")).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
