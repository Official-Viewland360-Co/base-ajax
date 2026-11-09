import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bundlePath = resolve(process.cwd(), "dist/baseAjax.all.umd.min.js");

describe("combined browser bundle", () => {
  it.skipIf(!existsSync(bundlePath))(
    "exposes the core and plugins from one standalone script",
    async () => {
      const bundle = readFileSync(bundlePath, "utf8");
      window.eval(bundle);

      const BaseAjax = window.BaseAjax;
      expect(BaseAjax.createClient).toEqual(expect.any(Function));
      expect(BaseAjax.cache).toEqual(expect.any(Function));
      expect(BaseAjax.compose).toEqual(expect.any(Function));

      let requestCount = 0;
      const client = BaseAjax.cache(
        BaseAjax.createClient({
          transport: async () => {
            requestCount += 1;
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

      await expect(client.get("https://example.test/data")).resolves.toEqual({
        ok: true,
      });
      await expect(client.get("https://example.test/data")).resolves.toEqual({
        ok: true,
      });
      expect(requestCount).toBe(1);
    },
  );
});
