import { readFileSync } from "node:fs";
import terser from "@rollup/plugin-terser";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

const banner = `/*! BaseAjax v${pkg.version} | https://github.com/Official-Viewland360-Co/base-ajax */`;

const shared = { sourcemap: true, banner, exports: "named" };

/**
 * Rollup's `exports: "named"` build exposes the API as a namespace object, so
 * `require("base-ajax")` would return `{ default: client, createClient, ... }`
 * instead of the ready-made client documented in the README. The footer below
 * makes `module.exports` the client itself while keeping every named export and
 * the `__esModule` marker that CommonJS interop relies on.
 */
const cjsFooter = [
  "module.exports = Object.assign({}, exports.default, exports);",
  "module.exports.default = module.exports;",
  'Object.defineProperty(module.exports, "__esModule", { value: true });',
].join("\n");

export default [
  /* ------------------------------- core ------------------------------- */
  {
    input: "src/index.js",
    output: { ...shared, file: "dist/baseAjax.esm.js", format: "es" },
  },
  {
    input: "src/index.js",
    output: { ...shared, file: "dist/baseAjax.cjs", format: "cjs", footer: cjsFooter },
  },
  {
    input: "src/index.js",
    output: {
      ...shared,
      file: "dist/baseAjax.umd.js",
      format: "umd",
      name: "BaseAjax",
    },
  },
  {
    input: "src/index.js",
    output: {
      ...shared,
      file: "dist/baseAjax.umd.min.js",
      format: "umd",
      name: "BaseAjax",
      plugins: [terser({ format: { comments: /^!/ } })],
    },
  },
  {
    input: "src/all.js",
    output: [
      { ...shared, file: "dist/baseAjax.all.esm.js", format: "es" },
      { ...shared, file: "dist/baseAjax.all.cjs", format: "cjs", footer: cjsFooter },
      {
        ...shared,
        file: "dist/baseAjax.all.umd.js",
        format: "umd",
        name: "BaseAjax",
      },
      {
        ...shared,
        file: "dist/baseAjax.all.umd.min.js",
        format: "umd",
        name: "BaseAjax",
        plugins: [terser({ format: { comments: /^!/ } })],
      },
    ],
  },

  /* ------------------------------ plugins ----------------------------- */
  {
    input: "src/plugins/index.js",
    output: [
      { ...shared, file: "dist/plugins.esm.js", format: "es" },
      { ...shared, file: "dist/plugins.cjs", format: "cjs" },
      {
        ...shared,
        file: "dist/plugins.umd.js",
        format: "umd",
        name: "BaseAjaxPlugins",
      },
    ],
  },
];
