/**
 * ESM entry point for BaseAjax.
 *
 * `./baseAjax.js` is a dependency-free UMD file kept as the single source of
 * truth (it also works as a `<script>` tag). Importing it publishes the API on
 * `globalThis.BaseAjax`; this module re-exports it so consumers can write:
 *
 * ```js
 * import BaseAjax, { ApiError, createClient } from "base-ajax";
 * ```
 */
import "./baseAjax.js";

const BaseAjax = globalThis.BaseAjax;

if (!BaseAjax) {
  throw new Error("BaseAjax failed to initialize. Ensure src/baseAjax.js runs cleanly.");
}

export default BaseAjax;
export const ApiError = BaseAjax.ApiError;
export const isApiError = BaseAjax.isApiError;
export const transports = BaseAjax.transports;
export const CODES = BaseAjax.CODES;
export const VERSION = BaseAjax.VERSION;
export const createClient = BaseAjax.createClient;
