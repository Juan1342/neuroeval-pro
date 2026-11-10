"use strict";

const DEFAULT_EVALUATION_PRICE_COP = 4000;

function calculateEvaluationPaymentAmounts(discountValue = 0) {
  const requestedDiscount = Number(discountValue);
  const discountCop = Number.isSafeInteger(requestedDiscount)
    ? Math.min(DEFAULT_EVALUATION_PRICE_COP - 1, Math.max(0, requestedDiscount))
    : 0;

  return {
    originalAmountCop: DEFAULT_EVALUATION_PRICE_COP,
    discountCop,
    amountCop: DEFAULT_EVALUATION_PRICE_COP - discountCop
  };
}

function isLegacyPendingPayment(evaluation = {}) {
  if (evaluation.paymentStatus !== "pending" || !evaluation.paymentReference) {
    return false;
  }

  const storedAmount = Number(
    evaluation.amountCop ?? evaluation.originalAmountCop ?? 0
  );

  return Number.isSafeInteger(storedAmount) &&
    storedAmount > 0 &&
    storedAmount !== DEFAULT_EVALUATION_PRICE_COP;
}

module.exports = {
  DEFAULT_EVALUATION_PRICE_COP,
  calculateEvaluationPaymentAmounts,
  isLegacyPendingPayment
};
