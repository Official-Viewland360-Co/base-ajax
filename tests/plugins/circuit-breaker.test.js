import { describe, expect, it, vi } from "vitest";
import { circuitBreaker, CircuitOpenError } from "../../src/plugins/circuit-breaker.js";
import { jsonResponse, makeClient, ORIGIN, sleep } from "../helpers.js";

const fail = () => Promise.resolve(new Response(null, { status: 500 }));
const pass = () => Promise.resolve(jsonResponse({ ok: true }));

describe("plugin: circuit-breaker", () => {
  it("trips after the failure threshold and short-circuits", async () => {
    const fetchImpl = vi.fn(fail);
    const client = circuitBreaker(makeClient(fetchImpl), {
      failureThreshold: 2,
      cooldownMs: 60_000,
    });

    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({ status: 500 });
    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({ status: 500 });
    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeInstanceOf(CircuitOpenError);

    expect(client.circuitBreaker.getState()).toBe("open");
    expect(client.circuitBreaker.getStats()).toMatchObject({ state: "open", failures: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("half-opens after the cooldown and closes after enough successes", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementationOnce(fail)
      .mockImplementationOnce(fail)
      .mockImplementation(pass);
    const client = circuitBreaker(makeClient(fetchImpl), {
      failureThreshold: 2,
      successThreshold: 1,
      cooldownMs: 5,
    });

    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeTruthy();
    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeTruthy();
    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(client.circuitBreaker.getState()).toBe("open");

    await sleep(20);
    await expect(client.get(`${ORIGIN}/x`)).resolves.toEqual({ ok: true });
    expect(client.circuitBreaker.getState()).toBe("closed");
  });

  it("stays open when the probe fails", async () => {
    const fetchImpl = vi.fn(fail);
    const client = circuitBreaker(makeClient(fetchImpl), {
      failureThreshold: 1,
      cooldownMs: 5,
    });

    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({ status: 500 });
    await sleep(20);
    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({ status: 500 });
    expect(client.circuitBreaker.getState()).toBe("open");
  });

  it("can be reset manually", async () => {
    const fetchImpl = vi.fn(fail);
    const client = circuitBreaker(makeClient(fetchImpl), { failureThreshold: 1 });
    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeTruthy();
    expect(client.circuitBreaker.getState()).toBe("open");

    client.circuitBreaker.reset();
    expect(client.circuitBreaker.getState()).toBe("closed");
  });

  it("does not count aborted requests by default", async () => {
    const fetchImpl = vi.fn(pass);
    const client = circuitBreaker(makeClient(fetchImpl), { failureThreshold: 1 });
    const controller = new AbortController();
    controller.abort();

    await expect(
      client.get(`${ORIGIN}/x`, undefined, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" });
    expect(client.circuitBreaker.getState()).toBe("closed");
  });

  it("honours shouldCount and the lifecycle callbacks", async () => {
    const events = [];
    const fetchImpl = vi.fn(fail);
    const client = circuitBreaker(makeClient(fetchImpl), {
      failureThreshold: 1,
      successThreshold: 1,
      shouldCount: () => true,
      onOpen: () => events.push("open"),
      onHalfOpen: () => events.push("half-open"),
      onClose: () => events.push("closed"),
      cooldownMs: 5,
    });

    await expect(client.get(`${ORIGIN}/x`)).rejects.toBeTruthy();
    expect(events).toEqual(["open"]);

    await sleep(20);
    fetchImpl.mockImplementation(pass);
    await client.get(`${ORIGIN}/x`);
    expect(events).toEqual(["open", "half-open", "closed"]);
  });
});
