import { describe, expect, it, vi } from "vitest";
import { generateTraceparent, trace } from "../../src/plugins/trace.js";
import { jsonResponse, makeClient, ORIGIN } from "../helpers.js";

const TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/;

function headersOf(fetchImpl, callIndex = 0) {
  return fetchImpl.mock.calls[callIndex][1].headers;
}

describe("plugin: trace", () => {
  it("injects a valid W3C traceparent", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = trace(makeClient(fetchImpl));

    await client.get(`${ORIGIN}/x`);
    expect(headersOf(fetchImpl).traceparent).toMatch(TRACEPARENT);
  });

  it("works for request(), verb shortcuts and OPTIONS", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = trace(makeClient(fetchImpl, { allowedOrigins: [ORIGIN] }));

    await client.request({ url: `${ORIGIN}/a` });
    await client.post(`${ORIGIN}/b`, { a: 1 });
    await client.options(`${ORIGIN}/c`);

    expect(headersOf(fetchImpl, 0).traceparent).toMatch(TRACEPARENT);
    expect(headersOf(fetchImpl, 1).traceparent).toMatch(TRACEPARENT);
    expect(headersOf(fetchImpl, 2).traceparent).toMatch(TRACEPARENT);
  });

  it("keeps an upstream traceparent instead of generating one", async () => {
    const upstream = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = trace(makeClient(fetchImpl), { getTraceparent: () => upstream });

    await client.get(`${ORIGIN}/x`);
    expect(headersOf(fetchImpl).traceparent).toBe(upstream);
  });

  it("does not overwrite a header provided by the caller", async () => {
    const explicit = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = trace(makeClient(fetchImpl));

    await client.get(`${ORIGIN}/x`, undefined, { headers: { Traceparent: explicit } });
    const headers = headersOf(fetchImpl);
    expect(headers.traceparent).toBe(explicit);
  });

  it("supports a custom header name and reports the value", async () => {
    const seen = [];
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const client = trace(makeClient(fetchImpl), {
      headerName: "x-trace-id",
      onTrace: (value) => seen.push(value),
    });

    await client.get(`${ORIGIN}/x`);
    expect(headersOf(fetchImpl)["x-trace-id"]).toBeTruthy();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(headersOf(fetchImpl)["x-trace-id"]);
  });

  it("does not mutate the base client interceptor stack", async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    const base = makeClient(fetchImpl);
    const client = trace(base);

    await client.get(`${ORIGIN}/x`);
    expect(base.interceptors.request.list()).toHaveLength(0);
  });

  it("generates unique values", () => {
    const values = new Set(Array.from({ length: 50 }, () => generateTraceparent()));
    expect(values.size).toBe(50);
    values.forEach((value) => expect(value).toMatch(TRACEPARENT));
  });
});
