"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync("public/app.js", "utf8");
const html = fs.readFileSync("public/index.html", "utf8");
const dictionaryStart = app.indexOf("const uiTranslations = {");
const dictionaryEnd = app.indexOf("const reverseUiTranslations", dictionaryStart);
assert.ok(dictionaryStart >= 0 && dictionaryEnd > dictionaryStart, "bilingual UI dictionary must exist");
const dictionary = app.slice(dictionaryStart, dictionaryEnd);

test("the language selector offers Spanish and English and updates document metadata", () => {
  assert.match(html, /<select id="global-language"/);
  assert.match(html, /<option value="es">🌐 Español<\/option>/);
  assert.match(html, /<option value="en">🌐 English<\/option>/);
  assert.match(app, /document\.documentElement\.lang = currentLanguage/);
  assert.match(app, /document\.title = currentLanguage === "en"/);
  assert.match(app, /localStorage\.setItem\("neuroeval-language", currentLanguage\)/);
  assert.match(app, /languageSelect\.addEventListener\("change", \(\) => setLanguage\(languageSelect\.value, \{ persist: true \}\)\)/);
});

test("language handling covers generated DOM text, placeholders, accessibility attributes and native dialogs", () => {
  assert.match(app, /function applyLanguageToDom\(root = document\.body\)/);
  assert.match(app, /input\[placeholder\],textarea\[placeholder\]/);
  assert.match(app, /\[title\],\[aria-label\],\[alt\]/);
  assert.match(app, /attributes: true, attributeFilter: \["placeholder", "title", "aria-label", "alt", "value"\]/);
  assert.match(app, /input\[type=button\]\[value\],input\[type=submit\]\[value\]/);
  assert.match(app, /function startLanguageObserver\(\)/);
  assert.match(app, /window\.alert = message => nativeAlert\(translateUiText\(message\)\)/);
  assert.match(app, /window\.confirm = message => nativeConfirm\(translateUiText\(message\)\)/);
  assert.match(app, /window\.prompt = \(message, defaultValue\) => nativePrompt\(translateUiText\(message\), defaultValue\)/);
});

test("global map explanatory copy and fallback messages have English translations", () => {
  const requiredTranslations = [
    ["Países resaltados cuando tienen grupos agregados de al menos 10 usuarios.", "Countries are highlighted when they have aggregated groups of at least 10 users."],
    ["Solo se resaltan países con al menos 10 perfiles y código reconocible. No se muestran ubicaciones individuales.", "Only countries with at least 10 profiles and a recognized code are highlighted. Individual locations are not shown."],
    ["Cartografía: Natural Earth, escala 1:110m. Datos de dominio público; límites esquemáticos, no oficiales.", "Cartography: Natural Earth, 1:110m scale. Public-domain data; schematic, non-official boundaries."],
    ["No se pudo cargar la cartografía mundial.", "The world map could not be loaded."],
    ["El archivo cartográfico no es válido.", "The map data file is invalid."]
  ];
  for (const [spanish, english] of requiredTranslations) {
    assert.ok(dictionary.includes(JSON.stringify(spanish) + ": " + JSON.stringify(english)),
      "missing translation: " + spanish);
  }
});

test("country map is localized, privacy-thresholded and does not request individual location", () => {
  assert.match(app, /feature\.properties\?\.name_en/);
  assert.match(app, /feature\.properties\?\.name_es/);
  assert.match(app, /count >= 10/);
  assert.match(app, /host\.setAttribute\("aria-label", mapLabel\)/);
  assert.match(app, /path\.setAttribute\("data-country-code", code\)/);
  assert.doesNotMatch(app, /navigator\.geolocation|Geolocation\.getCurrentPosition/);
});


test("the English word-memory game uses English prompts and answer values", () => {
  assert.match(app, /const bank=currentLanguage==="en"\?\["CLOUD","PENCIL","RIVER","CUP","MOON","FLOWER","CLOCK","BREAD","KEY","MOUNTAIN","BOOK","WINDOW","ROAD","ORANGE","STAR","GARDEN","MUSIC","TRAIN"\]/);
});

test("personal PDF and password reset email follow the selected account language", () => {
  const server = require("node:fs").readFileSync("server.js", "utf8");
  assert.match(server, /function translateReportText\(value, language = "es"\)/);
  assert.match(server, /const reportLanguage = \["es", "en"\]/);
  assert.match(server, /buildEvaluationPdf\(result\.data, \{ language: reportLanguage \}\)/);
  assert.match(server, /const resetLanguage = userProfileSnapshot\.exists[\s\S]{0,180}\? "en" : "es"/);
  assert.match(server, /subject: "Password reset code · NeuroEval Pro"/);
  assert.match(server, /Your verification code is:/);
  assert.match(server, /Tu código de verificación es:/);
  const app = require("node:fs").readFileSync("public/app.js", "utf8");
  assert.match(app, /\/pdf\?language=" \+ encodeURIComponent\(currentLanguage\)/);
});
