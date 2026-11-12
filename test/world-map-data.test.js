"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("world map asset is a valid Natural Earth country FeatureCollection", () => {
  const file = path.join(__dirname, "..", "public", "data", "world-countries-110m.geojson");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(data.type, "FeatureCollection");
  assert.ok(Array.isArray(data.features));
  assert.ok(data.features.length >= 150, "expected broad world country coverage");
  assert.match(data.name, /Natural Earth/i);
  for (const feature of data.features) {
    assert.equal(feature.type, "Feature");
    assert.ok(feature.geometry, "every mapped feature must have geometry");
    assert.ok(["Polygon", "MultiPolygon"].includes(feature.geometry.type));
    assert.equal(typeof feature.properties?.name_en, "string");
    assert.equal(typeof feature.properties?.name_es, "string");
    assert.equal(typeof feature.properties?.iso_a2, "string");
    assert.ok(feature.properties.iso_a2 === "-9" || feature.properties.iso_a2 === "-99" || /^[A-Z]{2}$/.test(feature.properties.iso_a2));
  }
});

test("world map coordinates stay within longitude/latitude bounds", () => {
  const file = path.join(__dirname, "..", "public", "data", "world-countries-110m.geojson");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const inspect = value => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      assert.ok(Number.isFinite(value[0]) && value[0] >= -180 && value[0] <= 180);
      assert.ok(Number.isFinite(value[1]) && value[1] >= -90 && value[1] <= 90);
      return;
    }
    value.forEach(inspect);
  };
  data.features.forEach(feature => inspect(feature.geometry.coordinates));
});
