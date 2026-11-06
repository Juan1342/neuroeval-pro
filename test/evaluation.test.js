"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EVALUATION_CHOICES,
  EVALUATION_BANK,
  calculateEvaluationOnServer
} = require("../lib/evaluation");

function makeAnswers(count = 15, answer = "Nunca") {
  return EVALUATION_BANK.slice(0, count).map(([, question]) => ({
    question,
    answer
  }));
}

test("el banco canónico contiene 18 preguntas únicas", () => {
  assert.equal(EVALUATION_BANK.length, 18);
  assert.equal(new Set(EVALUATION_BANK.map((item) => item[1])).size, 18);
  assert.deepEqual(EVALUATION_CHOICES, [
    "Nunca",
    "Raramente",
    "A veces",
    "A menudo",
    "Muy a menudo"
  ]);
});

test("calcula resultados a partir de 15 respuestas válidas", () => {
  const result = calculateEvaluationOnServer(makeAnswers(15, "Muy a menudo"));

  assert.equal(result.error, undefined);
  assert.equal(result.answers.length, 15);
  assert.deepEqual(result.scores, {
    inattention: 100,
    hyperactivity: 100,
    differential: 100
  });
  assert.equal(result.profile, "Indicadores asociados a estrés o sobrecarga");
  assert.ok(result.profileDescription.includes("estrés"));
  assert.equal(result.recommendations.length, 3);
});

test("ignora categoría, dimensión y puntos enviados por el cliente", () => {
  const answers = makeAnswers(15, "A menudo").map((item) => ({
    ...item,
    category: "Manipulada",
    dimension: "hyperactivity",
    points: 999
  }));

  const result = calculateEvaluationOnServer(answers);
  const canonical = EVALUATION_BANK[0];

  assert.equal(result.error, undefined);
  assert.equal(result.answers[0].category, canonical[0]);
  assert.equal(result.answers[0].dimension, canonical[2]);
  assert.equal(result.answers[0].points, 3);
  assert.equal(result.scores.inattention, 75);
});

test("rechaza cantidades distintas de 15 respuestas", () => {
  assert.match(
    calculateEvaluationOnServer(makeAnswers(14)).error,
    /exactamente 15/
  );
  assert.match(
    calculateEvaluationOnServer(makeAnswers(16)).error,
    /exactamente 15/
  );
});

test("rechaza preguntas desconocidas y preguntas repetidas", () => {
  const unknown = makeAnswers();
  unknown[0].question = "Pregunta inventada";
  assert.match(
    calculateEvaluationOnServer(unknown).error,
    /desconocidas o repetidas/
  );

  const repeated = makeAnswers();
  repeated[1].question = repeated[0].question;
  assert.match(
    calculateEvaluationOnServer(repeated).error,
    /desconocidas o repetidas/
  );
});

test("rechaza opciones de respuesta no incluidas en el banco", () => {
  const answers = makeAnswers();
  answers[0].answer = "Siempre";
  assert.match(
    calculateEvaluationOnServer(answers).error,
    /opciones de respuesta no son válidas/
  );
});

test("rechaza respuestas con estructura incorrecta", () => {
  const answers = makeAnswers();
  answers[0] = null;
  assert.match(
    calculateEvaluationOnServer(answers).error,
    /formato inválido/
  );
});
