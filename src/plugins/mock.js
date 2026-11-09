function matches(handler, req) {
  const match = handler.match;
  if (typeof match === "function") return Boolean(match(req));
  if (match instanceof RegExp) return match.test(req.url);
  if (typeof match === "string") {
    return match === req.url || match === `${req.method} ${req.url}`;
  }
  return false;
}

/**
 * Transport-level mock. Pass it as `transport` when creating a client:
 *
 * @example
 * const client = BaseAjax.createClient({
 *   origin: "https://a.test",
 *   transport: mock([
 *     { match: "/users/1", response: { body: { id: 1 } } },
 *     { match: /\/users\/\d+/, response: (req) => ({ body: { url: req.url } }) },
 *   ]),
 * });
 *
 * Handlers: `{ match, response }` where `match` is a string (exact URL or
 * `"GET /url"`), a RegExp tested against the URL, or a `(req) => boolean`
 * predicate, and `response` is a plain object or `(req) => response`.
 * Unmatched requests resolve as `404`, they do not reject.
 */
export function mock(handlers = []) {
  const routes = Array.isArray(handlers) ? handlers : [];

  return async function mockTransport(req) {
    for (const handler of routes) {
      if (!matches(handler, req)) continue;
      const raw =
        typeof handler.response === "function" ? await handler.response(req) : handler.response;
      const response = raw || {};
      return {
        status: response.status === undefined ? 200 : response.status,
        statusText: response.statusText || "",
        headers: response.headers || { "content-type": "application/json" },
        body:
          typeof response.body === "string"
            ? response.body
            : JSON.stringify(response.body === undefined ? null : response.body),
      };
    }
    return { status: 404, statusText: "Not Found", headers: {}, body: "" };
  };
}
