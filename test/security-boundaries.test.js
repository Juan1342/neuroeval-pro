"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const server = fs.readFileSync("server.js", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
const privacyPolicy = fs.readFileSync("public/privacy.html", "utf8");

test("server and browser application source parse successfully", () => {
  assert.doesNotThrow(() => new vm.Script(server, { filename: "server.js" }));
  const browserSource = app.replace(/^import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];\s*/gm, "");
  assert.doesNotThrow(() => new vm.Script(browserSource, { filename: "public/app.js" }));
});

test("global analytics is authenticated, paginated and privacy-thresholded", () => {
  assert.match(server, /api\/admin\/analytics\/global", requireUser, requireStaffAdmin\("dashboard\.view"\)/);
  assert.match(server, /GLOBAL_ANALYTICS_PAGE_SIZE = 1000/);
  assert.match(server, /GLOBAL_ANALYTICS_MAX_USERS = 50000/);
  assert.match(server, /\.startAfter\(cursor\)/);
  assert.match(server, /aggregateProfiles\(profiles, 10\)/);
  assert.match(server, /systemCache"\)\.doc\("globalAnalytics"\)/);
  assert.match(server, /GLOBAL_ANALYTICS_CACHE_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(server, /\.select\("country", "city", "detectedCountryCode", "age", "language"\)/);
});

test("evaluation creation requires current privacy consent and an adult account", () => {
  assert.match(server, /privacyConsents"\)\.doc\(PRIVACY_NOTICE_VERSION_ACTIVE\)/);
  assert.match(server, /age < 18 \|\| age > 99/);
  assert.match(server, /delete parentContextRecord\.childAge/);
  assert.match(app, /async function ensureCurrentPrivacyConsent\(\)/);
  assert.match(app, /privacyConsent: \{ accepted: true, version: PRIVACY_NOTICE_VERSION, language \}/);
  assert.match(html, /id="consent"/);
  assert.match(html, /id="parent-guardian-consent"/);
  assert.match(html, /id="admin-panel-privacy"/);
  assert.match(privacyPolicy, /BORRADOR NO APTO PARA PUBLICACIÓN/);
  assert.match(privacyPolicy, /NOT READY FOR PUBLICATION/);
  assert.match(privacyPolicy, /\[NOMBRE LEGAL O RAZÓN SOCIAL DEL RESPONSABLE\]/);
});

test("personal data rights endpoints are owner-scoped and admin review is restricted", () => {
  assert.match(server, /api\/privacy\/export", requireUser/);
  assert.match(server, /api\/privacy\/requests", requireUser/);
  assert.match(server, /api\/admin\/privacy-requests", requireUser, requireAdmin/);
  assert.match(server, /api\/admin\/privacy-requests\/:id", requireUser, requireAdmin/);
  assert.match(app, /api\("\/api\/privacy\/export"/);
  assert.match(app, /api\("\/api\/privacy\/requests"/);
});


test("PDF reports honor an explicit supported language and expose only a minor age band", () => {
  assert.match(server, /const requestedLanguage = String\(req\.query\.language \|\| ""\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(server, /const reportLanguage = \["es", "en"\]\.includes\(requestedLanguage\) \? requestedLanguage : profileLanguage/);
  const builderStart = server.indexOf("function buildEvaluationPdf");
  const builderEnd = server.indexOf('app.get(\n  "/api/my-evaluations/:id/pdf"', builderStart);
  assert.ok(builderStart >= 0 && builderEnd > builderStart, "PDF builder and personal PDF route must exist");
  const pdfBuilder = server.slice(builderStart, builderEnd);
  assert.match(pdfBuilder, /evaluation\.parentContext\?\.childAgeBand/);
  assert.doesNotMatch(pdfBuilder, /evaluation\.parentContext\?\.childAge\b/);
});

test("individual evaluation lookup enforces record ownership", () => {
  assert.match(server, /if \(evaluation\.uid !== uid\) return null/);
});


test("legacy exact minor age is not exposed by administrative endpoints", () => {
  assert.match(server, /childAgeBand:data\.parentContext\?\.childAgeBand\|\|data\.parentContext\?\.ageBand\|\|null/);
  assert.match(server, /const \{ childAge, \.\.\.safeParentContext \} = parentContext/);
  assert.match(server, /parentContext: safeParentContext/);
});


test("admin evaluation views redact client identity without clients.view", () => {
  assert.match(server, /if \(!can\("clients\.view"\)\) \{\s*\["uid", "name", "email", "age"\]/);
  assert.match(server, /const canViewClientIdentity = req\.adminAccess\?\.isPrimaryAdmin === true/);
  assert.match(server, /if \(!canViewClientIdentity\) \{\s*\["uid", "name", "email", "age"\]/);
  assert.match(server, /reportData\.name = ""/);
  assert.match(server, /reportData\.email = ""/);
  assert.match(server, /delete reportData\.age/);
});


test("adult and family questionnaires have English translations for visible prompts", () => {
  const dictionaryMatch = app.match(/const uiTranslations = (\{[\s\S]*?\n\});/);
  const adultBankMatch = app.match(/const bank = (\[[\s\S]*?\n\]);/);
  const familyBankMatch = app.match(/const parentQuestionBank = (\[[\s\S]*?\n\]);/);
  assert.ok(dictionaryMatch, "UI translation dictionary must exist");
  assert.ok(adultBankMatch, "adult questionnaire bank must exist");
  assert.ok(familyBankMatch, "family questionnaire bank must exist");
  const dictionary = vm.runInNewContext("(" + dictionaryMatch[1] + ")");
  const adultBank = vm.runInNewContext(adultBankMatch[1]);
  const familyBank = vm.runInNewContext(familyBankMatch[1]);
  for (const [index, question] of adultBank.entries()) {
    for (const position of [0, 1, 4]) {
      if (typeof question[position] === "string") {
        assert.ok(dictionary[question[position]], "Missing adult-question translation at row " + index + ": " + question[position]);
      }
    }
    if (Array.isArray(question[6])) {
      for (const option of question[6]) {
        if (typeof option === "string" && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(option)) {
          assert.ok(dictionary[option], "Missing adult answer translation: " + option);
        }
      }
    }
  }
  for (const [index, question] of familyBank.entries()) {
    for (const position of [0, 1, 4]) {
      assert.ok(dictionary[question[position]], "Missing family-question translation at row " + index + ": " + question[position]);
    }
  }
});
