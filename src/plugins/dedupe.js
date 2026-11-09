import { wrapClient, buildCfgFromArgs, stableStringify } from "./_wrap.js";

function defaultKey(cfg) {
  const method = String(cfg.method || "GET").toUpperCase();
  const params = cfg.params === undefined ? "" : stableStringify(cfg.params);
  const data = cfg.data === undefined ? "" : stableStringify(cfg.data);
  return `${method}:${cfg.url}:${params}:${data}`;
}

/**
 * Collapses concurrent identical requests into a single network call.
 * Every caller receives the *same* promise, so it resolves (or rejects)
 * exactly once.
 *
 * @example
 * const client = dedupe(base, { methods: ["GET", "HEAD"] });
 * await Promise.all([client.get("/a"), client.get("/a")]); // 1 fetch
 */
export function dedupe(client, options = {}) {
  const methods = new Set(
    (options.methods || ["GET", "HEAD"]).map((method) => String(method).toUpperCase()),
  );
  const keyFn = options.keyFn || defaultKey;
  const inflight = new Map();

  const middleware = (originalFn, method) => (...args) => {
    const cfg = buildCfgFromArgs(method, args);
    if (!methods.has(String(cfg.method || "GET").toUpperCase())) return originalFn(...args);

    const key = keyFn(cfg);
    const existing = inflight.get(key);
    if (existing) return existing;

    let pending;
    try {
      pending = Promise.resolve(originalFn(...args));
    } catch (error) {
      return Promise.reject(error);
    }
    const tracked = pending.finally(() => inflight.delete(key));
    inflight.set(key, tracked);
    return tracked;
  };

  return wrapClient(client, middleware, {
    /** Number of requests currently being collapsed. */
    get inflightSize() {
      return inflight.size;
    },
  });
}
