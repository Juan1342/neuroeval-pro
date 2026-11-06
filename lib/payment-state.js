"use strict";

const TERMINAL_WOMPI_STATUSES = new Set([
  "APPROVED",
  "DECLINED",
  "VOIDED",
  "ERROR"
]);

function decideWompiTransition(evaluation = {}, incoming = {}) {
  const status = String(incoming.status || "").toUpperCase();
  const transactionId = String(incoming.transactionId || "");
  const existingTransactionId = String(
    evaluation.wompiTransactionId || ""
  );

  if (!status || !transactionId) {
    return { ignored: true, reason: "Faltan datos de la transacción." };
  }

  if (
    existingTransactionId &&
    existingTransactionId !== transactionId
  ) {
    return {
      ignored: true,
      reason: "La referencia ya está asociada a otra transacción."
    };
  }

  if (evaluation.paymentStatus === "paid") {
    return {
      ignored: true,
      reason: "La evaluación ya tiene un pago confirmado."
    };
  }

  const currentStatus = String(
    evaluation.wompiTransactionStatus || ""
  ).toUpperCase();

  if (
    TERMINAL_WOMPI_STATUSES.has(currentStatus) &&
    status !== currentStatus
  ) {
    return {
      ignored: true,
      reason: "Se ignoró una notificación antigua o fuera de secuencia."
    };
  }

  const update = {
    wompiTransactionId: transactionId,
    wompiTransactionStatus: status
  };

  if (status === "APPROVED") {
    update.paymentStatus = "paid";
    update.paymentProvider = "wompi";
    update.setPaidAt = true;
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(status)) {
    update.paymentStatus = "failed";
  }

  return { ignored: false, update };
}

module.exports = { decideWompiTransition };
