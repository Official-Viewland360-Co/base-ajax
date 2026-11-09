import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";

const html = await readFile("docs/index.html", "utf8");
const window = new Window({ url: "http://localhost:5174/index.html" });
window.document.write(html);
const doc = window.document;
const problems = [];

if (/@@/.test(html)) problems.push("placeholder '@@' still present");

const allIds = [...doc.querySelectorAll("[id]")].map((el) => el.id);
const dupes = [...new Set(allIds.filter((id, i) => allIds.indexOf(id) !== i))];
if (dupes.length) problems.push(`duplicate ids: ${dupes.join(", ")}`);

const ids = new Set(allIds);
const anchors = [...doc.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href"));
const broken = [...new Set(anchors.filter((h) => h !== "#" && !ids.has(h.slice(1))))];
if (broken.length) problems.push(`broken internal links: ${broken.join(", ")}`);

const sections = [...doc.querySelectorAll("main section[id]")].map((s) => s.id);
const navHrefs = [...doc.querySelectorAll('#nav a[href^="#"]')].map((a) =>
  a.getAttribute("href").slice(1),
);
const missingInNav = sections.filter((id) => !navHrefs.includes(id));
if (missingInNav.length) problems.push(`sections missing from nav: ${missingInNav.join(", ")}`);
const staleNav = navHrefs.filter((id) => !sections.includes(id));
if (staleNav.length) problems.push(`nav entries without section: ${staleNav.join(", ")}`);

const balance = {};
for (const tag of ["section", "table", "div", "pre", "details", "ul", "ol", "p", "aside", "main", "html", "body"]) {
  const open = (html.match(new RegExp(`<${tag}(\\s|>)`, "gi")) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, "gi")) || []).length;
  balance[tag] = `${open}/${close}`;
  if (open !== close) problems.push(`unbalanced <${tag}>: ${open} open vs ${close} close`);
}

const htmlEl = doc.documentElement;
if (htmlEl.getAttribute("dir") !== "rtl") problems.push("html[dir] is not rtl");
if (htmlEl.getAttribute("lang") !== "fa") problems.push("html[lang] is not fa");

// --- execute the inline page script ---
const inline = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
let ran = 0;
for (const s of inline) {
  try {
    window.eval(s.textContent);
    ran += 1;
  } catch (error) {
    problems.push(`inline script threw: ${error && error.message}`);
  }
}

const themeToggle = doc.getElementById("themeToggle");
if (!themeToggle) problems.push("missing #themeToggle");
else {
  const before = htmlEl.getAttribute("data-theme");
  themeToggle.click();
  const after = htmlEl.getAttribute("data-theme");
  if (before === after) problems.push("theme toggle did not change data-theme");
  themeToggle.click();
}

const codeBlocks = doc.querySelectorAll(".code").length;
const copyButtons = doc.querySelectorAll(".code .copy-btn").length;
if (copyButtons !== codeBlocks) {
  problems.push(`copy buttons ${copyButtons} != code blocks ${codeBlocks}`);
}

const search = doc.getElementById("navSearch");
if (search) {
  search.value = "cache";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const visible = [...doc.querySelectorAll('#nav a[href^="#"]')].filter(
    (a) => !a.classList.contains("filtered-out"),
  ).length;
  if (visible === 0) problems.push("search filter hid every nav link");
  search.value = "zzzz-not-found";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const emptyShown = doc.getElementById("navEmpty")?.classList.contains("show");
  if (!emptyShown) problems.push("nav-empty state did not show for a no-match query");
  search.value = "";
  search.dispatchEvent(new window.Event("input", { bubbles: true }));
  const restored = [...doc.querySelectorAll('#nav a[href^="#"]')].every(
    (a) => !a.classList.contains("filtered-out"),
  );
  if (!restored) problems.push("clearing the query did not restore nav links");
} else {
  problems.push("missing #navSearch");
}

const groupTitles = doc.querySelectorAll("#nav .group-title");
if (groupTitles.length < 3) problems.push(`only ${groupTitles.length} nav group titles`);

window.happyDOM.close?.();

console.log(`inline scripts executed: ${ran}`);
console.log(`sections: ${sections.length} | nav links: ${navHrefs.length} | code blocks: ${codeBlocks}`);
console.log(`tag balance: ${JSON.stringify(balance)}`);
if (problems.length) {
  console.error("PROBLEMS:\n- " + problems.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("OK: docs/index.html passed all structural + interaction checks");
}
