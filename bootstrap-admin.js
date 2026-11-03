require("dotenv").config();
const admin = require("firebase-admin");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "jzamorazapata@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME || "Administrador NeuroEval Pro";

  if (!password || password.length < 8) {
    throw new Error("Configura ADMIN_PASSWORD en .env con al menos 8 caracteres.");
  }
  if (email !== "jzamorazapata@gmail.com") {
    throw new Error("El correo administrador debe ser jzamorazapata@gmail.com.");
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  admin.initializeApp({
    credential: serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson))
      : admin.credential.applicationDefault(),
    ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {})
  });

  const auth = admin.auth();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    // Actualiza contraseña si se proporciona
    await auth.updateUser(user.uid, { password, displayName, emailVerified: true });
    console.log("Usuario admin existente actualizado (contraseña y nombre).");
  } catch {
    user = await auth.createUser({ email, password, displayName, emailVerified: true });
    console.log("Usuario admin creado.");
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Administrador listo: ${email} (UID: ${user.uid})`);
  console.log("Inicia sesión en la web con este correo y la contraseña de ADMIN_PASSWORD.");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
