"use strict";

require("dotenv").config();

const admin = require("firebase-admin");

const ADMIN_EMAIL = "jzamorazapata@gmail.com";

async function main() {
  const email = String(process.env.ADMIN_EMAIL || ADMIN_EMAIL)
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const displayName =
    process.env.ADMIN_NAME || "Administrador NeuroEval Pro";

  if (email !== ADMIN_EMAIL) {
    throw new Error("El correo administrador autorizado no coincide.");
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: serviceAccountJson
        ? admin.credential.cert(JSON.parse(serviceAccountJson))
        : admin.credential.applicationDefault(),
      ...(process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : {})
    });
  }

  const auth = admin.auth();
  let user;

  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    if (password.length < 12) {
      throw new Error(
        "Para crear la cuenta, configura ADMIN_PASSWORD con al menos 12 caracteres."
      );
    }

    user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true
    });

    console.log("Cuenta administradora creada.");
  }

  const updates = {
    displayName,
    emailVerified: true
  };

  // La contraseña solo cambia si se proporciona expresamente.
  if (password) {
    if (password.length < 12) {
      throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres.");
    }
    updates.password = password;
  }

  user = await auth.updateUser(user.uid, updates);

  // Conserva otros permisos personalizados ya existentes.
  const existingClaims = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, {
    ...existingClaims,
    admin: true
  });

  console.log("Permiso administrativo verificado y asignado.");
  console.log(`Cuenta: ${email}`);
  console.log("Inicia sesión nuevamente para actualizar tu token.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("No se pudo preparar el administrador:", error.message);
    process.exit(1);
  });
