"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("public/app.js", "utf8");
const world = JSON.parse(fs.readFileSync("public/data/world-countries-110m.geojson", "utf8"));
const start = app.indexOf("async function renderWorldMap(rows = [])");
const end = app.indexOf("async function loadAdminGlobalAnalytics()", start);
assert.ok(start >= 0 && end > start, "renderWorldMap function must exist");
const renderSource = app.slice(start, end);

function createNode(tagName) {
  return {
    tagName,
    attributes: {},
    children: [],
    listeners: {},
    textContent: "",
    style: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    appendChild(node) { this.children.push(node); return node; },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    addEventListener(name, callback) { this.listeners[name] = callback; }
  };
}

function createMapContext(language = "es") {
  const host = createNode("div");
  const status = createNode("div");
  const document = {
    createElementNS(_namespace, tagName) { return createNode(tagName); }
  };
  const context = {
    document,
    currentLanguage: language,
    worldMapGeometryPromise: null,
    $: id => id === "admin-world-map" ? host : id === "admin-global-status" ? status : null,
    fetch: async () => ({ ok: true, json: async () => world }),
    console
  };
  vm.createContext(context);
  vm.runInContext(renderSource, context);
  return { context, host, status };
}

test("world map renderer creates SVG country paths and enforces the ten-profile threshold", async () => {
  const { context, host } = createMapContext("es");
  await context.renderWorldMap([{ code: "CO", count: 12 }, { code: "US", count: 9 }]);

  const svg = host.children[0];
  assert.equal(svg.tagName, "svg");
  assert.equal(svg.attributes.viewBox, "0 0 900 440");
  const paths = svg.children.filter(node => node.tagName === "path");
  assert.ok(paths.length >= 150, "expected broad country path coverage");

  const colombia = paths.find(node => node.attributes["aria-label"]?.startsWith("Colombia:"));
  const unitedStates = paths.find(node => node.attributes.class === "land" && node.attributes.tabindex === "-1" && node.attributes.d);
  assert.ok(colombia, "country with 12 profiles should be highlighted and labelled");
  assert.equal(colombia.attributes.class, "land has-users");
  assert.equal(colombia.attributes.tabindex, "0");
  assert.equal(colombia.attributes.role, "button");
  assert.match(colombia.attributes["aria-label"], /12 usuarios/);
  assert.ok(unitedStates, "countries below the threshold remain non-interactive");
});

test("highlighted map countries expose keyboard interaction and localized labels", async () => {
  const { context, host, status } = createMapContext("en");
  await context.renderWorldMap([{ code: "CO", count: 15 }]);
  const svg = host.children[0];
  const colombia = svg.children.find(node => node.tagName === "path" && node.attributes["aria-label"]?.startsWith("Colombia:"));
  assert.ok(colombia);
  assert.match(colombia.attributes["aria-label"], /15 users/);
  let prevented = false;
  colombia.listeners.keydown({ key: "Enter", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(status.textContent, /Colombia: 15 users/);
});
