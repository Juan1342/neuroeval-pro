"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("public/index.html", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const utilitiesCss = fs.readFileSync("public/css/utilities.css", "utf8");

function escapeCssClass(value) {
  return value
    .replace(/^2/, "\\32 ")
    .replace(/:/g, "\\:")
    .replace(/\//g, "\\/")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

test("the application uses a local stylesheet instead of runtime style CDNs", () => {
  assert.match(html, /<link rel="stylesheet" href="\/css\/utilities\.css">/);
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(utilitiesCss, /\.hidden\s*\{/);
  assert.match(utilitiesCss, /@media\s*\(min-width:640px\)/);
});

test("every Tailwind utility used by static and generated markup has a local CSS selector", () => {
  const classes = new Set();
  for (const source of [html, app]) {
    for (const match of source.matchAll(/class=["'`]([^"'`]+)["'`]/g)) {
      for (const name of match[1].split(/\s+/)) if (name) classes.add(name);
    }
    for (const match of source.matchAll(/classList\.(?:add|remove|toggle)\(([^)]*)\)/g)) {
      for (const token of match[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
        for (const name of token[1].split(/\s+/)) if (name) classes.add(name);
      }
    }
  }

  const utilityPattern = /^(?:sm:|md:|lg:|xl:|2xl:)?(?:flex|grid|block|inline|hidden|items-|justify-|gap-|space-|p-|px-|py-|m-|mx-|my-|mt-|mb-|mr-|w-|h-|min-w-|max-w-|text-|font-|bg-|border|rounded|shadow|leading-|tracking-|col-|row-|overflow-|relative|absolute|fixed|sticky|top-|left-|right-|z-|cursor-|opacity-|transition|duration-|ease-|animate-|ring|focus:|hover:|inset-|uppercase|sr-only)/;
  const utilityClasses = [...classes].filter(name => utilityPattern.test(name));
  const missing = utilityClasses.filter(name => !utilitiesCss.includes("." + escapeCssClass(name)));
  assert.deepEqual(missing, [], "missing local CSS for utility classes: " + missing.join(", "));
});
