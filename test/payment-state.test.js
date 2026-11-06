"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { decideWompiTransition } = require("../lib/payment-state");

test("aprueba un pago pendiente y devuelve los datos de confirmación", () => {
  const result = decideWompiTransition(
    { paymentStatus: "pending", wompiTransactionStatus: "PENDING" },
    { status: "APPROVED", transactionId: "tx-001" }
  );

  assert.equal(result.ignored, false);
  assert.deepEqual(result.update, {
    wompiTransactionId: "tx-001",
    wompiTransactionStatus: "APPROVED",
    paymentStatus: "paid",
    paymentProvider: "wompi",
    setPaidAt: true
  });
});

test("no permite que una notificación tardía quite un pago aprobado", () => {
  const result = decideWompiTransition(
    {
      paymentStatus: "paid",
      wompiTransactionId: "tx-001",
      wompiTransactionStatus: "APPROVED"
    },
    { status: "DECLINED", transactionId: "tx-001" }
  );

  assert.equal(result.ignored, true);
  assert.match(result.reason, /pago confirmado/);
});

test("ignora eventos antiguos después de un estado terminal", () => {
  const result = decideWompiTransition(
    {
      paymentStatus: "failed",
      wompiTransactionId: "tx-001",
      wompiTransactionStatus: "DECLINED"
    },
    { status: "PENDING", transactionId: "tx-001" }
  );

  assert.equal(result.ignored, true);
  assert.match(result.reason, /antigua o fuera de secuencia/);
});

test("no mezcla transacciones diferentes con la misma referencia", () => {
  const result = decideWompiTransition(
    {
      paymentStatus: "pending",
      wompiTransactionId: "tx-original",
      wompiTransactionStatus: "PENDING"
    },
    { status: "APPROVED", transactionId: "tx-diferente" }
  );

  assert.equal(result.ignored, true);
  assert.match(result.reason, /otra transacción/);
});

test("acepta una transición pendiente a rechazada", () => {
  const result = decideWompiTransition(
    { paymentStatus: "pending", wompiTransactionStatus: "PENDING" },
    { status: "DECLINED", transactionId: "tx-002" }
  );

  assert.equal(result.ignored, false);
  assert.equal(result.update.paymentStatus, "failed");
  assert.equal(result.update.wompiTransactionStatus, "DECLINED");
});

test("ignora estados de transacción que Wompi no reconoce", () => {
  const result = decideWompiTransition(
    { paymentStatus: "pending" },
    { status: "CUSTOM_STATUS", transactionId: "tx-003" }
  );

  assert.equal(result.ignored, true);
  assert.match(result.reason, /no reconocido/);
});

test("rechaza entradas incompletas", () => {
  const result = decideWompiTransition(
    {},
    { status: "APPROVED", transactionId: "" }
  );

  assert.equal(result.ignored, true);
});

test("trata VOIDED y ERROR como pagos fallidos terminales", () => {
  for (const status of ["VOIDED", "ERROR"]) {
    const result = decideWompiTransition(
      { paymentStatus: "pending", wompiTransactionStatus: "PENDING" },
      { status, transactionId: `tx-${status.toLowerCase()}` }
    );
    assert.equal(result.ignored, false);
    assert.equal(result.update.paymentStatus, "failed");
    assert.equal(result.update.wompiTransactionStatus, status);
  }
});

test("no permite convertir un rechazo terminal en aprobación con el mismo ID", () => {
  const result = decideWompiTransition(
    {
      paymentStatus: "failed",
      wompiTransactionId: "tx-declined",
      wompiTransactionStatus: "DECLINED"
    },
    { status: "APPROVED", transactionId: "tx-declined" }
  );
  assert.equal(result.ignored, true);
  assert.match(result.reason, /fuera de secuencia/);
});

test("no vuelve a aplicar una confirmación de una evaluación ya pagada", () => {
  const result = decideWompiTransition(
    {
      paymentStatus: "paid",
      wompiTransactionId: "tx-paid",
      wompiTransactionStatus: "APPROVED"
    },
    { status: "APPROVED", transactionId: "tx-paid" }
  );
  assert.equal(result.ignored, true);
  assert.match(result.reason, /pago confirmado/);
});
