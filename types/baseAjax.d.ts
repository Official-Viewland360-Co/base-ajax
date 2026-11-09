/**
 * Type definitions for BaseAjax v2.0.0
 *
 * The runtime lives in `src/baseAjax.js` (a dependency-free UMD file).
 * This file mirrors its public surface exactly; keep them in sync.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
export type ResponseType = "auto" | "json" | "text" | "blob" | "arraybuffer";
export type TransportName = "auto" | "fetch" | "xhr" | "jquery";
export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type AuthMode = "none" | "cookie" | "memory" | "storage";
export type MethodOverrideMode = false | "header" | "body";
export type ErrorCode =
  | "HTTP_ERROR"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "ABORTED"
  | "PARSE_ERROR"
  | "INVALID_REQUEST"
  | "UNTRUSTED_ORIGIN";

export interface ProgressEventLike {
  loaded: number;
  total: number | null;
  lengthComputable: boolean;
}

export interface RetryPolicy {
  count?: number;
  delay?: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  methods?: string[];
  statuses?: number[];
  onTimeout?: boolean;
  onNetworkError?: boolean;
  respectRetryAfter?: boolean;
  maxRetryAfter?: number;
}

export interface LoggerSink {
  debug?(message: string): void;
  info?(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
  log?(message: string): void;
}

export interface AuthConfig {
  mode?: AuthMode;
  header?: string;
  scheme?: string;
  storage?: "local" | "session";
  storageKey?: string;
  storageArea?: Storage | null;
  getToken?: (() => string | null | undefined | Promise<string | null | undefined>) | null;
  setToken?: ((token: string | null) => void) | null;
  refresh?: ((client: BaseAjaxClient) => Promise<string | void>) | null;
  refreshUrl?: string | null;
  refreshMethod?: HttpMethod;
  tokenField?: string;
  onUnauthorized?: ((error: ApiError, client: BaseAjaxClient) => void | Promise<void>) | null;
}

export interface CsrfConfig {
  cookieName?: string;
  headerName?: string;
  metaName?: string;
}

export interface TransportRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: BodyInit | null;
  credentials: RequestCredentials;
  signal: AbortSignal;
  responseType: ResponseType;
  fetch?: typeof fetch | null;
  onUploadProgress?: (event: ProgressEventLike) => void;
  onDownloadProgress?: (event: ProgressEventLike) => void;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export type TransportFunction = (req: TransportRequest) => Promise<TransportResponse>;

export interface RequestOptions {
  url?: string | URL;
  method?: HttpMethod;
  data?: unknown;
  params?: unknown;
  signal?: AbortSignal;
  abortKey?: string;
  idempotencyKey?: string | boolean;
  contentType?: string;
  withAuth?: boolean;
  token?: string;
  credentials?: RequestCredentials;
  skipRefresh?: boolean;
  validateStatus?: (status: number) => boolean;
  onUploadProgress?: (event: ProgressEventLike) => void;
  onDownloadProgress?: (event: ProgressEventLike) => void;
  correlationId?: string;

  baseURL?: string;
  timeout?: number | null;
  headers?: Record<string, string | null>;
  responseType?: ResponseType;
  transport?: TransportName | TransportFunction;
  allowedOrigins?: string[];
  origin?: string | null;
  methodOverride?: MethodOverrideMode;
  methodOverrideHeader?: string;
  methodOverrideField?: string;
  methodOverrideMethods?: string[];
  xRequestedWith?: boolean;
  correlationHeader?: string | null;
  bustCache?: boolean;
  fullResponse?: boolean;
  logLevel?: LogLevel;
  logger?: LoggerSink | null;
  fetch?: typeof fetch | null;
  document?: Document | null;
  jquery?: unknown;
  retry?: RetryPolicy | number | false;
  auth?: AuthConfig;
  csrf?: CsrfConfig;

  /** @deprecated use responseType */
  dataType?: "json" | "text" | "html" | "xml" | "script" | "blob" | "arraybuffer";
  /** @deprecated use retry.count */
  retryCount?: number;
  /** @deprecated use retry.delay */
  retryDelay?: number;
  /** @deprecated use bustCache */
  cache?: boolean;
}

export interface Response<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  method: HttpMethod;
  correlationId: string;
  attempts: number;
}

export type Interceptor<T> = (value: T, job?: unknown) => T | void | Promise<T | void>;

export interface InterceptorStack<T> {
  use(fn: Interceptor<T>): number;
  eject(id: number): void;
  clear(): void;
  list(): Array<Interceptor<T>>;
}

export interface ApiErrorDetails {
  code?: ErrorCode;
  status?: number;
  statusText?: string;
  data?: unknown;
  headers?: Record<string, string>;
  url?: string;
  method?: string;
  correlationId?: string;
  attempts?: number;
  cause?: unknown;
}

export declare class ApiError extends Error {
  readonly name: "ApiError";
  readonly code: ErrorCode;
  readonly status: number;
  readonly statusText: string;
  readonly data: unknown;
  readonly response: unknown;
  readonly headers: Record<string, string>;
  readonly url?: string;
  readonly method?: string;
  readonly correlationId?: string;
  readonly attempts: number;
  readonly cause?: unknown;
  readonly isHttp: boolean;
  readonly isTimeout: boolean;
  readonly isNetwork: boolean;
  readonly isAborted: boolean;
  constructor(message: string, details?: ApiErrorDetails);
  toJSON(): Record<string, unknown>;
}

export interface BaseAjaxClient {
  request<T = unknown>(options: RequestOptions | string): Promise<T>;
  get<T = unknown>(url: string, params?: unknown, options?: RequestOptions): Promise<T>;
  head<T = unknown>(url: string, params?: unknown, options?: RequestOptions): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
  options<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
  callAPI<T = unknown>(
    url: string,
    method?: HttpMethod,
    data?: unknown,
    options?: RequestOptions,
    token?: string,
  ): Promise<T>;
  configure(options: RequestOptions): BaseAjaxClient;
  getConfig(): RequestOptions;
  setToken(token: string | null): void;
  getToken(): string | null | undefined | Promise<string | null | undefined>;
  clearToken(): void;
  readonly interceptors: {
    request: InterceptorStack<RequestOptions>;
    response: InterceptorStack<Response>;
    error: InterceptorStack<ApiError>;
  };
  create(options?: RequestOptions): BaseAjaxClient;
  readonly version: string;
}

export interface BaseAjaxGlobal extends BaseAjaxClient {
  createClient(options?: RequestOptions): BaseAjaxClient;
  readonly ApiError: typeof ApiError;
  isApiError(error: unknown): error is ApiError;
  readonly transports: {
    fetch: TransportFunction;
    xhr: TransportFunction;
    jquery: (jquery: unknown) => TransportFunction;
  };
  readonly CODES: {
    HTTP_ERROR: "HTTP_ERROR";
    TIMEOUT: "TIMEOUT";
    NETWORK_ERROR: "NETWORK_ERROR";
    ABORTED: "ABORTED";
    PARSE_ERROR: "PARSE_ERROR";
    INVALID_REQUEST: "INVALID_REQUEST";
    UNTRUSTED_ORIGIN: "UNTRUSTED_ORIGIN";
  };
  readonly VERSION: string;
}

declare const BaseAjax: BaseAjaxGlobal;
export default BaseAjax;

export declare const ApiError: typeof ApiError;
export declare function isApiError(error: unknown): error is ApiError;
export declare const transports: BaseAjaxGlobal["transports"];
export declare const CODES: BaseAjaxGlobal["CODES"];
export declare const VERSION: string;
export declare function createClient(options?: RequestOptions): BaseAjaxClient;

