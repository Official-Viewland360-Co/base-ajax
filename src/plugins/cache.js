import { wrapClient, buildCfgFromArgs, stableStringify } from "./_wrap.js";

function defaultKey(cfg) {
  const method = String(cfg.method || "GET").toUpperCase();
  const params = cfg.params === undefined ? "" : stableStringify(cfg.params);
  return `${method}:${cfg.url}:${params}`;
}

/**
 * In-memory response cache for safe methods, with TTL and optional
 * stale-while-revalidate (SWR).
 *
 * Responses are shared *by reference*; clone them yourself if callers mutate
 * the payload.
 *
 * @example
 * const client = cache(base, { ttl: 30_000, staleWhileRevalidate: true });
 * await client.get("/users"); // network
 * await client.get("/users"); // memory
 * client.cache.clear();
 */
export function cache(client, options = {}) {
  const store = options.store || new Map();
  const ttl = typeof options.ttl === "number" && options.ttl >= 0 ? options.ttl : 60_000;
  const swr = options.staleWhileRevalidate === true;
  const methods = new Set(
    (options.methods || ["GET"]).map((method) => String(method).toUpperCase()),
  );
  const keyFn = options.keyFn || defaultKey;

  const middleware = (originalFn, method) => (...args) => {
    const cfg = buildCfgFromArgs(method, args);
    if (!methods.has(String(cfg.method || "GET").toUpperCase())) return originalFn(...args);

    const key = keyFn(cfg);
    const now = Date.now();
    const hit = store.get(key);

    if (hit && hit.expiresAt > now) return Promise.resolve(hit.data);

    let pending;
    try {
      pending = Promise.resolve(originalFn(...args));
    } catch (error) {
      return Promise.reject(error);
    }

    if (hit && swr && hit.data !== undefined) {
      // Serve the stale value immediately and refresh in the background.
      pending
        .then((fresh) => {
          store.set(key, { data: fresh, expiresAt: Date.now() + ttl });
        })
        .catch(() => {
          /* keep the stale entry; a later request retries */
        });
      return Promise.resolve(hit.data);
    }

    return pending.then((data) => {
      store.set(key, { data, expiresAt: Date.now() + ttl });
      return data;
    });
  };

  return wrapClient(client, middleware, {
    cache: Object.freeze({
      /** The key derivation function, so callers can target entries. */
      key: keyFn,
      clear: () => store.clear(),
      delete: (key) => store.delete(key),
      has: (key) => store.has(key),
      get: (key) => store.get(key),
      size: () => store.size,
      keys: () => Array.from(store.keys()),
    }),
  });
}
