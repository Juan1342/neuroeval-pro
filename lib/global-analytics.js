"use strict";

function buildCountryLookups() {
  const namesEn = new Intl.DisplayNames(["en"], { type: "region" });
  const namesEs = new Intl.DisplayNames(["es"], { type: "region" });
  const codes = {};
  const labels = {};

  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second);
      const englishName = namesEn.of(code);
      const spanishName = namesEs.of(code);
      if (!englishName || englishName === code) continue;
      codes[normalizeCountryName(englishName)] = code;
      if (spanishName && spanishName !== code) {
        codes[normalizeCountryName(spanishName)] = code;
        labels[code] = spanishName;
      } else {
        labels[code] = englishName;
      }
    }
  }

  // Alias comunes que los servicios de geolocalización o usuarios suelen usar.
  Object.assign(codes, {
    "usa": "US",
    "u s a": "US",
    "united states of america": "US",
    "estados unidos de america": "US",
    "uk": "GB",
    "great britain": "GB",
    "brasil": "BR",
    "republica de corea": "KR",
    "south korea": "KR",
    "russia": "RU",
    "rusia": "RU",
    "taiwan": "TW",
    "taiwán": "TW",
    "hong kong": "HK",
    "puerto rico": "PR"
  });

  return {
    codes: Object.freeze(codes),
    labels: Object.freeze(labels)
  };
}

const COUNTRY_LOOKUPS = buildCountryLookups();
const COUNTRY_CODES = COUNTRY_LOOKUPS.codes;
const COUNTRY_LABELS = COUNTRY_LOOKUPS.labels;

function canonicalCountryLabel(value) {
  const label = String(value || "").trim().slice(0, 80);
  const code = resolveCountryCode(label);
  return code ? COUNTRY_LABELS[code] || code : label || "Sin dato";
}

function normalizeCountryName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function resolveCountryCode(label) {
  const value = String(label || "").trim();
  if (/^[A-Z]{2}$/i.test(value) && value.toUpperCase() !== "XX") return value.toUpperCase();
  return COUNTRY_CODES[normalizeCountryName(value)] || "";
}

function ageBand(age) {
  const value = Number(age);
  if (!Number.isInteger(value) || value < 18 || value > 99) return "Sin dato";
  if (value <= 24) return "18–24";
  if (value <= 34) return "25–34";
  if (value <= 44) return "35–44";
  if (value <= 54) return "45–54";
  return "55+";
}

function aggregateProfiles(profiles, threshold = 10) {
  const buckets = {
    countries: new Map(),
    cities: new Map(),
    ages: new Map(),
    languages: new Map()
  };
  const add = (map, value) => {
    const label = String(value || "Sin dato").trim().slice(0, 100) || "Sin dato";
    map.set(label, (map.get(label) || 0) + 1);
  };

  for (const profile of profiles || []) {
    const user = profile || {};
    const countryInput = String(user.country || "").trim().slice(0, 80)
      || String(user.detectedCountryCode || "").trim().toUpperCase()
      || "Sin dato";
    const country = canonicalCountryLabel(countryInput);
    add(buckets.countries, country);
    if (user.city && country !== "Sin dato") {
      add(buckets.cities, String(user.city).trim().slice(0, 100) + ", " + country);
    }
    add(buckets.ages, ageBand(user.age));
    add(buckets.languages, user.language === "en" ? "English" : user.language === "es" ? "Español" : "Sin dato");
  }

  const safeRows = map => [...map.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 1000);

  const countries = safeRows(buckets.countries).map(row => ({
    ...row,
    code: resolveCountryCode(row.label)
  }));

  return {
    countries,
    cities: safeRows(buckets.cities),
    ages: safeRows(buckets.ages),
    languages: safeRows(buckets.languages)
  };
}

module.exports = { COUNTRY_CODES, COUNTRY_LABELS, normalizeCountryName, resolveCountryCode, canonicalCountryLabel, ageBand, aggregateProfiles };
