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

// IMPORTANTE: configuración del proxy de Render
app.set("trust proxy", 1);

const projectId = process.env.FIREBASE_PROJECT_ID;
const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "jzamorazapata@gmail.com"
).toLowerCase();

// Firebase Admin
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

// Seguridad
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin(origin, callback) {
    const allowed = (
      process.env.CORS_ORIGINS ||
      process.env.APP_ORIGIN ||
      "http://localhost:3000"
    )
      .split(",")
      .map(x => x.trim());

    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Origen no autorizado por CORS"));
  }
}));

app.use(express.json({ limit: "1mb" }));

// Configuración pública de Firebase
app.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").send(
    "window.FIREBASE_CONFIG = " +
    JSON.stringify({
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      appId: process.env.FIREBASE_APP_ID || ""
    }) +
    ";"
  );
});

// Archivos públicos
app.use(express.static(path.join(__dirname, "public")));

// Limitadores de solicitudes
const resetLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos seguidos. Espera un minuto."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera unos minutos."
  }
});

// Funciones auxiliares
function cleanText(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

// Configuración de correo electrónico
function mailer() {
  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    throw new Error(
      "El servicio de correo no está configurado. Completa las variables SMTP."
    );
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

// Verificación de sesión
async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Debes iniciar sesión."
      });
    }

    req.user = await auth.verifyIdToken(
      header.slice(7),
      true
    );

    next();

  } catch (error) {
    return res.status(401).json({
      error: "Sesión inválida o vencida. Inicia sesión nuevamente."
    });
  }
}

// Verificación de administrador
async function requireAdmin(req, res, next) {
  if (
    !req.user?.admin ||
    req.user.email?.toLowerCase() !== ADMIN_EMAIL
  ) {
    return res.status(403).json({
      error: "No tienes permisos de administrador."
    });
  }

  next();
}

// Comprobación del servidor
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "NeuroEval Pro",
    smtpConfigured: !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ),
    firebaseProject: process.env.FIREBASE_PROJECT_ID || null
  });
});

// Guardar perfil
app.post("/api/profile", authLimiter, requireUser, async (req, res) => {
  try {
    const name = cleanText(req.body.name, 120);
    const ageRaw = req.body.age;

    const age = (
      ageRaw === null ||
      ageRaw === undefined ||
      ageRaw === ""
    ) ? null : Number(ageRaw);

    const goal = cleanText(req.body.goal, 300);

    if (!name) {
      return res.status(400).json({
        error: "El nombre es obligatorio."
      });
    }

    if (
      age !== null &&
      (!Number.isInteger(age) || age < 12 || age > 99)
    ) {
      return res.status(400).json({
        error: "Edad no válida (debe estar entre 12 y 99)."
      });
    }

    await db.collection("users").doc(req.user.uid).set({
      uid: req.user.uid,
      name,
      email: req.user.email.toLowerCase(),
      age,
      goal,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, {
      merge: true
    });

    res.json({ ok: true });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No fue posible guardar el perfil."
    });
  }
});

// Consultar perfil
app.get("/api/profile", requireUser, async (req, res) => {
  try {
    const doc = await db
      .collection("users")
      .doc(req.user.uid)
      .get();

    res.json({
      profile: doc.exists ? doc.data() : null
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo cargar el perfil."
    });
  }
});
// ==========================================
// EVALUACIONES
// ==========================================

app.post("/api/evaluations", requireUser, async (req, res) => {
  try {
    const {
      answers,
      scores,
      profile,
      recommendations,
      age,
      goal
    } = req.body || {};

    if (
      !Array.isArray(answers) ||
      answers.length !== 15 ||
      !scores ||
      !profile ||
      !Array.isArray(recommendations)
    ) {
      return res.status(400).json({
        error: "La evaluación está incompleta."
      });
    }

    const safeAnswers = answers.map(a => ({
      question: cleanText(a.question, 600),
      category: cleanText(a.category, 100),
      dimension: cleanText(a.dimension, 40),
      answer: cleanText(a.answer, 40),
      points: Math.max(
        0,
        Math.min(4, Number(a.points) || 0)
      )
    }));

    const ref = db.collection("evaluations").doc();

    const paymentRef =
      `NE-${ref.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    await ref.set({
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

      profileDescription: cleanText(
        req.body.profileDescription,
        2000
      ),

      recommendations: recommendations.map(
        x => cleanText(x, 500)
      ),

      paymentStatus: "pending",
      paymentRef,
      paidAt: null,

      amount: Number(process.env.EVAL_PRICE_COP || 19900),
      currency: "COP",

      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      ok: true,
      id: ref.id,
      paymentRef,
      paymentStatus: "pending"
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No fue posible guardar la evaluación."
    });
  }
});


// ==========================================
// CONSULTAR EVALUACIONES DEL CLIENTE
// ==========================================

app.get("/api/my-evaluations", requireUser, async (req, res) => {
  try {
    const snap = await db
      .collection("evaluations")
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

        amount: x.amount || 19900,
        currency: x.currency || "COP",

        createdAt: x.createdAt?.toDate?.().toISOString() || null
      };
    });

    rows.sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

    res.json({
      evaluations: rows
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudieron cargar tus informes."
    });
  }
});


// ==========================================
// CONSULTAR UNA EVALUACIÓN
// ==========================================

app.get("/api/my-evaluations/:id", requireUser, async (req, res) => {
  try {
    const doc = await db
      .collection("evaluations")
      .doc(req.params.id)
      .get();

    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
    }

    const x = doc.data();

    res.json({
      id: doc.id,
      ...x,

      createdAt: x.createdAt?.toDate?.().toISOString() || null,
      paidAt: x.paidAt?.toDate?.().toISOString() || null
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo cargar el informe."
    });
  }
});


// ==========================================
// PAGOS
// ==========================================

// NOTA: este endpoint conserva el flujo de demostración
// del código original. No equivale a una confirmación
// real de Wompi.

app.post("/api/my-evaluations/:id/pay", requireUser, async (req, res) => {
  try {
    const ref = db
      .collection("evaluations")
      .doc(req.params.id);

    const doc = await ref.get();

    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
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

    const paymentRef = data.paymentRef ||
      `NE-${doc.id.slice(0, 8).toUpperCase()}`;

    await ref.update({
      paymentStatus: "paid",
      paymentRef,

      paidAt: admin.firestore.FieldValue.serverTimestamp(),

      paymentMethod: cleanText(
        req.body.method || "online",
        40
      )
    });

    const updated = (await ref.get()).data();

    res.json({
      ok: true,
      paymentStatus: "paid",
      paymentRef,
      receipt: buildReceipt(doc.id, updated)
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo procesar el pago."
    });
  }
});


// ==========================================
// COMPROBANTE DE PAGO
// ==========================================

function buildReceipt(id, data) {
  return {
    evaluationId: id,
    paymentRef: data.paymentRef,
    name: data.name,
    email: data.email,

    amount: data.amount || 19900,
    currency: data.currency || "COP",

    status: data.paymentStatus || "paid",

    paidAt:
      data.paidAt?.toDate?.().toISOString?.() ||
      new Date().toISOString(),

    concept: "Informe de autorregistro NeuroEval Pro"
  };
}


// ==========================================
// PDF DEL CLIENTE
// ==========================================

app.get("/api/my-evaluations/:id/pdf", requireUser, async (req, res) => {
  try {
    const doc = await db
      .collection("evaluations")
      .doc(req.params.id)
      .get();

    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
    }

    const x = doc.data();

    if (x.paymentStatus !== "paid") {
      return res.status(402).json({
        error: "Debes completar el pago para descargar el informe."
      });
    }

    makePdf({
      ...x,
      createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO")
    }, res, {
      includeAnswers: false
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo generar el PDF."
    });
  }
});


// ==========================================
// COMPROBANTE DEL CLIENTE
// ==========================================

app.get("/api/my-evaluations/:id/receipt", requireUser, async (req, res) => {
  try {
    const doc = await db
      .collection("evaluations")
      .doc(req.params.id)
      .get();

    if (!doc.exists || doc.data().uid !== req.user.uid) {
      return res.status(404).json({
        error: "No encontrado."
      });
    }

    const x = doc.data();

    if (x.paymentStatus !== "paid") {
      return res.status(402).json({
        error: "Aún no hay pago registrado."
      });
    }

    res.json({
      receipt: buildReceipt(doc.id, x)
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo obtener el comprobante."
    });
  }
});


// ==========================================
// PANEL ADMINISTRATIVO
// ==========================================

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

        createdAt:
          x.createdAt?.toDate?.().toISOString() || null
      };
    }).sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

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

        amount: x.amount || 19900,

        paidAt:
          x.paidAt?.toDate?.().toISOString() || null,

        createdAt:
          x.createdAt?.toDate?.().toISOString() || null
      };
    }).sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

    const paid = records.filter(
      r => r.paymentStatus === "paid"
    ).length;

    const pending = records.filter(
      r => r.paymentStatus !== "paid"
    ).length;

    res.json({
      users: users.length,
      evaluations: records.length,
      paid,
      pending,
      userList: users,
      records
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo cargar el panel."
    });
  }
});


// ==========================================
// DETALLE DE EVALUACIÓN PARA ADMINISTRADOR
// ==========================================

app.get("/api/admin/evaluations/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db
      .collection("evaluations")
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
    }

    const x = doc.data();

    res.json({
      id: doc.id,
      ...x,

      createdAt:
        x.createdAt?.toDate?.().toISOString() || null,

      paidAt:
        x.paidAt?.toDate?.().toISOString() || null
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo abrir el informe."
    });
  }
});


// ==========================================
// ACTUALIZAR ESTADO DEL PAGO - ADMIN
// ==========================================

app.post("/api/admin/evaluations/:id/payment", requireUser, requireAdmin, async (req, res) => {
  try {
    const status = cleanText(req.body.status, 20);

    if (!["paid", "pending", "failed"].includes(status)) {
      return res.status(400).json({
        error: "Estado de pago no válido."
      });
    }

    const ref = db
      .collection("evaluations")
      .doc(req.params.id);

    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
    }

    const update = {
      paymentStatus: status
    };

    if (status === "paid") {
      update.paidAt =
        admin.firestore.FieldValue.serverTimestamp();

      update.paymentMethod = cleanText(
        req.body.method || "admin",
        40
      );
    }

    await ref.update(update);

    res.json({
      ok: true,
      paymentStatus: status
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo actualizar el pago."
    });
  }
});


// ==========================================
// PDF ADMINISTRATIVO CON RESPUESTAS
// ==========================================

app.get("/api/admin/evaluations/:id/pdf", requireUser, requireAdmin, async (req, res) => {
  try {
    const doc = await db
      .collection("evaluations")
      .doc(req.params.id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Informe no encontrado."
      });
    }

    const x = doc.data();

    makePdf({
      ...x,
      createdAt: x.createdAt?.toDate?.().toLocaleString("es-CO")
    }, res, {
      includeAnswers: true
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "No se pudo generar el PDF."
    });
  }
});


// ==========================================
// GENERADOR DE INFORMES PDF
// ==========================================

function makePdf(record, res, options = { includeAnswers: false }) {
  const includeAnswers = !!options.includeAnswers;

  const pdf = new PDFDocument({
    size: "A4",
    margin: 48,
    info: {
      Title: "Informe NeuroEval Pro"
    }
  });

  const filename =
    `NeuroEval-${(record.name || "cliente").replace(/[^a-z0-9-_]/gi, "_")}.pdf`;

  res.setHeader("Content-Type", "application/pdf");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  pdf.pipe(res);

  pdf.fontSize(20)
    .fillColor("#111")
    .text("NeuroEval Pro", { continued: false });

  pdf.moveDown(0.3)
    .fontSize(14)
    .text("Informe de autorregistro cognitivo");

  pdf.moveDown()
    .fontSize(10)
    .fillColor("#333")
    .text(`Cliente: ${record.name || "No indicado"}`)
    .text(`Correo: ${record.email || "No indicado"}`)
    .text(`Edad: ${record.age ?? "No indicada"}`)
    .text(`Objetivo: ${record.goal || "No indicado"}`)
    .text(`Fecha: ${record.createdAt || "No disponible"}`)
    .text(
      `Estado de pago: ${record.paymentStatus === "paid" ? "Pagado" : "Pendiente"}`
    );

  if (record.paymentRef) {
    pdf.text(`Referencia de pago: ${record.paymentRef}`);
  }

  pdf.moveDown()
    .fontSize(13)
    .fillColor("#111")
    .text("Resultado orientativo");

  pdf.fontSize(11)
    .text(record.profile || "Sin perfil");

  pdf.moveDown(0.3)
    .fontSize(10)
    .fillColor("#333")
    .text(record.profileDescription || "");

  const s = record.scores || {};

  pdf.moveDown()
    .fontSize(12)
    .fillColor("#111")
    .text("Indicadores por dimensión");

  pdf.fontSize(10)
    .fillColor("#333")
    .text(`Inatención y función ejecutiva: ${s.inattention ?? 0}%`)
    .text(`Hiperactividad e impulsividad: ${s.hyperactivity ?? 0}%`)
    .text(`Indicadores diferenciales (estrés/fatiga): ${s.differential ?? 0}%`);

  pdf.moveDown()
    .fontSize(12)
    .fillColor("#111")
    .text("Interpretación del análisis");

  pdf.fontSize(10)
    .fillColor("#333")
    .text(buildDetailedAnalysis(record), {
      align: "justify"
    });

  pdf.moveDown()
    .fontSize(12)
    .fillColor("#111")
    .text("Recomendaciones");

  (record.recommendations || []).forEach(r => {
    pdf.fontSize(10)
      .fillColor("#333")
      .text(`• ${r}`);
  });

  if (includeAnswers) {
    pdf.moveDown()
      .fontSize(12)
      .fillColor("#111")
      .text("Preguntas y respuestas (solo administrador)");

    (record.answers || []).forEach((a, i) => {
      if (pdf.y > 720) {
        pdf.addPage();
      }

      pdf.moveDown(0.35)
        .fontSize(9)
        .fillColor("#111")
        .text(`${i + 1}. ${a.question}`);

      pdf.fontSize(9)
        .fillColor("#4f46e5")
        .text(
          `Respuesta: ${a.answer} (${a.points} puntos) · ${a.category || ""}`
        );
    });
  }

  pdf.moveDown()
    .fontSize(8)
    .fillColor("#666")
    .text(
      "Este documento es un autorregistro orientativo; no constituye diagnóstico médico ni sustituye una valoración profesional cualificada."
    );

  pdf.end();
}


// ==========================================
// ANÁLISIS DETALLADO
// ==========================================

function buildDetailedAnalysis(record) {
  const s = record.scores || {};
  const parts = [];

  parts.push(
    `El perfil obtenido (“${record.profile || "sin clasificar"}”) se calcula a partir de las respuestas del autorregistro en tres dimensiones.`
  );

  if (s.inattention >= 60) {
    parts.push(
      `La dimensión de inatención y función ejecutiva muestra elevación (${s.inattention}%). Esto sugiere dificultades frecuentes para sostener la atención, organizar tareas o completar actividades que requieren esfuerzo mental prolongado.`
    );

  } else if (s.inattention >= 40) {
    parts.push(
      `La inatención se sitúa en un rango moderado (${s.inattention}%). Pueden existir dificultades ocasionales de concentración u organización, sin llegar a un patrón claramente elevado en este autorregistro.`
    );

  } else {
    parts.push(
      `Los indicadores de inatención se encuentran en rango bajo o moderado-bajo (${s.inattention}%).`
    );
  }

  if (s.hyperactivity >= 60) {
    parts.push(
      `La hiperactividad/impulsividad aparece elevada (${s.hyperactivity}%). Puede reflejar inquietud, dificultad para esperar o respuestas precipitadas.`
    );

  } else if (s.hyperactivity >= 40) {
    parts.push(
      `La inquietud e impulsividad se observan en nivel moderado (${s.hyperactivity}%).`
    );

  } else {
    parts.push(
      `Los indicadores de hiperactividad e impulsividad están en rango bajo (${s.hyperactivity}%).`
    );
  }

  if (s.differential >= 60) {
    parts.push(
      `Los indicadores diferenciales de estrés o fatiga están elevados (${s.differential}%). Es relevante considerar sueño, carga laboral, ansiedad u otras causas médicas o contextuales antes de interpretar los síntomas solo como un patrón de atención.`
    );

  } else {
    parts.push(
      `Los indicadores diferenciales de estrés/fatiga no muestran elevación marcada (${s.differential}%).`
    );
  }

  parts.push(
    "Estos resultados son orientativos. No diagnostican TDAH ni ningún otro trastorno. La interpretación clínica debe integrar historia desde la infancia, impacto funcional, entrevista y, si procede, otras pruebas."
  );

  return parts.join(" ");
}
// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================

// Solicitar código de recuperación
app.post("/api/password/request", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: "Introduce un correo válido."
    });
  }

  try {
    let user;

    try {
      user = await auth.getUserByEmail(email);

    } catch {
      return res.json({
        ok: true,
        message: "Si la cuenta existe, recibirás instrucciones."
      });
    }

    // Generar código de seis dígitos
    const code = String(
      crypto.randomInt(100000, 1000000)
    );

    const ttl = Math.max(
      5,
      Math.min(
        60,
        Number(process.env.RESET_CODE_TTL_MINUTES || 15)
      )
    );

    // Guardar código cifrado mediante hash
    await db.collection("passwordResets").doc(user.uid).set({
      codeHash: sha256(code),

      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + ttl * 60000)
      ),

      attempts: 0,
      used: false,

      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Enviar correo electrónico
    await mailer().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,

      subject: "Tu código de recuperación - NeuroEval Pro",

      text:
        `Tu código de recuperación es ${code}. ` +
        `Vence en ${ttl} minutos. ` +
        "Si no solicitaste este cambio, ignora este mensaje.",

      html: `
        <div style="font-family:Arial,sans-serif;padding:25px">
          <h2>NeuroEval Pro</h2>

          <p>Tu código de recuperación de contraseña es:</p>

          <h1 style="letter-spacing:8px;color:#4f46e5">
            ${code}
          </h1>

          <p>Este código vence en ${ttl} minutos.</p>

          <p>
            Si no solicitaste este cambio,
            puedes ignorar este mensaje.
          </p>
        </div>
      `
    });

    res.json({
      ok: true,
      message: "Si la cuenta existe, recibirás instrucciones."
    });

  } catch (e) {
    console.error("password/request error:", e);

    const msg = String(e && e.message || e);

    let friendly =
      "No se pudo enviar el correo. Revisa la configuración SMTP en Render.";

    if (
      /Invalid login|EAUTH|Username and Password not accepted/i.test(msg)
    ) {
      friendly =
        "Gmail rechazó el acceso. Usa una Contraseña de aplicación (no la contraseña normal) en SMTP_PASS.";

    } else if (
      /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|connect/i.test(msg)
    ) {
      friendly =
        "No se pudo conectar al servidor SMTP. Revisa SMTP_HOST y SMTP_PORT.";

    } else if (
      /no está configurado|SMTP/i.test(msg)
    ) {
      friendly =
        "Faltan variables SMTP en Render (SMTP_HOST, SMTP_USER, SMTP_PASS).";
    }

    res.status(500).json({
      error: friendly
    });
  }
});


// ==========================================
// CONFIRMAR RECUPERACIÓN DE CONTRASEÑA
// ==========================================

app.post("/api/password/confirm", resetLimiter, async (req, res) => {
  const email = cleanText(req.body.email, 254).toLowerCase();

  const code = cleanText(req.body.code, 6);

  const password = String(req.body.newPassword || "");

  if (!/^\d{6}$/.test(code) || password.length < 8) {
    return res.status(400).json({
      error: "Código inválido o contraseña menor de 8 caracteres."
    });
  }

  try {
    const user = await auth.getUserByEmail(email);

    const ref = db
      .collection("passwordResets")
      .doc(user.uid);

    const result = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists) {
        return "invalid";
      }

      const d = snap.data();

      if (
        d.used ||
        d.expiresAt.toDate() < new Date() ||
        d.attempts >= 8
      ) {
        return "expired";
      }

      if (d.codeHash !== sha256(code)) {
        tx.update(ref, {
          attempts: (d.attempts || 0) + 1
        });

        return "invalid";
      }

      tx.update(ref, {
        used: true,
        codeHash: ""
      });

      return "ok";
    });

    if (result !== "ok") {
      return res.status(400).json({
        error:
          result === "expired"
            ? "El código venció. Solicita uno nuevo."
            : "Código incorrecto."
      });
    }

    // Actualizar contraseña en Firebase Authentication
    await auth.updateUser(user.uid, {
      password
    });

    res.json({
      ok: true,
      message: "Contraseña actualizada. Ya puedes iniciar sesión."
    });

  } catch (e) {
    console.error(e);

    res.status(400).json({
      error:
        "No fue posible restablecer la contraseña. Verifica el correo y vuelve a intentarlo."
    });
  }
});


// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get("*", (_req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log(
    `NeuroEval Pro escuchando en puerto ${PORT}`
  );
});
