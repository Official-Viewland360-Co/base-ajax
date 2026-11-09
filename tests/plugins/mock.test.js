import { describe, expect, it } from "vitest";
import { mock } from "../../src/plugins/mock.js";
import { ORIGIN } from "../helpers.js";

const BASE = globalThis.BaseAjax;

function clientWith(handlers) {
  return BASE.createClient({
    transport: mock(handlers),
    origin: ORIGIN,
    logLevel: "silent",
  });
}

describe("plugin: mock", () => {
  it("returns the matched response body", async () => {
    const client = clientWith([
      { match: `${ORIGIN}/users/1`, response: { status: 200, body: { id: 1 } } },
    ]);
    await expect(client.get(`${ORIGIN}/users/1`)).resolves.toEqual({ id: 1 });
  });

  it("matches by regexp and predicate", async () => {
    const client = clientWith([
      { match: /\/users\/\d+$/, response: { body: { id: 42 } } },
    ]);
    await expect(client.get(`${ORIGIN}/users/42`)).resolves.toEqual({ id: 42 });

    const byPredicate = clientWith([
      { match: (req) => req.method === "POST", response: { body: { created: true } } },
    ]);
    await expect(byPredicate.post(`${ORIGIN}/users`, { name: "ada" })).resolves.toEqual({
      created: true,
    });
  });

  it("supports method-prefixed string matches", async () => {
    const client = clientWith([
      { match: `POST ${ORIGIN}/x`, response: { body: { ok: true } } },
    ]);
    await expect(client.post(`${ORIGIN}/x`, {})).resolves.toEqual({ ok: true });
    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({ status: 404 });
  });

  it("supports a function response and sees the request", async () => {
    const client = clientWith([
      {
        match: /.*/,
        response: (req) => ({ status: 201, body: { url: req.url, method: req.method } }),
      },
    ]);
    await expect(client.put(`${ORIGIN}/x?y=1`, { a: 1 })).resolves.toEqual({
      url: `${ORIGIN}/x?y=1`,
      method: "POST",
    });
  });

  it("falls back to a 404 error", async () => {
    const client = clientWith([]);
    await expect(client.get(`${ORIGIN}/x`)).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 404,
    });
  });

  it("returns a raw transport payload", async () => {
    const transport = mock([{ match: `${ORIGIN}/raw`, response: { body: "plain" } }]);
    const response = await transport({ url: `${ORIGIN}/raw`, method: "GET" });
    expect(response).toEqual({
      status: 200,
      statusText: "",
      headers: { "content-type": "application/json" },
      body: "plain",
    });
  });

  it("is independent from the network", async () => {
    const client = clientWith([{ match: /.*/, response: { body: { ok: true } } }]);
    const results = await Promise.all([
      client.get(`${ORIGIN}/a`),
      client.get(`${ORIGIN}/b`),
      client.get(`${ORIGIN}/c`),
    ]);
    expect(results).toHaveLength(3);
  });
});
