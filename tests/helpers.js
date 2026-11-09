/** Small shared helpers for the test-suite. */
import { vi } from "vitest";

export const ORIGIN = "https://a.test";

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function textResponse(body, status = 200, contentType = "text/plain") {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

/** Creates a client bound to `fetchImpl` with logging silenced. */
export function makeClient(fetchImpl, options = {}) {
  const BaseAjax = globalThis.BaseAjax;
  return BaseAjax.createClient({
    fetch: fetchImpl,
    origin: ORIGIN,
    logLevel: "silent",
    ...options,
  });
}

/**
 * A fetch double whose promises are resolved manually, so tests can observe
 * "in flight" states without racing timers.
 */
export function deferredFetch(responseFactory = () => jsonResponse({ ok: true })) {
  const pending = [];
  const fetchImpl = vi.fn((...args) => {
    let resolve;
    const promise = new Promise((res) => {
      resolve = () => res(responseFactory(...args));
    });
    pending.push({ args, resolve });
    return promise;
  });
  return { fetchImpl, pending };
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitFor(predicate, timeout = 2000) {
  const startedAt = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - startedAt > timeout) throw new Error("waitFor() timed out");
    await sleep(1);
  }
}
