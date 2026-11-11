"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { calculateEvaluationOnServer, EVALUATION_BANK, EVALUATION_CHOICES } = require("../lib/evaluation");
const { calculateParentEvaluation, PARENT_QUESTIONS } = require("../lib/parent-evaluation");
const { decideWompiTransition } = require("../lib/payment-state");
const { validateWompiSignature } = require("../lib/wompi-signature");

function validSelfAnswers() {
  return EVALUATION_BANK.map(([, question, , , , type, options, correctAnswer]) => ({
    question,
    answer: type === "task" ? correctAnswer : type === "study" ? options[0] : EVALUATION_CHOICES[0]
  }));
}

function validFamilyAnswers() {
  return PARENT_QUESTIONS.map(([, question]) => ({ question, answer: "Nunca" }));
}

test("self-assessment rejects missing answers and accepts canonical answer values", () => {
  assert.ok(calculateEvaluationOnServer([]).error);
  assert.ok(calculateEvaluationOnServer(null).error);
  const result = calculateEvaluationOnServer(validSelfAnswers());
  assert.equal(result.error, undefined);
  assert.ok(result.scores);
  assert.equal(result.answers.length, EVALUATION_BANK.length);
});

test("family observation rejects unauthorized context and accepts an adult caregiver's authorization", () => {
  const answers = validFamilyAnswers();
  assert.ok(calculateParentEvaluation(answers, {
    childAge: 10, relationship: "Madre", settings: ["casa"], consent: false
  }).error);
  const result = calculateParentEvaluation(answers, {
    childAge: 10, relationship: "Madre", settings: ["casa", "colegio"], consent: true
  });
  assert.equal(result.error, undefined);
  assert.equal(result.parentContext.ageBand, "8–12 años");
  assert.equal(result.answers.length, PARENT_QUESTIONS.length);
});

test("Wompi approval changes a pending evaluation to paid", () => {
  const result = decideWompiTransition(
    { paymentStatus: "pending" },
    { status: "APPROVED", transactionId: "tx-123" }
  );
  assert.equal(result.ignored, false);
  assert.equal(result.update.paymentStatus, "paid");
  assert.equal(result.update.wompiTransactionStatus, "APPROVED");
  assert.equal(result.update.setPaidAt, true);
});

test("Wompi ignores a different transaction and duplicate paid notifications", () => {
  const mismatch = decideWompiTransition(
    { paymentStatus: "pending", wompiTransactionId: "tx-original" },
    { status: "APPROVED", transactionId: "tx-other" }
  );
  assert.equal(mismatch.ignored, true);
  const duplicate = decideWompiTransition(
    { paymentStatus: "paid", wompiTransactionId: "tx-original" },
    { status: "APPROVED", transactionId: "tx-original" }
  );
  assert.equal(duplicate.ignored, true);
});

test("Wompi signature accepts a correct checksum and rejects a forged one", () => {
  const secret = "unit-test-secret";
  const event = {
    data: { transaction: { id: "tx-123", status: "APPROVED" } },
    timestamp: 1700000000,
    signature: { properties: ["transaction.id", "transaction.status"] }
  };
  const checksum = crypto.createHash("sha256")
    .update("tx-123APPROVED" + String(event.timestamp) + secret)
    .digest("hex");
  assert.equal(validateWompiSignature(event, checksum, secret), true);
  assert.throws(() => validateWompiSignature(event, "forged", secret));
});
