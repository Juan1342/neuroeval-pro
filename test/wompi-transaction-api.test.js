"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveWompiEnvironment,
  fetchWompiTransaction
} = require("../lib/wompi-transaction-api");

test("Wompi public and private keys must belong to the same environment", () => {
  assert.equal(resolveWompiEnvironment("pub_test_public", "prv_test_private"), "test");
  assert.equal(resolveWompiEnvironment("pub_prod_public", "prv_prod_private"), "prod");
  assert.throws(
    () => resolveWompiEnvironment("pub_prod_public", "prv_test_private"),
    /ambientes distintos/
  );
  assert.throws(
    () => resolveWompiEnvironment("unknown", "prv_prod_private"),
    /ambiente reconocido/
  );
});

test("fetchWompiTransaction uses the authenticated sandbox API and validates the returned ID", async () => {
  let requestUrl = "";
  let requestOptions;
  const transaction = {
    id: "tx-test-123",
    reference: "eval-ref-123",
    status: "APPROVED",
    amount_in_cents: 400000,
    currency: "COP"
  };

  const result = await fetchWompiTransaction({
    transactionId: transaction.id,
    publicKey: "pub_test_public",
    privateKey: "prv_test_private",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return { ok: true, status: 200, json: async () => ({ data: transaction }) };
    }
  });

  assert.equal(requestUrl, "https://sandbox.wompi.co/v1/transactions/tx-test-123");
  assert.equal(requestOptions.method, "GET");
  assert.equal(requestOptions.headers.Authorization, "Bearer prv_test_private");
  assert.equal(result.reference, "eval-ref-123");
});

test("fetchWompiTransaction uses production API for production keys", async () => {
  let requestUrl = "";
  await fetchWompiTransaction({
    transactionId: "tx-prod-456",
    publicKey: "pub_prod_public",
    privateKey: "prv_prod_private",
    fetchImpl: async (url) => {
      requestUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: "tx-prod-456",
            reference: "prod-ref",
            status: "APPROVED",
            amount_in_cents: 400000,
            currency: "COP"
          }
        })
      };
    }
  });
  assert.equal(requestUrl, "https://production.wompi.co/v1/transactions/tx-prod-456");
});

test("fetchWompiTransaction fails closed for missing keys, HTTP errors and mismatched IDs", async () => {
  await assert.rejects(
    fetchWompiTransaction({
      transactionId: "tx-1",
      publicKey: "pub_prod_public",
      privateKey: "",
      fetchImpl: async () => { throw new Error("must not call fetch"); }
    }),
    /ambiente reconocido/
  );

  await assert.rejects(
    fetchWompiTransaction({
      transactionId: "tx-1",
      publicKey: "pub_prod_public",
      privateKey: "prv_prod_private",
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) })
    }),
    /HTTP 401/
  );

  await assert.rejects(
    fetchWompiTransaction({
      transactionId: "tx-1",
      publicKey: "pub_prod_public",
      privateKey: "prv_prod_private",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: "different-id" } })
      })
    }),
    /no coincide/
  );
});
