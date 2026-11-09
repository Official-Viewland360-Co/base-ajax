import { describe, expect, it } from "vitest";
import {
  cache,
  circuitBreaker,
  compose,
  dedupe,
  queue,
  trace,
  mock,
} from "../../src/plugins/index.js";
import { jsonResponse, makeClient, ORIGIN } from "../helpers.js";

describe("plugin: compose", () => {
  it("applies plugins left to right and keeps every handle", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = compose(
      makeClient(fetchImpl),
      (c) => queue(c, { maxConcurrent: 4 }),
      (c) => dedupe(c),
      (c) => cache(c, { ttl: 30_000 }),
      (c) => circuitBreaker(c, { failureThreshold: 5 }),
      (c) => trace(c),
    );

    expect(client.queue.maxConcurrent).toBe(4);
    expect(client.cache.size()).toBe(0);
    expect(client.circuitBreaker.getState()).toBe("closed");
    expect(client.inflightSize).toBe(0);

    await expect(client.get(`${ORIGIN}/x`)).resolves.toEqual({ ok: true });
    expect(client.cache.size()).toBe(1);
    expect(client.queue.active).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the client untouched when no plugin is given", () => {
    const base = makeClient(() => Promise.resolve(jsonResponse({})));
    expect(compose(base)).toBe(base);
  });

  it("works with the mock transport for offline demos", async () => {
    const BaseAjax = globalThis.BaseAjax;
    const client = compose(
      BaseAjax.createClient({
        origin: ORIGIN,
        logLevel: "silent",
        transport: mock([{ match: /.*/, response: { body: { id: 7 } } }]),
      }),
      (c) => cache(c, { ttl: 1000 }),
      (c) => trace(c),
    );

    await expect(client.get(`${ORIGIN}/users/7`)).resolves.toEqual({ id: 7 });
  });
});
