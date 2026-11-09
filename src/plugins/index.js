/**
 * Public entry point of the BaseAjax plugin layer (`base-ajax/plugins`).
 *
 * Every plugin is a pure function `(client, options) => client'`; the returned
 * client is proxied, so plugins stack in any order. `compose` is sugar for
 * that reduction.
 */
export { wrapClient, buildCfgFromArgs, optionIndex, withOption, stableStringify } from "./_wrap.js";
export { dedupe } from "./dedupe.js";
export { cache } from "./cache.js";
export { circuitBreaker, CircuitOpenError } from "./circuit-breaker.js";
export { queue } from "./queue.js";
export { trace, generateTraceparent } from "./trace.js";
export { mock } from "./mock.js";

/**
 * Applies plugins left to right.
 *
 * Ordering matters: the *first* plugin is the outermost layer, so it sees the
 * request first. A typical order is `queue → dedupe → cache → breaker → trace`.
 *
 * @example
 * const client = compose(
 *   BaseAjax.createClient({ baseURL: "https://api.example.com" }),
 *   (c) => queue(c, { maxConcurrent: 4 }),
 *   (c) => dedupe(c),
 *   (c) => cache(c, { ttl: 30_000, staleWhileRevalidate: true }),
 *   (c) => circuitBreaker(c, { failureThreshold: 5 }),
 *   (c) => trace(c),
 * );
 */
export function compose(client, ...plugins) {
  return plugins.reduce((current, apply) => apply(current), client);
}
