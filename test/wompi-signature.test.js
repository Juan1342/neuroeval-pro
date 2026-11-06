"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { validateWompiSignature } = require("../lib/wompi-signature");

function makeEvent(secret = "test-events-secret") {
  const event = {
    event: "transaction.updated",
    data: {
      transaction: {
        id: "txn_123",
        status: "APPROVED",
        reference: "NEURO-123",
        amount_in_cents: 400000,
        currency: "COP"
      }
    },
    timestamp: 1730000000,
    signature: {
      properties: [
        "transaction.id",
        "transaction.status",
        "transaction.reference",
        "transaction.amount_in_cents",
        "transaction.currency"
      ]
    }
  };

  const values = event.signature.properties.map((path) =>
    path.split(".").reduce((value, key) => value?.[key], event.data)
  );
  event.signature.checksum = crypto
    .createHash("sha256")
    .update(values.join("") + String(event.timestamp) + secret)
    .digest("hex");
  return event;
}

test("acepta un webhook con checksum válido", () => {
  const event = makeEvent();
  assert.equal(
    validateWompiSignature(event, "", "test-events-secret"),
    true
  );
});

test("rechaza un checksum manipulado", () => {
  const event = makeEvent();
  event.signature.checksum = "0".repeat(64);
  assert.throws(
    () => validateWompiSignature(event, "", "test-events-secret"),
    /firma del evento no coincide/
  );
});

test("prioriza el checksum recibido en el encabezado", () => {
  const event = makeEvent();
  assert.throws(
    () => validateWompiSignature(event, "checksum-incorrecto", "test-events-secret"),
    /firma del evento no coincide/
  );
});

test("rechaza eventos sin secreto de eventos configurado", () => {
  const event = makeEvent();
  assert.throws(
    () => validateWompiSignature(event, "", ""),
    /Falta configurar WOMPI_EVENTS_SECRET/
  );
});

test("rechaza propiedades declaradas que no existen en el evento", () => {
  const event = makeEvent();
  event.signature.properties.push("transaction.missing_field");
  assert.throws(
    () => validateWompiSignature(event, "", "test-events-secret"),
    /No se encontró la propiedad firmada/
  );
});

test("rechaza eventos sin metadatos de firma", () => {
  assert.throws(
    () => validateWompiSignature({ data: {} }, "", "test-events-secret"),
    /datos de firma requeridos/
  );
});
