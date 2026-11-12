"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const server = read("server.js");
const app = read("public/app.js");
const html = read("public/index.html");

test("bilingual privacy and terms pages identify the controller and privacy contact", () => {
  for (const file of [
    "public/legal/privacy-es.html",
    "public/legal/privacy-en.html",
    "public/legal/terms-es.html",
    "public/legal/terms-en.html"
  ]) {
    const page = read(file);
    assert.match(page, /JUAN MANUEL ZAMORA ZAPATA/);
    assert.match(page, /soporte\.neuroevalpro@gmail\.com/);
    assert.match(page, /Versión 1\.2|Version 1\.2/);
  }
});

test("privacy policy explains sensitive data, minors, international providers and user rights", () => {
  const es = read("public/legal/privacy-es.html");
  const en = read("public/legal/privacy-en.html");
  for (const phrase of ["datos sensibles", "menores", "Firebase", "Wompi", "supresión", "Superintendencia de Industria y Comercio"]) {
    assert.ok(es.toLowerCase().includes(phrase.toLowerCase()), "missing Spanish privacy topic: " + phrase);
  }
  for (const phrase of ["sensitive data", "minors", "Firebase", "Wompi", "deletion", "Superintendence of Industry and Commerce"]) {
    assert.ok(en.toLowerCase().includes(phrase.toLowerCase()), "missing English privacy topic: " + phrase);
  }
});

test("retention schedule documents categories, durations and backup limitations", () => {
  const schedule = read("docs/legal/retention-schedule.md");
  assert.match(schedule, /24 meses/);
  assert.match(schedule, /10 minutos/);
  assert.match(schedule, /10 años/);
  assert.match(schedule, /Copias de respaldo/);
  assert.match(schedule, /No activa borrados automáticos/);
});

test("registration links privacy and terms and provides separate sensitive consent screens", () => {
  assert.match(html, /href="\/legal\/privacy-es\.html"/);
  assert.match(html, /href="\/legal\/terms-es\.html"/);
  assert.match(html, /id="sensitive-consent-checkbox"/);
  assert.match(html, /id="parent-sensitive-consent"/);
  assert.match(html, /id="parent-child-informed-consent"/);
  assert.match(app, /function acceptSensitiveDataConsent/);
  assert.match(app, /sensitiveDataConsentVersion/);
});

test("server requires versioned express consent before self-report and guardian consent for minor observations", () => {
  assert.match(server, /const PRIVACY_NOTICE_VERSION = "2026-11-11-v2"/);
  assert.match(server, /consentProfile\.sensitiveDataConsent !== true/);
  assert.match(server, /consentProfile\.sensitiveDataConsentVersion !== PRIVACY_NOTICE_VERSION/);
  assert.match(server, /parentContext\.sensitiveDataConsent !== true/);
  assert.match(server, /parentContext\.consentVersion !== PRIVACY_NOTICE_VERSION/);
  assert.match(server, /parentContext\.minorHeard !== true/);
  assert.match(server, /guardianConsent: true, sensitiveDataConsent: true/);
});

test("privacy consent can be recorded or withdrawn and data export is private", () => {
  assert.match(server, /app\.post\("\/api\/privacy\/consent", requireUser/);
  assert.match(server, /sensitiveDataConsentRevokedAt/);
  assert.match(server, /app\.get\("\/api\/my-data\/export", requireUser/);
  assert.match(server, /Cache-Control", "private, no-store"/);
  assert.match(server, /passwordResets/);
  assert.match(app, /\/api\/my-data\/export/);
  assert.match(app, /exported\.localProgress = readProgress\(\)/);
});

test("privacy requests are authenticated and admin deletion requires primary-admin approval", () => {
  assert.match(server, /app\.post\("\/api\/privacy\/requests", supportCreateLimiter, requireUser/);
  assert.match(server, /app\.get\("\/api\/privacy\/requests", requireUser/);
  assert.match(server, /app\.get\("\/api\/admin\/privacy\/requests", requireUser, requireStaffAdmin\("support\.view"\)/);
  assert.match(server, /req\.adminAccess\?\.isPrimaryAdmin !== true/);
  assert.match(server, /requestData\.requestType !== "deletion" \|\| requestData\.status !== "approved"/);
});

test("deletion removes sensitive evaluation fields and retains only minimal Wompi payment evidence", () => {
  const start = server.indexOf('app.post("/api/admin/privacy/requests/:id/complete-deletion"');
  const end = server.indexOf('/*', start + 10);
  const deletion = server.slice(start, end > start ? end : start + 10000);
  assert.match(deletion, /paymentFields = \[/);
  assert.match(deletion, /value\.paymentProvider === "wompi"/);
  assert.match(deletion, /batch\.set\(document\.ref, minimal\)/);
  assert.match(deletion, /batch\.delete\(document\.ref\)/);
  assert.match(deletion, /firebaseAuth\.deleteUser\(targetUid\)/);
  assert.doesNotMatch(deletion, /minimal\.answers|minimal\.scores|minimal\.profile|minimal\.email|minimal\.uid/);
});

test("user-facing privacy controls and administrator request inbox are present", () => {
  assert.match(html, /id="privacy-request-form"/);
  assert.match(html, /id="settings-export-data"/);
  assert.match(html, /id="settings-revoke-sensitive"/);
  assert.match(html, /id="settings-clear-local-progress"/);
  assert.match(app, /localStorage\.removeItem\(progressKey\(\)\)/);
  assert.match(html, /id="admin-privacy-list"/);
  assert.match(app, /function submitPrivacyRequest/);
  assert.match(app, /function renderAdminPrivacyRequests/);
  assert.match(app, /function completeAdminPrivacyDeletion/);
});
