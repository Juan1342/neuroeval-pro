"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PRIVACY_NOTICE_VERSION,
  validatePrivacyConsent,
  validateSensitiveDataConsent,
  childAgeBand,
  buildParentConsentRecord
} = require("../lib/privacy");

test("accepts only the current, explicit and localized privacy consent", () => {
  assert.equal(validatePrivacyConsent({ accepted: true, version: PRIVACY_NOTICE_VERSION, language: "es" }), true);
  assert.equal(validatePrivacyConsent({ accepted: true, version: "old", language: "es" }), false);
  assert.equal(validatePrivacyConsent({ accepted: false, version: PRIVACY_NOTICE_VERSION, language: "en" }), false);
  assert.equal(validatePrivacyConsent({ accepted: true, version: PRIVACY_NOTICE_VERSION, language: "fr" }), false);
  assert.equal(validatePrivacyConsent(null), false);
});

test("maps a child's age to a broad band without retaining the exact age", () => {
  assert.equal(childAgeBand(7), "4–7 años");
  assert.equal(childAgeBand(8), "8–12 años");
  assert.equal(childAgeBand(17), "13–17 años");
  assert.equal(childAgeBand(18), "");
});

test("builds a minimal guardian authorization record", () => {
  const record = buildParentConsentRecord({
    consent: true, sensitiveDataConsent: true, childAge: 10, relationship: "Madre",
    settings: ["casa", "colegio", "casa", "invalid"]
  }, "en", "2026-11-11T12:00:00.000Z");
  assert.deepEqual(record, {
    guardianAuthorization: true,
    sensitiveDataConsent: true,
    consentVersion: PRIVACY_NOTICE_VERSION,
    consentLanguage: "en",
    acceptedAt: "2026-11-11T12:00:00.000Z",
    relationship: "Madre",
    settings: ["casa", "colegio"],
    childAgeBand: "8–12 años"
  });
  assert.equal(Object.hasOwn(record, "childAge"), false);
});

test("does not create a guardian record without all required authorization data", () => {
  assert.equal(buildParentConsentRecord({ consent: false }, "es", "now"), null);
});


test("requires a separate, current explicit authorization for sensitive assessment data", () => {
  assert.equal(validateSensitiveDataConsent({ accepted: true, version: PRIVACY_NOTICE_VERSION, language: "es" }), true);
  assert.equal(validateSensitiveDataConsent({ accepted: false, version: PRIVACY_NOTICE_VERSION, language: "es" }), false);
  assert.equal(validateSensitiveDataConsent({ accepted: true, version: "old", language: "es" }), false);
  assert.equal(validateSensitiveDataConsent({ accepted: true, version: PRIVACY_NOTICE_VERSION, language: "fr" }), false);
});

test("does not create a family-observation record without separate sensitive-data authorization", () => {
  assert.equal(buildParentConsentRecord({
    consent: true, sensitiveDataConsent: false, childAge: 10,
    relationship: "Madre", settings: ["casa"]
  }, "es", "now"), null);
});
