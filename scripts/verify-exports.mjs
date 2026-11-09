/**
 * Verifies the published `base-ajax/all` entry point in a real Node runtime.
 *
 * `tests/browser/bundle.test.js` covers the standalone browser bundle; this
 * script covers the package `exports` map for both module systems and performs
 * a real cache round-trip through the combined entry, so it proves the plugins
 * run on top of the core client instead of merely being re-exported.
 *
 * Requires built artifacts, so run it after `npm run build`.
 *
 * Both load orders are checked because the global singleton merge in
 * `src/baseAjax.js` behaves differently when the frozen core API already exists
 * on `globalThis` (`--cjs-first` runs the CommonJS entry first).
 *
 * Usage: node scripts/verify-exports.mjs [--cjs-first]
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/** Named exports every consumer of `base-ajax/all` can rely on. */
const EXPECTED_FUNCTIONS = [
  "createClient",
  "cache",
  "compose",
  "dedupe",
  "circuitBreaker",
  "queue",
  "trace",
  "mock",
  "wrapClient",
  "generateTraceparent",
];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertShape(label, mod) {
  assert(mod !== null && typeof mod === "object", `${label}: entry did not resolve to an object`);

  const missing = EXPECTED_FUNCTIONS.filter((name) => typeof mod[name] !== "function");
  assert(missing.length === 0, `${label}: missing named exports: ${missing.join(", ")}`);
  assert(
    mod.default !== null && typeof mod.default?.createClient === "function",
    `${label}: default export does not expose createClient`,
  );
  assert(mod.CODES !== null && typeof mod.CODES === "object", `${label}: core CODES export is missing`);
  assert(mod.ApiError !== undefined, `${label}: core ApiError export is missing`);
}

/** Two identical GETs through the cache plugin must hit the transport once. */
async function assertCacheWorks(label, mod) {
  let calls = 0;
  const client = mod.cache(
    mod.createClient({
      logLevel: "silent",
      transport: async () => {
        calls += 1;
        return {
          status: 200,
          statusText: "OK",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        };
      },
    }),
    { ttl: 10_000 },
  );

  assert(typeof client.cache?.size === "function", `${label}: cache handle is missing`);

  const first = await client.get("https://example.test/combined");
  const second = await client.get("https://example.test/combined");

  assert(first.ok === true && second.ok === true, `${label}: cached response has an unexpected shape`);
  assert(calls === 1, `${label}: cache plugin did not short-circuit the second request (calls=${calls})`);
  assert(client.cache.size() === 1, `${label}: cache handle did not record the entry`);
}

async function main() {
  const cjsFirst = process.argv.includes("--cjs-first");
  const steps = cjsFirst
    ? [
        ["CJS base-ajax/all", () => require("base-ajax/all")],
        ["ESM base-ajax/all", () => import("base-ajax/all")],
      ]
    : [
        ["ESM base-ajax/all", () => import("base-ajax/all")],
        ["CJS base-ajax/all", () => require("base-ajax/all")],
      ];

  for (const [label, load] of steps) {
    const mod = await load();
    assertShape(label, mod);
    await assertCacheWorks(label, mod);
  }

  console.log(
    `OK base-ajax/all exposes the core plus ${EXPECTED_FUNCTIONS.length} named API functions in ESM and CommonJS (${cjsFirst ? "CJS then ESM" : "ESM then CJS"}).`,
  );
  console.log("OK the cache plugin works through both entries.");
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
