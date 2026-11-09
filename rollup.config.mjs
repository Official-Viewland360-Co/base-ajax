import terser from "@rollup/plugin-terser";

const banner = `/*! BaseAjax v2.0.0 | MIT License | https://github.com/Official-Viewland360-Co/base-ajax */`;

const shared = { sourcemap: true, banner, exports: "named" };

export default [
  /* ------------------------------- core ------------------------------- */
  {
    input: "src/index.js",
    output: { ...shared, file: "dist/baseAjax.esm.js", format: "es" },
  },
  {
    input: "src/index.js",
    output: { ...shared, file: "dist/baseAjax.cjs", format: "cjs" },
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
      { ...shared, file: "dist/baseAjax.all.cjs", format: "cjs" },
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
