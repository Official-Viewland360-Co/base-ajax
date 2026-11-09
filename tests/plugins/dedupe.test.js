import { describe, expect, it, vi } from "vitest";
import { dedupe } from "../../src/plugins/dedupe.js";
import { deferredFetch, jsonResponse, makeClient, ORIGIN, waitFor } from "../helpers.js";

describe("plugin: dedupe", () => {
  it("collapses concurrent identical GETs into one fetch", async () => {
    const { fetchImpl, pending } = deferredFetch(() => jsonResponse({ n: 1 }));
    const client = dedupe(makeClient(fetchImpl));

    const first = client.get(`${ORIGIN}/x`, { id: 1 });
    const second = client.get(`${ORIGIN}/x`, { id: 1 });
    await waitFor(() => pending.length === 1);
    expect(client.inflightSize).toBe(1);

    pending[0].resolve();
    const [a, b] = await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(client.inflightSize).toBe(0);
  });

  it("does not collapse requests with different params", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = dedupe(makeClient(fetchImpl));

    const first = client.get(`${ORIGIN}/x`, { id: 1 });
    const second = client.get(`${ORIGIN}/x`, { id: 2 });
    await waitFor(() => pending.length === 2);
    pending.forEach((entry) => entry.resolve());

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("ignores key order when building the key", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = dedupe(makeClient(fetchImpl));

    const first = client.get(`${ORIGIN}/x`, { a: 1, b: 2 });
    const second = client.get(`${ORIGIN}/x`, { b: 2, a: 1 });
    await waitFor(() => pending.length === 1);
    pending[0].resolve();

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not dedupe POST by default", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = dedupe(makeClient(fetchImpl));

    const first = client.post(`${ORIGIN}/x`, { a: 1 });
    const second = client.post(`${ORIGIN}/x`, { a: 1 });
    await waitFor(() => pending.length === 2);
    pending.forEach((entry) => entry.resolve());

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("dedupes POST when configured to", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = dedupe(makeClient(fetchImpl), { methods: ["POST"] });

    const first = client.post(`${ORIGIN}/x`, { a: 1 });
    const second = client.post(`${ORIGIN}/x`, { a: 1 });
    await waitFor(() => pending.length === 1);
    pending[0].resolve();

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares rejections with every caller", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })));
    const client = dedupe(makeClient(fetchImpl));

    const results = await Promise.allSettled([
      client.get(`${ORIGIN}/x`),
      client.get(`${ORIGIN}/x`),
    ]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "rejected"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("supports a custom keyFn", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = dedupe(makeClient(fetchImpl), { keyFn: (cfg) => cfg.url });

    const first = client.get(`${ORIGIN}/x`, { id: 1 });
    const second = client.get(`${ORIGIN}/x`, { id: 2 });
    await waitFor(() => pending.length === 1);
    pending[0].resolve();

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("leaves the other client methods untouched", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const base = makeClient(fetchImpl);
    const client = dedupe(base);
    expect(client.version).toBe(base.version);
    expect(client.interceptors).toBe(base.interceptors);
    await expect(client.request({ url: `${ORIGIN}/x` })).resolves.toEqual({ ok: 1 });
  });
});
