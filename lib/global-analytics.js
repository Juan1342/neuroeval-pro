"use strict";

const COUNTRY_CODES = Object.freeze({
  "colombia": "CO",
  "united states": "US",
  "united states of america": "US",
  "estados unidos": "US",
  "estados unidos de america": "US",
  "usa": "US",
  "canada": "CA",
  "mexico": "MX",
  "brazil": "BR",
  "brasil": "BR",
  "argentina": "AR",
  "chile": "CL",
  "peru": "PE",
  "ecuador": "EC",
  "venezuela": "VE",
  "panama": "PA",
  "costa rica": "CR",
  "guatemala": "GT",
  "dominican republic": "DO",
  "republica dominicana": "DO",
  "spain": "ES",
  "espana": "ES",
  "united kingdom": "GB",
  "reino unido": "GB",
  "france": "FR",
  "francia": "FR",
  "germany": "DE",
  "alemania": "DE",
  "italy": "IT",
  "italia": "IT",
  "portugal": "PT",
  "netherlands": "NL",
  "paises bajos": "NL",
  "switzerland": "CH",
  "suiza": "CH",
  "ireland": "IE",
  "irlanda": "IE",
  "australia": "AU",
  "new zealand": "NZ",
  "nueva zelanda": "NZ",
  "japan": "JP",
  "japon": "JP",
  "south korea": "KR",
  "corea del sur": "KR",
  "china": "CN",
  "india": "IN",
  "singapore": "SG",
  "singapur": "SG",
  "united arab emirates": "AE",
  "emiratos arabes unidos": "AE",
  "saudi arabia": "SA",
  "arabia saudita": "SA",
  "south africa": "ZA",
  "sudafrica": "ZA",
  "nigeria": "NG",
  "kenya": "KE",
  "kenia": "KE",
  "egypt": "EG",
  "egipto": "EG",
  "sweden": "SE",
  "suecia": "SE",
  "norway": "NO",
  "noruega": "NO",
  "denmark": "DK",
  "dinamarca": "DK",
  "finland": "FI",
  "finlandia": "FI",
  "poland": "PL",
  "polonia": "PL",
  "ukraine": "UA",
  "ucrania": "UA",
  "turkey": "TR",
  "turquia": "TR",
  "israel": "IL",
  "thailand": "TH",
  "tailandia": "TH",
  "indonesia": "ID",
  "philippines": "PH",
  "filipinas": "PH",
  "pakistan": "PK"
});

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
    const country = String(user.country || "").trim().slice(0, 80)
      || String(user.detectedCountryCode || "").trim().toUpperCase()
      || "Sin dato";
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

module.exports = { COUNTRY_CODES, normalizeCountryName, resolveCountryCode, ageBand, aggregateProfiles };
