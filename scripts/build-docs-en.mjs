/**
 * Builds `docs/en.html`, the English edition of the documentation page.
 *
 * The English edition shares the Persian page's stylesheet and interactive
 * engine verbatim, so both editions stay visually and behaviourally identical.
 * Only the copy differs; this script retargets the few Persian strings that live
 * inside the shared script (theme tooltips and the language switch).
 *
 * The section bodies come from `docs/en/content.html`, which is maintained by
 * hand (it is translated prose, not generated).
 *
 * Usage: node scripts/build-docs-en.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const fa = await readFile("docs/index.html", "utf8");
const content = await readFile("docs/en/content.html", "utf8");

const cssMatch = fa.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) throw new Error("could not find the <style> block in docs/index.html");

// The page's main script is the last <script> block (the head holds a small
// redirect shim that must not be picked up here).
const scriptBlocks = [...fa.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!scriptBlocks.length) throw new Error("could not find the page <script> in docs/index.html");

const css = cssMatch[1].replace(
  "/* ---- Ú¯Ø±ÙˆÙ‡â€ŒØ¨Ù†Ø¯ÛŒ ÙÙ‡Ø±Ø³Øª: Ø³Ø±ØµÙØ­Ù‡Ù” Ú†Ø³Ø¨Ø§Ù† Ø¨Ø§ Ù†Ø´Ø§Ù† Ø±Ù†Ú¯ÛŒ ---- */",
  "/* ---- sidebar grouping: sticky header with a coloured badge ---- */",
);
let script = scriptBlocks[scriptBlocks.length - 1][1];

/* ------- retarget the shared script from Persian to English ------- */

const FA_TOOLTIP = 'themeToggle.setAttribute("title", dark ? "Ø­Ø§Ù„Øª Ø±ÙˆØ´Ù†" : "Ø­Ø§Ù„Øª ØªÛŒØ±Ù‡");';
const EN_TOOLTIP =
  'themeToggle.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");';
if (!script.includes(FA_TOOLTIP)) throw new Error("theme tooltip marker not found");
script = script.replace(FA_TOOLTIP, EN_TOOLTIP);

const FA_LANG_START = "/* ------------------------------ language ---------------------------- */";
const FA_LANG_END = "/* --------------------------- progress + spy ------------------------ */";
const start = script.indexOf(FA_LANG_START);
const end = script.indexOf(FA_LANG_END);
if (start === -1 || end === -1 || end < start) throw new Error("language block not found");

const EN_LANG_BLOCK = `/* ------------------------------ language ---------------------------- */
        // This page is the English edition. The switch hands over to the Persian
        // edition at \`index.html\` and remembers the choice so a later visit to
        // either page can send the visitor straight to the edition they picked.
        var LANG_KEY = "baseajax-docs-lang";
        var langToggle = document.getElementById("langToggle");

        function storeLang(value) {
          try {
            localStorage.setItem(LANG_KEY, value);
          } catch (e) {
            /* storage may be unavailable */
          }
        }

        if (langToggle) {
          langToggle.setAttribute("aria-label", "Switch to Persian");
          langToggle.setAttribute("title", "Show the Persian edition");
          langToggle.textContent = "FA";
          langToggle.addEventListener("click", function () {
            storeLang("fa");
            window.location.href = "index.html";
          });
        }

        `;

script = script.slice(0, start) + EN_LANG_BLOCK + script.slice(end);

/* ------- translate the copy-button labels in the shared script ------- */

const SCRIPT_COPY = [
  ['button.textContent = "Ú©Ù¾ÛŒ";', 'button.textContent = "Copy";'],
  ['button.setAttribute("aria-label", "Ú©Ù¾ÛŒ Ú©Ø¯");', 'button.setAttribute("aria-label", "Copy code");'],
  ['button.textContent = "Ú©Ù¾ÛŒ Ø´Ø¯ âœ“";', 'button.textContent = "Copied âœ“";'],
  ['button.textContent = "Ø®Ø·Ø§";', 'button.textContent = "Error";'],
];

for (const [from, to] of SCRIPT_COPY) {
  if (!script.includes(from)) throw new Error(`copy label marker not found: ${from}`);
  script = script.split(from).join(to);
}

const FOOTER = `      </main>
    </div>

    <footer class="site-foot">
      <div class="inner">
        <span>BaseAjax v2.0.0 â€” a dependency-free HTTP client for JavaScript</span>
        <span>
          <a href="https://github.com/Official-Viewland360-Co/base-ajax">GitHub</a> Â·
          <a href="../README.md">README</a> Â·
          <a href="../types/baseAjax.d.ts">types/baseAjax.d.ts</a>
        </span>
      </div>
    </footer>

    <button id="toTop" type="button" aria-label="Back to top" title="Back to top">â†‘</button>
`;

const html = `<!doctype html>
<html lang="en" dir="ltr" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BaseAjax â€” Complete Documentation and Reference Guide</title>
    <meta
      name="description"
      content="Complete BaseAjax documentation: a dependency-free HTTP client with fetch/XHR/jQuery transports, auth, CSRF, retry, interceptors and a plugin layer (cache, dedupe, queue, circuit breaker, trace, mock)."
    />
    <meta name="color-scheme" content="light dark" />
    <style>${css}</style>
  </head>
  <body>
${content.trimEnd()}
${FOOTER}
    <script>${script}</script>
  </body>
</html>
`;

await writeFile("docs/en.html", html, "utf8");
console.log(`wrote docs/en.html (${html.length} chars)`);
