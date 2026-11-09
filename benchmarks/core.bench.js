/**
 * Micro-benchmarks for the core factory and the plugin layer.
 * Run with `npm run bench` (builds `dist/` first).
 */
import { Bench } from "tinybench";
import BaseAjax from "../dist/baseAjax.esm.js";
import { cache, compose, dedupe, queue, trace } from "../dist/plugins.esm.js";

const ORIGIN = "https://a.test";
const fetchStub = async () =>
  new Response('{"ok":true}', { status: 200, headers: { "content-type": "application/json" } });

const base = BaseAjax.createClient({ origin: ORIGIN, fetch: fetchStub, logLevel: "silent" });
const stacked = compose(
  base,
  (client) => queue(client, { maxConcurrent: 8 }),
  (client) => dedupe(client),
  (client) => cache(client, { ttl: 60_000 }),
  (client) => trace(client),
);

const bench = new Bench({ time: 1000, warmupTime: 250 });

bench.add("createClient (defaults)", () => {
  BaseAjax.createClient({ origin: ORIGIN });
});

bench.add("createClient (retry + auth + csrf)", () => {
  BaseAjax.createClient({
    origin: ORIGIN,
    retry: { count: 2 },
    auth: { mode: "memory" },
    csrf: { cookieName: "XSRF-TOKEN" },
  });
});

bench.add("compose 4 plugins", () => {
  compose(
    base,
    (client) => queue(client, { maxConcurrent: 8 }),
    (client) => dedupe(client),
    (client) => cache(client, { ttl: 60_000 }),
    (client) => trace(client),
  );
});

bench.add("cached GET (plugins)", async () => {
  await stacked.get(`${ORIGIN}/users/1`, { page: 1 });
});

bench.add("GET through the core (stubbed fetch)", async () => {
  await base.get(`${ORIGIN}/users/1`, { page: 1 });
});

await bench.run();
console.table(bench.table());
