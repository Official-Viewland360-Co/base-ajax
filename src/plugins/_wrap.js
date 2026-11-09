/**
 * Shared plumbing for the BaseAjax plugin layer.
 *
 * A plugin is a pure function `(client, options) => client'`. The returned
 * client is a `Proxy` around the existing (frozen) client, so:
 *
 * - the core client is never mutated;
 * - every plugin can be applied to a client that already has other plugins;
 * - properties the plugin does not care about keep working untouched.
 *
 * Middleware contract: `(originalFn, methodKey) => (...args) => Promise`.
 * `methodKey` is `"REQUEST"` for `client.request(opts)` or the HTTP verb
 * (`"GET"`, `"POST"`, ...) for the shortcuts.
 */

const SHORTCUTS = Object.freeze({
  get: "GET",
  head: "HEAD",
  post: "POST",
  put: "PUT",
  patch: "PATCH",
  delete: "DELETE",
  options: "OPTIONS",
});

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Position of the per-request options object inside a shortcut call.
 *
 * | call                            | index |
 * | ------------------------------- | ----- |
 * | `client.request(opts)`          | 0     |
 * | `client.options(url, opts)`     | 1     |
 * | `client.get(url, params, opts)` | 2     |
 * | `client.post(url, data, opts)`  | 2     |
 */
export function optionIndex(method) {
  if (method === "REQUEST") return 0;
  if (method === "OPTIONS") return 1;
  return 2;
}

/** Reconstructs the request config from shortcut arguments (for key derivation). */
export function buildCfgFromArgs(method, args) {
  if (method === "REQUEST") {
    const first = args[0];
    if (typeof first === "string") return { url: first };
    return { ...(first || {}) };
  }
  const url = args[0];
  if (method === "OPTIONS") return { ...(args[1] || {}), url, method };
  const payload = args[1];
  const extra = args[2] || {};
  return method === "GET" || method === "HEAD"
    ? { ...extra, url, method, params: payload }
    : { ...extra, url, method, data: payload };
}

/** Returns a copy of `args` with `value` placed at `index` (padding as needed). */
export function withOption(args, index, value) {
  const out = args.slice();
  while (out.length < index) out.push(undefined);
  out[index] = value;
  return out;
}

/**
 * Returns `args` without the plugin-only `priority` hint, so the core never
 * logs it as an "Unknown option was ignored" warning.
 */
export function withoutPriority(method, args) {
  const index = optionIndex(method);
  const options = args[index];
  if (!options || typeof options !== "object" || !hasOwn(options, "priority")) return args;
  const next = { ...options };
  delete next.priority;
  return withOption(args, index, next);
}

function sortValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") return sortValue(value.toJSON());
  if (Array.isArray(value)) return value.map(sortValue);
  const out = {};
  Object.keys(value)
    .sort()
    .forEach((key) => {
      out[key] = sortValue(value[key]);
    });
  return out;
}

/**
 * Deterministic JSON used to build cache/dedupe keys: `{a:1,b:2}` and
 * `{b:2,a:1}` produce the same key. Falls back to `String(value)` for values
 * JSON cannot represent (cycles, BigInt, ...).
 */
export function stableStringify(value) {
  try {
    const out = JSON.stringify(sortValue(value));
    return out === undefined ? "" : out;
  } catch (e) {
    return String(value);
  }
}

/**
 * Wraps every public request method of a client with `middleware`.
 *
 * The core client is `Object.freeze`-d, and JavaScript forbids a `Proxy` from
 * returning anything other than the original value for a non-configurable,
 * non-writable property. So instead of proxying, we build a new frozen object
 * that copies the client's own properties and replaces the request methods with
 * their wrapped versions. That is also faster than intercepting every `get`.
 *
 * @param {object} client            frozen BaseAjax client (or another plugin's client)
 * @param {(fn: Function, method: string) => Function} middleware
 * @param {object} [extra]           additional properties to expose, for example
 *                                   `{ inflightSize }` or `{ cache }`. Accessors
 *                                   are copied as accessors, not as snapshots.
 * @returns {object} wrapped client
 */
export function wrapClient(client, middleware, extra) {
  const wrapped = { ...client };

  if (typeof client.request === "function") {
    wrapped.request = middleware(client.request.bind(client), "REQUEST");
  }
  Object.keys(SHORTCUTS).forEach((name) => {
    if (typeof client[name] === "function") {
      wrapped[name] = middleware(client[name].bind(client), SHORTCUTS[name]);
    }
  });

  Object.keys(extra || {}).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(extra, key);
    Object.defineProperty(wrapped, key, {
      enumerable: true,
      configurable: true,
      ...descriptor,
    });
  });

  return Object.freeze(wrapped);
}
