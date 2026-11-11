"use strict";

const PRIVACY_NOTICE_VERSION = "2026-11-11";

function validatePrivacyConsent(consent) {
  if (!consent || typeof consent !== "object") return false;
  return consent.accepted === true
    && consent.version === PRIVACY_NOTICE_VERSION
    && ["es", "en"].includes(consent.language);
}

function childAgeBand(age) {
  const value = Number(age);
  if (!Number.isInteger(value) || value < 4 || value > 17) return "";
  if (value <= 7) return "4–7 años";
  if (value <= 12) return "8–12 años";
  return "13–17 años";
}

function buildParentConsentRecord(context, language, acceptedAt) {
  if (!context || context.consent !== true) return null;
  const relationship = String(context.relationship || "").trim().slice(0, 50);
  const settings = Array.isArray(context.settings)
    ? [...new Set(context.settings.filter(value => ["casa", "colegio", "social"].includes(value)))]
    : [];
  const ageBand = childAgeBand(context.childAge);
  if (!relationship || !settings.length || !ageBand || !["es", "en"].includes(language)) return null;
  return {
    guardianAuthorization: true,
    consentVersion: PRIVACY_NOTICE_VERSION,
    consentLanguage: language,
    acceptedAt,
    relationship,
    settings,
    childAgeBand: ageBand
  };
}

module.exports = {
  PRIVACY_NOTICE_VERSION,
  validatePrivacyConsent,
  childAgeBand,
  buildParentConsentRecord
};
