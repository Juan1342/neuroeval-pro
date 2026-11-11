"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const server = fs.readFileSync("server.js", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");

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
});

test("personal data rights endpoints are owner-scoped and admin review is restricted", () => {
  assert.match(server, /api\/privacy\/export", requireUser/);
  assert.match(server, /api\/privacy\/requests", requireUser/);
  assert.match(server, /api\/admin\/privacy-requests", requireUser, requireAdmin/);
  assert.match(server, /api\/admin\/privacy-requests\/:id", requireUser, requireAdmin/);
  assert.match(app, /api\("\/api\/privacy\/export"/);
  assert.match(app, /api\("\/api\/privacy\/requests"/);
});
