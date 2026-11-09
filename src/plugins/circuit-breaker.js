import { wrapClient } from "./_wrap.js";

/** Thrown instead of hitting the network while the circuit is open. */
export class CircuitOpenError extends Error {
  constructor(message) {
    super(message || "Circuit breaker is open");
    this.name = "CircuitOpenError";
    this.code = "CIRCUIT_OPEN";
  }
}

/**
 * Classic closed → open → half-open circuit breaker.
 *
 * Trips after `failureThreshold` consecutive failures, rejects instantly for
 * `cooldownMs`, then lets `successThreshold` probe requests close it again.
 *
 * @example
 * const client = circuitBreaker(base, { failureThreshold: 5, cooldownMs: 30_000 });
 * client.circuitBreaker.getState(); // "closed" | "open" | "half-open"
 */
export function circuitBreaker(client, options = {}) {
  const failureThreshold =
    typeof options.failureThreshold === "number" && options.failureThreshold > 0
      ? options.failureThreshold
      : 5;
  const successThreshold =
    typeof options.successThreshold === "number" && options.successThreshold > 0
      ? options.successThreshold
      : 2;
  const cooldownMs = typeof options.cooldownMs === "number" ? options.cooldownMs : 30_000;
  const shouldCount = options.shouldCount || ((error) => !error.isAborted);
  const notify = (name, payload) => {
    if (typeof options[name] === "function") options[name](payload);
  };

  let state = "closed";
  let failures = 0;
  let halfOpenSuccesses = 0;
  let openedAt = 0;

  function trip() {
    state = "open";
    openedAt = Date.now();
    halfOpenSuccesses = 0;
    notify("onOpen", { failures });
  }

  function close() {
    const wasOpen = state !== "closed";
    state = "closed";
    failures = 0;
    halfOpenSuccesses = 0;
    if (wasOpen) notify("onClose", {});
  }

  const middleware = (originalFn) => (...args) => {
    if (state === "open") {
      if (Date.now() - openedAt < cooldownMs) return Promise.reject(new CircuitOpenError());
      state = "half-open";
      halfOpenSuccesses = 0;
      notify("onHalfOpen", {});
    }

    let pending;
    try {
      pending = Promise.resolve(originalFn(...args));
    } catch (error) {
      pending = Promise.reject(error);
    }

    return pending.then(
      (result) => {
        if (state === "half-open") {
          halfOpenSuccesses += 1;
          if (halfOpenSuccesses >= successThreshold) close();
        } else if (state === "closed") {
          failures = 0;
        }
        return result;
      },
      (error) => {
        if (shouldCount(error)) {
          failures += 1;
          if (state === "half-open") trip();
          else if (state === "closed" && failures >= failureThreshold) trip();
        }
        throw error;
      },
    );
  };

  return wrapClient(client, middleware, {
    circuitBreaker: Object.freeze({
      getState: () => state,
      reset: () => close(),
      getStats: () => ({ state, failures, openedAt }),
    }),
  });
}
