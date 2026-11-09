/**
 * Guards the combined `base-ajax/all` entry point.
 *
 * These imports use the package name (self-reference) on purpose: they prove
 * that the `exports` map and `types/all.d.ts` resolve for consumers, which the
 * relative imports in `index.test-d.ts` cannot check.
 */
import { describe, expectTypeOf, it } from "vitest";
import BaseAjax, {
  cache,
  circuitBreaker,
  compose,
  createClient,
  dedupe,
  mock,
  queue,
  trace,
} from "base-ajax/all";
import type {
  BaseAjaxClient,
  CacheHandle,
  CircuitBreakerHandle,
  QueueHandle,
  WrappedClient,
} from "base-ajax/all";

describe("combined entry types", () => {
  it("exposes the default export and the core factory", () => {
    expectTypeOf(BaseAjax.createClient).toBeFunction();

    const client = createClient({ baseURL: "https://api.example.com" });
    expectTypeOf(client).toEqualTypeOf<BaseAjaxClient>();
  });

  it("exposes every plugin factory alongside compose", () => {
    expectTypeOf(cache).toBeFunction();
    expectTypeOf(dedupe).toBeFunction();
    expectTypeOf(circuitBreaker).toBeFunction();
    expectTypeOf(queue).toBeFunction();
    expectTypeOf(trace).toBeFunction();
    expectTypeOf(mock).toBeFunction();
    expectTypeOf(compose).toBeFunction();
  });

  it("compose keeps the plugin handles on the returned client", () => {
    const client = createClient();
    const wrapped = compose(
      client,
      (c) => queue(c, { maxConcurrent: 2 }),
      (c) => cache(c, { ttl: 1_000 }),
      (c) => circuitBreaker(c, { failureThreshold: 3 }),
    );

    expectTypeOf(wrapped).toEqualTypeOf<WrappedClient>();
    expectTypeOf(wrapped.cache).toEqualTypeOf<CacheHandle | undefined>();
    expectTypeOf(wrapped.queue).toEqualTypeOf<QueueHandle | undefined>();
    expectTypeOf(wrapped.circuitBreaker).toEqualTypeOf<CircuitBreakerHandle | undefined>();
    expectTypeOf(client.get<{ id: number }>("/users")).toEqualTypeOf<Promise<{ id: number }>>();
  });
});
