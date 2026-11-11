"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { calculateEvaluationOnServer } = require("../lib/evaluation");
const { calculateParentEvaluation } = require("../lib/parent-evaluation");
const { decideWompiTransition } = require("../lib/payment-state");
const { validateWompiSignature } = require("../lib/wompi-signature");

test("self-assessment rejects missing or malformed answer sets", () => {
  assert.ok(calculateEvaluationOnServer([]).error);
  assert.ok(calculateEvaluationOnServer(null).error);
});

test("family observation rejects missing answers and unauthorized context", () => {
  assert.ok(calculateParentEvaluation([], {}).error);
  assert.ok(calculateParentEvaluation([], {
    childAge: 10, relationship: "Madre", settings: ["casa"], consent: false
  }).error);
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
