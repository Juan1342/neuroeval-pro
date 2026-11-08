"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PARENT_QUESTIONS,
  FREQUENCY_OPTIONS,
  calculateParentEvaluation
} = require("../lib/parent-evaluation");

function makeAnswers(answer = "Nunca") {
  return PARENT_QUESTIONS.map(([, question]) => ({ question, answer }));
}
function metadata(overrides = {}) {
  return { childAge: 9, relationship: "Madre", settings: ["casa", "colegio"], consent: true, ...overrides };
}

test("el cuestionario familiar contiene 24 preguntas únicas", () => {
  assert.equal(PARENT_QUESTIONS.length, 24);
  assert.equal(new Set(PARENT_QUESTIONS.map(item => item[1])).size, 24);
  assert.deepEqual(FREQUENCY_OPTIONS, ["Nunca", "Algunas veces", "A menudo", "Muy a menudo"]);
});

test("calcula dimensiones descriptivas sin emitir diagnóstico", () => {
  const result = calculateParentEvaluation(makeAnswers("A menudo"), metadata());
  assert.equal(result.error, undefined);
  assert.equal(result.answers.length, 24);
  assert.equal(result.parentContext.ageBand, "8–12 años");
  assert.equal(typeof result.scores.inattention, "number");
  assert.equal(typeof result.scores.hyperactivity, "number");
  assert.equal(typeof result.scores.impulsivity, "number");
  assert.match(result.disclaimer, /no diagnostica ni descarta TDAH/);
  assert.match(result.profileDescription, /no confirma TDAH/);
});

test("adapta la etapa de edad y rechaza edades fuera de 4 a 17", () => {
  assert.equal(calculateParentEvaluation(makeAnswers(), metadata({ childAge: 4 })).parentContext.ageBand, "4–7 años");
  assert.equal(calculateParentEvaluation(makeAnswers(), metadata({ childAge: 17 })).parentContext.ageBand, "13–17 años");
  assert.match(calculateParentEvaluation(makeAnswers(), metadata({ childAge: 3 })).error, /4 y 17/);
  assert.match(calculateParentEvaluation(makeAnswers(), metadata({ childAge: 18 })).error, /4 y 17/);
});

test("requiere parentesco, entorno y autorización del cuidador", () => {
  assert.match(calculateParentEvaluation(makeAnswers(), metadata({ consent: false })).error, /autorización/);
  assert.match(calculateParentEvaluation(makeAnswers(), metadata({ settings: [] })).error, /autorización/);
  assert.match(calculateParentEvaluation(makeAnswers(), metadata({ relationship: "" })).error, /autorización/);
});

test("rechaza respuestas duplicadas, desconocidas o con opciones inválidas", () => {
  const duplicate = makeAnswers();
  duplicate[1].question = duplicate[0].question;
  assert.match(calculateParentEvaluation(duplicate, metadata()).error, /desconocidas o repetidas/);
  const unknown = makeAnswers();
  unknown[0].question = "Pregunta inventada";
  assert.match(calculateParentEvaluation(unknown, metadata()).error, /desconocidas o repetidas/);
  const invalid = makeAnswers();
  invalid[0].answer = "Siempre";
  assert.match(calculateParentEvaluation(invalid, metadata()).error, /opción de respuesta/);
});

test("separa factores contextuales de las dimensiones de conducta", () => {
  const answers = makeAnswers("Nunca");
  answers[23].answer = "Muy a menudo";
  const result = calculateParentEvaluation(answers, metadata());
  assert.equal(result.scores.contextFactors, 100);
  assert.equal(result.scores.inattention, 0);
  assert.match(result.dimensions.contextFactors.explanation, /no son síntomas de TDAH/);
});

test("un patrón frecuente con impacto y distintos entornos recomienda consulta, no diagnóstico", () => {
  const result = calculateParentEvaluation(makeAnswers("Muy a menudo"), metadata());
  assert.match(result.profile, /conviene explorar/);
  assert.ok(result.recommendations.some(item => item.title === "Solicita una valoración profesional"));
  assert.match(result.disclaimer, /no es una escala clínica validada/);
});
