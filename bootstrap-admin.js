require("dotenv").config();
const admin = require("firebase-admin");

(async () => {
  const email = (process.env.ADMIN_EMAIL || "jzamorazapata@gmail.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME || "Administrador NeuroEval Pro";
  if (!password || password.length < 12 || password.includes("CAMBIAR_")) {
    throw new Error("Configura ADMIN_PASSWORD en .env con una contraseña única de al menos 12 caracteres.");
  }
  if (email !== "jzamorazapata@gmail.com") throw new Error("El correo administrador debe ser jzamorazapata@gmail.com.");
  admin.initializeApp({ credential: admin.credential.applicationDefault(), ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}) });
  const auth = admin.auth();
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch { user = await auth.createUser({ email, password, displayName, emailVerified: true }); }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Administrador configurado: ${email} (UID: ${user.uid})`);
  console.log("Inicia sesión desde la web con esta cuenta. Cambia la contraseña si fue compartida.");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
