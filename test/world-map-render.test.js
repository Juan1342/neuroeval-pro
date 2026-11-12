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

  const highlighted = paths.filter(node => node.attributes.class === "land has-users");
  const colombia = paths.find(node => node.attributes["aria-label"]?.startsWith("Colombia:"));
  assert.equal(highlighted.length, 1, "only the country meeting the threshold should be highlighted");
  assert.ok(colombia, "country with 12 profiles should be highlighted and labelled");
  assert.equal(colombia.attributes.class, "land has-users");
  assert.equal(colombia.attributes.tabindex, "0");
  assert.equal(colombia.attributes.role, "button");
  assert.match(colombia.attributes["aria-label"], /12 usuarios/);
  assert.ok(paths.filter(node => node.attributes.class === "land").every(node => node.attributes.tabindex === "-1"), "countries below the threshold remain non-interactive");
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


test("world map clips antimeridian-crossing geometry instead of drawing across the whole map", async () => {
  const { context, host } = createMapContext("en");
  await context.renderWorldMap([{ code: "FJ", count: 12 }]);
  const svg = host.children[0];
  const fiji = svg.children.find(node => node.tagName === "path" && node.attributes["data-country-code"] === "FJ");
  assert.ok(fiji, "Fiji must be present in the world map");
  assert.match(fiji.attributes["aria-label"], /^Fiji: 12 users$/);

  const subpaths = fiji.attributes.d.split(/\\s+Z\\s*/).filter(Boolean);
  for (const subpath of subpaths) {
    const points = [...subpath.matchAll(/[ML](-?\\d+(?:\\.\\d+)?) (-?\\d+(?:\\.\\d+)?)/g)]
      .map(match => Number(match[1]));
    for (let index = 1; index < points.length; index++) {
      assert.ok(Math.abs(points[index] - points[index - 1]) <= 450,
        "a map segment must not jump across most of the world");
    }
  }
});

test("world map host and SVG expose localized accessible names", async () => {
  const english = createMapContext("en");
  await english.context.renderWorldMap([{ code: "CO", count: 10 }]);
  assert.match(english.host.attributes["aria-label"], /^World country map/);
  assert.match(english.host.children[0].attributes["aria-label"], /^World country map/);

  const spanish = createMapContext("es");
  await spanish.context.renderWorldMap([{ code: "CO", count: 10 }]);
  assert.match(spanish.host.attributes["aria-label"], /^Mapa mundial/);
  assert.match(spanish.host.children[0].attributes["aria-label"], /^Mapa mundial/);
});
