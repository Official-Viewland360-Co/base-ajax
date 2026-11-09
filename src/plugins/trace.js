import { wrapClient, optionIndex, withOption } from "./_wrap.js";

const TRACEPARENT = /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/;

function randomHex(bytes) {
  const buffer = new Uint8Array(bytes);
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buffer);
  } else {
    for (let i = 0; i < bytes; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Builds a W3C `traceparent` value: `00-<trace-id>-<parent-id>-01`.
 * 16 random bytes for the trace id, 8 for the span id.
 */
export function generateTraceparent() {
  return `00-${randomHex(16)}-${randomHex(8)}-01`;
}

/** Case-insensitive lookup of an existing header name. */
function findHeaderKey(headers, name) {
  const target = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === target) || null;
}

/**
 * Injects a W3C `traceparent` header into every request so browser calls can
 * be stitched to server traces (OpenTelemetry, Tempo, Jaeger, ...).
 *
 * Implemented as middleware (not as a request interceptor) so it never mutates
 * the shared interceptor stack of the base client.
 *
 * @example
 * const client = trace(base, { onTrace: (value) => console.debug(value) });
 * // propagate an upstream trace instead of generating one:
 * trace(base, { getTraceparent: () => upstreamTraceparent });
 */
export function trace(client, options = {}) {
  const headerName = options.headerName || "traceparent";
  const getValue = options.getTraceparent || generateTraceparent;

  const middleware = (originalFn, method) => (...args) => {
    const index = optionIndex(method);
    const current = args[index];
    const base = current && typeof current === "object" ? current : {};
    const headers = { ...(base.headers || {}) };
    if (!findHeaderKey(headers, headerName)) {
      const value = getValue();
      if (!TRACEPARENT.test(value) && options.validate !== false && typeof options.onInvalid === "function") {
        options.onInvalid(value);
      }
      headers[headerName] = value;
      if (typeof options.onTrace === "function") options.onTrace(value);
    }
    return originalFn(...withOption(args, index, { ...base, headers }));
  };

  return wrapClient(client, middleware);
}
