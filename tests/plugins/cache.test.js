import { describe, expect, it, vi } from "vitest";
import { cache } from "../../src/plugins/cache.js";
import { deferredFetch, jsonResponse, makeClient, ORIGIN, sleep, waitFor } from "../helpers.js";

describe("plugin: cache", () => {
  it("serves the second identical GET from memory", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ n: 1 })));
    const client = cache(makeClient(fetchImpl), { ttl: 10_000 });

    await client.get(`${ORIGIN}/x`, { id: 1 });
    await expect(client.get(`${ORIGIN}/x`, { id: 1 })).resolves.toEqual({ n: 1 });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(client.cache.size()).toBe(1);
  });

  it("keeps different params in separate entries", async () => {
    const fetchImpl = vi.fn((url) => Promise.resolve(jsonResponse({ url })));
    const client = cache(makeClient(fetchImpl), { ttl: 10_000 });

    await client.get(`${ORIGIN}/x`, { id: 1 });
    await client.get(`${ORIGIN}/x`, { id: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(client.cache.size()).toBe(2);
  });

  it("re-fetches once the TTL expires", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ n: 1 })));
    const client = cache(makeClient(fetchImpl), { ttl: 5 });

    await client.get(`${ORIGIN}/x`);
    await sleep(30);
    await client.get(`${ORIGIN}/x`);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("serves stale data and revalidates in the background (SWR)", async () => {
    let fetchCount = 0;
    const { fetchImpl, pending } = deferredFetch(() => {
      fetchCount += 1;
      return jsonResponse({ n: fetchCount });
    });
    const client = cache(makeClient(fetchImpl), { ttl: 100, staleWhileRevalidate: true });

    const first = client.get(`${ORIGIN}/x`);
    await waitFor(() => pending.length === 1);
    pending[0].resolve();
    await expect(first).resolves.toEqual({ n: 1 });

    await sleep(130);
    await expect(client.get(`${ORIGIN}/x`)).resolves.toEqual({ n: 1 }); // stale
    await waitFor(() => pending.length === 2);
    pending[1].resolve();
    await waitFor(() => client.cache.get(client.cache.keys()[0]).data.n === 2);

    await expect(client.get(`${ORIGIN}/x`)).resolves.toEqual({ n: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not cache unsafe methods", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const client = cache(makeClient(fetchImpl), { ttl: 10_000 });

    await client.post(`${ORIGIN}/x`, { a: 1 });
    await client.post(`${ORIGIN}/x`, { a: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(client.cache.size()).toBe(0);
  });

  it("exposes clear/keys/has/delete", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const client = cache(makeClient(fetchImpl), { ttl: 10_000 });

    await client.get(`${ORIGIN}/x`);
    const [key] = client.cache.keys();
    expect(client.cache.has(key)).toBe(true);
    expect(client.cache.delete(key)).toBe(true);
    expect(client.cache.size()).toBe(0);

    await client.get(`${ORIGIN}/x`);
    client.cache.clear();
    expect(client.cache.size()).toBe(0);
  });

  it("does not coalesce concurrent misses on its own", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = cache(makeClient(fetchImpl), { ttl: 10_000 });

    const first = client.get(`${ORIGIN}/x`);
    const second = client.get(`${ORIGIN}/x`);
    await waitFor(() => pending.length === 2);
    pending.forEach((entry) => entry.resolve());

    await Promise.all([first, second]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares the store between clients when provided", async () => {
    const store = new Map();
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: 1 })));
    const a = cache(makeClient(fetchImpl), { store, ttl: 10_000 });
    const b = cache(makeClient(fetchImpl), { store, ttl: 10_000 });

    await a.get(`${ORIGIN}/x`);
    await b.get(`${ORIGIN}/x`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
