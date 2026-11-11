"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ageBand, normalizeCountryName, resolveCountryCode, canonicalCountryLabel, aggregateProfiles } = require("../lib/global-analytics");

test("normalizes accented country names and resolves ISO alpha-2 codes", () => {
  assert.equal(normalizeCountryName("México"), "mexico");
  assert.equal(resolveCountryCode("México"), "MX");
  assert.equal(resolveCountryCode("United States"), "US");
  assert.equal(resolveCountryCode("co"), "CO");
  assert.equal(resolveCountryCode("XX"), "");
});

test("classifies adult ages only", () => {
  assert.equal(ageBand(18), "18–24");
  assert.equal(ageBand(34), "25–34");
  assert.equal(ageBand(55), "55+");
  assert.equal(ageBand(17), "Sin dato");
  assert.equal(ageBand(120), "Sin dato");
  assert.equal(ageBand("unknown"), "Sin dato");
});

test("suppresses country, city, age and language groups below threshold", () => {
  const profiles = [
    ...Array.from({ length: 10 }, () => ({ country: "Colombia", city: "Medellín", age: 30, language: "es" })),
    ...Array.from({ length: 9 }, () => ({ country: "Canada", city: "Toronto", age: 22, language: "en" }))
  ];
  const result = aggregateProfiles(profiles, 10);
  assert.deepEqual(result.countries, [{ label: "Colombia", count: 10, code: "CO", labelEn: "Colombia" }]);
  assert.deepEqual(result.cities, [{ label: "Medellín, Colombia", count: 10, labelEn: "Medellín, Colombia" }]);
  assert.deepEqual(result.ages, [{ label: "25–34", count: 10 }]);
  assert.deepEqual(result.languages, [{ label: "Español", count: 10 }]);
});

test("uses detected country code only when voluntary country is absent", () => {
  const result = aggregateProfiles(Array.from({ length: 10 }, () => ({
    country: "", detectedCountryCode: "GB", age: 40, language: "en"
  })));
  assert.equal(result.countries[0].code, "GB");
  assert.equal(result.countries[0].label, "GB");
});

test("caps the number of returned city groups for bounded cache documents", () => {
  const profiles = [];
  for (let city = 0; city < 1001; city++) {
    for (let user = 0; user < 10; user++) {
      profiles.push({ country: "Colombia", city: "City " + city, age: 30, language: "es" });
    }
  }
  const result = aggregateProfiles(profiles, 10);
  assert.equal(result.cities.length, 1000);
});


test("canonicalizes ISO country names across English, Spanish and alpha-2 input", () => {
  assert.equal(resolveCountryCode("United States"), "US");
  assert.equal(resolveCountryCode("Estados Unidos"), "US");
  assert.equal(resolveCountryCode("US"), "US");
  assert.equal(canonicalCountryLabel("United States"), "Estados Unidos");
  assert.equal(canonicalCountryLabel("US"), "Estados Unidos");
  assert.equal(canonicalCountryLabel("United Kingdom"), "Reino Unido");
  assert.equal(canonicalCountryLabel("Atlantis"), "Atlantis");
});

test("combines country variants into one privacy-safe global group", () => {
  const profiles = [
    ...Array.from({ length: 10 }, () => ({ country: "United States", city: "Miami", age: 30, language: "en" })),
    ...Array.from({ length: 10 }, () => ({ country: "Estados Unidos", city: "Miami", age: 31, language: "en" })),
    ...Array.from({ length: 10 }, () => ({ country: "US", city: "Miami", age: 32, language: "en" }))
  ];
  const result = aggregateProfiles(profiles, 10);
  assert.deepEqual(result.countries, [{ label: "Estados Unidos", count: 30, code: "US", labelEn: "United States" }]);
  assert.deepEqual(result.cities, [{ label: "Miami, Estados Unidos", count: 30, labelEn: "Miami, United States" }]);
});
