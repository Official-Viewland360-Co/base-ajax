import { wrapClient, optionIndex, withoutPriority } from "./_wrap.js";

/**
 * Concurrency limiter with a priority queue.
 *
 * Pass `priority` (higher runs sooner) inside the request options; the hint is
 * stripped before the request reaches the core, so no "unknown option"
 * warnings are emitted.
 *
 * @example
 * const client = queue(base, { maxConcurrent: 4 });
 * client.get("/slow");                       // priority 0
 * client.get("/slow", undefined, { priority: 10 }); // jumps the queue
 * client.queue.active;  // 1
 * client.queue.pending; // 0
 */
export function queue(client, options = {}) {
  const maxConcurrent =
    typeof options.maxConcurrent === "number" && options.maxConcurrent > 0
      ? Math.floor(options.maxConcurrent)
      : 6;
  const waiting = [];
  let active = 0;

  function acquire(priority) {
    return new Promise((resolve) => {
      if (active < maxConcurrent) {
        active += 1;
        resolve();
        return;
      }
      waiting.push({ resolve, priority });
      waiting.sort((a, b) => b.priority - a.priority);
    });
  }

  function release() {
    active -= 1;
    const next = waiting.shift();
    if (next) {
      active += 1;
      next.resolve();
    }
  }

  const middleware = (originalFn, method) => (...args) => {
    const index = optionIndex(method);
    const requestOptions = args[index];
    const priority =
      requestOptions && typeof requestOptions === "object" && typeof requestOptions.priority === "number"
        ? requestOptions.priority
        : 0;

    const forwarded = withoutPriority(method, args);
    return acquire(priority).then(
      () =>
        new Promise((resolve, reject) => {
          let pending;
          try {
            pending = Promise.resolve(originalFn(...forwarded));
          } catch (error) {
            pending = Promise.reject(error);
          }
          pending.then(
            (value) => {
              release();
              resolve(value);
            },
            (error) => {
              release();
              reject(error);
            },
          );
        }),
    );
  };

  return wrapClient(client, middleware, {
    queue: Object.freeze({
      get active() {
        return active;
      },
      get pending() {
        return waiting.length;
      },
      get maxConcurrent() {
        return maxConcurrent;
      },
    }),
  });
}
