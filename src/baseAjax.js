/*!
 * BaseAjax v2.0.0
 * Dependency-free, secure HTTP client with fetch / XHR / jQuery transports.
 * Works as a <script> (window.BaseAjax), CommonJS and AMD module.
 * License: MIT
 */
(function (root, factory) {
  "use strict";
  var api = factory(root);
  // Publish on the root object in *every* module format so the ESM entry
  // (src/index.js) and bundlers always observe the same singleton through
  // `globalThis.BaseAjax`. Without this line a bundler that provides `module`
  // (CJS) would take the `module.exports` branch and the global would be unset.
  //
  // The existing object is either the extensible namespace Rollup creates for a
  // UMD bundle or the frozen core API (for example when the ESM entry is
  // imported before the combined CommonJS entry in the same process). Only the
  // former can receive the core API; merging into the frozen singleton would
  // throw in strict mode.
  if (
    root.BaseAjax &&
    root.BaseAjax !== api &&
    typeof root.BaseAjax === "object"
  ) {
    if (Object.isExtensible(root.BaseAjax)) Object.assign(root.BaseAjax, api);
  } else {
    root.BaseAjax = api;
  }
  if (typeof module === "object" && module && module.exports) {
    if (!Object.prototype.hasOwnProperty.call(module.exports, "__esModule")) {
      module.exports = api;
    }
  } else if (typeof define === "function" && define.amd) {
    define(function () {
      return api;
    });
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
        ? window
        : {},
  function (root) {
    "use strict";

    const VERSION = "2.0.0";

    /* ====================================================================
     * 1. Constants
     * ================================================================== */

    const ALLOWED_METHODS = Object.freeze([
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
    ]);
    const SAFE_METHODS = Object.freeze(["GET", "HEAD", "OPTIONS"]);
    const QUERY_METHODS = Object.freeze(["GET", "HEAD"]);
    const LOG_LEVELS = Object.freeze({
      debug: 10,
      info: 20,
      warn: 30,
      error: 40,
      silent: 100,
    });
    const RESPONSE_TYPES = Object.freeze([
      "auto",
      "json",
      "text",
      "blob",
      "arraybuffer",
    ]);
    const AUTH_MODES = Object.freeze(["none", "cookie", "memory", "storage"]);
    const OVERRIDE_MODES = Object.freeze([false, "header", "body"]);

    const CODES = Object.freeze({
      HTTP_ERROR: "HTTP_ERROR",
      TIMEOUT: "TIMEOUT",
      NETWORK_ERROR: "NETWORK_ERROR",
      ABORTED: "ABORTED",
      PARSE_ERROR: "PARSE_ERROR",
      INVALID_REQUEST: "INVALID_REQUEST",
      UNTRUSTED_ORIGIN: "UNTRUSTED_ORIGIN",
    });

    const SENSITIVE_KEY =
      /(pass(word)?|token|secret|authori[sz]ation|api[-_]?key|session|cookie|csrf|xsrf|signature|credential)/i;

    const STATUS_HINTS = Object.freeze({
      400: "Bad request",
      401: "Unauthorized - session expired or token invalid",
      403: "Forbidden - access denied",
      404: "Not found - resource does not exist",
      408: "Request timeout",
      409: "Conflict",
      413: "Payload too large",
      422: "Unprocessable entity",
      429: "Too many requests",
      500: "Server error",
      502: "Bad gateway",
      503: "Service unavailable",
      504: "Gateway timeout",
    });

    // Legacy jQuery-style `dataType` -> modern `responseType`.
    const DATA_TYPE_MAP = Object.freeze({
      json: "json",
      text: "text",
      html: "text",
      xml: "text",
      script: "text",
      blob: "blob",
      arraybuffer: "arraybuffer",
    });

    function deepFreeze(obj) {
      Object.getOwnPropertyNames(obj).forEach((key) => {
        const value = obj[key];
        if (
          value !== null &&
          typeof value === "object" &&
          !Object.isFrozen(value)
        ) {
          deepFreeze(value);
        }
      });
      return Object.freeze(obj);
    }

    const DEFAULTS = deepFreeze({
      baseURL: "",
      timeout: 12000, // ms per attempt; 0 / null / Infinity disables
      headers: {},
      responseType: "auto",
      transport: "auto", // "auto" | "fetch" | "xhr" | "jquery" | function
      allowedOrigins: [],
      origin: null, // auto-detected from location.origin
      methodOverride: "header", // false | "header" | "body"
      methodOverrideHeader: "X-HTTP-Method-Override",
      methodOverrideField: "_method",
      methodOverrideMethods: ["PUT", "PATCH", "DELETE"],
      xRequestedWith: true,
      correlationHeader: null, // e.g. "X-Request-Id"
      bustCache: false,
      fullResponse: false,
      logLevel: "warn",
      logger: null, // console-like sink: { debug, info, warn, error }
      fetch: null, // custom fetch (advanced / tests)
      document: null, // custom document (advanced / tests)
      jquery: null, // jQuery instance for transport "jquery"
      retry: {
        count: 0,
        delay: 1000,
        maxDelay: 30000,
        factor: 2,
        jitter: true,
        methods: ["GET", "HEAD", "OPTIONS"],
        statuses: [408, 425, 429, 500, 502, 503, 504],
        onTimeout: true,
        onNetworkError: true,
        respectRetryAfter: true,
        maxRetryAfter: 60000,
      },
      auth: {
        mode: "cookie", // "none" | "cookie" | "memory" | "storage"
        header: "Authorization",
        scheme: "Bearer",
        storage: "local", // "local" | "session" (mode "storage")
        storageKey: "token",
        storageArea: null, // custom Storage-like object (advanced / tests)
        getToken: null, // () => token | Promise<token>
        setToken: null, // (token) => void
        refresh: null, // async (client) => newToken | undefined
        refreshUrl: null,
        refreshMethod: "POST",
        tokenField: "accessToken",
        onUnauthorized: null, // (error, client) => void
      },
      csrf: {
        cookieName: "XSRF-TOKEN",
        headerName: "X-XSRF-TOKEN",
        metaName: "csrf-token",
      },
    });

    const REQUEST_KEYS = Object.freeze([
      "url",
      "method",
      "data",
      "params",
      "signal",
      "abortKey",
      "idempotencyKey",
      "contentType",
      "withAuth",
      "token",
      "credentials",
      "skipRefresh",
      "validateStatus",
      "onUploadProgress",
      "onDownloadProgress",
      "correlationId",
    ]);
    const LEGACY_KEYS = Object.freeze([
      "dataType",
      "retryCount",
      "retryDelay",
      "cache",
    ]);
    const KNOWN_KEYS = new Set([
      ...Object.keys(DEFAULTS),
      ...REQUEST_KEYS,
      ...LEGACY_KEYS,
    ]);
    const NESTED_KEYS = Object.freeze(["retry", "auth", "csrf"]);

    /* ====================================================================
     * 2. Small utilities
     * ================================================================== */

    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const isObject = (v) => v !== null && typeof v === "object";
    const upper = (v) => String(v).toUpperCase();

    function isPlainObject(v) {
      if (!isObject(v)) return false;
      const proto = Object.getPrototypeOf(v);
      return proto === Object.prototype || proto === null;
    }

    function isInstance(name, value) {
      return typeof root[name] === "function" && value instanceof root[name];
    }

    function isBinary(v) {
      return (
        isInstance("Blob", v) ||
        isInstance("ArrayBuffer", v) ||
        (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(v)) ||
        isInstance("ReadableStream", v)
      );
    }

    function uid() {
      const c = root.crypto;
      if (c && typeof c.randomUUID === "function") return c.randomUUID();
      if (c && typeof c.getRandomValues === "function") {
        return Array.from(c.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      }
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function compact(obj) {
      const out = {};
      Object.keys(obj || {}).forEach((key) => {
        if (obj[key] !== undefined) out[key] = obj[key];
      });
      return out;
    }

    function normalizeHeaders(input) {
      const out = {};
      if (!input) return out;
      if (typeof input.forEach === "function" && !isPlainObject(input)) {
        input.forEach((value, key) => {
          out[String(key).toLowerCase()] = String(value);
        });
        return out;
      }
      Object.keys(input).forEach((key) => {
        const value = input[key];
        out[key.toLowerCase()] =
          value === null || value === undefined ? null : String(value);
      });
      return out;
    }

    /** Case-insensitive merge. A `null` / `undefined` value removes a header. */
    function mergeHeaders(...sets) {
      const out = {};
      sets.forEach((set) => {
        const normalized = normalizeHeaders(set);
        Object.keys(normalized).forEach((key) => {
          if (normalized[key] === null) delete out[key];
          else out[key] = normalized[key];
        });
      });
      return out;
    }

    function mergeConfig(base, override) {
      const o = compact(override);
      const out = { ...base, ...o };
      NESTED_KEYS.forEach((key) => {
        if (isPlainObject(o[key]))
          out[key] = { ...base[key], ...compact(o[key]) };
      });
      out.headers = mergeHeaders(base.headers, o.headers);
      return out;
    }

    function toTimeout(value, fallback) {
      if (value === null || value === Infinity || value === 0) return 0;
      if (typeof value === "number" && Number.isFinite(value) && value > 0)
        return value;
      return fallback;
    }

    function toNumber(value, fallback, min) {
      return typeof value === "number" && Number.isFinite(value) && value >= min
        ? value
        : fallback;
    }

    function abortedError() {
      const error = new Error("Aborted");
      error.name = "AbortError";
      return error;
    }

    function sleep(ms, signal) {
      return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
          reject(abortedError());
          return;
        }
        let timer = null;
        const onAbort = () => {
          clearTimeout(timer);
          reject(abortedError());
        };
        timer = setTimeout(() => {
          if (signal) signal.removeEventListener("abort", onAbort);
          resolve();
        }, ms);
        if (signal) signal.addEventListener("abort", onAbort, { once: true });
      });
    }

    function linkSignals(signals) {
      const controller = new AbortController();
      const cleanups = [];
      const abort = () => controller.abort();
      signals.filter(Boolean).forEach((signal) => {
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener("abort", abort, { once: true });
          cleanups.push(() => signal.removeEventListener("abort", abort));
        }
      });
      return {
        signal: controller.signal,
        dispose: () => cleanups.forEach((fn) => fn()),
      };
    }

    function parseRawHeaders(raw) {
      const out = {};
      String(raw || "")
        .split(/\r?\n/)
        .forEach((line) => {
          const index = line.indexOf(":");
          if (index <= 0) return;
          const key = line.slice(0, index).trim().toLowerCase();
          const value = line.slice(index + 1).trim();
          out[key] = key in out ? `${out[key]}, ${value}` : value;
        });
      return out;
    }

    function parseRetryAfter(value) {
      if (value === undefined || value === null || value === "") return null;
      const seconds = Number(value);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
      const date = Date.parse(value);
      return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
    }

    function readCookie(cookieString, name) {
      if (typeof cookieString !== "string") return null;
      const parts = cookieString.split(";");
      for (let i = 0; i < parts.length; i += 1) {
        const index = parts[i].indexOf("=");
        if (index < 0) continue;
        if (parts[i].slice(0, index).trim() === name) {
          const raw = parts[i].slice(index + 1).trim();
          try {
            return decodeURIComponent(raw);
          } catch (e) {
            return raw;
          }
        }
      }
      return null;
    }

    /* ====================================================================
     * 3. Logging (structured JSON, with redaction)
     * ================================================================== */

    function redact(value, depth) {
      const level = depth || 0;
      if (value === null || typeof value !== "object") return value;
      if (level > 4) return "[Truncated]";
      if (value instanceof Error)
        return { name: value.name, message: value.message };
      if (Array.isArray(value))
        return value.slice(0, 20).map((v) => redact(v, level + 1));
      const out = {};
      Object.keys(value).forEach((key) => {
        out[key] = SENSITIVE_KEY.test(key)
          ? "[REDACTED]"
          : redact(value[key], level + 1);
      });
      return out;
    }

    function redactURL(input) {
      try {
        const url = new URL(input);
        Array.from(url.searchParams.keys()).forEach((key) => {
          if (SENSITIVE_KEY.test(key)) url.searchParams.set(key, "[REDACTED]");
        });
        url.username = "";
        url.password = "";
        url.hash = "";
        return url.toString().replace(/%5BREDACTED%5D/g, "[REDACTED]");
      } catch (e) {
        return String(input).split("?")[0];
      }
    }

    function createLogger(getConfig) {
      const emit = (level, message, meta) => {
        const cfg = getConfig();
        const threshold = hasOwn(LOG_LEVELS, cfg.logLevel)
          ? LOG_LEVELS[cfg.logLevel]
          : LOG_LEVELS.warn;
        if (LOG_LEVELS[level] < threshold) return;
        const sink = cfg.logger || root.console;
        if (!sink) return;
        const fn = typeof sink[level] === "function" ? sink[level] : sink.log;
        if (typeof fn !== "function") return;
        let line;
        try {
          line = JSON.stringify({
            level: level.toUpperCase(),
            message,
            ...redact(meta || {}),
          });
        } catch (e) {
          line = JSON.stringify({ level: level.toUpperCase(), message });
        }
        fn.call(sink, line);
      };
      return {
        debug: (m, meta) => emit("debug", m, meta),
        info: (m, meta) => emit("info", m, meta),
        warn: (m, meta) => emit("warn", m, meta),
        error: (m, meta) => emit("error", m, meta),
      };
    }

    /* ====================================================================
     * 4. ApiError
     * ================================================================== */

    class ApiError extends Error {
      constructor(message, details) {
        super(message);
        const d = details || {};
        this.name = "ApiError";
        this.code = d.code || CODES.HTTP_ERROR;
        this.status = d.status || 0;
        this.statusText = d.statusText || "";
        this.data = d.data === undefined ? null : d.data;
        this.response = this.data; // legacy alias (v1 exposed `response`)
        this.headers = d.headers || {};
        this.url = d.url;
        this.method = d.method;
        this.correlationId = d.correlationId;
        this.attempts = d.attempts || 1;
        if (d.cause !== undefined) this.cause = d.cause;
      }

      get isHttp() {
        return this.code === CODES.HTTP_ERROR;
      }
      get isTimeout() {
        return this.code === CODES.TIMEOUT;
      }
      get isNetwork() {
        return this.code === CODES.NETWORK_ERROR;
      }
      get isAborted() {
        return this.code === CODES.ABORTED;
      }

      toJSON() {
        return {
          name: this.name,
          message: this.message,
          code: this.code,
          status: this.status,
          statusText: this.statusText,
          url: this.url,
          method: this.method,
          correlationId: this.correlationId,
          attempts: this.attempts,
        };
      }
    }

    const isApiError = (e) => e instanceof ApiError;

    function errorContext(job, options) {
      if (job) {
        return {
          url: redactURL(job.url),
          method: job.method,
          correlationId: job.correlationId,
        };
      }
      const o = options || {};
      return {
        url: typeof o.url === "string" ? redactURL(o.url) : undefined,
        method: o.method ? upper(o.method) : undefined,
        correlationId: o.correlationId,
      };
    }

    function makeError(job, code, message, extra, options) {
      return new ApiError(message, {
        ...errorContext(job, options),
        code,
        ...extra,
      });
    }

    function extractMessage(data, fallback) {
      if (isPlainObject(data)) {
        if (typeof data.error === "string" && data.error) return data.error;
        if (isObject(data.error) && typeof data.error.message === "string") {
          return data.error.message;
        }
        if (typeof data.message === "string" && data.message)
          return data.message;
      } else if (
        typeof data === "string" &&
        data.length > 0 &&
        data.length <= 200 &&
        data.trim()[0] !== "<"
      ) {
        return data;
      }
      return fallback;
    }

    /* ====================================================================
     * 5. Body & query helpers
     * ================================================================== */

    function appendParams(searchParams, source) {
      if (source === null || source === undefined) return;
      if (isInstance("URLSearchParams", source)) {
        source.forEach((value, key) => searchParams.append(key, value));
        return;
      }
      if (typeof source === "string") {
        new URLSearchParams(source.replace(/^\?/, "")).forEach((value, key) =>
          searchParams.append(key, value),
        );
        return;
      }
      if (!isObject(source)) {
        throw new TypeError(
          "Query parameters must be an object, string or URLSearchParams",
        );
      }
      Object.keys(source).forEach((key) => {
        const value = source[key];
        const values = Array.isArray(value) ? value : [value];
        values.forEach((item) => {
          if (item === null || item === undefined) return;
          if (item instanceof Date)
            searchParams.append(key, item.toISOString());
          else if (isObject(item))
            searchParams.append(key, JSON.stringify(item));
          else searchParams.append(key, String(item));
        });
      });
    }

    /** Returns { body, contentType } - never mangles binary / form payloads. */
    function prepareBody(data) {
      if (data === null || data === undefined)
        return { body: null, contentType: null };
      if (
        isInstance("FormData", data) ||
        isInstance("URLSearchParams", data) ||
        isInstance("Blob", data) ||
        isBinary(data) ||
        typeof data === "string"
      ) {
        return { body: data, contentType: null };
      }
      if (typeof data === "function" || typeof data === "symbol") {
        throw new TypeError("Request data cannot be a function or symbol");
      }
      const json = JSON.stringify(data);
      return {
        body: json === undefined ? null : json,
        contentType: "application/json; charset=utf-8",
      };
    }

    function canOverrideBody(data) {
      return (
        data === null ||
        data === undefined ||
        isPlainObject(data) ||
        isInstance("FormData", data) ||
        isInstance("URLSearchParams", data)
      );
    }

    /** Copies the payload (never mutates the caller's object) and adds the override field. */
    function applyBodyOverride(data, method, field) {
      if (isInstance("FormData", data)) {
        const copy = new FormData();
        data.forEach((value, key) => copy.append(key, value));
        copy.set(field, method);
        return copy;
      }
      if (isInstance("URLSearchParams", data)) {
        const copy = new URLSearchParams(data);
        copy.set(field, method);
        return copy;
      }
      return { ...(data || {}), [field]: method };
    }

    function parseBody(raw, responseType, contentType) {
      if (raw === null || raw === undefined) return null;
      if (responseType === "blob" || responseType === "arraybuffer") return raw;
      const text = String(raw).replace(/^\uFEFF/, "");
      if (text === "") return null;
      const wantsJson =
        responseType === "json" ||
        (responseType === "auto" && /json/i.test(contentType || ""));
      return wantsJson ? JSON.parse(text) : text;
    }

    function parseBodyLenient(raw, responseType, contentType) {
      try {
        return parseBody(raw, responseType, contentType);
      } catch (e) {
        return typeof raw === "string" ? raw : null;
      }
    }

    /* ====================================================================
     * 6. Transports
     *    Contract: (req) => Promise<{ status, statusText, headers, body }>
     *    Resolve for ANY http status; reject only for network / abort.
     * ================================================================== */

    async function fetchTransport(req) {
      const fetchImpl = req.fetch || root.fetch;
      if (typeof fetchImpl !== "function") {
        const error = new TypeError(
          "fetch is not available in this environment",
        );
        error.baseAjaxCode = "UNSUPPORTED";
        throw error;
      }
      const res = await fetchImpl.call(root, req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body === null ? undefined : req.body,
        credentials: req.credentials,
        signal: req.signal,
        redirect: "follow",
      });
      let body = null;
      if (req.method !== "HEAD") {
        if (req.responseType === "blob") body = await res.blob();
        else if (req.responseType === "arraybuffer")
          body = await res.arrayBuffer();
        else body = await res.text();
      }
      const headers = {};
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      return { status: res.status, statusText: res.statusText, headers, body };
    }

    function xhrTransport(req) {
      return new Promise((resolve, reject) => {
        const XHR = root.XMLHttpRequest;
        if (typeof XHR !== "function") {
          const error = new TypeError("XMLHttpRequest is not available");
          error.baseAjaxCode = "UNSUPPORTED";
          reject(error);
          return;
        }
        const xhr = new XHR();
        let settled = false;
        const binary =
          req.responseType === "blob" || req.responseType === "arraybuffer";

        const finish = (fn, value) => {
          if (settled) return;
          settled = true;
          if (req.signal) req.signal.removeEventListener("abort", onAbort);
          fn(value);
        };
        const onAbort = () => {
          try {
            xhr.abort();
          } catch (e) {
            /* ignore */
          }
          finish(reject, abortedError());
        };
        const emitProgress = (callback, event) => {
          if (typeof callback !== "function") return;
          try {
            callback({
              loaded: event.loaded,
              total: event.lengthComputable ? event.total : null,
              lengthComputable: Boolean(event.lengthComputable),
            });
          } catch (e) {
            /* never let a progress callback break the request */
          }
        };

        xhr.open(req.method, req.url, true);
        xhr.withCredentials = req.credentials === "include";
        if (binary) xhr.responseType = req.responseType;
        Object.keys(req.headers).forEach((key) =>
          xhr.setRequestHeader(key, req.headers[key]),
        );

        xhr.onload = () =>
          finish(resolve, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseRawHeaders(xhr.getAllResponseHeaders()),
            body:
              req.method === "HEAD"
                ? null
                : binary
                  ? xhr.response
                  : xhr.responseText,
          });
        xhr.onerror = () =>
          finish(reject, new TypeError("Network request failed"));
        xhr.onabort = () => finish(reject, abortedError());
        if (xhr.upload && req.onUploadProgress) {
          xhr.upload.onprogress = (e) => emitProgress(req.onUploadProgress, e);
        }
        if (req.onDownloadProgress) {
          xhr.onprogress = (e) => emitProgress(req.onDownloadProgress, e);
        }

        if (req.signal) {
          if (req.signal.aborted) {
            onAbort();
            return;
          }
          req.signal.addEventListener("abort", onAbort, { once: true });
        }
        xhr.send(req.body === null ? null : req.body);
      });
    }

    /** Adapter for legacy projects: routes requests through an existing jQuery. */
    function createJqueryTransport($) {
      return function jqueryTransport(req) {
        return new Promise((resolve, reject) => {
          if (
            req.responseType === "blob" ||
            req.responseType === "arraybuffer"
          ) {
            const error = new TypeError(
              'The jQuery transport does not support binary responses; use transport "fetch"',
            );
            error.baseAjaxCode = "UNSUPPORTED";
            reject(error);
            return;
          }
          const jq = $.ajax({
            url: req.url,
            type: req.method,
            data: req.body === null ? undefined : req.body,
            processData: false,
            contentType: false,
            dataType: "text",
            headers: req.headers,
            cache: true,
            global: false,
            timeout: 0,
            xhrFields: { withCredentials: req.credentials === "include" },
          });
          const onAbort = () => jq.abort();
          const cleanup = () => {
            if (req.signal) req.signal.removeEventListener("abort", onAbort);
          };
          const toRaw = (xhr) => ({
            status: xhr.status,
            statusText: xhr.statusText,
            headers: parseRawHeaders(xhr.getAllResponseHeaders()),
            body: req.method === "HEAD" ? null : xhr.responseText,
          });
          jq.done((data, textStatus, xhr) => {
            cleanup();
            resolve(toRaw(xhr));
          }).fail((xhr, textStatus) => {
            cleanup();
            if (textStatus === "abort") reject(abortedError());
            else if (!xhr.status)
              reject(new TypeError("Network request failed"));
            else resolve(toRaw(xhr));
          });
          if (req.signal) {
            if (req.signal.aborted) onAbort();
            else req.signal.addEventListener("abort", onAbort, { once: true });
          }
        });
      };
    }

    const transports = Object.freeze({
      fetch: fetchTransport,
      xhr: xhrTransport,
      jquery: createJqueryTransport,
    });

    /* ====================================================================
     * 7. Client factory
     * ================================================================== */

    function createInterceptorStack() {
      const handlers = [];
      return Object.freeze({
        use(fn) {
          if (typeof fn !== "function")
            throw new TypeError("Interceptor must be a function");
          handlers.push(fn);
          return handlers.length - 1;
        },
        eject(id) {
          if (handlers[id]) handlers[id] = null;
        },
        clear() {
          handlers.length = 0;
        },
        list() {
          return handlers.filter(Boolean);
        },
      });
    }

    function normalizeLegacy(options) {
      const o = { ...(options || {}) };
      if (o.dataType !== undefined && o.responseType === undefined) {
        o.responseType =
          DATA_TYPE_MAP[String(o.dataType).toLowerCase()] || "auto";
      }
      delete o.dataType;

      if (typeof o.retry === "number") o.retry = { count: o.retry };
      else if (o.retry === false) o.retry = { count: 0 };
      if (o.retryCount !== undefined)
        o.retry = {
          ...(isPlainObject(o.retry) ? o.retry : {}),
          count: o.retryCount,
        };
      if (o.retryDelay !== undefined)
        o.retry = {
          ...(isPlainObject(o.retry) ? o.retry : {}),
          delay: o.retryDelay,
        };
      delete o.retryCount;
      delete o.retryDelay;

      if (o.cache === false && o.bustCache === undefined) o.bustCache = true;
      delete o.cache;
      return o;
    }

    function checkEnums(settings, fail) {
      if (!RESPONSE_TYPES.includes(settings.responseType)) {
        fail(`Unsupported responseType "${settings.responseType}"`);
      }
      if (!OVERRIDE_MODES.includes(settings.methodOverride)) {
        fail(`Unsupported methodOverride "${settings.methodOverride}"`);
      }
      if (!hasOwn(LOG_LEVELS, settings.logLevel)) {
        fail(`Unsupported logLevel "${settings.logLevel}"`);
      }
      if (
        !isPlainObject(settings.auth) ||
        !AUTH_MODES.includes(settings.auth.mode)
      ) {
        fail(`Unsupported auth.mode "${settings.auth && settings.auth.mode}"`);
      }
    }

    function createClient(initialOptions) {
      let config = mergeConfig(DEFAULTS, normalizeLegacy(initialOptions));
      checkEnums(config, (message) => {
        throw new RangeError(message);
      });

      let memoryToken = null;
      let refreshPromise = null;
      let warnedStorage = false;
      const warnedUnknown = new Set();
      const inflight = new Map();
      const requestInterceptors = createInterceptorStack();
      const responseInterceptors = createInterceptorStack();
      const errorInterceptors = createInterceptorStack();
      const log = createLogger(() => config);

      function warnUnknown(options) {
        Object.keys(options).forEach((key) => {
          if (!KNOWN_KEYS.has(key) && !warnedUnknown.has(key)) {
            warnedUnknown.add(key);
            log.warn(`Unknown option "${key}" was ignored`, { option: key });
          }
        });
      }

      function warnStorageMode() {
        if (config.auth.mode === "storage" && !warnedStorage) {
          warnedStorage = true;
          log.warn(
            'auth.mode "storage" keeps the token readable by any script on the page (XSS risk). ' +
              'Prefer "cookie" (HttpOnly) or "memory".',
          );
        }
      }
      warnStorageMode();

      /* ---------------- token handling ---------------- */

      function storageArea(auth) {
        if (auth.storageArea) return auth.storageArea;
        try {
          return auth.storage === "session"
            ? root.sessionStorage
            : root.localStorage;
        } catch (e) {
          return null;
        }
      }

      function readToken(auth) {
        if (typeof auth.getToken === "function") return auth.getToken();
        if (auth.mode === "memory") return memoryToken;
        if (auth.mode === "storage") {
          const area = storageArea(auth);
          try {
            return area ? area.getItem(auth.storageKey) : null;
          } catch (e) {
            return null;
          }
        }
        return null;
      }

      function storeToken(token) {
        const auth = config.auth;
        if (typeof auth.setToken === "function") {
          auth.setToken(token || null);
          return;
        }
        if (auth.mode === "storage") {
          const area = storageArea(auth);
          if (!area) {
            log.warn("Token storage is not available");
            return;
          }
          try {
            if (token) area.setItem(auth.storageKey, token);
            else area.removeItem(auth.storageKey);
          } catch (e) {
            log.warn("Could not persist token", { message: e && e.message });
          }
          return;
        }
        if (auth.mode === "memory") {
          memoryToken = token || null;
          return;
        }
        log.warn(`setToken() has no effect when auth.mode is "${auth.mode}"`);
      }

      async function resolveToken(job) {
        if (job.token) return job.token;
        if (job.withAuth === false) return null;
        const token = await readToken(job.settings.auth);
        if (!token && job.withAuth === true) {
          log.warn("withAuth was requested but no token is available", {
            correlationId: job.correlationId,
          });
        }
        return token || null;
      }

      function canRefresh() {
        const auth = config.auth;
        return typeof auth.refresh === "function" || Boolean(auth.refreshUrl);
      }

      function refreshAccess() {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const auth = config.auth;
            let token;
            if (typeof auth.refresh === "function") {
              token = await auth.refresh(client);
            } else {
              const res = await client.request({
                url: auth.refreshUrl,
                method: auth.refreshMethod,
                withAuth: false,
                skipRefresh: true,
                retry: { count: 0 },
                responseType: "json",
              });
              token =
                typeof res === "string"
                  ? res
                  : isObject(res)
                    ? res[auth.tokenField]
                    : undefined;
            }
            if (typeof token === "string" && token) storeToken(token);
          })().finally(() => {
            refreshPromise = null;
          });
        }
        return refreshPromise;
      }

      async function notifyUnauthorized(error) {
        const callback = config.auth.onUnauthorized;
        if (typeof callback !== "function") return;
        try {
          await callback(error, client);
        } catch (e) {
          log.error("auth:onUnauthorized failed", { message: e && e.message });
        }
      }

      function readCsrfToken(settings) {
        const csrf = settings.csrf;
        if (!csrf) return null;
        const doc = settings.document || root.document;
        if (!doc) return null;
        if (csrf.cookieName) {
          let cookies = null;
          try {
            cookies = doc.cookie;
          } catch (e) {
            cookies = null;
          }
          const value = readCookie(cookies, csrf.cookieName);
          if (value) return value;
        }
        if (
          csrf.metaName &&
          /^[\w.:-]+$/.test(csrf.metaName) &&
          typeof doc.querySelector === "function"
        ) {
          const meta = doc.querySelector(`meta[name="${csrf.metaName}"]`);
          const value = meta && meta.getAttribute("content");
          if (value) return value;
        }
        return null;
      }

      /* ---------------- URL & trust ---------------- */

      function detectOrigin(settings) {
        if (settings.origin) return settings.origin;
        try {
          const origin = root.location && root.location.origin;
          return origin && origin !== "null" ? origin : null;
        } catch (e) {
          return null;
        }
      }

      function resolveURL(input, settings, fail) {
        let target = input;
        if (settings.baseURL && !/^([a-z][a-z\d+\-.]*:|\/\/)/i.test(input)) {
          target = `${String(settings.baseURL).replace(/\/+$/, "")}/${input.replace(/^\/+/, "")}`;
        }
        let url;
        try {
          url = new URL(target, detectOrigin(settings) || undefined);
        } catch (e) {
          fail(`Cannot resolve URL "${redactURL(input)}"`, e);
        }
        if (!/^https?:$/.test(url.protocol)) {
          fail(`Unsupported URL protocol "${url.protocol}"`);
        }
        url.hash = "";
        return url;
      }

      function trustedOrigins(settings) {
        const origins = new Set();
        const page = detectOrigin(settings);
        if (page) origins.add(page);
        if (settings.baseURL) {
          try {
            origins.add(new URL(settings.baseURL, page || undefined).origin);
          } catch (e) {
            /* invalid baseURL is reported when resolving */
          }
        }
        (settings.allowedOrigins || []).forEach((entry) => {
          try {
            origins.add(new URL(entry).origin);
          } catch (e) {
            log.warn("Ignoring invalid allowedOrigins entry", {
              entry: String(entry),
            });
          }
        });
        return origins;
      }

      /* ---------------- building a job ---------------- */

      async function buildJob(rawOptions) {
        const options = normalizeLegacy(rawOptions);
        warnUnknown(options);
        let settings = mergeConfig(config, options);

        for (const fn of requestInterceptors.list()) {
          const out = await fn(settings);
          if (out !== undefined) settings = out;
          if (!isObject(settings)) {
            throw new TypeError(
              "A request interceptor must return the request config",
            );
          }
        }

        const fail = (message, cause) => {
          throw makeError(
            null,
            CODES.INVALID_REQUEST,
            message,
            { cause },
            settings,
          );
        };
        checkEnums(settings, fail);

        const urlInput = isInstance("URL", settings.url)
          ? settings.url.href
          : settings.url;
        if (typeof urlInput !== "string" || !urlInput.trim())
          fail("URL is required");
        const method = upper(settings.method || "GET");
        if (!ALLOWED_METHODS.includes(method))
          fail(`HTTP method "${settings.method}" is not allowed`);

        const target = resolveURL(urlInput.trim(), settings, fail);
        const trusted = trustedOrigins(settings).has(target.origin);
        if (!trusted && (settings.token || settings.withAuth === true)) {
          throw makeError(
            null,
            CODES.UNTRUSTED_ORIGIN,
            `Refusing to send credentials to untrusted origin ${target.origin}. ` +
              "Add it to allowedOrigins if this is intended.",
            {},
            settings,
          );
        }

        const headers = mergeHeaders(settings.headers);
        if (!headers.accept)
          headers.accept = "application/json, text/plain, */*";

        // method override (only towards our own, trusted servers)
        let data = settings.data;
        let wireMethod = method;
        let overrideHeader = null;
        const overridable = (settings.methodOverrideMethods || []).map(upper);
        if (
          trusted &&
          settings.methodOverride &&
          overridable.includes(method)
        ) {
          wireMethod = "POST";
          if (settings.methodOverride === "body" && canOverrideBody(data)) {
            data = applyBodyOverride(
              data,
              method,
              settings.methodOverrideField,
            );
          } else {
            overrideHeader = settings.methodOverrideHeader;
          }
        }

        // query string & body
        let body = null;
        let autoContentType = null;
        try {
          appendParams(target.searchParams, settings.params);
          if (QUERY_METHODS.includes(method)) {
            appendParams(target.searchParams, data);
          } else {
            const prepared = prepareBody(data);
            body = prepared.body;
            autoContentType = prepared.contentType;
          }
        } catch (e) {
          fail(e.message, e);
        }
        if (settings.bustCache && QUERY_METHODS.includes(method)) {
          target.searchParams.set("_", String(Date.now()));
        }

        if (settings.contentType)
          headers["content-type"] = settings.contentType;
        else if (body !== null && autoContentType && !headers["content-type"]) {
          headers["content-type"] = autoContentType;
        }
        if (isInstance("FormData", body)) delete headers["content-type"]; // browser sets the boundary

        let idempotencyKey = settings.idempotencyKey;
        if (idempotencyKey === true) idempotencyKey = uid();
        if (typeof idempotencyKey === "string" && idempotencyKey) {
          headers["idempotency-key"] = idempotencyKey;
        }

        const correlationId = settings.correlationId || uid();
        if (settings.correlationHeader && trusted) {
          headers[String(settings.correlationHeader).toLowerCase()] =
            correlationId;
        }

        const policy = {
          ...DEFAULTS.retry,
          ...(isPlainObject(settings.retry) ? settings.retry : {}),
        };
        policy.count = Math.floor(toNumber(policy.count, 0, 0));
        policy.delay = toNumber(policy.delay, DEFAULTS.retry.delay, 0);
        policy.maxDelay = toNumber(policy.maxDelay, DEFAULTS.retry.maxDelay, 0);
        policy.maxRetryAfter = toNumber(
          policy.maxRetryAfter,
          DEFAULTS.retry.maxRetryAfter,
          0,
        );
        policy.factor = toNumber(policy.factor, DEFAULTS.retry.factor, 1);
        policy.methods = (
          Array.isArray(policy.methods) ? policy.methods : []
        ).map(upper);
        policy.statuses = Array.isArray(policy.statuses) ? policy.statuses : [];

        return {
          settings,
          correlationId,
          url: target.toString(),
          method,
          wireMethod,
          overrideHeader,
          headers,
          body,
          trusted,
          timeout: toTimeout(settings.timeout, DEFAULTS.timeout),
          retry: policy,
          hasIdempotencyKey: Boolean(headers["idempotency-key"]),
          responseType: settings.responseType,
          signal: settings.signal || null,
          abortKey: settings.abortKey || null,
          withAuth: settings.withAuth,
          token: settings.token || null,
          credentials: settings.credentials || (trusted ? "include" : "omit"),
          fullResponse: Boolean(settings.fullResponse),
          skipRefresh: Boolean(settings.skipRefresh),
          validateStatus:
            typeof settings.validateStatus === "function"
              ? settings.validateStatus
              : (status) => status >= 200 && status < 300,
          onUploadProgress: settings.onUploadProgress,
          onDownloadProgress: settings.onDownloadProgress,
        };
      }

      /* ---------------- dispatching ---------------- */

      function resolveTransport(job) {
        const choice = job.settings.transport;
        if (typeof choice === "function") return choice;
        if (choice === "fetch") return fetchTransport;
        if (choice === "xhr") return xhrTransport;
        if (choice === "jquery") {
          const $ = job.settings.jquery || root.jQuery;
          if (!$ || typeof $.ajax !== "function") {
            throw makeError(
              job,
              CODES.INVALID_REQUEST,
              'jQuery was not found for transport "jquery"',
            );
          }
          return createJqueryTransport($);
        }
        const wantsProgress = job.onUploadProgress || job.onDownloadProgress;
        if (wantsProgress && typeof root.XMLHttpRequest === "function")
          return xhrTransport;
        if (typeof (job.settings.fetch || root.fetch) === "function")
          return fetchTransport;
        if (typeof root.XMLHttpRequest === "function") return xhrTransport;
        throw makeError(
          job,
          CODES.INVALID_REQUEST,
          "No HTTP transport is available",
        );
      }

      async function buildHeaders(job) {
        const headers = { ...job.headers };
        const settings = job.settings;
        if (job.trusted) {
          if (settings.xRequestedWith && !headers["x-requested-with"]) {
            headers["x-requested-with"] = "XMLHttpRequest";
          }
          const token = await resolveToken(job);
          if (token) {
            const auth = settings.auth;
            headers[String(auth.header).toLowerCase()] = auth.scheme
              ? `${auth.scheme} ${token}`
              : token;
          }
          if (settings.csrf && !SAFE_METHODS.includes(job.method)) {
            const csrfName = String(
              settings.csrf.headerName || "",
            ).toLowerCase();
            if (csrfName && !headers[csrfName]) {
              const csrfToken = readCsrfToken(settings);
              if (csrfToken) headers[csrfName] = csrfToken;
            }
          }
        }
        if (job.overrideHeader)
          headers[String(job.overrideHeader).toLowerCase()] = job.method;
        return headers;
      }

      async function dispatchOnce(job) {
        const state = { timedOut: false, aborted: false };
        const controller = new AbortController();
        let timer = null;
        const onUserAbort = () => {
          state.aborted = true;
          controller.abort();
        };

        if (job.signal) {
          if (job.signal.aborted) {
            throw makeError(job, CODES.ABORTED, "Request aborted");
          }
          job.signal.addEventListener("abort", onUserAbort, { once: true });
        }
        if (job.timeout > 0) {
          timer = setTimeout(() => {
            state.timedOut = true;
            controller.abort();
          }, job.timeout);
        }

        try {
          const headers = await buildHeaders(job);
          const transport = resolveTransport(job);
          return await transport({
            url: job.url,
            method: job.wireMethod,
            headers,
            body:
              job.method === job.wireMethod &&
              QUERY_METHODS.includes(job.method)
                ? null
                : job.body,
            credentials: job.credentials,
            signal: controller.signal,
            responseType: job.responseType,
            fetch: job.settings.fetch,
            onUploadProgress: job.onUploadProgress,
            onDownloadProgress: job.onDownloadProgress,
          });
        } catch (err) {
          if (err instanceof ApiError) throw err;
          if (state.timedOut) {
            throw makeError(
              job,
              CODES.TIMEOUT,
              `Request timed out after ${job.timeout}ms`,
              { cause: err },
            );
          }
          if (state.aborted || (err && err.name === "AbortError")) {
            throw makeError(job, CODES.ABORTED, "Request aborted", {
              cause: err,
            });
          }
          if (err && err.baseAjaxCode === "UNSUPPORTED") {
            throw makeError(job, CODES.INVALID_REQUEST, err.message, {
              cause: err,
            });
          }
          throw makeError(job, CODES.NETWORK_ERROR, "Network error", {
            cause: err,
          });
        } finally {
          clearTimeout(timer);
          if (job.signal) job.signal.removeEventListener("abort", onUserAbort);
        }
      }

      function buildResponse(job, raw, attempt) {
        const headers = raw.headers || {};
        const contentType = headers["content-type"] || "";
        const noBody = raw.status === 204 || raw.status === 205;
        const rawBody = noBody ? null : raw.body;

        if (!job.validateStatus(raw.status)) {
          const data = parseBodyLenient(rawBody, job.responseType, contentType);
          throw makeError(
            job,
            CODES.HTTP_ERROR,
            extractMessage(
              data,
              STATUS_HINTS[raw.status] || `HTTP error ${raw.status}`,
            ),
            {
              status: raw.status,
              statusText: raw.statusText,
              data,
              headers,
              attempts: attempt,
            },
          );
        }

        let data;
        try {
          data = parseBody(rawBody, job.responseType, contentType);
        } catch (cause) {
          throw makeError(
            job,
            CODES.PARSE_ERROR,
            "Response body is not valid JSON",
            {
              status: raw.status,
              statusText: raw.statusText,
              headers,
              attempts: attempt,
              cause,
            },
          );
        }
        return {
          data,
          status: raw.status,
          statusText: raw.statusText,
          headers,
          url: job.url,
          method: job.method,
          correlationId: job.correlationId,
          attempts: attempt,
        };
      }

      function retryDelay(job, error, attempt) {
        const policy = job.retry;
        if (attempt > policy.count) return null;
        if (!(error.isTimeout || error.isNetwork || error.isHttp)) return null;
        if (!policy.methods.includes(job.method) && !job.hasIdempotencyKey)
          return null;
        if (error.isTimeout && !policy.onTimeout) return null;
        if (error.isNetwork && !policy.onNetworkError) return null;
        if (error.isHttp && !policy.statuses.includes(error.status))
          return null;

        let wait = Math.min(
          policy.maxDelay,
          policy.delay * Math.pow(policy.factor, attempt - 1),
        );
        if (policy.jitter) wait = wait / 2 + (Math.random() * wait) / 2;
        if (policy.respectRetryAfter && error.isHttp) {
          const retryAfter = parseRetryAfter(error.headers["retry-after"]);
          if (retryAfter !== null) {
            if (retryAfter > policy.maxRetryAfter) return null;
            wait = Math.max(wait, retryAfter);
          }
        }
        return Math.round(wait);
      }

      async function sendWithRetry(job) {
        for (let attempt = 1; ; attempt += 1) {
          let failure;
          try {
            const raw = await dispatchOnce(job);
            return buildResponse(job, raw, attempt);
          } catch (e) {
            failure =
              e instanceof ApiError
                ? e
                : makeError(
                    job,
                    CODES.NETWORK_ERROR,
                    (e && e.message) || "Request failed",
                    { cause: e },
                  );
          }
          failure.attempts = attempt;
          const wait = retryDelay(job, failure, attempt);
          if (wait === null) throw failure;
          log.warn("request:retry", {
            correlationId: job.correlationId,
            attempt,
            maxRetries: job.retry.count,
            code: failure.code,
            status: failure.status,
            delayMs: wait,
          });
          try {
            await sleep(wait, job.signal);
          } catch (e) {
            throw makeError(job, CODES.ABORTED, "Request aborted", {
              cause: e,
              attempts: attempt,
            });
          }
        }
      }

      async function run(job) {
        let refreshed = false;
        for (;;) {
          try {
            return await sendWithRetry(job);
          } catch (error) {
            const unauthorized =
              error instanceof ApiError &&
              error.status === 401 &&
              !job.skipRefresh;
            if (unauthorized && !refreshed && canRefresh()) {
              refreshed = true;
              try {
                await refreshAccess();
              } catch (refreshError) {
                log.warn("auth:refresh failed", {
                  correlationId: job.correlationId,
                  message: refreshError && refreshError.message,
                });
                error.refreshFailed = true;
                await notifyUnauthorized(error);
                throw error;
              }
              continue;
            }
            if (unauthorized) await notifyUnauthorized(error);
            throw error;
          }
        }
      }

      function registerAbortKey(job) {
        const key = job.abortKey;
        const previous = inflight.get(key);
        if (previous) previous.abort();
        const controller = new AbortController();
        inflight.set(key, controller);
        const link = linkSignals([job.signal, controller.signal]);
        job.signal = link.signal;
        return {
          dispose() {
            link.dispose();
            if (inflight.get(key) === controller) inflight.delete(key);
          },
        };
      }

      async function applyErrorInterceptors(error, job) {
        let current = error;
        const list = errorInterceptors.list();
        for (let i = 0; i < list.length; i += 1) {
          try {
            const out = await list[i](current, job);
            if (out === undefined) continue;
            if (out instanceof Error) current = out;
            else return { recovered: true, value: out };
          } catch (thrown) {
            if (thrown instanceof Error) current = thrown;
          }
        }
        return { recovered: false, error: current };
      }

      async function execute(input) {
        const options =
          typeof input === "string" ? { url: input } : input || {};
        const startedAt = Date.now();
        let job = null;
        let linked = null;
        try {
          job = await buildJob(options);
          if (job.abortKey) linked = registerAbortKey(job);
          log.info("request:start", {
            correlationId: job.correlationId,
            method: job.method,
            url: redactURL(job.url),
          });
          let response = await run(job);
          const list = responseInterceptors.list();
          for (let i = 0; i < list.length; i += 1) {
            const out = await list[i](response, job);
            if (out !== undefined) response = out;
          }
          log.info("request:success", {
            correlationId: job.correlationId,
            method: job.method,
            url: redactURL(job.url),
            status: response.status,
            attempts: response.attempts,
            durationMs: Date.now() - startedAt,
          });
          return job.fullResponse ? response : response.data;
        } catch (e) {
          const error =
            e instanceof ApiError
              ? e
              : makeError(
                  job,
                  CODES.INVALID_REQUEST,
                  (e && e.message) || "Request failed",
                  { cause: e },
                  options,
                );
          const handled = await applyErrorInterceptors(error, job);
          if (handled.recovered) return handled.value;
          const failed = handled.error;
          log[failed.isAborted ? "debug" : "error"]("request:error", {
            correlationId: failed.correlationId,
            method: failed.method,
            url: failed.url,
            code: failed.code,
            status: failed.status,
            attempts: failed.attempts,
            message: failed.message,
            durationMs: Date.now() - startedAt,
          });
          throw failed;
        } finally {
          if (linked) linked.dispose();
        }
      }

      /* ---------------- public API ---------------- */

      const request = (options) => execute(options);
      const shortcut = (method, hasBody) => (url, payload, options) =>
        execute({
          ...options,
          url,
          method,
          [hasBody ? "data" : "params"]: payload,
        });

      function callAPI(url, method, data, options, token) {
        const opts = options || {};
        const withAuth = opts.withAuth === true;
        return execute({
          dataType: "json",
          ...opts,
          url,
          method: method === undefined ? "GET" : method,
          data: data === undefined ? null : data,
          withAuth,
          token: withAuth && token ? token : undefined,
        });
      }

      function configure(options) {
        const next = mergeConfig(config, normalizeLegacy(options));
        checkEnums(next, (message) => {
          throw new RangeError(message);
        });
        warnUnknown(options || {});
        config = next;
        warnStorageMode();
        return client;
      }

      function currentConfig() {
        return {
          ...config,
          auth: { ...config.auth },
          retry: { ...config.retry },
        };
      }

      const client = Object.freeze({
        request,
        get: shortcut("GET", false),
        head: shortcut("HEAD", false),
        post: shortcut("POST", true),
        put: shortcut("PUT", true),
        patch: shortcut("PATCH", true),
        delete: shortcut("DELETE", true),
        options: (url, options) =>
          execute({ ...options, url, method: "OPTIONS" }),
        callAPI,
        configure,
        getConfig: currentConfig,
        setToken: (token) => storeToken(token),
        getToken: () => readToken(config.auth),
        clearToken: () => storeToken(null),
        interceptors: Object.freeze({
          request: requestInterceptors,
          response: responseInterceptors,
          error: errorInterceptors,
        }),
        create: (options) =>
          createClient(mergeConfig(config, normalizeLegacy(options))),
        version: VERSION,
      });
      return client;
    }

    const defaultClient = createClient({});

    return Object.freeze({
      ...defaultClient,
      createClient,
      ApiError,
      isApiError,
      transports,
      CODES,
      VERSION,
    });
  },
);
