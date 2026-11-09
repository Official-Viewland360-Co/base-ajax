import { describe, expect, it, vi } from "vitest";
import { queue } from "../../src/plugins/queue.js";
import { deferredFetch, jsonResponse, makeClient, ORIGIN, waitFor } from "../helpers.js";

describe("plugin: queue", () => {
  it("never exceeds maxConcurrent", async () => {
    let active = 0;
    let peak = 0;
    const fetchImpl = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return jsonResponse({ ok: true });
    });
    const client = queue(makeClient(fetchImpl), { maxConcurrent: 2 });

    await Promise.all(Array.from({ length: 6 }, (_, i) => client.get(`${ORIGIN}/${i}`)));

    expect(peak).toBe(2);
    expect(client.queue.active).toBe(0);
    expect(client.queue.pending).toBe(0);
  });

  it("tracks active and pending requests", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const client = queue(makeClient(fetchImpl), { maxConcurrent: 1 });

    const first = client.get(`${ORIGIN}/a`);
    await waitFor(() => pending.length === 1);
    expect(client.queue.active).toBe(1);
    expect(client.queue.pending).toBe(0);

    const second = client.get(`${ORIGIN}/b`);
    expect(client.queue.pending).toBe(1);

    pending[0].resolve();
    await first;
    await waitFor(() => pending.length === 2);
    expect(client.queue.active).toBe(1);

    pending[1].resolve();
    await second;
    expect(client.queue.active).toBe(0);
  });

  it("runs higher priority requests first", async () => {
    const { fetchImpl, pending } = deferredFetch((url) => jsonResponse({ url }));
    const client = queue(makeClient(fetchImpl), { maxConcurrent: 1 });

    const a = client.get(`${ORIGIN}/a`);
    await waitFor(() => pending.length === 1);
    const b = client.get(`${ORIGIN}/b`, undefined, { priority: 0 });
    const c = client.get(`${ORIGIN}/c`, undefined, { priority: 10 });
    const d = client.get(`${ORIGIN}/d`, undefined, { priority: 5 });

    pending[0].resolve();
    await waitFor(() => pending.length === 2);
    expect(pending[1].args[0]).toBe(`${ORIGIN}/c`);

    pending[1].resolve();
    await waitFor(() => pending.length === 3);
    expect(pending[2].args[0]).toBe(`${ORIGIN}/d`);

    pending[2].resolve();
    await waitFor(() => pending.length === 4);
    expect(pending[3].args[0]).toBe(`${ORIGIN}/b`);

    pending[3].resolve();
    await Promise.all([a, b, c, d]);
  });

  it("does not leak the priority hint to the core", async () => {
    const warnings = [];
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = queue(
      makeClient(fetchImpl, { logLevel: "warn", logger: { warn: (line) => warnings.push(line) } }),
      { maxConcurrent: 2 },
    );

    await client.get(`${ORIGIN}/x`, undefined, { priority: 3 });
    await client.request({ url: `${ORIGIN}/y`, priority: 1 });

    expect(warnings.join("\n")).not.toContain("priority");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("releases the slot when a request fails", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })));
    const client = queue(makeClient(fetchImpl), { maxConcurrent: 1 });

    await expect(client.get(`${ORIGIN}/a`)).rejects.toBeTruthy();
    expect(client.queue.active).toBe(0);
    await expect(client.get(`${ORIGIN}/b`)).rejects.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
