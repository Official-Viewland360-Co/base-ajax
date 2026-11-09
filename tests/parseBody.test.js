import { describe, expect, it } from "vitest";
import { jsonResponse, makeClient, textResponse } from "./helpers.js";

const client = (fetchImpl) => makeClient(fetchImpl);

describe("response parsing", () => {
  it("auto-parses JSON", async () => {
    const c = client(() => Promise.resolve(jsonResponse({ a: 1 })));
    await expect(c.get("https://a.test/x")).resolves.toEqual({ a: 1 });
  });

  it("returns text when responseType is text", async () => {
    const c = client(() => Promise.resolve(jsonResponse({ a: 1 })));
    await expect(c.get("https://a.test/x", undefined, { responseType: "text" })).resolves.toBe(
      '{"a":1}',
    );
  });

  it("returns null for an empty body", async () => {
    const c = client(() => Promise.resolve(new Response(null, { status: 200 })));
    await expect(c.get("https://a.test/x")).resolves.toBeNull();
  });

  it("returns null for 204", async () => {
    const c = client(() => Promise.resolve(new Response(null, { status: 204 })));
    await expect(c.get("https://a.test/x")).resolves.toBeNull();
  });

  it("strips a UTF-8 BOM", async () => {
    const c = client(() => Promise.resolve(textResponse('\uFEFF{"a":1}', 200, "application/json")));
    await expect(c.get("https://a.test/x")).resolves.toEqual({ a: 1 });
  });

  it("throws PARSE_ERROR on invalid JSON", async () => {
    const c = client(() => Promise.resolve(textResponse("not-json", 200, "application/json")));
    await expect(c.get("https://a.test/x")).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("uses the server error message", async () => {
    const c = client(() => Promise.resolve(jsonResponse({ error: "nope" }, 400)));
    await expect(c.get("https://a.test/x")).rejects.toMatchObject({
      message: "nope",
      status: 400,
      isHttp: true,
    });
  });

  it("honours a custom validateStatus", async () => {
    const c = client(() => Promise.resolve(jsonResponse({ a: 1 }, 404)));
    await expect(
      c.get("https://a.test/x", undefined, { validateStatus: (s) => s < 500 }),
    ).resolves.toEqual({ a: 1 });
  });

  it("returns the full response when fullResponse is true", async () => {
    const c = client(() => Promise.resolve(jsonResponse({ a: 1 }, 201)));
    const res = await c.get("https://a.test/x", undefined, { fullResponse: true });
    expect(res).toMatchObject({ data: { a: 1 }, status: 201, method: "GET", attempts: 1 });
    expect(res.url).toBe("https://a.test/x");
  });
});
