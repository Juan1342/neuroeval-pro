/**
 * NeuroEval Pro — Backend (Express + Firebase Admin + PDF + SMTP)
 * Versión reforzada: 5 nov 2026
 *
 * Cambios principales respecto a la versión anterior:
 *  - Pago demo protegido por ALLOW_DEMO_PAY (nunca activo en producción real)
 *  - Endpoint para generar firma de integridad Wompi (checkout)
 *  - Webhook Wompi con validación de checksum (esqueleto listo)
 *  - CORS más limpio
 *  - requireAdmin más flexible (email o claim)
 *  - Mejor manejo de emails nulos y logs
 *  - trust proxy ya presente
 */

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
app.set("trust proxy", 1); // Obligatorio detrás del proxy de Render

const PORT = Number(process.env.PORT || 3000);
const projectId = process.env.FIREBASE_PROJECT_ID;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "jzamorazapata@gmail.com").toLowerCase();
const ALLOW_DEMO_PAY = String(process.env.ALLOW_DEMO_PAY || "false").toLowerCase() === "true";
const EVAL_PRICE_COP = Number(process.env.EVAL_PRICE_COP || 19900);

// ─── Firebase Admin ───────────────────────────────────────────────────────────
if (!admin.apps.length) {
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

// ─── Seguridad base ───────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // SPA con scripts inline / Firebase
}));

app.use(cors({
  origin(origin, callback) {
    const allowed = (process.env.CORS_ORIGINS || process.env.APP_ORIGIN || "http://localhost:3000")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);

    // Permitir requests sin Origin (health checks, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowed.includes(origin) || allowed.includes("*")) return callback(null, true);
    return callback(null, false); // Rechazo limpio (sin throw)
  },
  credentials: true
}));

app.use(express.json({ limit: "1mb" }));

// Config Firebase para el frontend (público)
app.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").send(
    "window.FIREBASE_CONFIG = " + JSON.stringify({
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      appId: process.env.FIREBASE_APP_ID || ""
    }) + ";"
  );
});

app.use(express.static(path.join(__dirname, "public")));

// ─── Rate limits ──────────────────────────────────────────────────────────────
const resetLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos seguidos. Espera un minuto." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera unos minutos." }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cleanText(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function mailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("El servicio de correo no está configurado. Completa las variables SMTP.");
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function safeEmail(user) {
  return (user?.email || "").toLowerCase();
}

// ─── Middlewares de autenticación ─────────────────────────────────────────────
async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Debes iniciar sesión." });
    }
    req.user = await auth.verifyIdToken(header.slice(7), true);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión inválida o vencida. Inicia sesión nuevamente." });
  }
}

async function requireAdmin(req, res, next) {
  // Acepta custom claim "admin" O email del administrador configurado
  const isClaimAdmin = !!req.user?.admin;
  const isEmailAdmin = safeEmail(req.user) === ADMIN_EMAIL;

  if (!isClaimAdmin && !isEmailAdmin) {
    return res.status(403).json({ error: "No tienes permisos de administrador." });
  }
  next();
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "NeuroEval Pro",
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    firebaseProject: process.env.FIREBASE_PROJECT_ID || null,
    demoPayEnabled: ALLOW_DEMO_PAY
  });
});

// ─── Perfil ───────────────────────────────────────────────────────────────────
app.post("/api/profile", authLimiter, requireUser, async (req, res) => {
  try {
    const name = cleanText(req.body.name, 120);
    const ageRaw = req.body.age;
    const age = (ageRaw === null || ageRaw === undefined || ageRaw === "")
      ? null
      : Number(ageRaw);
    const goal = cleanText(req.body.goal, 300);

    if (!name) return res.status(400).json({ error: "El nombre es obligatorio." });
    if (age !== null && (!Number.isInteger(age) || age < 12 || age > 99)) {
      return res.status(400).json({ error: "Edad no válida (debe estar entre 12 y 99)." });
    }

    await db.collection("users").doc(req.user.uid).set({
      uid: req.user.uid,
      name,
      email: safeEmail(req.user),
      age,
      goal,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    res.json({ ok: true });
  } catch (e) {
    console.error("[profile POST]", e);
    res.status(500).json({ error: "No fue posible guardar el perfil." });
  }
});

app.get("/api/profile", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.user.uid).get();
    res.json({ profile: doc.exists ? doc.data() : null });
  } catch (e) {
    console.error("[profile GET]", e);
    res.status(500).json({ error: "No se pudo cargar el perfil." });
  }
});

// ─── Evaluaciones ─────────────────────────────────────────────────────────────
app.post("/api/evaluations", requireUser, async (req, res) => {
  try {
    const { answers, scores, profile, recommendations, age, goal } = req.body || {};

    if (
      !Array.isArray(answers) ||
      answers.length !== 15 ||
      !scores ||
      !profile ||
      !Array.isArray(recommendations)
    ) {
      return res.status(400).json({ error: "La evaluación está incompleta." });
    }

    const safeAnswers = answers.map(a => ({
      question: cleanText(a.question, 600),
      category: cleanText(a.category, 100),
      dimension: cleanText(a.dimension, 40),
      answer: cleanText(a.answer, 40),
      points: Math.max(0, Math.min(4, Number(a.points) || 0))
    }));

    const ref = db.collection("evaluations").doc();
    const paymentRef = `NE-${ref.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    await ref.set({
      uid: req.user.uid,
      name: cleanText(req.body.name, 120),
      email: safeEmail(req.user),
      age: Number(age) || null,
      goal: cleanText(goal, 300),
      answers: safeAnswers,
      scores: {
        inattention: Number(scores.inattention) || 0,
        hyperactivity: Number(scores.hyperactivity) || 0,
        differential: Number(scores.differential) || 0
      },
      profile: cleanText(profile, 250),
      profileDescription: cleanText(req.body.profileDescription, 2000),
      recommendations: recommendations.map(x => cleanText(x, 500)),
      paymentStatus: "pending",
      paymentRef,
      paidAt: null,
      amount: EVAL_PRICE_COP,
      currency: "COP",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      ok: true,
      id: ref.id,
      paymentRef,
      paymentStatus: "pending",
      amount: EVAL_PRICE_COP
    });
  } catch (e) {
    console.error("[evaluations POST]", e);
    res.status(500).json({ error: "No fue posible guardar la evaluación." });
  }
});

app.get("/api/my-evaluations", requireUser, async (req, res) => {
  try {
    const snap = await db.collection("evaluations")
      .where("uid", "==", req.user.uid)
      .get();

    const rows = snap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name,
        email: x.email,
        profile: x.profile,
        profileDescription: x.profileDescription,
        scores: x.scores || {},
        recommendations: x.recommendations || [],
        paymentStatus: x.paymentStatus || "pending",
        paymentRef: x.paymentRef || null,
        paidAt: x.paidAt?.toDate?.().toISOString?.() || null,
        amount: x.amount || EVAL_PRICE_COP,
        currency: x.currency || "COP",
        createdAt: x.createdAt?.toDate?.().toISOString() || null
      };
    });

    rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    res.json({ evaluations: rows });
  } catch (e) {
    console.error("[my-evaluations]", e);
    res.status(500).json({ error: "No se pudieron cargar tus informes." });
  }
});

app.get("/api/my-evaluations/:id", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({ error: "Informe no encontrado." });
    }
    const x = doc.data();
    res.json({
      id: doc.id,
      ...x,
      createdAt: x.createdAt?.toDate?.().toISOString() || null,
      paidAt: x.paidAt?.toDate?.().toISOString() || null
    });
  } catch (e) {
    console.error("[my-evaluations/:id]", e);
    res.status(500).json({ error: "No se pudo cargar el informe." });
  }
});

// ─── Pago ─────────────────────────────────────────────────────────────────────
/**
 * IMPORTANTE DE SEGURIDAD:
 * Este endpoint solo debe usarse en desarrollo / pruebas.
 * En producción real el pago se confirma ÚNICAMENTE vía webhook de Wompi
 * (firmado). Por eso está protegido por ALLOW_DEMO_PAY.
 */
app.post("/api/my-evaluations/:id/pay", requireUser, async (req, res) => {
  try {
    if (!ALLOW_DEMO_PAY) {
      return res.status(403).json({
        error: "El pago demo está desactivado. Usa el flujo real de Wompi."
      });
    }

    const ref = db.collection("evaluations").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({ error: "Informe no encontrado." });
    }

    const data = doc.data();
    if (data.paymentStatus === "paid") {
      return res.json({
        ok: true,
        paymentStatus: "paid",
        paymentRef: data.paymentRef,
        receipt: buildReceipt(doc.id, data)
      });
    }

    const paymentRef = data.paymentRef || `NE-${doc.id.slice(0, 8).toUpperCase()}`;
    await ref.update({
      paymentStatus: "paid",
      paymentRef,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: cleanText(req.body.method || "demo", 40)
    });

    const updated = (await ref.get()).data();
    res.json({
      ok: true,
      paymentStatus: "paid",
      paymentRef,
      receipt: buildReceipt(doc.id, updated)
    });
  } catch (e) {
    console.error("[pay]", e);
    res.status(500).json({ error: "No se pudo procesar el pago." });
  }
});

/**
 * Genera la firma de integridad que el frontend necesita para abrir el Widget de Wompi.
 * Documentación Wompi: SHA256(reference + amountInCents + currency + integritySecret)
 */
app.post("/api/payments/wompi-signature", requireUser, async (req, res) => {
  try {
    const { evaluationId } = req.body || {};
    if (!evaluationId) {
      return res.status(400).json({ error: "Falta evaluationId." });
    }

    const doc = await db.collection("evaluations").doc(evaluationId).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({ error: "Evaluación no encontrada." });
    }

    const data = doc.data();
    if (data.paymentStatus === "paid") {
      return res.status(400).json({ error: "Esta evaluación ya está pagada." });
    }

    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const publicKey = process.env.WOMPI_PUBLIC_KEY;

    if (!integritySecret || !publicKey) {
      return res.status(500).json({
        error: "Wompi no está configurado (faltan WOMPI_PUBLIC_KEY o WOMPI_INTEGRITY_SECRET)."
      });
    }

    const reference = data.paymentRef;
    const amountInCents = Math.round((data.amount || EVAL_PRICE_COP) * 100); // COP → centavos
    const currency = "COP";

    const integrityString = `${reference}${amountInCents}${currency}${integritySecret}`;
    const signature = crypto.createHash("sha256").update(integrityString).digest("hex");

    res.json({
      publicKey,
      currency,
      amountInCents,
      reference,
      signature,
      redirectUrl: process.env.WOMPI_REDIRECT_URL || process.env.APP_ORIGIN || ""
    });
  } catch (e) {
    console.error("[wompi-signature]", e);
    res.status(500).json({ error: "No se pudo generar la firma de pago." });
  }
});

/**
 * Webhook de Wompi.
 * Valida el checksum según la documentación oficial y marca la evaluación como pagada.
 * Configura esta URL en el dashboard de Wompi: https://TU-DOMINIO/api/payments/wompi-webhook
 */
app.post("/api/payments/wompi-webhook", async (req, res) => {
  try {
    const event = req.body || {};
    const eventsKey = process.env.WOMPI_EVENTS_KEY || process.env.WOMPI_INTEGRITY_SECRET;

    // Validación básica de estructura
    if (!event?.data?.transaction || !event?.signature) {
      console.warn("[wompi-webhook] Payload incompleto");
      return res.status(400).json({ error: "Payload incompleto" });
    }

    const { id, status, amount_in_cents, reference } = event.data.transaction;
    const checksum = event.signature?.checksum;
    const timestamp = event.timestamp || event.signature?.timestamp;

    if (!eventsKey) {
      console.error("[wompi-webhook] Falta WOMPI_EVENTS_KEY / WOMPI_INTEGRITY_SECRET");
      return res.status(500).json({ error: "Configuración incompleta" });
    }

    // Validación de integridad (adaptada a la fórmula más común de Wompi)
    // Ajusta según la documentación exacta de tu cuenta (properties pueden variar)
    const integrityString = `${id}${status}${amount_in_cents}${timestamp}${eventsKey}`;
    const expected = crypto.createHash("sha256").update(integrityString).digest("hex");

    if (expected !== checksum) {
      console.warn("[wompi-webhook] Checksum inválido", { expected, received: checksum });
      return res.status(400).json({ error: "Firma inválida" });
    }

    // Solo procesamos pagos aprobados
    if (status !== "APPROVED") {
      console.log(`[wompi-webhook] Estado ignorado: ${status} ref=${reference}`);
      return res.status(200).json({ ok: true, ignored: true });
    }

    // Buscamos la evaluación por paymentRef
    const snap = await db.collection("evaluations")
      .where("paymentRef", "==", reference)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(`[wompi-webhook] No se encontró evaluación con ref ${reference}`);
      return res.status(200).json({ ok: true, notFound: true });
    }

    const evalDoc = snap.docs[0];
    const current = evalDoc.data();

    if (current.paymentStatus === "paid") {
      return res.status(200).json({ ok: true, alreadyPaid: true });
    }

    // Validamos monto (seguridad extra)
    const expectedCents = Math.round((current.amount || EVAL_PRICE_COP) * 100);
    if (Number(amount_in_cents) !== expectedCents) {
      console.error(`[wompi-webhook] Monto no coincide. Esperado ${expectedCents}, recibido ${amount_in_cents}`);
      return res.status(400).json({ error: "Monto incorrecto" });
    }

    await evalDoc.ref.update({
      paymentStatus: "paid",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: "wompi",
      wompiTransactionId: id,
      wompiStatus: status
    });

    console.log(`[wompi-webhook] Pago confirmado: ${reference} → ${evalDoc.id}`);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[wompi-webhook]", e);
    res.status(500).json({ error: "Error interno del webhook" });
  }
});

function buildReceipt(id, data) {
  return {
    evaluationId: id,
    paymentRef: data.paymentRef,
    name: data.name,
    email: data.email,
    amount: data.amount || EVAL_PRICE_COP,
    currency: data.currency || "COP",
    status: data.paymentStatus || "paid",
    paidAt: data.paidAt?.toDate?.().toISOString?.() || new Date().toISOString(),
    concept: "Informe de autorregistro NeuroEval Pro"
  };
}

// ─── PDF cliente (sin respuestas) ─────────────────────────────────────────────
app.get("/api/my-evaluations/:id/pdf", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({ error: "Informe no encontrado." });
    }
    const x = doc.data();
    if (x.paymentStatus !== "paid") {
      return res.status(402).json({ error: "Debes completar el pago para descargar el informe." });
    }
    makePdf({
      ...x,
      createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO")
    }, res, { includeAnswers: false });
  } catch (e) {
    console.error("[pdf cliente]", e);
    res.status(500).json({ error: "No se pudo generar el PDF." });
  }
});

app.get("/api/my-evaluations/:id/receipt", requireUser, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({ error: "No encontrado." });
    }
    const x = doc.data();
    if (x.paymentStatus !== "paid") {
      return res.status(402).json({ error: "Aún no hay pago registrado." });
    }
    res.json({ receipt: buildReceipt(doc.id, x) });
  } catch (e) {
    console.error("[receipt]", e);
    res.status(500).json({ error: "No se pudo obtener el comprobante." });
  }
});

// ─── Admin ────────────────────────────────────────────────────────────────────
app.get("/api/admin/overview", requireUser, requireAdmin, async (_req, res) => {
  try {
    const [usersSnap, evalSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("evaluations").get()
    ]);

    const users = usersSnap.docs.map(d => {
      const x = d.data();
      return {
        uid: d.id,
        name: x.name,
        email: x.email,
        age: x.age ?? null,
        goal: x.goal || null,
        createdAt: x.createdAt?.toDate?.().toISOString() || null
      };
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const records = evalSnap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name,
        email: x.email,
        age: x.age ?? null,
        profile: x.profile,
        scores: x.scores || {},
        paymentStatus: x.paymentStatus || "pending",
        paymentRef: x.paymentRef || null,
        amount: x.amount || EVAL_PRICE_COP,
        paidAt: x.paidAt?.toDate?.().toISOString() || null,
        createdAt: x.createdAt?.toDate?.().toISOString() || null
      };
    }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const paid = records.filter(r => r.paymentStatus === "paid").length;
    const pending = records.filter(r => r.paymentStatus !== "paid").length;

    res.json({
      users: users.length,
      evaluations: records.length,
      paid,
      pending,
      userList: users,
      records
    });
  } catch (e) {
    console.error("[admin/overview]", e);
    res.status(500).json({ error: "No se pudo cargar el panel." });
  }
});

app.get("/api/admin/evaluations/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Informe no encontrado." });
    const x = doc.data();
    res.json({
      id: doc.id,
      ...x,
      createdAt: x.createdAt?.toDate?.().toISOString() || null,
      paidAt: x.paidAt?.toDate?.().toISOString() || null
    });
  } catch (e) {
    console.error("[admin/evaluations/:id]", e);
    res.status(500).json({ error: "No se pudo abrir el informe." });
  }
});

app.post("/api/admin/evaluations/:id/payment", requireUser, requireAdmin, async (req, res) => {
  try {
    const status = cleanText(req.body.status, 20);
    if (!["paid", "pending", "failed"].includes(status)) {
      return res.status(400).json({ error: "Estado de pago no válido." });
    }
    const ref = db.collection("evaluations").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Informe no encontrado." });

    const update = { paymentStatus: status };
    if (status === "paid") {
      update.paidAt = admin.firestore.FieldValue.serverTimestamp();
      update.paymentMethod = cleanText(req.body.method || "admin", 40);
    }
    await ref.update(update);
    res.json({ ok: true, paymentStatus: status });
  } catch (e) {
    console.error("[admin/payment]", e);
    res.status(500).json({ error: "No se pudo actualizar el pago." });
  }
});

// PDF admin (CON respuestas)
app.get("/api/admin/evaluations/:id/pdf", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db.collection("evaluations").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Informe no encontrado." });
    const x = doc.data();
    makePdf({
      ...x,
      createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO")
    }, res, { includeAnswers: true });
  } catch (e) {
    console.error("[admin/pdf]", e);
    res.status(500).json({ error: "No se pudo generar el PDF." });
  }
});

// ─── Generación de PDF ────────────────────────────────────────────────────────
function makePdf(record, res, options = { includeAnswers: false }) {
  const includeAnswers = !!options.includeAnswers;
  const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Informe NeuroEval Pro" } });
  const filename = `NeuroEval-${(record.name || "cliente").replace(/[^a-z0-9-_]/gi, "_")}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  pdf.pipe(res);

  pdf.fontSize(20).fillColor("#111").text("NeuroEval Pro", { continued: false });
  pdf.moveDown(0.3).fontSize(14).text("Informe de autorregistro cognitivo");
  pdf.moveDown().fontSize(10).fillColor("#333")
    .text(`Cliente: ${record.name || "No indicado"}`)
    .text(`Correo: ${record.email || "No indicado"}`)
    .text(`Edad: ${record.age ?? "No indicada"}`)
    .text(`Objetivo: ${record.goal || "No indicado"}`)
    .text(`Fecha: ${record.createdAt || "No disponible"}`)
    .text(`Estado de pago: ${record.paymentStatus === "paid" ? "Pagado" : "Pendiente"}`);
  if (record.paymentRef) pdf.text(`Referencia de pago: ${record.paymentRef}`);

  pdf.moveDown().fontSize(13).fillColor("#111").text("Resultado orientativo");
  pdf.fontSize(11).text(record.profile || "Sin perfil");
  pdf.moveDown(0.3).fontSize(10).fillColor("#333").text(record.profileDescription || "");

  const s = record.scores || {};
  pdf.moveDown().fontSize(12).fillColor("#111").text("Indicadores por dimensión");
  pdf.fontSize(10).fillColor("#333")
    .text(`Inatención y función ejecutiva: ${s.inattention ?? 0}%`)
    .text(`Hiperactividad e impulsividad: ${s.hyperactivity ?? 0}%`)
    .text(`Indicadores diferenciales (estrés/fatiga): ${s.differential ?? 0}%`);

  pdf.moveDown().fontSize(12).fillColor("#111").text("Interpretación del análisis");
  pdf.fontSize(10).fillColor("#333").text(buildDetailedAnalysis(record), { align: "justify" });

  pdf.moveDown().fontSize(12).fillColor("#111").text("Recomendaciones");
  (record.recommendations || []).forEach(r => {
    pdf.fontSize(10).fillColor("#333").text(`• ${r}`);
  });

  if (includeAnswers) {
    pdf.moveDown().fontSize(12).fillColor("#111").text("Preguntas y respuestas (solo administrador)");
    (record.answers || []).forEach((a, i) => {
      if (pdf.y > 720) pdf.addPage();
      pdf.moveDown(0.35).fontSize(9).fillColor("#111").text(`${i + 1}. ${a.question}`);
      pdf.fontSize(9).fillColor("#4f46e5").text(`Respuesta: ${a.answer} (${a.points} puntos) · ${a.category || ""}`);
    });
  }

  pdf.moveDown().fontSize(8).fillColor("#666")
    .text("Este documento es un autorregistro orientativo; no constituye diagnóstico médico ni sustituye una valoración profesional cualificada.");
  pdf.end();
}

function buildDetailedAnalysis(record) {
  const s = record.scores || {};
  const parts = [];
  parts.push(`El perfil obtenido (“${record.profile || "sin clasificar"}”) se calcula a partir de las respuestas del autorregistro en tres dimensiones.`);

  if (s.inattention >= 60) {
    parts.push(`La dimensión de inatención y función ejecutiva muestra elevación (${s.inattention}%). Esto sugiere dificultades frecuentes para sostener la atención, organizar tareas o completar actividades que requieren esfuerzo mental prolongado.`);
  } else if (s.inattention >= 40) {
    parts.push(`La inatención se sitúa en un rango moderado (${s.inattention}%). Pueden existir dificultades ocasionales de concentración u organización, sin llegar a un patrón claramente elevado en este autorregistro.`);
  } else {
    parts.push(`Los indicadores de inatención se encuentran en rango bajo o moderado-bajo (${s.inattention}%).`);
  }

  if (s.hyperactivity >= 60) {
    parts.push(`La hiperactividad/impulsividad aparece elevada (${s.hyperactivity}%). Puede reflejar inquietud, dificultad para esperar o respuestas precipitadas.`);
  } else if (s.hyperactivity >= 40) {
    parts.push(`La inquietud e impulsividad se observan en nivel moderado (${s.hyperactivity}%).`);
  } else {
    parts.push(`Los indicadores de hiperactividad e impulsividad están en rango bajo (${s.hyperactivity}%).`);
  }

  if (s.differential >= 60) {
    parts.push(`Los indicadores diferenciales de estrés o fatiga están elevados (${s.differential}%). Es relevante considerar sueño, carga laboral, ansiedad u otras causas médicas o contextuales antes de interpretar los síntomas solo como un patrón de atención.`);
  } else {
    parts.push(`Los indicadores diferenciales de estrés/fatiga no muestran elevación marcada (${s.differential}%).`);
  }

  parts.push("Estos resultados son orientativos. No diagnostican TDAH ni ningún otro trastorno. La interpretación clínica debe integrar historia desde la infancia, impacto funcional, entrevista y, si procede, otras pruebas.");
  return parts.join(" ");
}

// ─── Recuperación de contraseña ───────────────────────────────────────────────
app.post("/api/password/request", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Introduce un correo válido." });
  }

  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      // No revelamos si el correo existe o no
      return res.json({ ok: true, message: "Si la cuenta existe, recibirás instrucciones." });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const ttl = Math.max(5, Math.min(60, Number(process.env.RESET_CODE_TTL_MINUTES || 15)));

    await db.collection("passwordResets").doc(user.uid).set({
      codeHash: sha256(code),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + ttl * 60000)),
      attempts: 0,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await mailer().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Tu código de recuperación - NeuroEval Pro",
      text: `Tu código de recuperación es ${code}. Vence en ${ttl} minutos. Si no solicitaste este cambio, ignora este mensaje.`,
      html: `<p>Tu código de recuperación de NeuroEval Pro es:</p>
             <h1 style="letter-spacing:8px;font-family:monospace">${code}</h1>
             <p>Vence en ${ttl} minutos.</p>`
    });

    res.json({ ok: true, message: "Si la cuenta existe, recibirás instrucciones." });
  } catch (e) {
    console.error("[password/request]", e);
    const msg = String(e && e.message || e);
    let friendly = "No se pudo enviar el correo. Revisa la configuración SMTP en Render.";
    if (/Invalid login|EAUTH|Username and Password not accepted/i.test(msg)) {
      friendly = "Gmail rechazó el acceso. Usa una Contraseña de aplicación (no la contraseña normal) en SMTP_PASS.";
    } else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|connect/i.test(msg)) {
      friendly = "No se pudo conectar al servidor SMTP. Revisa SMTP_HOST y SMTP_PORT.";
    } else if (/no está configurado|SMTP/i.test(msg)) {
      friendly = "Faltan variables SMTP en Render (SMTP_HOST, SMTP_USER, SMTP_PASS).";
    }
    res.status(500).json({ error: friendly });
  }
});

app.post("/api/password/confirm", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();
  const code = cleanText(req.body.code, 6);
  const password = String(req.body.newPassword || "");

  if (!/^\d{6}$/.test(code) || password.length < 8) {
    return res.status(400).json({ error: "Código inválido o contraseña menor de 8 caracteres." });
  }

  try {
    const user = await auth.getUserByEmail(email);
    const ref = db.collection("passwordResets").doc(user.uid);

    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return "invalid";
      const d = snap.data();
      if (d.used || d.expiresAt.toDate() < new Date() || d.attempts >= 8) return "expired";
      if (d.codeHash !== sha256(code)) {
        tx.update(ref, { attempts: (d.attempts || 0) + 1 });
        return "invalid";
      }
      tx.update(ref, { used: true, codeHash: "" });
      return "ok";
    });

    if (result !== "ok") {
      return res.status(400).json({
        error: result === "expired"
          ? "El código venció. Solicita uno nuevo."
          : "Código incorrecto."
      });
    }

    await auth.updateUser(user.uid, { password });
    res.json({ ok: true, message: "Contraseña actualizada. Ya puedes iniciar sesión." });
  } catch (e) {
    console.error("[password/confirm]", e);
    res.status(400).json({
      error: "No fue posible restablecer la contraseña. Verifica el correo y vuelve a intentarlo."
    });
  }
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`NeuroEval Pro escuchando en puerto ${PORT}`);
  console.log(`  · Demo pay: ${ALLOW_DEMO_PAY ? "ACTIVADO (solo pruebas)" : "desactivado"}`);
  console.log(`  · Firebase project: ${process.env.FIREBASE_PROJECT_ID || "(no definido)"}`);
});
