"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_EVALUATION_PRICE_COP,
  calculateEvaluationPaymentAmounts,
  isLegacyPendingPayment
} = require("../lib/pricing");

test("el precio base vigente es de 4.000 COP", () => {
  assert.equal(DEFAULT_EVALUATION_PRICE_COP, 4000);
});

test("un descuento válido se resta del precio base", () => {
  assert.deepEqual(calculateEvaluationPaymentAmounts(1000), {
    originalAmountCop: 4000,
    discountCop: 1000,
    amountCop: 3000
  });
});

test("limita descuentos heredados para no cobrar cero ni un valor negativo", () => {
  assert.deepEqual(calculateEvaluationPaymentAmounts(19900), {
    originalAmountCop: 4000,
    discountCop: 3999,
    amountCop: 1
  });
});

test("ignora descuentos inválidos y mantiene el precio base", () => {
  assert.deepEqual(calculateEvaluationPaymentAmounts("descuento"), {
    originalAmountCop: 4000,
    discountCop: 0,
    amountCop: 4000
  });
});

test("identifica un intento pendiente con referencia e importe histórico", () => {
  assert.equal(isLegacyPendingPayment({
    paymentStatus: "pending",
    paymentReference: "ref-anterior",
    amountCop: 19900
  }), true);
});

test("no bloquea evaluaciones nuevas o intentos ya terminados", () => {
  assert.equal(isLegacyPendingPayment({
    paymentStatus: "pending",
    paymentReference: "ref-vigente",
    amountCop: 4000
  }), false);
  assert.equal(isLegacyPendingPayment({
    paymentStatus: "failed",
    paymentReference: "ref-anterior",
    amountCop: 19900
  }), false);
  assert.equal(isLegacyPendingPayment({
    paymentStatus: "pending",
    amountCop: 19900
  }), false);
});
