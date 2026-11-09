import { describe, expectTypeOf, it } from "vitest";
import type {
  ApiError,
  BaseAjaxClient,
  ErrorCode,
  RequestOptions,
  TransportFunction,
  TransportName,
} from "../../types/baseAjax";
import type { CacheHandle, TraceOptions, WrappedClient } from "../../types/plugins";

describe("types", () => {
  it("client.get is generic", () => {
    const client = null as unknown as BaseAjaxClient;
    expectTypeOf(client.get<{ id: number }>("/x")).toEqualTypeOf<Promise<{ id: number }>>();
  });

  it("client.request accepts a string or options", () => {
    const client = null as unknown as BaseAjaxClient;
    expectTypeOf(client.request<number>("/x")).toEqualTypeOf<Promise<number>>();
    expectTypeOf(client.request<number>({ url: "/x", method: "GET" })).toEqualTypeOf<
      Promise<number>
    >();
  });

  it("ApiError exposes predicates and a code union", () => {
    const error = null as unknown as ApiError;
    expectTypeOf(error.isHttp).toEqualTypeOf<boolean>();
    expectTypeOf(error.isTimeout).toEqualTypeOf<boolean>();
    expectTypeOf(error.isNetwork).toEqualTypeOf<boolean>();
    expectTypeOf(error.isAborted).toEqualTypeOf<boolean>();
    expectTypeOf(error.code).toEqualTypeOf<ErrorCode>();
  });

  it("RequestOptions accepts transport names and custom transports", () => {
    const options: RequestOptions = { transport: "jquery" };
    expectTypeOf(options.transport).toEqualTypeOf<TransportName | TransportFunction | undefined>();

    const custom: RequestOptions = {
      transport: async () => ({ status: 200, statusText: "OK", headers: {}, body: null }),
    };
    expectTypeOf(custom.transport).toEqualTypeOf<TransportName | TransportFunction | undefined>();
  });

  it("plugins expose their handles on the wrapped client", () => {
    const client = null as unknown as WrappedClient;
    expectTypeOf(client.cache).toEqualTypeOf<CacheHandle | undefined>();
    expectTypeOf(client.queue?.active).toEqualTypeOf<number | undefined>();
    expectTypeOf(client.circuitBreaker?.getState()).toEqualTypeOf<
      "closed" | "open" | "half-open" | undefined
    >();
  });

  it("TraceOptions stays optional", () => {
    const options: TraceOptions = {};
    expectTypeOf(options.onTrace).toEqualTypeOf<((value: string) => void) | undefined>();
  });
});
