"use strict";

const WOMPI_API_BASE_URLS = Object.freeze({
  test: "https://sandbox.wompi.co",
  prod: "https://production.wompi.co"
});

function resolveWompiEnvironment(publicKey, privateKey) {
  const publicEnvironment = String(publicKey || "").startsWith("pub_test_")
    ? "test"
    : String(publicKey || "").startsWith("pub_prod_")
      ? "prod"
      : "";
  const privateEnvironment = String(privateKey || "").startsWith("prv_test_")
    ? "test"
    : String(privateKey || "").startsWith("prv_prod_")
      ? "prod"
      : "";

  if (!publicEnvironment || !privateEnvironment) {
    throw new Error("Las llaves pública y privada de Wompi no tienen un ambiente reconocido.");
  }
  if (publicEnvironment !== privateEnvironment) {
    throw new Error("Las llaves pública y privada de Wompi pertenecen a ambientes distintos.");
  }
  return publicEnvironment;
}

async function fetchWompiTransaction({
  transactionId,
  publicKey,
  privateKey,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000
} = {}) {
  const id = String(transactionId || "").trim();
  if (!id || id.length > 255) {
    throw new Error("El identificador de transacción de Wompi no es válido.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("No está disponible el cliente HTTP para consultar Wompi.");
  }

  const environment = resolveWompiEnvironment(publicKey, privateKey);
  const baseUrl = WOMPI_API_BASE_URLS[environment];
  const response = await fetchImpl(
    `${baseUrl}/v1/transactions/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${privateKey}`
      },
      signal: AbortSignal.timeout(timeoutMs)
    }
  );

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw new Error("Wompi devolvió una respuesta que no es JSON válido.");
  }

  if (!response.ok) {
    throw new Error(`No se pudo verificar la transacción en Wompi (HTTP ${response.status}).`);
  }

  const transaction = payload?.data;
  if (!transaction || String(transaction.id || "") !== id) {
    throw new Error("La consulta de Wompi no coincide con el identificador solicitado.");
  }

  return transaction;
}

module.exports = {
  resolveWompiEnvironment,
  fetchWompiTransaction
};
