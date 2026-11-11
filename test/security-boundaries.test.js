"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const server = fs.readFileSync("server.js", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
const privacyPolicy = fs.readFileSync("public/privacy.html", "utf8");
const envExample = fs.readFileSync(".env.example", "utf8");

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
  assert.match(privacyPolicy, /JUAN MANUEL ZAMORA ZAPATA/);
  assert.match(privacyPolicy, /Carrera 60 # 71-10, Bello, Antioquia, Colombia/);
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
      if (typeof question[position] === "string" && /[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(question[position])) {
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


test("password recovery email follows the account language", () => {
  assert.match(server, /const resetLanguage = userProfileSnapshot\.exists[\s\S]{0,180}\? "en" : "es"/);
  assert.match(server, /subject: "Password reset code · NeuroEval Pro"/);
  assert.match(server, /Your verification code is:/);
  assert.match(server, /Tu código de verificación es:/);
});


test("native browser dialogs are translated using the active interface language", () => {
  assert.match(app, /window\.alert = message => nativeAlert\(translateUiText\(message\)\)/);
  assert.match(app, /window\.confirm = message => nativeConfirm\(translateUiText\(message\)\)/);
  assert.match(app, /window\.prompt = \(message, defaultValue\) => nativePrompt\(translateUiText\(message\), defaultValue\)/);
  assert.match(app, /"No se pudo guardar tu evaluación:": "Could not save your assessment:"/);
  assert.match(app, /"No tienes permisos para consultar esta sección\.": "You do not have permission to view this section\."/);
});


test("Wompi webhook verifies transaction identity and amount through the authenticated API", () => {
  assert.match(server, /const WOMPI_PRIVATE_KEY = process\.env\.WOMPI_PRIVATE_KEY \|\| ""/);
  assert.match(server, /if \(!WOMPI_PRIVATE_KEY\)/);
  assert.match(server, /fetchWompiTransaction\(\{\s*transactionId,\s*publicKey: WOMPI_PUBLIC_KEY,\s*privateKey: WOMPI_PRIVATE_KEY/);
  assert.match(server, /const reference = String\(verifiedTransaction\.reference \|\| ""\)/);
  assert.match(server, /const amountInCents = Number\(verifiedTransaction\.amount_in_cents\)/);
  assert.match(server, /const currency = String\(verifiedTransaction\.currency \|\| ""\)\.toUpperCase\(\)/);
  assert.match(server, /const status = String\(verifiedTransaction\.status \|\| ""\)\.toUpperCase\(\)/);
  assert.match(envExample, /WOMPI_PRIVATE_KEY=/);
});


test("sensitive assessment data requires a separate versioned explicit consent", () => {
  assert.match(server, /validateSensitiveDataConsent/);
  assert.match(server, /sensitiveDataConsents/);
  assert.match(server, /sensitiveDataConsentVersion/);
  assert.match(server, /sensitiveConsentSnapshot\.data\(\)\?\.accepted !== true/);
  assert.match(app, /sensitiveDataConsent: \{ accepted: true, version: PRIVACY_NOTICE_VERSION, language: currentLanguage \}/);
  assert.match(app, /sensitiveDataConsentVersion === PRIVACY_NOTICE_VERSION/);
  assert.match(html, /id="sensitive-data-consent"/);
  assert.match(html, /id="parent-sensitive-data-consent"/);
  assert.match(privacyPolicy, /datos personales sensibles relacionados con salud, atención y bienestar cognitivo/);
  assert.match(privacyPolicy, /sensitive personal data related to health, attention and cognitive well-being/);
});


test("privacy export includes sensitive-data consent history and reports truncation accurately", () => {
  assert.match(server, /sensitiveDataConsents: sensitiveConsentSnapshot\.docs\.map/);
  assert.match(server, /db\.collection\("evaluations"\)\.where\("uid", "==", uid\)\.limit\(1001\)/);
  assert.match(server, /truncated: evaluationsSnapshot\.size > 1000/);
});

test("withdrawing sensitive-data consent blocks future assessments immediately", () => {
  assert.match(server, /"withdraw_consent"/);
  assert.match(server, /sensitiveDataConsentVersion: FieldValue\.delete\(\)/);
  assert.match(server, /accepted: false,[\s\S]{0,100}withdrawnAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(server, /sensitiveConsentSnapshot\.data\(\)\?\.accepted !== true/);
  assert.match(app, /if \(type === "withdraw_consent"\)/);
  assert.match(html, /value="withdraw_consent"/);
});


test("global analytics is admin-only, minimized and suppresses small groups", () => {
  const routeStart = server.indexOf('app.get("/api/admin/analytics/global"');
  const routeEnd = server.indexOf('app.get("/api/admin/analytics/commercial"', routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart, "global analytics route must exist");
  const route = server.slice(routeStart, routeEnd);
  assert.match(route, /requireStaffAdmin\("dashboard\.view"\)/);
  assert.match(route, /select\("country", "city", "detectedCountryCode", "age", "language"\)/);
  assert.match(route, /aggregateProfiles\(profiles, 10\)/);
  assert.match(route, /privacyThreshold: 10/);
  assert.doesNotMatch(route, /customerEmail|answers|recommendations|profileDescription/);
  assert.match(server, /GLOBAL_ANALYTICS_MAX_USERS = 50000/);
  assert.match(route, /truncated: hasMore/);
});


test("every static DOM ID referenced by the application exists exactly once", () => {
  const htmlIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const idCounts = new Map();
  for (const id of htmlIds) idCounts.set(id, (idCounts.get(id) || 0) + 1);
  const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  const references = [...new Set([...app.matchAll(/\$\(["']([^"']+)["']\)/g)].map(match => match[1]))];
  const missing = references.filter(id => !idCounts.has(id));
  assert.deepEqual(duplicates, []);
  assert.deepEqual(missing, []);
});


test("registration offers localized country suggestions without requesting GPS", () => {
  assert.match(html, /id="reg-country"[^>]*list="country-options"/);
  assert.match(html, /<datalist id="country-options"><\/datalist>/);
  assert.match(app, /new Intl\.DisplayNames\(\[locale\], \{ type: "region" \}\)/);
  assert.doesNotMatch(app, /navigator\.geolocation|Geolocation\.getCurrentPosition/);
});


test("webhook reference fields cannot override or suppress the authenticated Wompi reference", () => {
  assert.match(server, /const reference = String\(verifiedTransaction\.reference \|\| ""\)/);
  assert.match(server, /La referencia del evento difiere de la referencia autenticada de Wompi/);
  const eventReferenceBlockStart = server.indexOf('const eventReference = String(transaction.reference');
  const eventReferenceBlockEnd = server.indexOf('const query = await db', eventReferenceBlockStart);
  assert.ok(eventReferenceBlockStart >= 0 && eventReferenceBlockEnd > eventReferenceBlockStart);
  const eventReferenceBlock = server.slice(eventReferenceBlockStart, eventReferenceBlockEnd);
  assert.doesNotMatch(eventReferenceBlock, /return res\.status\(200\)\.json/);
});


test("initial UI language follows saved preference or browser language before first render", () => {
  assert.match(app, /function preferredLanguage\(profileLanguage\)/);
  assert.match(app, /setLanguage\(preferredLanguage\(\)\);\s*initializeFirebase\(\);/);
});
