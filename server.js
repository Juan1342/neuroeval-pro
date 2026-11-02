require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  // En Render, la cuenta de servicio se configura como variable privada.
  // Nunca publiques el contenido de esta variable en GitHub ni en el navegador.
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  admin.initializeApp({
    credential: serviceAccountJson
      ? admin.credential.cert(JSON.parse(serviceAccountJson))
      : admin.credential.applicationDefault(),
    ...(projectId ? { projectId } : {})
  });
}
const auth = admin.auth();
const db = admin.firestore();

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  // Temporalmente desactivada para permitir los módulos CDN de Firebase
  // y el script CDN de Tailwind usados por el frontend.
  contentSecurityPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    const allowed = (process.env.CORS_ORIGINS || process.env.APP_ORIGIN || "http://localhost:3000")
      .split(",").map(x => x.trim());
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error("Origen no autorizado por CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));
app.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").send("window.FIREBASE_CONFIG = " + JSON.stringify({
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  }) + ";");
});
app.use(express.static(path.join(__dirname, "public")));

const resetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

function cleanText(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("El servicio de correo no está configurado. Completa las variables SMTP.");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}
async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Debes iniciar sesión." });
    req.user = await auth.verifyIdToken(header.slice(7), true);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida. Inicia sesión nuevamente." });
  }
}
async function requireAdmin(req, res, next) {
  if (!req.user?.admin || req.user.email?.toLowerCase() !== "jzamorazapata@gmail.com") {
    return res.status(403).json({ error: "No tienes permisos de administrador." });
  }
  next();
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "NeuroEval Pro" }));

// El cliente Firebase crea su cuenta; el backend solo registra el perfil autenticado.
app.post("/api/profile", authLimiter, requireUser, async (req, res) => {
  try {
    const name = cleanText(req.body.name, 120);
    const ageRaw = req.body.age;
    // Permitir null/undefined (usuarios Google sin edad). Solo validar si se envía un valor.
    const age = (ageRaw === null || ageRaw === undefined || ageRaw === "") ? null : Number(ageRaw);
    const goal = cleanText(req.body.goal, 300);
    if (!name) {
      return res.status(400).json({ error: "El nombre es obligatorio." });
    }
    if (age !== null && (!Number.isInteger(age) || age < 12 || age > 99)) {
      return res.status(400).json({ error: "Edad no válida (debe estar entre 12 y 99)." });
    }
    await db.collection("users").doc(req.user.uid).set({
      uid: req.user.uid,
      name,
      email: req.user.email.toLowerCase(),
      age,
      goal,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No fue posible guardar el perfil." });
  }
});

app.get("/api/profile", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.user.uid).get();
    res.json({ profile: doc.exists ? doc.data() : null });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "No se pudo cargar el perfil." });
  }
});

app.post("/api/evaluations", requireUser, async (req, res) => {
  try {
    const { answers, scores, profile, recommendations, age, goal } = req.body || {};
    if (!Array.isArray(answers) || answers.length !== 15 || !scores || !profile || !Array.isArray(recommendations)) {
      return res.status(400).json({ error: "La evaluación está incompleta." });
    }
    const safeAnswers = answers.map(a => ({
      question: cleanText(a.question, 600),
      category: cleanText(a.category, 100),
      answer: cleanText(a.answer, 40),
      points: Math.max(0, Math.min(4, Number(a.points) || 0))
    }));
    const doc = await db.collection("evaluations").add({
      uid: req.user.uid,
      name: cleanText(req.body.name, 120),
      email: req.user.email.toLowerCase(),
      age: Number(age) || null,
      goal: cleanText(goal, 300),
      answers: safeAnswers,
      scores: {
        inattention: Number(scores.inattention) || 0,
        hyperactivity: Number(scores.hyperactivity) || 0,
        differential: Number(scores.differential) || 0
      },
      profile: cleanText(profile, 250),
      profileDescription: cleanText(req.body.profileDescription, 1500),
      recommendations: recommendations.map(x => cleanText(x, 500)),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ ok: true, id: doc.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "No fue posible guardar la evaluación." });
  }
});

app.get("/api/my-evaluations", requireUser, async (req, res) => {
  try {
    const snap = await db.collection("evaluations").where("uid", "==", req.user.uid).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.().toISOString() || null }));
    rows.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ evaluations: rows });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "No se pudieron cargar tus informes." });
  }
});

app.get("/api/admin/overview", requireUser, requireAdmin, async (_req, res) => {
  try {
    const [usersSnap, evalSnap] = await Promise.all([
      db.collection("users").get(), db.collection("evaluations").get()
    ]);
    res.json({
      users: usersSnap.size,
      evaluations: evalSnap.size,
      records: evalSnap.docs.map(d => {
        const x = d.data();
        return { id: d.id, name: x.name, email: x.email, profile: x.profile,
          createdAt: x.createdAt?.toDate?.().toISOString() || null,
          scores: x.scores || {} };
      }).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "No se pudo cargar el panel." });
  }
});
app.get("/api/admin/evaluations/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Informe no encontrado." });
    const x = doc.data();
    res.json({ id: doc.id, ...x, createdAt: x.createdAt?.toDate?.().toISOString() || null });
  } catch (e) { console.error(e); res.status(500).json({ error: "No se pudo abrir el informe." }); }
});

function makePdf(record, res) {
  const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Informe NeuroEval Pro" } });
  const filename = `NeuroEval-${(record.name || "cliente").replace(/[^a-z0-9-_]/gi, "_")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  pdf.pipe(res);
  pdf.fontSize(20).text("NeuroEval Pro", { continued: false });
  pdf.moveDown(0.3).fontSize(15).text("Informe de autorregistro cognitivo");
  pdf.moveDown().fontSize(10).fillColor("#333")
    .text(`Cliente: ${record.name || "No indicado"}`)
    .text(`Correo: ${record.email || "No indicado"}`)
    .text(`Edad: ${record.age || "No indicada"}`)
    .text(`Objetivo: ${record.goal || "No indicado"}`)
    .text(`Fecha: ${record.createdAt || "No disponible"}`);
  pdf.moveDown().fontSize(13).fillColor("#111").text("Resultado orientativo");
  pdf.fontSize(11).text(record.profile || "Sin perfil");
  pdf.moveDown(0.3).fontSize(10).text(record.profileDescription || "");
  const s = record.scores || {};
  pdf.moveDown().fontSize(12).text("Indicadores por dimensión");
  pdf.fontSize(10).text(`Inatención y función ejecutiva: ${s.inattention ?? 0}%`);
  pdf.text(`Hiperactividad e impulsividad: ${s.hyperactivity ?? 0}%`);
  pdf.text(`Indicadores diferenciales: ${s.differential ?? 0}%`);
  pdf.moveDown().fontSize(12).text("Preguntas y respuestas");
  (record.answers || []).forEach((a, i) => {
    if (pdf.y > 720) pdf.addPage();
    pdf.moveDown(0.35).fontSize(9).fillColor("#111").text(`${i + 1}. ${a.question}`);
    pdf.fontSize(9).fillColor("#4f46e5").text(`Respuesta: ${a.answer} (${a.points} puntos)`);
  });
  pdf.moveDown().fontSize(12).fillColor("#111").text("Recomendaciones");
  (record.recommendations || []).forEach(r => pdf.fontSize(10).text(`• ${r}`));
  pdf.moveDown().fontSize(8).fillColor("#666").text("Este documento es un autorregistro orientativo; no constituye diagnóstico médico ni sustituye una valoración profesional.");
  pdf.end();
}
app.get("/api/my-evaluations/:id/pdf", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) return res.status(404).json({ error: "Informe no encontrado." });
    const x = doc.data(); makePdf({ ...x, createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO") }, res);
  } catch (e) { console.error(e); res.status(500).json({ error: "No se pudo generar el PDF." }); }
});
app.get("/api/admin/evaluations/:id/pdf", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Informe no encontrado." });
    const x = doc.data(); makePdf({ ...x, createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO") }, res);
  } catch (e) { console.error(e); res.status(500).json({ error: "No se pudo generar el PDF." }); }
});

// Recuperación propia: código aleatorio, hash en Firestore, vencimiento, uso único y rate limit.
app.post("/api/password/request", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Introduce un correo válido." });
  try {
    let user;
    try { user = await auth.getUserByEmail(email); } catch { return res.json({ ok: true, message: "Si la cuenta existe, recibirás instrucciones." }); }
    const code = String(crypto.randomInt(100000, 1000000));
    const ttl = Math.max(5, Math.min(30, Number(process.env.RESET_CODE_TTL_MINUTES || 10)));
    await db.collection("passwordResets").doc(user.uid).set({
      codeHash: sha256(code), expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + ttl * 60000)),
      attempts: 0, used: false, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await mailer().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER, to: email,
      subject: "Tu código de recuperación - NeuroEval Pro",
      text: `Tu código de recuperación es ${code}. Vence en ${ttl} minutos. Si no solicitaste este cambio, ignora este mensaje.`,
      html: `<p>Tu código de recuperación de NeuroEval Pro es:</p><h1 style="letter-spacing:8px">${code}</h1><p>Vence en ${ttl} minutos. Si no solicitaste este cambio, ignora este mensaje.</p>`
    });
    res.json({ ok: true, message: "Si la cuenta existe, recibirás instrucciones." });
  } catch (e) {
    console.error(e); res.status(500).json({ error: "No se pudo enviar el correo. Revisa la configuración SMTP." });
  }
});
app.post("/api/password/confirm", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  const code = cleanText(req.body.code, 6);
  const password = String(req.body.newPassword || "");
  if (!/^\d{6}$/.test(code) || password.length < 8) return res.status(400).json({ error: "Código inválido o contraseña menor de 8 caracteres." });
  try {
    const user = await auth.getUserByEmail(email);
    const ref = db.collection("passwordResets").doc(user.uid);
    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "invalid";
      const d = snap.data();
      if (d.used || d.expiresAt.toDate() < new Date() || d.attempts >= 5) return "expired";
      if (d.codeHash !== sha256(code)) {
        tx.update(ref, { attempts: (d.attempts || 0) + 1 });
        return "invalid";
      }
      tx.update(ref, { used: true, codeHash: "" });
      return "ok";
    });
    if (result !== "ok") return res.status(400).json({ error: result === "expired" ? "El código venció. Solicita uno nuevo." : "Código incorrecto." });
    await auth.updateUser(user.uid, { password });
    res.json({ ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (e) {
    console.error(e); res.status(400).json({ error: "No fue posible restablecer la contraseña. Verifica el correo y vuelve a intentarlo." });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`NeuroEval Pro escuchando en puerto ${PORT}`));
