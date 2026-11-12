"use strict";

const crypto = require("crypto");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""));
  const second = Buffer.from(String(b || ""));
  if (first.length !== second.length) return false;
  return crypto.timingSafeEqual(first, second);
}

function getNestedValue(object, propertyPath) {
  return String(propertyPath).split(".").reduce((value, key) => {
    if (value === null || value === undefined) return undefined;
    return value[key];
  }, object);
}

function validateWompiSignature(event, headerChecksum, eventsSecret) {
  if (!eventsSecret) {
    throw new Error("Falta configurar WOMPI_EVENTS_SECRET.");
  }

  const properties = event?.signature?.properties;
  const timestamp = event?.timestamp;
  const receivedChecksum =
    headerChecksum || event?.signature?.checksum || "";

  if (
    !Array.isArray(properties) ||
    properties.length === 0 ||
    timestamp === undefined ||
    !receivedChecksum
  ) {
    throw new Error("El evento no contiene los datos de firma requeridos.");
  }

  const values = properties.map((propertyPath) => {
    const value = getNestedValue(event.data, propertyPath);
    if (value === undefined || value === null) {
      throw new Error(
        `No se encontró la propiedad firmada: ${propertyPath}`
      );
    }
    return String(value);
  });

  const expectedChecksum = sha256(
    values.join("") + String(timestamp) + eventsSecret
  );

  if (!safeEqual(expectedChecksum.toLowerCase(), String(receivedChecksum).toLowerCase())) {
    throw new Error("La firma del evento no coincide.");
  }

  return true;
}

module.exports = { validateWompiSignature };
