import { readFile } from "node:fs/promises";
import { Window } from "happy-dom";

const html = await readFile("docs/en.html", "utf8");
const window = new Window({ url: "http://localhost:5174/en.html" });
window.document.write(html);
const doc = window.document;

const problems = [];
const root = doc.documentElement;

if (root.getAttribute("lang") !== "en") problems.push("lang is not en");
if (root.getAttribute("dir") !== "ltr") problems.push("dir is not ltr");

const inline = [...doc.querySelectorAll("script")].filter((s) => !s.getAttribute("src"));
for (const s of inline) {
  try {
    window.eval(s.textContent);
  } catch (e) {
    problems.push(`inline script threw: ${e.message}`);
  }
}

// theme toggle
const t = doc.getElementById("themeToggle");
const before = root.getAttribute("data-theme");
t.click();
if (root.getAttribute("data-theme") === before) problems.push("theme toggle broken");
if (!/Switch to (light|dark) mode/.test(t.getAttribute("title") || ""))
  problems.push(`theme title not EN: ${t.getAttribute("title")}`);

// language button
const l = doc.getElementById("langToggle");
if (!l) problems.push("missing #langToggle");
else if (l.textContent.trim() !== "FA") problems.push(`lang button should read FA, got ${l.textContent}`);

// nav/sections integrity
const sections = [...doc.querySelectorAll("main section[id]")].map((s) => s.id);
const navHrefs = [...doc.querySelectorAll('#nav a[href^="#"]')].map((a) =>
  a.getAttribute("href").slice(1),
);
const missing = sections.filter((id) => !navHrefs.includes(id));
if (missing.length) problems.push(`sections missing from nav: ${missing.join(",")}`);
const stale = navHrefs.filter((id) => !sections.includes(id));
if (stale.length) problems.push(`nav links without section: ${stale.join(",")}`);

// no Persian left in visible text
const text = doc.body.textContent || "";
const persian = (text.match(/[\u0600-\u06FF]/g) || []).length;
if (persian > 0) problems.push(`${persian} Persian characters still in body text`);

window.happyDOM.close?.();

console.log(`sections: ${sections.length} | nav links: ${navHrefs.length}`);
if (problems.length) {
  console.error("PROBLEMS:\n- " + problems.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("OK: docs/en.html passed checks");
}
