"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  EVALUATION_CHOICES,
  EVALUATION_BANK,
  calculateEvaluationOnServer
} = require("../lib/evaluation");

function makeAnswers(answer = "Nunca") {
  return EVALUATION_BANK.map(([, question, , , , type, options]) => ({
    question,
    answer: type === "task" || type === "study" ? options[0] : answer
  }));
}

test("el banco canónico contiene 26 preguntas únicas", () => {
  assert.equal(EVALUATION_BANK.length, 26);
  assert.equal(new Set(EVALUATION_BANK.map(item => item[1])).size, 26);
  assert.deepEqual(EVALUATION_CHOICES, [
    "Nunca", "Rara vez", "A veces", "Con frecuencia", "Casi siempre"
  ]);
});

test("calcula resultados a partir de las 26 respuestas válidas", () => {
  const result = calculateEvaluationOnServer(makeAnswers("Casi siempre"));
  assert.equal(result.error, undefined);
  assert.equal(result.answers.length, 26);
  assert.deepEqual(result.scores, {
    inattention: 100,
    executive: 100,
    hyperactivity: 100,
    emotionalContext: 100,
    context: 100,
    impact: 100,
    history: 100
  });
  assert.match(result.disclaimer, /no representan la probabilidad/);
});

test("calcula las dimensiones sin contar las actividades interactivas como síntomas", () => {
  const result = calculateEvaluationOnServer(makeAnswers("Nunca"));
  assert.equal(result.error, undefined);
  assert.equal(result.scores.inattention, 0);
  assert.equal(result.scores.executive, 0);
  assert.equal(result.scores.hyperactivity, 0);
  assert.ok(result.attentionTasks.completed > 0);
});

test("ignora categoría, dimensión y puntos enviados por el cliente", () => {
  const answers = makeAnswers("Con frecuencia").map(item => ({
    ...item, category: "Manipulada", dimension: "hyperactivity", points: 999
  }));
  const result = calculateEvaluationOnServer(answers);
  assert.equal(result.error, undefined);
  assert.equal(result.answers[0].category, EVALUATION_BANK[0][0]);
  assert.equal(result.answers[0].dimension, EVALUATION_BANK[0][2]);
  assert.equal(result.answers[0].points, null);
});

test("rechaza cantidades distintas de 26 respuestas", () => {
  assert.match(calculateEvaluationOnServer(makeAnswers().slice(0,25)).error, /exactamente 26/);
  assert.match(calculateEvaluationOnServer([...makeAnswers(), makeAnswers()[0]]).error, /exactamente 26/);
});

test("rechaza preguntas desconocidas y preguntas repetidas", () => {
  const unknown = makeAnswers(); unknown[0].question = "Pregunta inventada";
  assert.match(calculateEvaluationOnServer(unknown).error, /desconocidas o repetidas/);
  const repeated = makeAnswers(); repeated[1].question = repeated[0].question;
  assert.match(calculateEvaluationOnServer(repeated).error, /desconocidas o repetidas/);
});

test("rechaza opciones de frecuencia no incluidas en el banco", () => {
  const answers = makeAnswers(); answers[1].answer = "Siempre";
  assert.match(calculateEvaluationOnServer(answers).error, /opciones de respuesta no son válidas/);
});

test("rechaza opciones interactivas no incluidas en la pregunta", () => {
  const answers = makeAnswers(); answers[0].answer = "Respuesta inventada";
  assert.match(calculateEvaluationOnServer(answers).error, /respuesta de actividad interactiva no es válida/);
});

test("rechaza respuestas con estructura incorrecta", () => {
  const answers = makeAnswers(); answers[0] = null;
  assert.match(calculateEvaluationOnServer(answers).error, /formato inválido/);
});
