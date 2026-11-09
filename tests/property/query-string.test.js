import fc from "fast-check";
import { describe, it, vi } from "vitest";
import { makeClient, ORIGIN } from "../helpers.js";

describe("property: query string round-trip", () => {
  it("serializes arbitrary string params losslessly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 12 }).filter((key) => /^[A-Za-z0-9_]+$/.test(key)),
          fc.string({ minLength: 0, maxLength: 40 }),
          { maxKeys: 5 },
        ),
        async (params) => {
          const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
          const client = makeClient(fetchImpl);
          await client.get(`${ORIGIN}/x`, params);

          const url = new URL(fetchImpl.mock.calls[0][0]);
          return Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("serializes numeric and boolean params as their string form", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 8 }).filter((key) => /^[a-z]+$/.test(key)),
          fc.oneof(fc.integer(), fc.boolean()),
          { maxKeys: 4 },
        ),
        async (params) => {
          const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
          const client = makeClient(fetchImpl);
          await client.get(`${ORIGIN}/x`, params);

          const url = new URL(fetchImpl.mock.calls[0][0]);
          return Object.entries(params).every(
            ([key, value]) => url.searchParams.get(key) === String(value),
          );
        },
      ),
      { numRuns: 40 },
    );
  });
});
