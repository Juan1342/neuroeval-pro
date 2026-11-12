"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { aggregateProfiles } = require("../lib/global-analytics");

test("global analytics only exposes country and demographic groups meeting the ten-profile threshold", () => {
  const profiles = [
    ...Array.from({ length: 10 }, () => ({ country: "Colombia", city: "Bello", age: 31, language: "es", regionalAnalyticsConsent: true, email: "private@example.test", uid: "private" })),
    ...Array.from({ length: 9 }, () => ({ country: "United States", city: "Miami", age: 22, language: "en", regionalAnalyticsConsent: true }))
  ];
  const result = aggregateProfiles(profiles, 10);
  assert.equal(result.countries.length, 1);
  assert.equal(result.countries[0].code, "CO");
  assert.equal(result.countries[0].count, 10);
  assert.equal(result.cities.length, 1);
  assert.equal(result.ages.length, 1);
  assert.equal(result.languages.length, 1);
  assert.equal(JSON.stringify(result).includes("private@example.test"), false);
  assert.equal(JSON.stringify(result).includes('"uid"'), false);
});

test("international analytics endpoint is authenticated, permission-scoped, paginated and cached", () => {
  const fs = require("node:fs");
  const server = fs.readFileSync("server.js", "utf8");
  assert.match(server, /api\/admin\/analytics\/global", requireUser, requireStaffAdmin\("dashboard\.view"\)/);
  assert.match(server, /GLOBAL_ANALYTICS_PAGE_SIZE = 1000/);
  assert.match(server, /regionalAnalyticsConsent: req\.body\.regionalAnalyticsConsent === true/);
  assert.match(server, /GLOBAL_ANALYTICS_MAX_USERS = 50000/);
  assert.match(server, /aggregateProfiles\(profiles, 10\)/);
  assert.match(server, /\.select\("country", "city", "detectedCountryCode", "age", "language"\)/);
});

test("profiles without explicit regional analytics consent are excluded", () => {
  const result = aggregateProfiles([
    ...Array.from({ length: 12 }, () => ({ country: "Colombia", city: "Bogotá", age: 30, language: "es", regionalAnalyticsConsent: false })),
    ...Array.from({ length: 9 }, () => ({ country: "Colombia", city: "Bogotá", age: 30, language: "es", regionalAnalyticsConsent: true }))
  ], 10);
  assert.equal(result.countries.length, 0);
  assert.equal(result.cities.length, 0);
  assert.equal(result.ages.length, 0);
  assert.equal(result.languages.length, 0);
});
