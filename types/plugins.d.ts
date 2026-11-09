/**
 * Type definitions for the BaseAjax plugin layer (`base-ajax/plugins`).
 */
import type {
  BaseAjaxClient,
  RequestOptions,
  Response,
  TransportFunction,
  TransportRequest,
  TransportResponse,
} from "./baseAjax";

export type BreakerState = "closed" | "open" | "half-open";
export type Methods = string[];

/** Client returned by a plugin: the base client plus plugin-specific handles. */
export interface WrappedClient extends BaseAjaxClient {
  readonly inflightSize?: number;
  readonly cache?: CacheHandle;
  readonly circuitBreaker?: CircuitBreakerHandle;
  readonly queue?: QueueHandle;
}

export interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

export interface CacheHandle {
  key(cfg: Partial<RequestOptions>): string;
  clear(): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  get(key: string): CacheEntry | undefined;
  size(): number;
  keys(): string[];
}

export interface CircuitBreakerHandle {
  getState(): BreakerState;
  reset(): void;
  getStats(): { state: BreakerState; failures: number; openedAt: number };
}

export interface QueueHandle {
  readonly active: number;
  readonly pending: number;
  readonly maxConcurrent: number;
}

export declare class CircuitOpenError extends Error {
  readonly name: "CircuitOpenError";
  readonly code: "CIRCUIT_OPEN";
}

export type Plugin<P = any> = (client: BaseAjaxClient) => WrappedClient;

export interface DedupeOptions {
  methods?: Methods;
  keyFn?: (cfg: Partial<RequestOptions>) => string;
}

export interface CacheOptions {
  ttl?: number;
  staleWhileRevalidate?: boolean;
  methods?: Methods;
  keyFn?: (cfg: Partial<RequestOptions>) => string;
  store?: Map<string, CacheEntry>;
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  cooldownMs?: number;
  shouldCount?: (error: any) => boolean;
  onOpen?: (info: { failures: number }) => void;
  onClose?: (info: Record<string, never>) => void;
  onHalfOpen?: (info: Record<string, never>) => void;
}

export interface QueueOptions {
  maxConcurrent?: number;
}

export interface QueuedRequestOptions extends RequestOptions {
  /** Plugin-only hint: higher runs sooner. Stripped before the request is sent. */
  priority?: number;
}

export interface TraceOptions {
  headerName?: string;
  getTraceparent?: () => string;
  onTrace?: (value: string) => void;
  onInvalid?: (value: string) => void;
  validate?: boolean;
}

export interface MockRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status?: number;
  statusText?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface MockHandler {
  match: string | RegExp | ((req: MockRequest) => boolean);
  response: MockResponse | ((req: MockRequest) => MockResponse | Promise<MockResponse>);
}

export declare function wrapClient(
  client: BaseAjaxClient,
  middleware: (
    fn: (...args: any[]) => Promise<any>,
    method: string,
  ) => (...args: any[]) => Promise<any>,
  extra?: Record<string, unknown>,
): WrappedClient;

export declare function buildCfgFromArgs(
  method: string,
  args: unknown[],
): Partial<RequestOptions>;

export declare function optionIndex(method: string): number;
export declare function withOption(args: unknown[], index: number, value: unknown): unknown[];
export declare function stableStringify(value: unknown): string;

export declare function dedupe(client: BaseAjaxClient, options?: DedupeOptions): WrappedClient;
export declare function cache(client: BaseAjaxClient, options?: CacheOptions): WrappedClient;
export declare function circuitBreaker(
  client: BaseAjaxClient,
  options?: CircuitBreakerOptions,
): WrappedClient;
export declare function queue(client: BaseAjaxClient, options?: QueueOptions): WrappedClient;
export declare function trace(client: BaseAjaxClient, options?: TraceOptions): WrappedClient;
export declare function mock(handlers?: MockHandler[]): TransportFunction;
export declare function generateTraceparent(): string;

export declare function compose(
  client: BaseAjaxClient,
  ...plugins: Array<(client: BaseAjaxClient) => BaseAjaxClient>
): WrappedClient;

export type {
  BaseAjaxClient,
  RequestOptions,
  Response,
  TransportFunction,
  TransportRequest,
  TransportResponse,
};
