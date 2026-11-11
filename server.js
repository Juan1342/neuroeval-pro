"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { getApps, initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, FieldPath, AggregateField } = require("firebase-admin/firestore");
const { aggregateProfiles } = require("./lib/global-analytics");
const { PRIVACY_NOTICE_VERSION, validatePrivacyConsent, buildParentConsentRecord } = require("./lib/privacy");
const PDFDocument = require("pdfkit");
const path = require("path");
const https = require("https");
const {
  DEFAULT_EVALUATION_PRICE_COP,
  calculateEvaluationPaymentAmounts,
  isLegacyPendingPayment
} = require("./lib/pricing");

/* =========================================================
   1. CONFIGURACIÓN GENERAL
========================================================= */

const app = express();

// Firebase recomienda servir el helper de autenticación bajo el mismo
// dominio de la aplicación para evitar bloqueos de almacenamiento de terceros.
app.use("/__/auth", (req, res) => {
  if (!FIREBASE_PROJECT_ID) {
    return res.status(503).send("Firebase project is not configured.");
  }

  const firebaseHost = `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
  const upstream = https.request(
    {
      hostname: firebaseHost,
      port: 443,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: firebaseHost
      }
    },
    (upstreamResponse) => {
      res.writeHead(
        upstreamResponse.statusCode || 502,
        upstreamResponse.headers
      );
      upstreamResponse.pipe(res);
    }
  );

  upstream.setTimeout(30000, () => {
    upstream.destroy(new Error("Firebase auth proxy timed out."));
  });

  upstream.on("error", (error) => {
    console.error("Firebase auth proxy:", error.message);
    if (!res.headersSent) {
      res.status(502).send("No se pudo conectar con Firebase Authentication.");
    } else {
      res.destroy(error);
    }
  });

  req.pipe(upstream);
});

app.set("trust proxy", 1);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = String(
  process.env.ADMIN_EMAIL || "jzamorazapata@gmail.com"
).trim().toLowerCase();

const APP_ORIGIN = String(
  process.env.APP_ORIGIN || `http://localhost:${PORT}`
).replace(/\/+$/, "");

const DEFAULT_EVAL_PRICE_COP = DEFAULT_EVALUATION_PRICE_COP;
const EVALUATION_SERVICE_ID = "adhd_evaluation";
const EVALUATION_SERVICE_LABEL = "Evaluación integral";
const CURRENCY = "COP";
const PRIVACY_NOTICE_VERSION_ACTIVE = PRIVACY_NOTICE_VERSION;
async function getPricingConfig() {
  // Precio comercial fijo de producción. Las promociones pueden aplicar
  // descuentos sobre este importe, pero ninguna configuración de Firestore
  // puede elevarlo o sustituirlo accidentalmente.
  return {
    serviceId: EVALUATION_SERVICE_ID,
    label: EVALUATION_SERVICE_LABEL,
    priceCop: DEFAULT_EVAL_PRICE_COP,
    currency: CURRENCY
  };
}
function calculatePromoDiscount(promo, basePrice) {
  const value = Number(promo.discountValue || 0);
  return promo.discountType === "percentage" ? Math.min(basePrice - 1, Math.floor(basePrice * value / 100)) : Math.min(basePrice - 1, Math.floor(value));
}
function validatePromoWindow(promo, now = new Date()) {
  if (!promo || promo.active !== true) return "Este código promocional no está activo.";
  const startsAt = promo.startsAt ? new Date(promo.startsAt) : null;
  const expiresAt = promo.expiresAt ? new Date(promo.expiresAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && now < startsAt) return "Este código todavía no está vigente.";
  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && now > expiresAt) return "Este código promocional venció.";
  if (Number(promo.maxUses || 0) > 0 && Number(promo.uses || 0) >= Number(promo.maxUses)) return "Este código alcanzó el límite de usos.";
  return "";
}

const { calculateEvaluationOnServer } = require("./lib/evaluation");
const { calculateParentEvaluation } = require("./lib/parent-evaluation");
const { decideWompiTransition } = require("./lib/payment-state");
const { validateWompiSignature } = require("./lib/wompi-signature");

const ALLOW_DEMO_PAY =
  String(process.env.ALLOW_DEMO_PAY || "false").toLowerCase() === "true";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";

const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || "";

const WOMPI_INTEGRITY_SECRET =
  process.env.WOMPI_INTEGRITY_SECRET ||
  process.env.WOMPI_INTEGRITY_KEY ||
  "";

const WOMPI_EVENTS_SECRET =
  process.env.WOMPI_EVENTS_SECRET ||
  process.env.WOMPI_EVENTS_KEY ||
  "";

/* =========================================================
   2. FIREBASE ADMIN
========================================================= */

if (!getApps().length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      );

      credential = cert(serviceAccount);
    } catch (error) {
      console.error(
        "FIREBASE_SERVICE_ACCOUNT_JSON no es válido:",
        error.message
      );
      process.exit(1);
    }
  } else {
    credential = applicationDefault();
  }

  initializeApp({
    credential,
    ...(FIREBASE_PROJECT_ID
      ? { projectId: FIREBASE_PROJECT_ID }
      : {})
  });
}

const db = getFirestore();
const firebaseAuth = getAuth();

/* =========================================================
   3. CORS, SEGURIDAD Y MIDDLEWARE
========================================================= */

const configuredOrigins = String(
  process.env.CORS_ORIGINS || APP_ORIGIN
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalized = origin.replace(/\/+$/, "");

      if (configuredOrigins.includes(normalized)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no autorizado por CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Event-Checksum"
    ],
    credentials: false
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 250,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiadas solicitudes. Intenta nuevamente más tarde."
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera unos minutos."
  }
});

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Has realizado demasiadas solicitudes. Intenta más tarde."
  }
});

// Límites adicionales para acciones que pueden consumir recursos o generar abuso.
// El almacén predeterminado es local al proceso; en despliegues con varias instancias
// debe sustituirse por un almacén compartido para aplicar límites globales.
const supportCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Has creado varias solicitudes. Intenta nuevamente en una hora." }
});
const backupExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 2,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Se alcanzó el límite temporal de exportaciones. Intenta más tarde." }
});

app.use("/api", generalLimiter);

/* =========================================================
   4. CORREO ELECTRÓNICO
========================================================= */

let mailer = null;

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || SMTP_FROM || SMTP_USER;
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || "NeuroEval Pro";
const EMAIL_PROVIDER = String(
  process.env.EMAIL_PROVIDER ||
    (BREVO_API_KEY ? "brevo" : RESEND_API_KEY ? "resend" : "smtp")
).trim().toLowerCase();

let smtpConnectionVerified = false;
const resendConfigured = Boolean(
  EMAIL_PROVIDER === "resend" && RESEND_API_KEY && RESEND_FROM
);
const brevoConfigured = Boolean(
  EMAIL_PROVIDER === "brevo" &&
  BREVO_API_KEY &&
  BREVO_FROM_EMAIL &&
  isValidEmail(BREVO_FROM_EMAIL)
);

if (
  EMAIL_PROVIDER === "smtp" &&
  SMTP_HOST &&
  SMTP_USER &&
  SMTP_PASSWORD &&
  Number.isInteger(SMTP_PORT) &&
  SMTP_PORT >= 1 &&
  SMTP_PORT <= 65535
) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  mailer.verify()
    .then(() => {
      smtpConnectionVerified = true;
      console.log("Conexión SMTP verificada correctamente.");
    })
    .catch((error) => {
      smtpConnectionVerified = false;
      console.error("No se pudo verificar la conexión SMTP:", error.message);
    });
}

const emailConfigured = EMAIL_PROVIDER === "brevo"
  ? brevoConfigured
  : EMAIL_PROVIDER === "resend"
    ? resendConfigured
    : EMAIL_PROVIDER === "smtp" && Boolean(mailer);

async function sendTransactionalEmail({ to, subject, text, html }) {
  if (EMAIL_PROVIDER === "brevo") {
    if (!brevoConfigured) {
      throw new Error("Brevo no está configurado. Revisa BREVO_API_KEY y BREVO_FROM_EMAIL.");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      }),
      signal: AbortSignal.timeout(15000)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = cleanText(
        result.message || result.code || `HTTP ${response.status}`,
        300
      );
      throw new Error(`Brevo rechazó el envío (${response.status}): ${detail}`);
    }
    return result;
  }

  if (EMAIL_PROVIDER === "resend") {
    if (!resendConfigured) {
      throw new Error("Resend no está configurado. Revisa RESEND_API_KEY y RESEND_FROM.");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(15000)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = cleanText(
        result.message || result.name || result.error || `HTTP ${response.status}`,
        300
      );
      throw new Error(`Resend rechazó el envío (${response.status}): ${detail}`);
    }
    return result;
  }

  if (EMAIL_PROVIDER !== "smtp" || !mailer) {
    throw new Error("No hay un proveedor de correo configurado.");
  }
  return mailer.sendMail({ from: SMTP_FROM, to, subject, text, html });
}

/* =========================================================
   5. FUNCIONES AUXILIARES
========================================================= */

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""));
  const second = Buffer.from(String(b || ""));

  if (first.length !== second.length) return false;

  return crypto.timingSafeEqual(first, second);
}

function makeReference() {
  return `NEURO-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function getPublicFirebaseConfig() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || ""
  };
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function asDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function getNestedValue(object, propertyPath) {
  return String(propertyPath)
    .split(".")
    .reduce((value, key) => {
      if (value === null || value === undefined) return undefined;
      return value[key];
    }, object);
}

/* =========================================================
   6. AUTENTICACIÓN Y PERMISOS
========================================================= */

async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return sendError(
        res,
        401,
        "Debes iniciar sesión para continuar."
      );
    }

    const decoded = await firebaseAuth.verifyIdToken(match[1], true);

    req.user = decoded;
    return next();

  } catch (error) {
    console.error("Token no válido:", error.message);
    return sendError(
      res,
      401,
      "Tu sesión no es válida. Inicia sesión nuevamente."
    );
  }
}

const ADMIN_PERMISSION_CATALOG = [
  "dashboard.view",
  "clients.view",
  "evaluations.view",
  "evaluations.responses",
  "evaluations.pdf",
  "payments.view",
  "settings.view",
  "pricing.manage",
  "audit.view",
  "support.view",
  "support.manage"
];

function normalizeAdminPermissions(values) {
  const permissions = new Set(
    Array.isArray(values)
      ? values.filter(item => ADMIN_PERMISSION_CATALOG.includes(item))
      : []
  );
  if (permissions.has("evaluations.responses") || permissions.has("evaluations.pdf")) {
    permissions.add("evaluations.view");
  }
  if (permissions.has("support.manage")) permissions.add("support.view");
  if (permissions.size) permissions.add("dashboard.view");
  return [...permissions];
}

async function getPrimaryAdminAccount(uid) {
  const account = await firebaseAuth.getUser(uid);
  const isPrimaryAdmin =
    !account.disabled &&
    account.emailVerified === true &&
    String(account.email || "").trim().toLowerCase() === ADMIN_EMAIL;
  return { account, isPrimaryAdmin };
}

// El administrador principal se identifica exclusivamente por el correo
// configurado y verificado. Un custom claim antiguo nunca concede privilegios.
async function requireAdmin(req, res, next) {
  try {
    if (!req.user) return sendError(res, 401, "Debes iniciar sesión.");
    const { isPrimaryAdmin } = await getPrimaryAdminAccount(req.user.uid);
    if (!isPrimaryAdmin) {
      return sendError(res, 403, "Esta acción está reservada al administrador principal.");
    }
    req.adminAccess = { isPrimaryAdmin: true, permissions: ADMIN_PERMISSION_CATALOG };
    return next();
  } catch (error) {
    console.error("Validación del administrador principal:", error);
    return sendError(res, 403, "No se pudo validar el permiso administrativo.");
  }
}

function requireStaffAdmin(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) return sendError(res, 401, "Debes iniciar sesión.");
      const { account, isPrimaryAdmin } = await getPrimaryAdminAccount(req.user.uid);
      if (account.disabled) return sendError(res, 403, "La cuenta está deshabilitada.");
      if (isPrimaryAdmin) {
        req.adminAccess = { isPrimaryAdmin: true, permissions: ADMIN_PERMISSION_CATALOG };
        return next();
      }
      const roleSnapshot = await db.collection("adminRoles").doc(req.user.uid).get();
      const role = roleSnapshot.exists ? roleSnapshot.data() || {} : {};
      const permissions = Array.isArray(role.permissions)
        ? role.permissions.filter(item => ADMIN_PERMISSION_CATALOG.includes(item))
        : [];
      const accountEmail = String(account.email || "").trim().toLowerCase();
      const roleEmail = String(role.email || "").trim().toLowerCase();
      if (account.emailVerified !== true || !roleEmail || roleEmail !== accountEmail ||
          role.status !== "active" || !permissions.includes(permission)) {
        return sendError(res, 403, "No tienes autorización para realizar esta acción.");
      }
      req.adminAccess = { isPrimaryAdmin: false, permissions };
      return next();
    } catch (error) {
      console.error("Validación de permisos de colaborador:", error);
      return sendError(res, 403, "No se pudieron validar tus permisos.");
    }
  };
}

async function writeAdminAudit(actorUid, action, targetUid, details = {}) {
  await db.collection("adminAuditLogs").add({
    actorUid,
    action,
    targetUid: targetUid || null,
    details,
    createdAt: FieldValue.serverTimestamp()
  });
}

/* =========================================================
   CENTRO DE SOPORTE Y SOLICITUDES
========================================================= */

// Un cliente solo puede crear y consultar sus propios tickets.
// El acceso administrativo se controla mediante permisos independientes.
app.post("/api/support/tickets", supportCreateLimiter, requireUser, async (req, res) => {
  try {
    const subject = cleanText(req.body.subject, 120);
    const message = cleanText(req.body.message, 3000);
    const category = ["cuenta", "evaluacion", "pago", "informe", "tecnico", "otro"].includes(req.body.category)
      ? req.body.category : "otro";
    if (subject.length < 4 || message.length < 10) {
      return sendError(res, 400, "Escribe un asunto y una descripción más completos.");
    }
    const account = await firebaseAuth.getUser(req.user.uid);
    const ticketRef = db.collection("supportTickets").doc();
    await ticketRef.set({
      uid: req.user.uid,
      email: String(account.email || req.user.email || "").toLowerCase(),
      displayName: cleanText(account.displayName || "", 120),
      subject,
      category,
      status: "open",
      priority: "normal",
      messages: [{
        senderUid: req.user.uid,
        senderRole: "customer",
        message,
        createdAt: new Date().toISOString()
      }],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return res.status(201).json({ ok: true, ticketId: ticketRef.id });
  } catch (error) {
    console.error("Crear ticket de soporte:", error);
    return sendError(res, 500, "No se pudo crear la solicitud de soporte.");
  }
});

app.get("/api/support/tickets", requireUser, async (req, res) => {
  try {
    const snapshot = await db.collection("supportTickets")
      .where("uid", "==", req.user.uid)
      .limit(100)
      .get();
    const tickets = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id, subject: data.subject || "", category: data.category || "otro",
        status: data.status || "open", priority: data.priority || "normal",
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: asDate(data.createdAt)?.toISOString() || null,
        updatedAt: asDate(data.updatedAt)?.toISOString() || null
      };
    }).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ tickets });
  } catch (error) {
    console.error("Consultar tickets propios:", error);
    return sendError(res, 500, "No se pudieron consultar tus solicitudes.");
  }
});

// Un cliente autenticado solo puede responder dentro de sus propias solicitudes.
app.post("/api/support/tickets/:id/messages", requireUser, async (req, res) => {
  try {
    const message = cleanText(req.body.message, 3000);
    if (message.length < 2) return sendError(res, 400, "Escribe un mensaje antes de enviarlo.");
    const ref = db.collection("supportTickets").doc(String(req.params.id || ""));
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { status: 404, error: "No encontramos esa solicitud." };
      const data = snapshot.data() || {};
      if (data.uid !== req.user.uid) return { status: 403, error: "No tienes acceso a esta solicitud." };
      const messages = Array.isArray(data.messages) ? data.messages : [];
      if (messages.length >= 100) return { status: 409, error: "Esta conversación alcanzó el límite de mensajes. Crea una nueva solicitud para continuar." };
      if (data.status === "closed") return { status: 409, error: "Esta solicitud está cerrada. Crea una nueva solicitud para recibir ayuda." };
      const nextMessages = [...messages, {
        senderUid: req.user.uid,
        senderRole: "customer",
        message,
        createdAt: new Date().toISOString()
      }];
      transaction.update(ref, {
        messages: nextMessages,
        status: ["resolved", "waiting_customer"].includes(data.status) ? "in_progress" : (data.status || "open"),
        updatedAt: FieldValue.serverTimestamp()
      });
      return { status: 200, ok: true };
    });
    if (result.status !== 200) return sendError(res, result.status, result.error);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Responder ticket de soporte:", error);
    return sendError(res, 500, "No se pudo enviar tu mensaje.");
  }
});

app.get("/api/admin/support/tickets", requireUser, requireStaffAdmin("support.view"), async (req, res) => {
  try {
    const status = ["open", "in_progress", "waiting_customer", "resolved", "closed"].includes(req.query.status)
      ? req.query.status : "";
    let query = db.collection("supportTickets").orderBy("updatedAt", "desc").limit(150);
    if (status) query = db.collection("supportTickets").where("status", "==", status).limit(150);
    const snapshot = await query.get();
    const tickets = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id, uid: data.uid || "", email: data.email || "",
        displayName: data.displayName || "", subject: data.subject || "",
        category: data.category || "otro", status: data.status || "open",
        priority: data.priority || "normal",
        messages: Array.isArray(data.messages) ? data.messages : [],
        createdAt: asDate(data.createdAt)?.toISOString() || null,
        updatedAt: asDate(data.updatedAt)?.toISOString() || null
      };
    }).sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return res.json({ tickets });
  } catch (error) {
    console.error("Consultar tickets administrativos:", error);
    return sendError(res, 500, "No se pudo cargar la bandeja de soporte.");
  }
});

app.patch("/api/admin/support/tickets/:id", requireUser, requireStaffAdmin("support.manage"), async (req, res) => {
  try {
    const ref = db.collection("supportTickets").doc(String(req.params.id || ""));
    const snapshot = await ref.get();
    if (!snapshot.exists) return sendError(res, 404, "No encontramos esa solicitud.");
    const allowedStatuses = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) return sendError(res, 400, "El estado seleccionado no es válido.");
      updates.status = req.body.status;
    }
    if (req.body.priority !== undefined) {
      if (!["low", "normal", "high", "urgent"].includes(req.body.priority)) return sendError(res, 400, "La prioridad seleccionada no es válida.");
      updates.priority = req.body.priority;
    }
    const reply = cleanText(req.body.reply, 3000);
    if (reply.length) {
      const existingMessages = Array.isArray(snapshot.data()?.messages) ? snapshot.data().messages : [];
      if (existingMessages.length >= 100) {
        return sendError(res, 409, "Esta conversación alcanzó el límite de mensajes. Crea una nueva solicitud para continuar.");
      }
      updates.messages = FieldValue.arrayUnion({
        senderUid: req.user.uid,
        senderRole: "admin",
        message: reply,
        createdAt: new Date().toISOString()
      });
    }
    if (Object.keys(updates).length === 1) return sendError(res, 400, "No hay cambios para guardar.");
    await ref.set(updates, { merge: true });
    await writeAdminAudit(req.user.uid, "support.ticket.updated", snapshot.data()?.uid || null, {
      ticketId: ref.id, status: updates.status || snapshot.data()?.status || "open",
      priority: updates.priority || snapshot.data()?.priority || "normal",
      replied: Boolean(reply)
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Actualizar ticket de soporte:", error);
    return sendError(res, 500, "No se pudo actualizar la solicitud.");
  }
});

/* =========================================================
   7. SESIÓN Y ROL DE LA CUENTA
========================================================= */

// Devuelve el rol calculado en el servidor. La cuenta administradora debe
// tener el correo configurado y estar verificada en Firebase Authentication.
app.get("/api/session", requireUser, async (req, res) => {
  try {
    const { account, isPrimaryAdmin } = await getPrimaryAdminAccount(req.user.uid);
    const roleSnapshot = isPrimaryAdmin
      ? null
      : await db.collection("adminRoles").doc(req.user.uid).get();
    const role = roleSnapshot?.exists ? roleSnapshot.data() || {} : {};
    const permissions = isPrimaryAdmin
      ? ADMIN_PERMISSION_CATALOG
      : role.status === "active" && Array.isArray(role.permissions)
        ? role.permissions.filter(item => ADMIN_PERMISSION_CATALOG.includes(item))
        : [];
    const isSecondaryAdmin =
      !isPrimaryAdmin &&
      !account.disabled &&
      account.emailVerified === true &&
      role.status === "active" &&
      String(role.email || "").trim().toLowerCase() === String(account.email || "").trim().toLowerCase();
    return res.json({
      ok: true,
      isAdmin: !account.disabled && (isPrimaryAdmin || isSecondaryAdmin),
      isPrimaryAdmin: !account.disabled && isPrimaryAdmin,
      isSecondaryAdmin: !account.disabled && isSecondaryAdmin,
      permissions
    });
  } catch (error) {
    console.error("Consultar rol de sesión:", error);
    return sendError(res, 500, "No se pudo validar el perfil de la cuenta.");
  }
});

/* =========================================================
   8. ESTADO DEL SERVIDOR Y CONFIGURACIÓN FIREBASE
========================================================= */

app.get("/api/health", (req, res) => {
  const wompiEnvironment = WOMPI_PUBLIC_KEY.startsWith("pub_test_")
    ? "sandbox"
    : WOMPI_PUBLIC_KEY.startsWith("pub_prod_")
      ? "production"
      : "not-configured";

  res.json({
    ok: true,
    service: "NeuroEval Pro API",
    firebaseProject: FIREBASE_PROJECT_ID || null,
    smtpConfigured: EMAIL_PROVIDER === "smtp" && Boolean(mailer),
    smtpConnectionVerified: EMAIL_PROVIDER === "smtp" && Boolean(mailer) && smtpConnectionVerified,
    emailProvider: EMAIL_PROVIDER,
    emailConfigured,
    brevoConfigured,
    resendConfigured,
    emailConnectionVerified: EMAIL_PROVIDER === "smtp"
      ? (Boolean(mailer) && smtpConnectionVerified)
      : null,
    wompiConfigured: Boolean(
      WOMPI_PUBLIC_KEY &&
      WOMPI_INTEGRITY_SECRET &&
      WOMPI_EVENTS_SECRET
    ),
    wompiEnvironment,
    demoPaymentEnabled: ALLOW_DEMO_PAY,
    evaluationPriceCop: DEFAULT_EVAL_PRICE_COP,
    time: new Date().toISOString()
  });
});

app.get("/firebase-config.js", (req, res) => {
  const config = getPublicFirebaseConfig();

  res.setHeader(
    "Content-Type",
    "application/javascript; charset=utf-8"
  );
  res.setHeader("Cache-Control", "no-store");

  res.send(
    `window.FIREBASE_CONFIG = ${JSON.stringify(config)};`
  );
});

/* =========================================================
   8. PERFIL DE USUARIO
========================================================= */

app.get("/api/profile", requireUser, async (req, res) => {
  try {
    const ref = db.collection("users").doc(req.user.uid);
    const snapshot = await ref.get();

    return res.json({
      profile: snapshot.exists ? snapshot.data() : null
    });

  } catch (error) {
    console.error("GET perfil:", error);
    return sendError(
      res,
      500,
      "No se pudo consultar el perfil."
    );
  }
});

app.post("/api/profile", requireUser, async (req, res) => {
  try {
    const name = cleanText(req.body.name, 120);
    const goal = cleanText(req.body.goal, 120);
    const age = req.body.age === null || req.body.age === undefined ? null : Number(req.body.age);
    const country = cleanText(req.body.country, 80);
    const city = cleanText(req.body.city, 100);
    const requestedLanguage = String(req.body.language || "").toLowerCase();
    const language = ["es", "en"].includes(requestedLanguage) ? requestedLanguage : "es";
    const requestedConsent = req.body.privacyConsent;
    if (requestedConsent !== undefined && !validatePrivacyConsent(requestedConsent)) {
      return sendError(res, 400, "El consentimiento de privacidad no es válido o está desactualizado.");
    }
    if (!name) return sendError(res, 400, "El nombre es obligatorio.");
    if (age !== null && (!Number.isInteger(age) || age < 18 || age > 99)) return sendError(res, 400, "La edad no es válida.");
    const proxyCountry = String(req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "").trim().toUpperCase();
    const validProxyCountry = /^[A-Z]{2}$/.test(proxyCountry) && proxyCountry !== "XX" ? proxyCountry : "";
    const userRef = db.collection("users").doc(req.user.uid);
    const existing = await userRef.get();
    const previous = existing.exists ? existing.data() || {} : {};
    const profile = {
      uid: req.user.uid, name, email: String(req.user.email || "").toLowerCase(), age,
      goal: goal || "Autoconocimiento",
      country: country || previous.country || "",
      city: city || previous.city || "",
      countrySource: country ? "user" : (previous.country ? previous.countrySource || "user" : (validProxyCountry ? "proxy_country" : "unknown")),
      detectedCountryCode: validProxyCountry || previous.detectedCountryCode || "",
      language, updatedAt: FieldValue.serverTimestamp()
    };
    if (!existing.exists) profile.createdAt = FieldValue.serverTimestamp();
    if (requestedConsent) {
      profile.privacyConsentVersion = PRIVACY_NOTICE_VERSION_ACTIVE;
      profile.privacyConsentLanguage = requestedConsent.language;
      profile.privacyConsentAt = FieldValue.serverTimestamp();
    }
    await userRef.set(profile, { merge: true });
    if (requestedConsent) {
      await userRef.collection("privacyConsents").doc(PRIVACY_NOTICE_VERSION_ACTIVE).set({
        version: PRIVACY_NOTICE_VERSION_ACTIVE,
        accepted: true,
        language: requestedConsent.language,
        scope: "account_and_self_assessment",
        acceptedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    // La analítica agregada admite hasta cinco minutos de desfase para evitar
    // invalidar la caché y volver a escanear perfiles en cada actualización.
    return res.json({ ok: true, profile });
  } catch (error) {
    console.error("POST perfil:", error);
    return sendError(res, 500, "No se pudo guardar el perfil.");
  }
});

/* =========================================================
   8A. PORTABILIDAD Y SOLICITUDES DE PRIVACIDAD
========================================================= */

app.get("/api/privacy/export", requireUser, backupExportLimiter, async (req, res) => {
  try {
    const uid = req.user.uid;
    const [profileSnapshot, evaluationsSnapshot] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("evaluations").where("uid", "==", uid).limit(1000).get()
    ]);
    const consentSnapshot = await db.collection("users").doc(uid).collection("privacyConsents").get();
    const evaluations = evaluationsSnapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="neuroeval-pro-datos-personales.json"');
    return res.json({
      exportedAt: new Date().toISOString(),
      account: profileSnapshot.exists ? profileSnapshot.data() : null,
      consents: consentSnapshot.docs.map(document => document.data()),
      evaluations,
      truncated: evaluationsSnapshot.size >= 1000
    });
  } catch (error) {
    console.error("Exportación de datos personales:", error);
    return sendError(res, 500, "No se pudieron exportar tus datos personales.");
  }
});

app.post("/api/privacy/requests", requireUser, supportCreateLimiter, async (req, res) => {
  try {
    const requestType = String(req.body?.type || "").trim().toLowerCase();
    const allowedTypes = ["access", "rectification", "deletion"];
    if (!allowedTypes.includes(requestType)) {
      return sendError(res, 400, "El tipo de solicitud de privacidad no es válido.");
    }
    const requestRef = await db.collection("privacyRequests").add({
      uid: req.user.uid,
      email: String(req.user.email || "").toLowerCase(),
      type: requestType,
      status: "pending",
      noticeVersion: PRIVACY_NOTICE_VERSION_ACTIVE,
      createdAt: FieldValue.serverTimestamp()
    });
    return res.status(202).json({ ok: true, requestId: requestRef.id, status: "pending" });
  } catch (error) {
    console.error("Solicitud de privacidad:", error);
    return sendError(res, 500, "No se pudo registrar tu solicitud de privacidad.");
  }
});

/* Solicitudes de derechos de privacidad: solo el administrador principal puede revisarlas. */
app.get("/api/admin/privacy-requests", requireUser, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("privacyRequests").orderBy("createdAt", "desc").limit(100).get();
    const requests = snapshot.docs.map(document => {
      const data = document.data() || {};
      return {
        id: document.id,
        uid: data.uid || "",
        email: data.email || "",
        type: data.type || "",
        status: data.status || "pending",
        createdAt: asDate(data.createdAt)?.toISOString() || null,
        reviewedAt: asDate(data.reviewedAt)?.toISOString() || null
      };
    });
    return res.json({ requests });
  } catch (error) {
    console.error("Bandeja de solicitudes de privacidad:", error);
    return sendError(res, 500, "No se pudieron consultar las solicitudes de privacidad.");
  }
});

app.patch("/api/admin/privacy-requests/:id", requireUser, requireAdmin, async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["in_review", "completed", "rejected"].includes(status)) {
      return sendError(res, 400, "El estado de la solicitud no es válido.");
    }
    const ref = db.collection("privacyRequests").doc(String(req.params.id || ""));
    const snapshot = await ref.get();
    if (!snapshot.exists) return sendError(res, 404, "No encontramos la solicitud de privacidad.");
    await ref.update({
      status,
      reviewedAt: FieldValue.serverTimestamp(),
      reviewedBy: req.user.uid
    });
    return res.json({ ok: true, status });
  } catch (error) {
    console.error("Actualizar solicitud de privacidad:", error);
    return sendError(res, 500, "No se pudo actualizar la solicitud de privacidad.");
  }
});

/* =========================================================
   9. CREAR EVALUACIÓN
========================================================= */

app.post("/api/evaluations", requireUser, async (req, res) => {
  try {
    const body = req.body || {};
    const name = cleanText(body.name, 120);
    const goal = cleanText(body.goal, 120);
    const email = String(req.user.email || "").toLowerCase();

    if (!name) {
      return sendError(res, 400, "No se encontró el nombre del usuario.");
    }

    const evaluationType = body.evaluationType === "parent_observation" ? "parent_observation" : "self_report";
    const userProfileSnapshot = await db.collection("users").doc(req.user.uid).get();
    const userProfile = userProfileSnapshot.exists ? userProfileSnapshot.data() || {} : {};
    const consentSnapshot = await db.collection("users").doc(req.user.uid)
      .collection("privacyConsents").doc(PRIVACY_NOTICE_VERSION_ACTIVE).get();
    if (!consentSnapshot.exists || consentSnapshot.data()?.accepted !== true) {
      return sendError(res, 428, "Antes de evaluar debes aceptar la versión vigente del aviso de privacidad.");
    }

    const calculated = evaluationType === "parent_observation"
      ? calculateParentEvaluation(body.answers, body.parentContext || {})
      : calculateEvaluationOnServer(body.answers);
    if (calculated.error) {
      return sendError(res, 400, calculated.error);
    }

    const age = body.age === null || body.age === undefined
      ? Number(userProfile.age)
      : Number(body.age);
    if (!Number.isInteger(age) || age < 18 || age > 99) {
      return sendError(res, 400, "La cuenta debe corresponder a una persona adulta de 18 años o más.");
    }

    const consentLanguage = consentSnapshot.data()?.language === "en" ? "en" : "es";
    let parentContextRecord = null;
    if (evaluationType === "parent_observation") {
      parentContextRecord = buildParentConsentRecord(
        body.parentContext || {},
        body.parentContext?.consentLanguage || consentLanguage,
        new Date().toISOString()
      );
      if (!parentContextRecord) {
        return sendError(res, 400, "Se requiere autorización válida del padre, madre, tutor o cuidador.");
      }
      parentContextRecord = { ...calculated.parentContext, ...parentContextRecord };
      // Se conserva solo una franja de edad; no el dato exacto del menor.
      delete parentContextRecord.childAge;
    }

    const pricing = await getPricingConfig();
    const reference = makeReference();
    const evaluation = {
      uid: req.user.uid,
      name,
      email,
      age,
      goal,
      evaluationType,
      parentContext: parentContextRecord,
      answers: calculated.answers,
      scores: calculated.scores,
      profile: calculated.profile,
      profileDescription: calculated.profileDescription,
      recommendations: calculated.recommendations,
      dimensions: calculated.dimensions,
      summary: calculated.summary,
      attentionTasks: calculated.attentionTasks,
      disclaimer: calculated.disclaimer,
      paymentStatus: "pending",
      paymentProvider: "wompi",
      paymentReference: reference,
      serviceId: pricing.serviceId,
      serviceLabel: evaluationType === "parent_observation" ? "Observación familiar de indicadores asociados al TDAH" : pricing.label,
      originalAmountCop: pricing.priceCop,
      discountCop: 0,
      amountCop: pricing.priceCop,
      promoCode: null,
      currency: CURRENCY,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const document = await db.collection("evaluations").add(evaluation);

    // No devolver respuestas ni resultados antes del pago confirmado.
    // El informe completo solo se entrega mediante el endpoint protegido.
    return res.status(201).json({
      ok: true,
      id: document.id,
      reference,
      paymentStatus: "pending",
      amountCop: pricing.priceCop,
      currency: CURRENCY
    });
  } catch (error) {
    console.error("Crear evaluación:", error);
    return sendError(res, 500, "No se pudo guardar la evaluación.");
  }
});

/* =========================================================
   10. CONSULTAR EVALUACIONES DEL USUARIO
========================================================= */

app.get("/api/my-evaluations", requireUser, async (req, res) => {
  try {
    const snapshot = await db
      .collection("evaluations")
      .where("uid", "==", req.user.uid)
      .get();

    // El historial del usuario solo expone metadatos de pago.
    // Nunca incluir respuestas, puntajes, perfil ni recomendaciones aquí.
    const evaluations = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.name || "",
        goal: data.goal || "",
        paymentStatus: data.paymentStatus || "pending",
        amountCop: data.amountCop || DEFAULT_EVAL_PRICE_COP,
        currency: data.currency || CURRENCY,
        createdAt: data.createdAt || null
      };
    });

    return res.json({ evaluations });

  } catch (error) {
    console.error("Consultar evaluaciones:", error);
    return sendError(
      res,
      500,
      "No se pudieron consultar tus evaluaciones."
    );
  }
});

async function getOwnedEvaluation(uid, id) {
  const ref = db.collection("evaluations").doc(id);
  const snapshot = await ref.get();

  if (!snapshot.exists) return null;

  const evaluation = snapshot.data();

  if (evaluation.uid !== uid) return null;

  return {
    ref,
    data: evaluation
  };
}

app.get(
  "/api/my-evaluations/:id",
  requireUser,
  async (req, res) => {
    try {
      const result = await getOwnedEvaluation(
        req.user.uid,
        req.params.id
      );

      if (!result) {
        return sendError(
          res,
          404,
          "No encontramos esa evaluación."
        );
      }

      if (result.data.paymentStatus !== "paid") {
        return sendError(
          res,
          402,
          "El informe estará disponible cuando se confirme el pago."
        );
      }

      return res.json({
        evaluation: {
          id: req.params.id,
          ...result.data
        }
      });

    } catch (error) {
      console.error("Consultar evaluación individual:", error);
      return sendError(
        res,
        500,
        "No se pudo cargar la evaluación."
      );
    }
  }
);
/* =========================================================
   11. ESTADO DEL PAGO
========================================================= */

app.get(
  "/api/my-evaluations/:id/payment-status",
  requireUser,
  async (req, res) => {
    try {
      const result = await getOwnedEvaluation(req.user.uid, req.params.id);

      if (!result) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      return res.json({
        id: req.params.id,
        paymentStatus: result.data.paymentStatus || "pending",
        reference: result.data.paymentReference || null,
        amountCop: result.data.amountCop || DEFAULT_EVAL_PRICE_COP,
        currency: result.data.currency || CURRENCY
      });

    } catch (error) {
      console.error("Estado de pago:", error);
      return sendError(res, 500, "No se pudo consultar el estado del pago.");
    }
  }
);

/* =========================================================
   12. FIRMA DE INTEGRIDAD WOMPI
========================================================= */

app.post(
  "/api/payments/wompi-signature",
  requireUser,
  async (req, res) => {
    try {
      if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET) {
        return sendError(
          res,
          503,
          "La pasarela de pagos todavía no está configurada en el servidor."
        );
      }

      const evaluationId = cleanText(req.body.evaluationId, 150);

      if (!evaluationId) {
        return sendError(res, 400, "Falta el identificador de la evaluación.");
      }

      const result = await getOwnedEvaluation(req.user.uid, evaluationId);

      if (!result) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      const requestedPromoCode = String(req.body.promoCode || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
      const payment = await db.runTransaction(async (transactionWriter) => {
        const snapshot = await transactionWriter.get(result.ref);
        if (!snapshot.exists) return { error: "not-found" };
        const evaluation = snapshot.data() || {};
        if (evaluation.paymentStatus === "paid") return { error: "already-paid" };
        if (String(evaluation.wompiTransactionStatus || "").toUpperCase() === "APPROVED") return { error: "reconciliation-required" };
        // No reemplazar una referencia de Wompi pendiente creada con el precio
        // anterior: su checkout podría seguir abierto y pagarse fuera de la app.
        if (isLegacyPendingPayment(evaluation)) return { error: "legacy-pending-payment" };
        const basePrice = DEFAULT_EVAL_PRICE_COP;
        let promo = null, promoRef = null;
        if (requestedPromoCode) {
          promoRef = db.collection("promoCodes").doc(requestedPromoCode);
          const promoSnapshot = await transactionWriter.get(promoRef);
          promo = promoSnapshot.exists ? promoSnapshot.data() || {} : null;
          if (!promo) return { error: "invalid-promo" };
          const promoError = evaluation.promoCode === requestedPromoCode ? "" : validatePromoWindow(promo);
          if (promoError) return { error: "promo-unavailable", message: promoError };
          if (Array.isArray(promo.serviceIds) && promo.serviceIds.length && !promo.serviceIds.includes(evaluation.serviceId || EVALUATION_SERVICE_ID)) return { error: "promo-service" };
          if (promo.newCustomersOnly) {
            const priorEvaluations = await transactionWriter.get(db.collection("evaluations").where("uid", "==", req.user.uid).limit(100));
            if (priorEvaluations.docs.some(doc => doc.data()?.paymentStatus === "paid")) return { error: "promo-new-customer" };
          }
          if (evaluation.promoCode && evaluation.promoCode !== requestedPromoCode) return { error: "promo-locked" };
        }
        let amounts = calculateEvaluationPaymentAmounts(
          evaluation.promoCode ? evaluation.discountCop : 0
        );
        let discountCop = amounts.discountCop;
        let appliedCode = evaluation.promoCode || null;
        let amountCop = amounts.amountCop;
        if (requestedPromoCode && !evaluation.promoCode) {
          amounts = calculateEvaluationPaymentAmounts(calculatePromoDiscount(promo, basePrice));
          discountCop = amounts.discountCop;
          amountCop = amounts.amountCop;
          appliedCode = requestedPromoCode;
          transactionWriter.set(promoRef, { uses: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
        if (!Number.isSafeInteger(amountCop) || amountCop < 1) return { error: "invalid-price" };
        // Al retomar una evaluación pendiente, conservar la referencia activa
        // de Wompi siempre que el importe y el código promocional sigan iguales.
        // Solo se crea una referencia nueva para una evaluación nueva o un intento
        // que realmente cambie sus condiciones de pago.
        const storedAmount = Number(evaluation.amountCop || basePrice);
        const canReuseReference =
          evaluation.paymentStatus === "pending" &&
          Boolean(evaluation.paymentReference) &&
          (!requestedPromoCode || evaluation.promoCode === requestedPromoCode) &&
          storedAmount === amountCop;
        const reference = canReuseReference
          ? evaluation.paymentReference
          : makeReference();
        const paymentUpdate = {
          originalAmountCop: basePrice,
          discountCop,
          amountCop,
          promoCode: appliedCode,
          paymentReference: reference,
          paymentStatus: "pending",
          paymentProvider: "wompi",
          updatedAt: FieldValue.serverTimestamp()
        };
        if (!canReuseReference) {
          paymentUpdate.wompiTransactionId = FieldValue.delete();
          paymentUpdate.wompiTransactionStatus = FieldValue.delete();
        }
        transactionWriter.set(result.ref, paymentUpdate, { merge: true });
        return { reference, amountCop, originalAmountCop: basePrice, discountCop, promoCode: appliedCode };
      });

      if (payment.error === "already-paid") {
        return sendError(res, 409, "Esta evaluación ya aparece pagada.");
      }
      if (payment.error === "reconciliation-required") {
        return sendError(
          res,
          409,
          "La transacción aparece aprobada y requiere reconciliación del pago."
        );
      }
      if (payment.error === "legacy-pending-payment") {
        return sendError(
          res,
          409,
          "Esta evaluación conserva un intento de pago anterior con un importe distinto al vigente. No se generó otro enlace para evitar cobros duplicados. Contacta a soporte para revisar el intento."
        );
      }
      if (payment.error === "invalid-promo") return sendError(res, 400, "El código promocional no existe.");
      if (payment.error === "promo-unavailable") return sendError(res, 400, payment.message || "El código promocional no está disponible.");
      if (payment.error === "promo-service") return sendError(res, 400, "Este código no aplica a esta evaluación.");
      if (payment.error === "promo-new-customer") return sendError(res, 400, "Este código es exclusivo para nuevos clientes.");
      if (payment.error === "promo-locked") return sendError(res, 409, "Ya se aplicó otro código a esta evaluación. No es posible sustituirlo.");
      if (payment.error === "invalid-price") return sendError(res, 500, "El precio configurado no es válido.");
      if (payment.error) return sendError(res, 404, "No encontramos esa evaluación.");
      const reference = payment.reference;
      const amountInCents = payment.amountCop * 100;
      const signatureString =
        `${reference}${amountInCents}${CURRENCY}${WOMPI_INTEGRITY_SECRET}`;
      const signature = sha256(signatureString);
      const redirectUrl =
        `${APP_ORIGIN}/?evaluation=${encodeURIComponent(evaluationId)}`;

      return res.json({
        publicKey: WOMPI_PUBLIC_KEY,
        currency: CURRENCY,
        amountInCents,
        amountCop: payment.amountCop,
        originalAmountCop: payment.originalAmountCop,
        discountCop: payment.discountCop,
        promoCode: payment.promoCode,
        reference,
        signature,
        redirectUrl
      });

    } catch (error) {
      console.error("Firma Wompi:", error);
      return sendError(res, 500, "No se pudo preparar el pago.");
    }
  }
);

/* =========================================================
   13. WEBHOOK WOMPI
   La notificación firmada por Wompi es la fuente de confirmación.
========================================================= */

function validateWompiEvent(event, headerChecksum) {
  return validateWompiSignature(
    event,
    headerChecksum,
    WOMPI_EVENTS_SECRET
  );
}

app.post("/api/payments/wompi-webhook", async (req, res) => {
  try {
    const event = req.body || {};
    const headerChecksum = req.get("X-Event-Checksum") || "";

    validateWompiEvent(event, headerChecksum);

    if (event.event !== "transaction.updated") {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "Evento no relacionado con actualización de transacción."
      });
    }

    const transaction = event?.data?.transaction;

    if (!transaction) {
      return sendError(res, 400, "El evento no contiene la transacción.");
    }

    const reference = String(transaction.reference || "");
    const transactionId = String(transaction.id || "");
    const status = String(transaction.status || "").toUpperCase();
    const amountInCents = Number(transaction.amount_in_cents);
    const currency = String(transaction.currency || "").toUpperCase();
    const expectedEnvironment = WOMPI_PUBLIC_KEY.startsWith("pub_test_")
      ? "test"
      : WOMPI_PUBLIC_KEY.startsWith("pub_prod_")
        ? "prod"
        : "";

    if (!reference || !transactionId || !status) {
      return sendError(res, 400, "La transacción no contiene los datos obligatorios.");
    }

    if (
      expectedEnvironment &&
      String(event.environment || "").toLowerCase() !== expectedEnvironment
    ) {
      console.error("El ambiente del evento Wompi no coincide con la configuración:", {
        expectedEnvironment,
        receivedEnvironment: event.environment
      });
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "El ambiente de la transacción no coincide."
      });
    }

    const query = await db
      .collection("evaluations")
      .where("paymentReference", "==", reference)
      .limit(1)
      .get();

    if (query.empty) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "Referencia no encontrada."
      });
    }

    const evaluationRef = query.docs[0].ref;
    const expectedAmountInCents = Number(query.docs[0].data()?.amountCop || DEFAULT_EVAL_PRICE_COP) * 100;
    if (amountInCents !== expectedAmountInCents || currency !== CURRENCY) {
      console.error("Importe o moneda no coinciden:", { reference, amountInCents, expectedAmountInCents, currency });
      return res.status(200).json({ ok: true, ignored: true, reason: "El importe o la moneda no coinciden." });
    }
    const outcome = await db.runTransaction(async (transactionWriter) => {
      const snapshot = await transactionWriter.get(evaluationRef);

      if (!snapshot.exists) {
        return { ignored: true, reason: "La evaluación ya no existe." };
      }

      const evaluation = snapshot.data() || {};

      // La referencia debe seguir siendo la activa: una notificación de un
      // intento anterior no puede afectar un reintento con nueva referencia.
      if (evaluation.paymentReference !== reference) return { ignored: true, reason: "La referencia ya no corresponde al intento de pago activo." };
      if (Number(evaluation.amountCop || DEFAULT_EVAL_PRICE_COP) * 100 !== amountInCents || currency !== CURRENCY) return { ignored: true, reason: "El importe ya no coincide con el precio registrado." };

      const decision = decideWompiTransition(evaluation, {
        status,
        transactionId
      });

      if (decision.ignored) {
        return decision;
      }

      const update = {
        ...decision.update,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (decision.update.setPaidAt) {
        update.paidAt = FieldValue.serverTimestamp();
        delete update.setPaidAt;
      }

      transactionWriter.set(evaluationRef, update, { merge: true });
      return { updated: true };
    });

    if (outcome.ignored) {
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: outcome.reason
      });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Webhook Wompi rechazado:", error.message);
    return res.status(400).json({
      error: "No se pudo validar el evento."
    });
  }
});

/* =========================================================
   14. PAGO DE DEMOSTRACIÓN (SOLO PARA PRUEBAS)
========================================================= */

app.post(
  "/api/my-evaluations/:id/pay",
  requireUser,
  async (req, res) => {
    if (!ALLOW_DEMO_PAY) {
      return sendError(
        res,
        403,
        "Los pagos de demostración están desactivados."
      );
    }

    try {
      const result = await getOwnedEvaluation(
        req.user.uid,
        req.params.id
      );

      if (!result) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      await result.ref.set(
        {
          paymentStatus: "paid",
          paymentProvider: "demo",
          paidAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      return res.json({
        ok: true,
        paymentStatus: "paid"
      });

    } catch (error) {
      console.error("Pago de demostración:", error);
      return sendError(
        res,
        500,
        "No se pudo completar la demostración."
      );
    }
  }
);

/* =========================================================
   15. GENERACIÓN DE INFORME PDF
========================================================= */

const REPORT_TRANSLATIONS = {
  "Plataforma segura": "Secure platform",
  "🌐 Español": "🌐 Spanish",
  "Azul": "Blue",
  "Amarillo": "Yellow",
  "Morado": "Purple",
  "Verde": "Green",
  "← Anterior": "← Previous",
  "Mi cuenta": "My account",
  "Panel de administración": "Admin dashboard",
  "Perfil": "Profile",
  "Pruebas": "Assessments",
  "Juegos": "Games",
  "Actividades": "Activities",
  "Recomendaciones": "Recommendations",
  "Mi progreso": "My progress",
  "Configuración": "Settings",
  "Cerrar sesión": "Sign out",
  "Conocimiento · Atención · Bienestar": "Awareness · Attention · Well-being",
  "Conoce mejor cómo funciona tu mente.": "Understand how your mind works.",
  "Explora tus hábitos de atención, organización y autorregulación mediante una experiencia interactiva diseñada para ayudarte a conocerte mejor.": "Explore your attention, organization, and self-regulation habits through an interactive experience designed to help you understand yourself better.",
  "Comienza tu experiencia": "Start your experience",
  "Accede a tu cuenta o crea una nueva en pocos pasos.": "Sign in or create an account in a few steps.",
  "Bienvenido a NeuroEval": "Welcome to NeuroEval",
  "Ingresa tus datos para continuar.": "Enter your details to continue.",
  "Iniciar sesión": "Sign in",
  "Crear cuenta": "Create account",
  "Correo electrónico": "Email address",
  "Contraseña": "Password",
  "Ingresar a mi cuenta →": "Sign in →",
  "¿Olvidaste tu contraseña?": "Forgot your password?",
  "Nombre completo": "Full name",
  "Crea una contraseña": "Create a password",
  "Edad": "Age",
  "Objetivo": "Goal",
  "Seleccionar": "Select",
  "Explorar atención": "Explore attention",
  "Concentración": "Focus",
  "Debes aceptar el aviso de privacidad.": "You must accept the privacy notice.",
  "Tu cuenta": "Your account",
  "Mi perfil": "My profile",
  "Consulta la información asociada a tu cuenta.": "Review the information associated with your account.",
  "Nombre": "Name",
  "País (opcional)": "Country (optional)",
  "Ciudad (opcional)": "City (optional)",
  "Idioma preferido": "Preferred language",
  "Guardar preferencias regionales": "Save regional preferences",
  "La ciudad y el país son voluntarios. Se utilizan en estadísticas agregadas y no para localizarte individualmente.": "City and country are optional. They are used for aggregate statistics, not to locate you individually.",
  "Volver a mis pruebas": "Back to my assessments",
  "Guardando preferencias…": "Saving preferences…",
  "Preferencias regionales guardadas.": "Regional preferences saved.",
  "Nunca": "Never",
  "Rara vez": "Rarely",
  "A veces": "Sometimes",
  "Con frecuencia": "Often",
  "Casi siempre": "Almost always",
  "Finalizar evaluación": "Finish assessment",
  "Siguiente →": "Next →",
  "Anterior": "Previous",
  "Memoria inmediata": "Immediate memory",
  "Atención sostenida": "Sustained attention",
  "Búsqueda visual": "Visual search",
  "Organización y planificación": "Organization and planning",
  "Inquietud e impulsividad": "Restlessness and impulsivity",
  "Regulación emocional": "Emotional regulation",
  "Estrés y descanso": "Stress and rest",
  "Impacto cotidiano": "Everyday impact",
  "Historia y contexto": "History and context",
  "Recuerdo de palabras": "Word recall",
  "Memoria de secuencias": "Sequence memory",
  "Recuerdo de números": "Number recall",
  "Recuerdo de patrones": "Pattern recall",
  "Recuerdo final de palabras": "Final word recall",
  "Memoriza estas tres palabras. Más adelante te pediremos recordarlas.": "Memorize these three words. We will ask you to recall them later.",
  "Cuando lees, estudias o trabajas, ¿pierdes el hilo aunque quieras prestar atención?": "When reading, studying or working, do you lose track even when you want to pay attention?",
  "Cuenta cuántas estrellas aparecen entre los símbolos.": "Count how many stars appear among the symbols.",
  "¿Te cuesta dividir una tarea grande en pasos y decidir por dónde empezar?": "Do you find it difficult to break a large task into steps and decide where to start?",
  "Memoriza estos números en el mismo orden. Más adelante tendrás que seleccionarlos.": "Memorize these numbers in the same order. You will select them later.",
  "¿Sientes inquietud física o necesidad de moverte cuando debes permanecer sentado?": "Do you feel physically restless or need to move when you have to remain seated?",
  "¿Qué color aparece más veces en esta secuencia?": "Which color appears most often in this sequence?",
  "¿Una frustración pequeña puede provocarte una reacción emocional intensa o difícil de regular?": "Can a small frustration trigger an intense or difficult-to-regulate emotional reaction?",
  "¿Qué grupo contiene exactamente las tres palabras que memorizaste al comienzo?": "Which group contains exactly the three words you memorized at the beginning?",
  "¿Notas que tu concentración empeora cuando duermes poco o descansas mal?": "Does your concentration get worse when you sleep too little or rest poorly?",
  "¿Postergas tareas importantes aunque tengas claro que debes hacerlas?": "Do you put off important tasks even when you know you need to do them?",
  "Memoriza el orden de estos símbolos. Más adelante tendrás que reconocer la secuencia exacta.": "Memorize the order of these symbols. You will need to recognize the exact sequence later.",
  "¿Estas experiencias dificultan tus estudios, trabajo, tareas domésticas o relaciones?": "Do these experiences make studying, working, household tasks or relationships more difficult?",
  "¿Cuál era la secuencia numérica que viste anteriormente?": "What was the number sequence you saw earlier?",
  "¿Actúas o respondes rápidamente y luego piensas que habrías preferido hacer una pausa?": "Do you act or respond quickly and later wish you had paused first?",
  "¿Recuerdas que algunas de estas dificultades ya estaban presentes antes de los 12 años?": "Do you remember some of these difficulties being present before age 12?",
  "Cuenta cuántos círculos negros aparecen en la secuencia.": "Count how many black circles appear in the sequence.",
  "Memoriza estas cuatro palabras. Después de varias actividades te preguntaremos por ellas.": "Memorize these four words. We will ask you about them after several activities.",
  "¿Cuál era el orden exacto de los cuatro símbolos que memorizaste?": "What was the exact order of the four symbols you memorized?",
  "¿La preocupación, tensión o ansiedad ocupa tu mente e interfiere con lo que estás haciendo?": "Do worry, tension or anxiety occupy your mind and interfere with what you are doing?",
  "¿Te cuesta terminar una actividad cuando aparecen notificaciones, conversaciones o ruidos?": "Do you find it difficult to finish an activity when notifications, conversations or noise appear?",
  "Cuenta cuántos triángulos aparecen en esta secuencia.": "Count how many triangles appear in this sequence.",
  "¿Estas dificultades aparecen en más de un entorno, por ejemplo casa, estudio, trabajo o vida social?": "Do these difficulties occur in more than one setting, such as home, school, work or social life?",
  "¿Te cuesta recuperar la calma cuando algo interrumpe tus planes?": "Do you find it difficult to regain your calm when something disrupts your plans?",
  "¿Otras personas te han señalado dificultades de atención, organización, inquietud o impulsividad?": "Have other people pointed out difficulties with attention, organization, restlessness or impulsivity?",
  "Al inicio de esta parte memorizaste cuatro palabras. ¿Cuál es el grupo exacto?": "At the beginning of this section, you memorized four words. Which group is exact?",
  "Ya memoricé la secuencia": "I memorized the sequence",
  "Ya memoricé los números": "I memorized the numbers",
  "Ya memoricé las palabras": "I memorized the words",
  "Por ejemplo: relees el mismo párrafo varias veces y al final no recuerdas qué decía.": "For example: you reread the same paragraph several times and still cannot remember what it said.",
  "Por ejemplo: tienes varias cosas pendientes y no sabes cómo ordenarlas.": "For example: you have several pending tasks and do not know how to organize them.",
  "Observa cuánto tarda en bajar la intensidad de la emoción.": "Notice how long it takes for the intensity of the emotion to decrease.",
  "Compara tus días descansados con los días de poco sueño.": "Compare well-rested days with days when you sleep little.",
  "No se trata de pereza: observa si te cuesta iniciar o sostener el primer paso.": "This is not about laziness: notice whether starting or maintaining the first step is difficult.",
  "Responde pensando en consecuencias concretas y repetidas.": "Answer by thinking about specific, recurring consequences.",
  "Selecciona los cuatro números en el mismo orden.": "Select the four numbers in the same order.",
  "Piensa en recuerdos escolares, familiares o relatos de personas cercanas.": "Think about school or family memories, or accounts from people close to you.",
  "Elige la secuencia que viste, en el mismo orden.": "Choose the sequence you saw, in the same order.",
  "Por ejemplo: intentas trabajar, pero sigues pensando en un problema.": "For example: you try to work, but keep thinking about a problem.",
  "Piensa en lo que ocurre cuando intentas concentrarte y algo interrumpe tu tarea.": "Think about what happens when you try to focus and something interrupts your task.",
  "No tienen que presentarse igual en todos los lugares.": "They do not have to appear in the same way in every setting.",
  "Piensa en cambios inesperados o tareas que no salen como esperabas.": "Think about unexpected changes or tasks that do not go as planned.",
  "Considera comentarios respetuosos de personas que te conocen bien.": "Consider thoughtful feedback from people who know you well.",
  "Elige la secuencia que recuerdes, sin volver atrás.": "Choose the sequence you remember without going back.",
  "Observa y memoriza estos elementos. No los anotes: te preguntaremos por ellos más adelante.": "Observe and memorize these items. Do not write them down: we will ask you about them later.",
  "Piensa en una situación habitual de tu vida cotidiana.": "Think of a typical situation in your everyday life.",
  "¡Vas muy bien! Sigue a tu ritmo; cada respuesta ayuda a construir una imagen más completa.": "You are doing great! Keep your own pace; every answer helps build a more complete picture.",
  "¡Ya superaste la mitad! Mantén la concentración: estás avanzando muy bien.": "You are past the halfway point! Stay focused; you are making great progress.",
  "¡Último tramo! Ya falta poco. Respira y responde con tranquilidad.": "Final stretch! You are almost there. Breathe and answer calmly.",
  "¡Casi terminamos! Una respuesta honesta es más útil que intentar elegir la respuesta perfecta.": "Almost done! An honest answer is more useful than trying to choose the perfect answer.",
  "Tómate tu tiempo. Responde pensando en lo que suele ocurrirte, no en un día excepcional.": "Take your time. Think about what usually happens to you, not an unusual day.",
  "NeuroEval Pro | Conoce cómo funciona tu mente": "NeuroEval Pro | Understand how your mind works",
  "Idioma / Language": "Language",
  "🛡️ &nbsp; Panel de administración": "🛡️ &nbsp; Admin dashboard",
  "👤 &nbsp; Perfil": "👤 &nbsp; Profile",
  "🧠 &nbsp; Pruebas": "🧠 &nbsp; Assessments",
  "⚙️ &nbsp; Configuración": "⚙️ &nbsp; Settings",
  "↪ &nbsp; Cerrar sesión": "↪ &nbsp; Sign out",
  "Estrés y fatiga": "Stress and fatigue",
  "Autoconocimiento": "Self-awareness",
  "País y ciudad son voluntarios y se usan para estadísticas generales. No se almacena tu ubicación GPS.": "Country and city are optional and used for aggregate statistics. Your GPS location is not stored.",
  "He leído y acepto el aviso de privacidad y el tratamiento de mis datos para esta experiencia.": "I have read and accept the privacy notice and the processing of my data for this experience.",
  "Crear cuenta y comenzar →": "Create account and start →",
  "O continúa con": "Or continue with",
  "Continuar con Google": "Continue with Google",
  "NeuroEval Pro ofrece un autorregistro orientativo. No es una prueba diagnóstica, no confirma ni descarta TDAH y no reemplaza la valoración de un profesional de salud.": "NeuroEval Pro provides an informational self-report. It is not a diagnostic test, does not confirm or rule out ADHD, and does not replace assessment by a health professional.",
  "Tu mente merece atención": "Your mind deserves attention",
  "Pequeños descubrimientos pueden abrir nuevas perspectivas.": "Small discoveries can open new perspectives.",
  "Responde con calma, reflexiona sobre tus experiencias y recibe un resumen orientativo de tus respuestas.": "Answer calmly, reflect on your experiences, and receive an informational summary of your responses.",
  "Experiencia guiada": "Guided experience",
  "Informe personal": "Personal report",
  "Recupera tu acceso": "Recover your access",
  "Te enviaremos un código de verificación de seis dígitos a tu correo.": "We will send a six-digit verification code to your email.",
  "Correo de tu cuenta": "Your account email",
  "Enviar código": "Send code",
  "Código de seis dígitos": "Six-digit code",
  "Nueva contraseña": "New password",
  "Cambiar contraseña": "Change password",
  "Volver al inicio de sesión": "Back to sign in",
  "Tu espacio personal": "Your personal space",
  "Bienvenido a NeuroEval Pro": "Welcome to NeuroEval Pro",
  "Elige la evaluación que deseas realizar. Podrás regresar a este panel para consultar las opciones disponibles.": "Choose the assessment you want to take. You can return to this dashboard to view available options.",
  "Catálogo de evaluaciones": "Assessment catalog",
  "Selecciona una evaluación para conocer sus características y comenzar.": "Select an assessment to learn about its features and get started.",
  "● Disponible ahora": "● Available now",
  "Autorregistro de atención e indicadores asociados al TDAH": "Attention self-report and ADHD-related indicators",
  "Explora experiencias relacionadas con atención, organización, inquietud e impulsividad. Es orientativo y no constituye un diagnóstico.": "Explore experiences related to attention, organization, restlessness, and impulsivity. This is informational and is not a diagnosis.",
  "Comenzar evaluación →": "Start assessment →",
  "● Nueva evaluación": "● New assessment",
  "Observación familiar de indicadores asociados al TDAH": "Family observation of ADHD-related indicators",
  "Cuestionario para padres y cuidadores de menores de 4 a 17 años. Explora conductas observables en casa, colegio y otros entornos.": "Questionnaire for parents and caregivers of children aged 4–17. Explore observable behaviors at home, school, and other settings.",
  "Mismo precio que la evaluación actual · Informe individual": "Same price as the current assessment · Individual report",
  "Comenzar observación →": "Start observation →",
  "Próximamente": "Coming soon",
  "Una futura evaluación orientativa sobre atención, planificación y organización de actividades.": "A future informational assessment of attention, planning, and task organization.",
  "Una futura evaluación orientativa para explorar factores que pueden influir en el bienestar y la concentración.": "A future informational assessment of factors that may affect well-being and concentration.",
  "Las evaluaciones disponibles ofrecen información orientativa y no sustituyen una valoración profesional ni constituyen diagnósticos clínicos.": "Available assessments provide informational insights and do not replace professional evaluation or constitute clinical diagnoses.",
  "Estamos para ayudarte": "We're here to help",
  "Centro de soporte": "Support center",
  "Crea una solicitud y sigue la conversación con nuestro equipo.": "Create a request and follow the conversation with our team.",
  "↻ Actualizar solicitudes": "↻ Refresh requests",
  "Asunto": "Subject",
  "Categoría": "Category",
  "Cuenta y acceso": "Account and access",
  "Evaluaciones": "Assessments",
  "Pagos": "Payments",
  "Informe y PDF": "Report and PDF",
  "Problema técnico": "Technical issue",
  "Otro": "Other",
  "¿En qué podemos ayudarte?": "How can we help?",
  "Enviar solicitud": "Submit request",
  "Mis solicitudes": "My requests",
  "Tus conversaciones son privadas.": "Your conversations are private.",
  "Cargando tus solicitudes…": "Loading your requests…",
  "Entrena jugando": "Train through games",
  "Desafíos cognitivos por niveles": "Level-based cognitive challenges",
  "12 juegos diferentes, gratuitos y con dificultad progresiva. Supera cada reto para desbloquear el siguiente nivel.": "12 free games with progressive difficulty. Complete each challenge to unlock the next level.",
  "100 % gratis": "100% free",
  "Juegos disponibles": "Available games",
  "Niveles progresivos": "Progressive levels",
  "Tu avance": "Your progress",
  "0 niveles": "0 levels",
  "Memoria de trabajo": "Working memory",
  "1. Secuencia relámpago": "1. Flash sequence",
  "Recuerda números cada vez más largos y en el orden exacto.": "Remember increasingly long number sequences in the exact order.",
  "Jugar →": "Play →",
  "Atención selectiva": "Selective attention",
  "2. Cazador de símbolos": "2. Symbol hunter",
  "Encuentra objetivos entre más distractores y con menos tiempo.": "Find targets among more distractors and with less time.",
  "Razonamiento abstracto": "Abstract reasoning",
  "3. Completa el patrón": "3. Complete the pattern",
  "Descubre reglas numéricas y secuencias que se vuelven más complejas.": "Discover numerical rules and increasingly complex sequences.",
  "Cálculo mental · contrarreloj": "Mental math · timed",
  "4. Mente veloz": "4. Quick mind",
  "Resuelve operaciones con dificultad y ritmo crecientes.": "Solve calculations with increasing difficulty and pace.",
  "Memoria verbal": "Verbal memory",
  "5. Archivo de palabras": "5. Word archive",
  "Memoriza palabras y reconócelas entre opciones parecidas.": "Memorize words and recognize them among similar options.",
  "Discriminación visual": "Visual discrimination",
  "6. El intruso": "6. The odd one out",
  "Detecta el elemento diferente en grupos cada vez más parecidos.": "Spot the different item in increasingly similar groups.",
  "Control inhibitorio": "Inhibitory control",
  "7. Color bajo presión": "7. Color under pressure",
  "Responde al color de la tinta, no a la palabra que intenta distraerte.": "Respond to the ink color, not the distracting word.",
  "Orientación espacial": "Spatial orientation",
  "8. Giro mental": "8. Mental rotation",
  "Rota flechas y figuras mentalmente para elegir su orientación final.": "Mentally rotate arrows and shapes to choose their final orientation.",
  "Velocidad de reacción": "Reaction speed",
  "9. Reflejos": "9. Reflexes",
  "Espera la señal y reacciona sin anticiparte. Mejora tu marca personal.": "Wait for the signal and react without anticipating. Improve your personal best.",
  "Lógica deductiva": "Deductive logic",
  "10. Código secreto": "10. Secret code",
  "Usa pistas para descubrir combinaciones y resolver el código.": "Use clues to discover combinations and solve the code.",
  "Atención y conteo": "Attention and counting",
  "11. Cuenta y encuentra": "11. Count and find",
  "Cuenta objetivos en tableros con más elementos y distractores.": "Count targets on boards with more items and distractors.",
  "Atención dividida": "Divided attention",
  "12. Doble misión": "12. Double mission",
  "Atiende dos reglas al mismo tiempo y cambia de estrategia por ronda.": "Follow two rules at the same time and switch strategies each round.",
  "Cada juego guarda tu nivel más alto en este dispositivo. Los retos son recreativos y sus resultados no constituyen diagnósticos ni pruebas neuropsicológicas validadas.": "Each game saves your highest level on this device. These challenges are recreational; their results are not diagnoses or validated neuropsychological tests.",
  "Pausas que ayudan": "Helpful breaks",
  "Actividades para tu día": "Daily activities",
  "Pequeños ejercicios gratuitos para practicar enfoque, organización y autorregulación.": "Short free exercises to practice focus, organization, and self-regulation.",
  "Respiración consciente": "Mindful breathing",
  "Inhala suavemente durante 4 segundos, exhala durante 6. Repite cinco veces sin forzar la respiración.": "Breathe in gently for 4 seconds and out for 6. Repeat five times without forcing your breath.",
  "Marcar como realizada": "Mark as completed",
  "Divide una tarea": "Break down a task",
  "Escribe una tarea pendiente y divídela en tres pasos pequeños y concretos. Empieza por el primero.": "Write down a pending task and divide it into three small, concrete steps. Start with the first.",
  "Pausa de observación": "Observation break",
  "Mira a tu alrededor y nombra mentalmente cinco cosas que ves, cuatro que sientes y tres que escuchas.": "Look around and mentally name five things you see, four you feel, and three you hear.",
  "Enfoque de 10 minutos": "10-minute focus",
  "Elige una sola tarea, elimina una distracción y trabaja en ella durante diez minutos.": "Choose one task, remove one distraction, and work on it for ten minutes.",
  "Recuerdo del día": "Daily recall",
  "Sin consultar el teléfono, recuerda tres cosas que aprendiste o hiciste hoy y en qué orden ocurrieron.": "Without checking your phone, recall three things you learned or did today and the order in which they happened.",
  "Pausa de movimiento": "Movement break",
  "Levántate, cambia de postura y camina suavemente unos minutos si tus condiciones lo permiten.": "Stand up, change posture, and walk gently for a few minutes if your circumstances allow.",
  "Lectura con intención": "Intentional reading",
  "Lee un párrafo corto. Después, explica con tus palabras tres ideas principales sin mirar el texto.": "Read a short paragraph. Then explain three main ideas in your own words without looking at the text.",
  "Ordena tu espacio": "Organize your space",
  "Dedica cinco minutos a organizar una pequeña zona de trabajo. Deja a la vista solo lo que necesitas.": "Spend five minutes organizing a small work area. Keep only what you need in view.",
  "Cuenta hacia atrás": "Count backwards",
  "Cuenta desde 50 hacia atrás de tres en tres. Hazlo a tu ritmo y vuelve a empezar si pierdes la cuenta.": "Count backwards from 50 in steps of three. Go at your own pace and start again if you lose track.",
  "Plan de tres prioridades": "Three-priority plan",
  "Elige tres tareas importantes para hoy. Marca cuál es la primera y estima cuánto tiempo necesitas.": "Choose three important tasks for today. Mark the first one and estimate how much time you need.",
  "Escucha atenta": "Active listening",
  "Escucha durante dos minutos un sonido o una canción. Identifica cinco detalles que normalmente pasarías por alto.": "Listen to a sound or song for two minutes. Identify five details you would normally overlook.",
  "Diario de bienestar": "Well-being journal",
  "Anota cómo te sientes, qué pudo influir en ese estado y una acción pequeña que te ayudaría ahora.": "Write down how you feel, what may have influenced it, and one small action that could help now.",
  "Hábitos y bienestar": "Habits and well-being",
  "Recomendaciones prácticas": "Practical recommendations",
  "Ideas generales que puedes adaptar a tu rutina. No sustituyen una orientación profesional.": "General ideas you can adapt to your routine. They do not replace professional guidance.",
  "1. Trabaja en bloques pequeños": "1. Work in small blocks",
  "Elige una tarea, define un primer paso y dedica un periodo breve a completarlo. Haz una pausa antes de continuar.": "Choose a task, define a first step, and spend a short period completing it. Take a break before continuing.",
  "2. Reduce las distracciones visibles": "2. Reduce visible distractions",
  "Deja a mano solo lo que necesitas y silencia notificaciones que no sean importantes durante tu bloque de enfoque.": "Keep only what you need nearby and mute nonessential notifications during your focus block.",
  "3. Usa recordatorios externos": "3. Use external reminders",
  "Apóyate en listas, alarmas y calendarios. No necesitas depender únicamente de la memoria.": "Use lists, alarms, and calendars. You do not need to rely on memory alone.",
  "4. Practica de forma breve y constante": "4. Practice briefly and consistently",
  "Alterna juegos de memoria, búsqueda visual y actividades de organización. Observa cómo te sientes, sin convertir el puntaje en una etiqueta.": "Alternate memory games, visual search, and organizational activities. Notice how you feel without turning scores into labels.",
  "5. Cuida el descanso y las pausas": "5. Look after rest and breaks",
  "Procura horarios de sueño regulares y pausas de movimiento adecuadas a tus posibilidades.": "Aim for regular sleep times and movement breaks suited to your circumstances.",
  "6. Convierte las metas en acciones observables": "6. Turn goals into observable actions",
  "En lugar de proponerte “ser más organizado”, define una acción concreta: preparar los materiales antes de empezar.": "Instead of aiming to “be more organized,” define a concrete action: prepare materials before starting.",
  "7. Usa una señal para comenzar": "7. Use a starting cue",
  "Asocia el inicio de una tarea con una señal sencilla, como abrir tu agenda, poner un temporizador o despejar el escritorio.": "Link the start of a task to a simple cue, such as opening your planner, setting a timer, or clearing your desk.",
  "8. Alterna esfuerzo y recuperación": "8. Alternate effort and recovery",
  "Prueba bloques de trabajo adaptados a tu energía y realiza pausas breves entre ellos. Ajusta la duración según cómo te sientas.": "Try work blocks adapted to your energy and take short breaks between them. Adjust the duration to how you feel.",
  "9. Repite la información de otra manera": "9. Repeat information in another way",
  "Resume en voz alta, dibuja un esquema o escribe palabras clave. Cambiar de formato puede facilitar la comprensión.": "Summarize aloud, draw an outline, or write keywords. Changing the format can make information easier to understand.",
  "10. Prepara el día siguiente": "10. Prepare for the next day",
  "Antes de terminar, anota el primer paso de mañana y deja listo lo que puedas necesitar.": "Before finishing, write down tomorrow's first step and prepare what you may need.",
  "11. Reconoce los avances pequeños": "11. Recognize small steps forward",
  "Registra lo que sí lograste, incluso si fue un paso breve. Evita comparar tu ritmo con el de otras personas.": "Record what you achieved, even if it was a small step. Avoid comparing your pace with others.",
  "12. Observa tus momentos de mayor energía": "12. Notice when your energy is highest",
  "Identifica en qué momentos te resulta más sencillo concentrarte y reserva, cuando sea posible, las tareas exigentes para esos periodos.": "Identify when it is easiest for you to focus and, when possible, reserve demanding tasks for those periods.",
  "13. Reduce la carga de memoria": "13. Reduce memory load",
  "Deja notas visibles, utiliza listas de verificación y establece un lugar fijo para objetos importantes.": "Leave visible notes, use checklists, and establish a fixed place for important items.",
  "14. Haz una cosa a la vez cuando sea posible": "14. Do one thing at a time when possible",
  "Cierra pestañas innecesarias y termina un paso antes de cambiar de actividad. La multitarea puede aumentar los olvidos.": "Close unnecessary tabs and finish one step before switching activities. Multitasking can increase forgetfulness.",
  "15. Pide apoyo de forma específica": "15. Ask for specific support",
  "Si lo necesitas, explica qué tarea te cuesta y qué ayuda concreta te serviría: recordar una fecha, dividir un proyecto o revisar prioridades.": "If needed, explain which task is difficult and what specific help would be useful: remembering a date, breaking down a project, or reviewing priorities.",
  "Si las dificultades de atención, memoria, impulsividad o estado de ánimo afectan tu vida diaria, consulta con un profesional cualificado.": "If difficulties with attention, memory, impulsivity, or mood affect your daily life, consult a qualified professional.",
  "Tu recorrido": "Your journey",
  "Resumen de los juegos y actividades completados en este dispositivo y cuenta.": "Summary of games and activities completed on this device and account.",
  "Actualizar": "Refresh",
  "Juegos completados": "Games completed",
  "Actividades realizadas": "Activities completed",
  "Mejor puntuación": "Best score",
  "Actividad reciente": "Recent activity",
  "Aún no hay actividades registradas. ¡Prueba tu primer juego!": "No activities recorded yet. Try your first game!",
  "Mis evaluaciones": "My assessments",
  "Historial de evaluaciones y acceso a tus informes.": "Assessment history and access to your reports.",
  "Total de evaluaciones": "Total assessments",
  "Pagadas": "Paid",
  "Pendientes de pago": "Pending payment",
  "Inicia sesión para consultar tus evaluaciones.": "Sign in to view your assessments.",
  "El progreso de esta sección se guarda en el navegador de este dispositivo. Si borras los datos del navegador o cambias de dispositivo, el historial local puede perderse.": "Progress in this section is saved in this device's browser. If you clear browser data or change devices, local history may be lost.",
  "Preferencias y seguridad": "Preferences and security",
  "Administra opciones básicas de acceso y conoce cómo se utiliza tu cuenta.": "Manage basic access options and learn how your account is used.",
  "Cuenta activa": "Active account",
  "Seguridad de la cuenta": "Account security",
  "Puedes iniciar el proceso de recuperación para establecer una contraseña nueva mediante el código enviado a tu correo.": "You can start the recovery process to set a new password using the code sent to your email.",
  "Tus respuestas de evaluación se utilizan para generar el informe orientativo. Evita compartir tu contraseña y cierra sesión si utilizas un dispositivo compartido.": "Your assessment answers are used to generate the informational report. Do not share your password and sign out if you use a shared device.",
  "Observación familiar · 4 a 17 años": "Family observation · Ages 4–17",
  "Cuéntanos sobre el menor que observas": "Tell us about the child you are observing",
  "Responde como padre, madre o cuidador. No hay respuestas correctas o incorrectas. La evaluación se refiere a conductas observadas durante los últimos seis meses, teniendo en cuenta la edad y las circunstancias. Ten en cuenta las diferencias esperables entre las etapas de 4–7, 8–12 y 13–17 años.": "Answer as a parent or caregiver. There are no right or wrong answers. This assessment concerns behaviors observed over the last six months, taking age and circumstances into account. Consider expected differences across ages 4–7, 8–12, and 13–17.",
  "Nombre del familiar que responde": "Name of the responding family member",
  "Franja de edad del menor": "Child's age band",
  "Edad del menor": "Child's age",
  "Seleccionar edad": "Select age",
  "¿Qué parentesco tienes con el menor?": "What is your relationship to the child?",
  "Madre": "Mother",
  "Padre": "Father",
  "Tutor legal": "Legal guardian",
  "Abuelo/a": "Grandparent",
  "Otro familiar": "Other family member",
  "Cuidador/a": "Caregiver",
  "¿En qué entornos puedes observar su comportamiento? (Selecciona al menos uno)": "In which settings can you observe their behavior? (Select at least one)",
  "Casa": "Home",
  "Colegio": "School",
  "Actividades sociales u otros espacios": "Social activities or other settings",
  "Importante: esta herramienta no diagnostica ni descarta TDAH y no es una escala clínica validada. No escribas el nombre del menor, su colegio ni otros datos que permitan identificarlo. Si te preocupa su desarrollo o bienestar, consulta con pediatría o un profesional de salud infantil.": "Important: this tool does not diagnose or rule out ADHD and is not a validated clinical scale. Do not enter the child's name, school, or other identifying details. If you are concerned about their development or well-being, consult a pediatrician or child health professional.",
  "Confirmo que soy su padre, madre, tutor o cuidador autorizado y que puedo proporcionar esta información para recibir orientación.": "I confirm that I am the child's parent, guardian, or authorized caregiver and may provide this information to receive guidance.",
  "Continuar al cuestionario →": "Continue to questionnaire →",
  "Volver al catálogo": "Back to catalog",
  "Tu espacio de exploración": "Your exploration space",
  "Vamos paso a paso.": "Let's take it step by step.",
  "Responde según lo que observas habitualmente; no hay respuestas buenas ni malas.": "Answer based on what you usually observe; there are no right or wrong answers.",
  "Atención y enfoque": "Attention and focus",
  "Tu progreso": "Your progress",
  "Selecciona la frecuencia que mejor describa tu experiencia.": "Select the frequency that best describes your experience.",
  "Tómate tu tiempo. No hay respuestas correctas o incorrectas.": "Take your time. There are no right or wrong answers.",
  "Evaluación completada": "Assessment completed",
  "Tu informe está casi listo.": "Your report is almost ready.",
  "Tu autorregistro fue recibido. Completa el pago para desbloquear el informe detallado y descargar tu PDF.": "Your self-report has been received. Complete payment to unlock the detailed report and download your PDF.",
  "Pago único por informe": "One-time payment per report",
  "¿Tienes un código promocional?": "Do you have a promo code?",
  "Aplicar código": "Apply code",
  "Resumen de dimensiones": "Dimension summary",
  "Orientaciones personales": "Personal guidance",
  "Informe descargable": "Downloadable report",
  "Ya realicé el pago · Verificar estado": "I've paid · Verify status",
  "El estado del pago se confirma en el servidor mediante la notificación de Wompi. El regreso desde la pasarela no constituye por sí solo una confirmación de pago.": "Payment status is confirmed on the server through a Wompi notification. Returning from the payment gateway alone does not confirm payment.",
  "Tu informe personal": "Your personal report",
  "Un espacio para comprenderte.": "A space to understand yourself.",
  "Este resumen organiza tus respuestas y ofrece orientaciones generales para reflexionar sobre tu bienestar cognitivo.": "This summary organizes your answers and offers general guidance to help you reflect on your cognitive well-being.",
  "Resultado del autorregistro": "Self-report result",
  "Indicadores descriptivos calculados a partir de tus respuestas.": "Descriptive indicators calculated from your answers.",
  "Mapa de dimensiones": "Dimensions map",
  "Comparación visual de los indicadores del autorregistro. Los valores describen respuestas y no representan probabilidades ni un diagnóstico clínico.": "Visual comparison of self-report indicators. Values describe responses and do not represent probabilities or a clinical diagnosis.",
  "Actividades interactivas de atención y memoria": "Interactive attention and memory activities",
  "Aspectos que ayudan a interpretar las respuestas con cautela.": "Aspects that help interpret responses with caution.",
  "Orientaciones personalizadas": "Personalized guidance",
  "Estrategias relacionadas con las áreas que destacaron en tus respuestas.": "Strategies related to the areas that stood out in your responses.",
  "Este informe no es un diagnóstico clínico ni una escala validada. Los porcentajes representan únicamente la distribución de respuestas de este cuestionario y no deben interpretarse como probabilidad de tener un trastorno. Si tienes inquietudes, consulta con un profesional cualificado.": "This report is not a clinical diagnosis or a validated scale. Percentages represent only the distribution of responses in this questionnaire and must not be interpreted as the probability of having a disorder. If you have concerns, consult a qualified professional.",
  "↓ Descargar informe PDF": "↓ Download PDF report",
  "Administración segura": "Secure administration",
  "Centro de administración.": "Administration center.",
  "Gestiona clientes, evaluaciones, pagos e informes desde un solo lugar.": "Manage clients, assessments, payments, and reports in one place.",
  "📊 Resumen": "📊 Overview",
  "👥 Clientes": "👥 Clients",
  "🧠 Evaluaciones": "🧠 Assessments",
  "💳 Pagos": "💳 Payments",
  "📈 Analítica comercial": "📈 Business analytics",
  "🌍 Alcance internacional": "🌍 International reach",
  "🏷️ Precios y promociones": "🏷️ Pricing and promotions",
  "⚙️ Configuración": "⚙️ Settings",
  "🩺 Salud del sistema": "🩺 System health",
  "🛡️ Colaboradores": "🛡️ Team members",
  "🎧 Centro de soporte": "🎧 Support center",
  "📋 Actividad": "📋 Activity",
  "Clientes registrados": "Registered clients",
  "Pendientes": "Pending",
  "Fallidos": "Failed",
  "Ingresos confirmados": "Confirmed revenue",
  "Evolución de evaluaciones": "Assessment trends",
  "Distribución mensual de los registros recientes disponibles": "Monthly distribution of available recent records",
  "Tendencia": "Trend",
  "Cargando datos…": "Loading data…",
  "Evaluaciones registradas": "Assessments recorded",
  "Muestra disponible": "Available sample",
  "Estado de pagos": "Payment status",
  "Proporción según los registros disponibles": "Proportion based on available records",
  "Sin datos": "No data",
  "Últimas evaluaciones recibidas.": "Latest assessments received.",
  "Ver todas": "View all",
  "↻ Actualizar": "↻ Refresh",
  "Fecha": "Date",
  "Cliente": "Client",
  "Correo": "Email",
  "Estado": "Status",
  "Acciones": "Actions",
  "Cargando...": "Loading...",
  "Perfiles asociados a las cuentas de la plataforma.": "Profiles associated with platform accounts.",
  "Registro": "Registration",
  "UID": "UID",
  "Se muestran hasta 100 perfiles registrados.": "Up to 100 registered profiles are shown.",
  "Historial de evaluaciones": "Assessment history",
  "Consulta estados, respuestas, resultados e informes.": "View statuses, answers, results, and reports.",
  "Resultado": "Result",
  "Pago": "Payment",
  "Se muestran hasta las 100 evaluaciones más recientes. El detalle protegido incluye respuestas y resultados almacenados.": "Up to the 100 most recent assessments are shown. Protected details include stored answers and results.",
  "Analítica comercial": "Business analytics",
  "Indicadores calculados con los registros de evaluaciones y pagos guardados en Firestore.": "Indicators calculated from assessment and payment records stored in Firestore.",
  "↻ Actualizar analítica": "↻ Refresh analytics",
  "Cargando indicadores…": "Calculating indicators…",
  "Ingresos confirmados · últimos 6 meses": "Confirmed revenue · last 6 months",
  "Solo pagos con estado confirmado.": "Confirmed payments only.",
  "Conversiones por mes": "Monthly conversions",
  "Evaluaciones pagadas frente al total creado en cada mes.": "Paid assessments compared with the total created each month.",
  "Rendimiento de promociones": "Promotion performance",
  "Usos reservados por código y evaluaciones que lo tienen asociado. Un uso reservado no garantiza que el pago haya sido aprobado.": "Reserved uses by code and associated assessments. A reserved use does not guarantee payment approval.",
  "Alcance internacional": "International reach",
  "Distribución agregada por país, ciudad, edad, idioma y objetivo declarado.": "Aggregated distribution by country, city, age, language, and stated goal.",
  "↻ Actualizar datos": "↻ Refresh data",
  "Los grupos de menos de 10 usuarios se ocultan para proteger la privacidad.": "Groups with fewer than 10 users are hidden to protect privacy.",
  "Mapa mundial de usuarios": "World map of users",
  "Ubicaciones agregadas por país; cada punto representa un grupo, no una persona.": "Aggregated locations by country; each point represents a group, not an individual.",
  "Vista global": "Global view",
  "Cargando mapa mundial…": "Loading world map…",
  "Solo se representan países con al menos 10 perfiles y código de país reconocible. No se muestran ubicaciones individuales.": "Only countries with at least 10 profiles and a recognized country code are shown. Individual locations are not displayed.",
  "Usuarios por país": "Users by country",
  "Usuarios por ciudad": "Users by city",
  "Distribución por edades": "Age distribution",
  "Idioma": "Language",
  "No se muestran nombres, correos, identificadores, respuestas ni ubicaciones individuales. Los grupos inferiores a 10 se ocultan. La ciudad es voluntaria; no se usa GPS.": "Names, emails, identifiers, answers, and individual locations are not shown. Groups under 10 are hidden. City is optional; GPS is not used.",
  "Pagos y transacciones Wompi": "Wompi payments and transactions",
  "Seguimiento de referencias, identificadores y confirmaciones recibidas por webhook.": "Track references, identifiers, and confirmations received by webhook.",
  "Valor": "Amount",
  "Referencia": "Reference",
  "ID transacción": "Transaction ID",
  "Confirmación": "Confirmation",
  "Precios de las evaluaciones": "Assessment pricing",
  "Actualmente hay una evaluación de pago. Modifica su precio; las evaluaciones futuras adicionales podrán tener tarifas independientes cuando se incorporen al catálogo. Los registros ya creados conservan su precio original.": "There is currently one paid assessment. Change its price; future assessments may have separate rates when added to the catalog. Existing records keep their original price.",
  "Evaluación integral (TDAH y concentración) · COP": "Comprehensive assessment (ADHD and focus) · COP",
  "Guardar precio": "Save price",
  "Crear código promocional": "Create promo code",
  "Define descuentos porcentuales o por valor fijo, vigencia, límite de usos y condiciones para nuevos clientes. Cada uso se reserva cuando el cliente aplica el código y genera el pago.": "Set percentage or fixed-value discounts, validity, usage limits, and conditions for new clients. Each use is reserved when a client applies the code and creates a payment.",
  "Código promocional": "Promo code",
  "Tipo de descuento": "Discount type",
  "Valor del descuento": "Discount amount",
  "Máximo de usos (0 = ilimitado)": "Maximum uses (0 = unlimited)",
  "Inicio (opcional)": "Start (optional)",
  "Vencimiento (opcional)": "Expiration (optional)",
  "Exclusivo para clientes que todavía no hayan pagado una evaluación.": "Only for clients who have not yet paid for an assessment.",
  "Promociones y códigos": "Promotions and codes",
  "Consulta los usos y activa o desactiva campañas.": "Review usage and activate or deactivate campaigns.",
  "Salud del sistema": "System health",
  "Colaboradores": "Team members",
  "Actividad": "Activity",
  "Algunas veces": "Sometimes",
  "A menudo": "Often",
  "Muy a menudo": "Very often",
  "Atención": "Attention",
  "Actividad e inquietud": "Activity and restlessness",
  "Impulsividad": "Impulsivity",
  "Contexto": "Context",
  "Factores adicionales": "Additional factors",
  "Informe de observación familiar": "Family observation report",
  "Observación familiar": "Family observation",
  "Una mirada a las conductas observadas.": "A closer look at the observed behaviors.",
  "Este informe organiza tus observaciones y ofrece orientaciones generales para acompañar al menor.": "This report organizes your observations and offers general guidance to support the child.",
  "Orientaciones para padres y cuidadores": "Guidance for parents and caregivers",
  "Esta evaluación recoge observaciones del familiar; no incluye pruebas de rendimiento cognitivo ni actividades para el menor.": "This assessment collects family observations; it does not include cognitive performance tests or activities for the child.",
  "Resumen orientativo": "Informational summary",
  "Porcentaje descriptivo de las respuestas de esta dimensión; no equivale a una probabilidad clínica.": "Descriptive percentage of responses in this dimension; it is not a clinical probability.",
  "Actividades interactivas:": "Interactive activities:",
  "retos de selección correctos. Memoria:": "correct selection tasks. Memory:",
  "búsqueda visual:": "visual search:",
  "Otros factores que pueden influir": "Other factors that may influence",
  "Historia y contextos": "History and settings",
  "Se observan comportamientos que conviene explorar con un profesional": "Behaviors are observed that may warrant professional exploration",
  "Observaciones para seguir registrando y contextualizando": "Observations to continue documenting and contextualizing",
  "Varias conductas fueron descritas como frecuentes o muy frecuentes y se señalaron aspectos de impacto o presencia en distintos entornos. Esto no confirma TDAH: una valoración profesional debe considerar el desarrollo, la historia, otros posibles factores y distintas fuentes de información.": "Several behaviors were described as frequent or very frequent, with reported impact or presence across settings. This does not confirm ADHD: a professional assessment should consider development, history, other possible factors, and multiple sources of information.",
  "Las respuestas ofrecen una descripción inicial, pero no permiten confirmar ni descartar TDAH. La frecuencia, la edad, las circunstancias y el impacto deben analizarse con más información y, cuando exista preocupación, con un profesional.": "The answers provide an initial description but cannot confirm or rule out ADHD. Frequency, age, circumstances, and impact should be considered with more information and, when there is concern, with a professional.",
  "Patrones que merecen exploración:": "Patterns worth exploring:",
  "Sin elevaciones marcadas en las áreas principales exploradas": "No marked elevations in the main areas explored",
  "atención y memoria cotidiana": "attention and everyday memory",
  "organización y gestión de tareas": "organization and task management",
  "inquietud e impulsividad": "restlessness and impulsivity",
  "regulación emocional": "emotional regulation",
  "Reduce las distracciones visibles": "Reduce visible distractions",
  "Apoya la memoria con señales externas": "Support memory with external cues",
  "Convierte las tareas en primeros pasos": "Break tasks into first steps",
  "Haz visible el tiempo": "Make time visible",
  "Programa movimiento y pausas": "Schedule movement and breaks",
  "Crea un intervalo para regular emociones": "Create a pause to regulate emotions",
  "Revisa los factores que cambian tu concentración": "Review factors that affect your concentration",
  "Considera una valoración profesional": "Consider a professional assessment",
  "Conserva lo que ya te funciona": "Keep what already works for you",
  "Registra ejemplos concretos": "Record concrete examples",
  "Contrasta la observación con el colegio": "Compare observations with the school",
  "Prueba apoyos cotidianos": "Try everyday supports",
  "Revisa otros factores que pueden influir": "Review other factors that may influence behavior",
  "Solicita una valoración profesional": "Request a professional assessment",
  "Consulta si la preocupación continúa": "Seek guidance if concerns continue",
  "Durante las próximas semanas anota qué ocurrió, cuándo, dónde, qué pasó antes y cómo afectó al menor. Evita etiquetas como perezoso, desobediente o problemático.": "Over the next few weeks, note what happened, when, where, what came before, and how it affected the child. Avoid labels such as lazy, disobedient, or problematic.",
  "Solicita al docente ejemplos específicos sobre atención, seguimiento de instrucciones, movimiento, turnos y finalización de tareas.": "Ask the teacher for specific examples of attention, following instructions, movement, turn-taking, and task completion.",
  "Da instrucciones breves de una en una, utiliza rutinas visuales, divide las tareas en pasos pequeños y reconoce el esfuerzo.": "Give brief instructions one at a time, use visual routines, break tasks into small steps, and acknowledge effort.",
  "El sueño, el estrés, los cambios familiares, la salud o las dificultades de aprendizaje pueden modificar la conducta y la atención. Coméntalos con un profesional sin asumir una causa única.": "Sleep, stress, family changes, health, or learning difficulties may affect behavior and attention. Discuss them with a professional without assuming a single cause.",
  "Las respuestas describen conductas frecuentes junto con señales de impacto o presencia en distintos contextos. Conviene comentarlo con pediatría o un profesional de salud mental infantil; lleva ejemplos y, si es posible, información del colegio.": "The answers describe frequent behaviors alongside signs of impact or presence across settings. Consider discussing this with a pediatrician or child mental health professional; bring examples and, if possible, information from school.",
  "Aunque este cuestionario no muestre un patrón destacado, si algo te preocupa o afecta al menor, puedes solicitar orientación profesional. Este resultado no descarta TDAH ni otras dificultades.": "Even if this questionnaire does not show a prominent pattern, seek professional guidance if something concerns you or affects the child. This result does not rule out ADHD or other difficulties.",
  "Se mencionan factores adicionales que también podrían influir y conviene explorar": "Additional factors that may also influence behavior are mentioned and are worth exploring",
  "No se señalaron con frecuencia factores adicionales en esta respuesta": "No additional factors were frequently reported in this response",
  "Se refiere impacto en actividades cotidianas": "Impact on everyday activities is reported",
  "No se señaló impacto frecuente en esta respuesta": "No frequent impact was reported in this response",
  "Se refiere una duración aproximada de seis meses o más": "A duration of approximately six months or more is reported",
  "La duración requiere mayor observación": "Duration requires further observation",
  "Se señalan antecedentes desde etapas anteriores del desarrollo": "History from earlier developmental stages is reported",
  "Conviene contrastar otros entornos": "Other settings should be compared",
  "Otro cuidador o docente también expresa preocupación": "Another caregiver or teacher also expresses concern",
  "Se observan varios entornos": "Several settings are observed",
  "Fecha no disponible": "Date unavailable",
  "Consultando tus evaluaciones...": "Checking your assessments...",
  "Pago confirmado. Preparando tu informe.": "Payment confirmed. Preparing your report.",
  "El pago aún no aparece confirmado.": "Payment has not yet been confirmed.",
  "Completa el pago para desbloquear tu informe.": "Complete payment to unlock your report.",
  "Guardando respuestas...": "Saving answers...",
  "No fue posible cargar las estadísticas:": "Could not load statistics:",
  "NeuroEval": "NeuroEval",
  "Pro": "Pro",
  "🌐 English": "🌐 English",
  "🛡️   Panel de administración": "🛡️   Admin dashboard",
  "👤   Perfil": "👤   Profile",
  "🧠   Pruebas": "🧠   Assessments",
  "↪   Cerrar sesión": "↪   Sign out",
  "15 preguntas": "15 questions",
  "Concentración y organización": "Focus and organization",
  "Estrés, fatiga y sobrecarga": "Stress, fatigue, and overload",
  "Español": "Spanish",
  "4 años": "4 years",
  "5 años": "5 years",
  "6 años": "6 years",
  "7 años": "7 years",
  "8 años": "8 years",
  "9 años": "9 years",
  "10 años": "10 years",
  "11 años": "11 years",
  "12 años": "12 years",
  "13 años": "13 years",
  "14 años": "14 years",
  "15 años": "15 years",
  "16 años": "16 years",
  "17 años": "17 years",
  "Pregunta 1 de 24": "Question 1 of 24",
  "¿Te cuesta mantener la atención?": "Do you find it difficult to maintain attention?",
  "COP": "COP",
  "Dimensiones exploradas": "Dimensions explored",
  "Contexto e impacto cotidiano": "Everyday context and impact",
  "$0 COP": "COP 0",
  "Cargando…": "Loading…",
  "Porcentaje (%)": "Percentage (%)",
  "Valor fijo (COP)": "Fixed amount (COP)",
  "Cargando promociones…": "Loading promotions…",
  "Centro de salud de NeuroEval Pro": "NeuroEval Pro system health center",
  "Conectividad y recursos del servidor. No muestra claves ni secretos.": "Server connectivity and resources. No keys or secrets are displayed.",
  "↻ Ejecutar diagnóstico": "↻ Run diagnostics",
  "Ejecuta el diagnóstico para consultar los servicios.": "Run diagnostics to check services.",
  "Respaldo manual de datos": "Manual data backup",
  "Exporta registros seleccionados de Firestore en JSON. Solo disponible para el administrador principal; no reemplaza los respaldos automáticos de Google Cloud.": "Export selected Firestore records as JSON. Available only to the primary administrator; it does not replace automatic Google Cloud backups.",
  "⬇️ Exportar respaldo": "⬇️ Export backup",
  "Incluye hasta 500 documentos por colección. Si el archivo indica que está incompleto, algunos registros superan ese límite.": "Includes up to 500 documents per collection. If the file indicates it is incomplete, some records exceed that limit.",
  "Perfil administrador": "Administrator profile",
  "Cuenta autenticada y permisos activos.": "Authenticated account and active permissions.",
  "Rol": "Role",
  "Administrador": "Administrator",
  "Ver perfil de cuenta": "View account profile",
  "Estado de servicios": "Service status",
  "Consulta el estado de los servicios conectados.": "Check the status of connected services.",
  "Esta vista muestra estados de conexión, nunca claves privadas ni secretos de integración.": "This view shows connection statuses, never private keys or integration secrets.",
  "Agregar administrador secundario": "Add secondary administrator",
  "La persona debe tener una cuenta creada en NeuroEval Pro con el correo que registres aquí. Tu cuenta principal conserva el control exclusivo de este módulo.": "The person must have a NeuroEval Pro account using the email entered here. Your primary account retains exclusive control of this module.",
  "Correo electrónico del colaborador": "Team member email",
  "Permisos que deseas conceder": "Permissions to grant",
  "Ver resumen general": "View general overview",
  "Consultar clientes": "View clients",
  "Consultar evaluaciones": "View assessments",
  "Ver respuestas y resultados privados": "View private answers and results",
  "Descargar informes PDF": "Download PDF reports",
  "Consultar pagos e ingresos": "View payments and revenue",
  "Consultar estado técnico": "View technical status",
  "Administrar precios y promociones": "Manage pricing and promotions",
  "Consultar historial administrativo": "View admin activity log",
  "Consultar solicitudes de soporte": "View support requests",
  "Responder y gestionar soporte": "Respond to and manage support",
  "Agregar colaborador": "Add team member",
  "Administradores secundarios": "Secondary administrators",
  "Modifica permisos, suspende o revoca accesos cuando quieras.": "Change permissions, suspend, or revoke access at any time.",
  "Cargando colaboradores…": "Loading team members…",
  "Solicitudes de clientes, conversación, prioridad y seguimiento.": "Customer requests, conversations, priority, and follow-up.",
  "Cargando solicitudes…": "Loading requests…",
  "Actividad administrativa": "Administrative activity",
  "Registro de altas, cambios y revocaciones de permisos.": "Log of permission grants, changes, and revocations.",
  "Cargando historial…": "Loading history…",
  "Detalle de evaluación": "Assessment details",
  "Cerrar ✕": "Close ✕",
  "NeuroEval Pro · Una herramienta de autorregistro orientativo.": "NeuroEval Pro · An informational self-report tool.",
  "4–7 años": "Ages 4–7",
  "8–12 años": "Ages 8–12",
  "13–17 años": "Ages 13–17",
  "casa": "home",
  "colegio": "school",
  "social": "social",
  "Explora la facilidad para mantener el foco, seguir conversaciones, recordar instrucciones y evitar distracciones.": "Explores the ability to maintain focus, follow conversations, remember instructions, and avoid distractions.",
  "Explora la planificación, el inicio y finalización de tareas, la gestión del tiempo y la capacidad de retomar actividades.": "Explores planning, starting and completing tasks, time management, and the ability to resume activities.",
  "Explora la necesidad de movimiento, la espera, la tendencia a interrumpir y la pausa antes de actuar.": "Explores the need for movement, waiting, interrupting, and pausing before acting.",
  "Explora la intensidad de las respuestas emocionales y la recuperación ante frustraciones o cambios.": "Explores the intensity of emotional responses and recovery after frustration or change.",
  "Explora factores contextuales que pueden influir en la concentración, como el sueño, la tensión y la sobrecarga.": "Explores contextual factors that may affect concentration, such as sleep, tension, and overload.",
  "Explora si las experiencias descritas generan dificultades funcionales y si son observadas por otras personas.": "Explores whether the described experiences cause functional difficulties and are noticed by other people.",
  "Explora si las experiencias parecen remontarse a la infancia y si ocurren en más de un contexto.": "Explores whether the experiences may date back to childhood and occur in more than one setting.",
  "Frecuencia descriptiva de las conductas observadas por el familiar; no equivale a una probabilidad clínica.": "Descriptive frequency of behaviors observed by the family member; it is not a clinical probability.",
  "Señala circunstancias que también podrían influir en la conducta; no son síntomas de TDAH ni aumentan una puntuación de síntomas.": "Indicates circumstances that may also affect behavior; they are not ADHD symptoms and do not increase a symptom score.",
  "LUNA   ·   LLAVE   ·   RÍO": "MOON   ·   KEY   ·   RIVER",
  "Selecciona las cuatro palabras que aparecieron juntas.": "Select the four words that appeared together.",
  "Firebase no proporcionó detalles adicionales.": "Firebase did not provide additional details.",
  "Ese correo ya tiene una cuenta.": "An account already exists with this email.",
  "El correo electrónico no es válido.": "The email address is invalid.",
  "La contraseña debe tener al menos 8 caracteres.": "The password must contain at least 8 characters.",
  "Correo o contraseña incorrectos.": "Incorrect email or password.",
  "No encontramos una cuenta con ese correo.": "We could not find an account with that email.",
  "La contraseña es incorrecta.": "The password is incorrect.",
  "No se pudo conectar. Verifica tu internet.": "Could not connect. Check your internet connection.",
  "No se pudo completar la operación.": "The operation could not be completed.",
  "Creando tu cuenta...": "Creating your account...",
  "Esta sección requiere permisos administrativos.": "This section requires administrative permissions.",
  "¿Comete errores por descuido en tareas, deberes o actividades que sabe realizar?": "Does the child make careless mistakes in tasks, homework, or activities they know how to do?",
  "Por ejemplo, omite partes de una instrucción o no revisa lo que hizo.": "For example, they miss parts of an instruction or do not review their work.",
  "¿Le cuesta mantener la atención durante juegos, lecturas, conversaciones o tareas apropiadas para su edad?": "Does the child find it difficult to maintain attention during age-appropriate games, reading, conversations, or tasks?",
  "Piensa en actividades que normalmente disfruta y que requieren continuidad.": "Think about activities the child usually enjoys and that require sustained attention.",
  "¿Parece no escuchar cuando un adulto le habla directamente, aunque no haya una distracción evidente?": "Does the child seem not to listen when an adult speaks directly to them, even when there is no obvious distraction?",
  "Por ejemplo, hay que repetirle varias veces una indicación sencilla.": "For example, a simple instruction may need to be repeated several times.",
  "¿Empieza instrucciones o tareas, pero deja pasos sin completar aunque haya entendido qué debe hacer?": "Does the child start instructions or tasks but leave steps unfinished even when they understand what to do?",
  "Considera rutinas, deberes y pequeñas responsabilidades.": "Consider routines, homework, and small responsibilities.",
  "¿Tiene dificultad para organizar sus tareas, materiales o actividades diarias?": "Does the child have difficulty organizing tasks, materials, or daily activities?",
  "Por ejemplo, no sabe por dónde empezar o pierde el orden de los pasos.": "For example, they do not know where to start or lose track of the steps.",
  "¿Evita o demora actividades que requieren concentración sostenida?": "Does the child avoid or delay activities that require sustained concentration?",
  "Por ejemplo, deberes, lectura o tareas que exigen esfuerzo mental continuo.": "For example, homework, reading, or tasks requiring continuous mental effort.",
  "¿Pierde con frecuencia objetos necesarios para sus actividades?": "Does the child frequently lose items needed for activities?",
  "Por ejemplo, útiles escolares, juguetes, libros, prendas o materiales.": "For example, school supplies, toys, books, clothing, or materials.",
  "¿Se distrae fácilmente con ruidos, movimientos, conversaciones u otros estímulos del entorno?": "Is the child easily distracted by noises, movement, conversations, or other environmental stimuli?",
  "Observa si le cuesta retomar lo que estaba haciendo.": "Notice whether the child finds it difficult to return to what they were doing.",
  "¿Olvida con frecuencia actividades o responsabilidades habituales para su edad?": "Does the child frequently forget activities or responsibilities that are usual for their age?",
  "Por ejemplo, llevar materiales, terminar una rutina o recordar una indicación.": "For example, bringing materials, finishing a routine, or remembering an instruction.",
  "¿Mueve constantemente manos o pies, se retuerce en la silla o cambia de postura cuando se espera que permanezca sentado?": "Does the child constantly move their hands or feet, squirm in their chair, or change position when expected to remain seated?",
  "Ten en cuenta lo esperable para su edad y la situación.": "Consider what is typical for the child's age and the situation.",
  "¿Se levanta de su asiento en momentos en los que normalmente se espera que permanezca sentado?": "Does the child get up from their seat when they are usually expected to remain seated?",
  "Por ejemplo, durante comidas, clase o actividades tranquilas.": "For example, during meals, class, or quiet activities.",
  "¿Corre, trepa o se mueve en situaciones en las que no resulta apropiado?": "Does the child run, climb, or move around in situations where it is not appropriate?",
  "En adolescentes, puede manifestarse como inquietud interna o dificultad para estar quieto.": "In adolescents, this may appear as inner restlessness or difficulty staying still.",
  "¿Le cuesta jugar o realizar actividades tranquilas sin hacer mucho ruido o movimiento?": "Does the child find it difficult to play or do quiet activities without making a lot of noise or moving around?",
  "Compara con otros niños de edad y contexto similares.": "Compare with other children of a similar age and context.",
  "¿Parece estar constantemente en movimiento, como si le costara bajar el ritmo?": "Does the child seem to be constantly on the move, as if it were difficult to slow down?",
  "Observa si ocurre incluso cuando la actividad requiere calma.": "Notice whether this happens even when the activity requires calm.",
  "¿Habla mucho más de lo esperado para la situación y le cuesta detenerse?": "Does the child talk much more than expected for the situation and find it difficult to stop?",
  "Considera conversaciones, clase y reuniones familiares.": "Consider conversations, class, and family gatherings.",
  "¿Responde antes de que terminen de hacerle una pregunta o interrumpe para contestar?": "Does the child answer before a question is finished or interrupt to respond?",
  "Observa si puede esperar a escuchar la pregunta completa.": "Notice whether the child can wait to hear the whole question.",
  "¿Le cuesta esperar su turno en juegos, filas o conversaciones?": "Does the child find it difficult to wait their turn in games, lines, or conversations?",
  "Piensa en situaciones cotidianas repetidas.": "Think about recurring everyday situations.",
  "¿Interrumpe conversaciones, juegos o actividades de otras personas sin advertirlo?": "Does the child interrupt other people's conversations, games, or activities without noticing?",
  "Por ejemplo, se incorpora a una actividad o toma la palabra de forma repentina.": "For example, they join an activity or suddenly start speaking.",
  "¿Las conductas que has señalado se presentan desde hace aproximadamente seis meses o más?": "Have the behaviors you identified been present for approximately six months or longer?",
  "Si comenzaron hace poco, anota cuándo aparecieron.": "If they began recently, note when they appeared.",
  "¿Recuerdas que algunas de estas conductas ya estaban presentes en etapas anteriores de su desarrollo?": "Do you remember some of these behaviors being present at earlier stages of the child's development?",
  "Piensa en informes escolares, recuerdos familiares o comentarios de docentes.": "Think about school reports, family memories, or teachers' comments.",
  "¿Has observado estas conductas en al menos dos entornos, como casa y colegio?": "Have you observed these behaviors in at least two settings, such as home and school?",
  "También pueden ser actividades extracurriculares u otros espacios.": "These may also include extracurricular activities or other settings.",
  "¿Estas conductas afectan de forma clara su aprendizaje, convivencia, amistades o rutinas?": "Do these behaviors clearly affect the child's learning, relationships, friendships, or routines?",
  "Describe consecuencias concretas, no solo que el comportamiento resulte molesto.": "Describe concrete consequences, not only that the behavior is bothersome.",
  "¿Un docente u otro cuidador ha expresado preocupaciones similares?": "Has a teacher or another caregiver expressed similar concerns?",
  "Si es posible, contrasta lo observado con alguien que lo conozca en otro entorno.": "If possible, compare your observations with someone who knows the child in another setting.",
  "¿Hay factores recientes que podrían influir, como cambios familiares, sueño insuficiente, estrés, dificultades de aprendizaje o problemas de salud?": "Are there recent factors that could have an influence, such as family changes, insufficient sleep, stress, learning difficulties, or health problems?",
  "No atribuyas automáticamente estas conductas al TDAH.": "Do not automatically attribute these behaviors to ADHD.",
  "Esta orientación está diseñada para edades de 4 a 17 años.": "This guidance is designed for ages 4–17.",
  "Indica tu parentesco y al menos un entorno de observación.": "Enter your relationship to the child and at least one observation setting.",
  "Confirma que tienes autorización para proporcionar esta información.": "Confirm that you are authorized to provide this information.",
  "Considera responsabilidades, actividades académicas y relaciones propias de la adolescencia.": "Consider responsibilities, academic activities, and relationships typical of adolescence.",
  "Observación familiar · 24 preguntas": "Family observation · 24 questions",
  "Inicia sesión para comenzar una evaluación.": "Sign in to begin an assessment.",
  "Consultando el estado de tu evaluación...": "Checking your assessment status...",
  "No se encontró una evaluación pendiente.": "No pending assessment was found.",
  "¡Pago confirmado! Cargando informe.": "Payment confirmed! Loading report.",
  "Aún no recibimos la confirmación del pago. Si acabas de pagar, espera unos segundos.": "We have not received payment confirmation yet. If you just paid, please wait a few seconds.",
  "Esta acción está reservada al administrador principal.": "This action is reserved for the primary administrator.",
  "Preparando exportación segura…": "Preparing secure export…",
  "No se pudo consultar el diagnóstico.": "Could not retrieve diagnostics.",
  "Diagnóstico completado. No se detectaron errores en las comprobaciones ejecutadas.": "Diagnostics completed. No errors were detected in the checks performed.",
  "Calculando estadísticas agregadas…": "Calculating aggregate statistics…",
  "No se pudo consultar la analítica internacional.": "Could not retrieve international analytics.",
  "Todavía no hay grupos con suficientes usuarios para mostrarlos.": "There are not yet enough users in any group to display them.",
  "Usuarios agrupados por país": "Users grouped by country",
  "Aún no hay grupos de países que puedan ubicarse": "There are no mappable country groups yet.",
  " años": " years",
  "⚙️   Configuración": "⚙️   Settings",
  "Información sobre privacidad y uso de datos": "Privacy and data use information",
  "NeuroEval Pro es una herramienta de autorregistro orientativo para personas adultas. No diagnostica ni sustituye la valoración de profesionales.": "NeuroEval Pro is an informational self-report tool for adults. It does not diagnose or replace professional assessment.",
  "Se procesan datos de cuenta, edad adulta, idioma, respuestas y resultados para prestar el servicio, generar informes, gestionar pagos y proteger la plataforma.": "Account details, adult age, language, answers, and results are processed to provide the service, generate reports, manage payments, and protect the platform.",
  "País y ciudad son opcionales. No se solicita GPS. Los datos geográficos y demográficos se muestran al equipo autorizado únicamente de forma agregada y con un mínimo de 10 personas por grupo.": "Country and city are optional. GPS is not requested. Geographic and demographic data are shown to authorized staff only in aggregate, with at least 10 people per group.",
  "La observación de menores debe realizarla un adulto autorizado. No escribas nombres, colegios ni otros datos que identifiquen al menor; el sistema conserva una franja de edad, no su edad exacta.": "Observation of minors must be completed by an authorized adult. Do not enter names, schools, or other identifying details; the system stores an age band, not the child's exact age.",
  "Puedes solicitar acceso, rectificación o revisión de eliminación desde los canales de privacidad. Algunos registros pueden conservarse cuando existan obligaciones legales, contables o relacionadas con pagos. Consulta la política de privacidad completa antes del lanzamiento internacional.": "You may request access, correction, or review of deletion through the privacy channels. Some records may be retained where legal, accounting, or payment obligations apply. Consult the full privacy policy before the international launch.",
  "Versión del aviso: 2026-11-11.": "Notice version: 2026-11-11.",
  "Tus datos y privacidad": "Your data and privacy",
  "Puedes descargar una copia de los datos asociados a tu cuenta o registrar una solicitud de acceso, rectificación o revisión de eliminación.": "You can download a copy of the data associated with your account or submit a request for access, correction, or deletion review.",
  "Descargar mis datos": "Download my data",
  "Acceso a mis datos": "Access my data",
  "Rectificar mis datos": "Correct my data",
  "Solicitar revisión de eliminación": "Request deletion review",
  "La solicitud queda registrada para revisión; no elimina datos automáticamente. Algunos registros pueden estar sujetos a obligaciones legales o de pago.": "The request is recorded for review; it does not automatically delete data. Some records may be subject to legal or payment obligations.",
  "Solicitudes de privacidad": "Privacy requests",
  "Bandeja restringida al administrador principal. Revisar no implica borrar automáticamente datos.": "Inbox restricted to the primary administrator. Reviewing a request does not automatically delete data.",
  "Leer el aviso completo (ES)": "Read the full notice (Spanish)",
  "Read full notice (EN)": "Read full notice (English)",
  "Aviso completo (ES)": "Full notice (Spanish)",
  "Full notice (EN)": "Full notice (English)"
};
const REPORT_TRANSLATION_ENTRIES = Object.entries(REPORT_TRANSLATIONS).sort((a,b)=>b[0].length-a[0].length);
function translateReportText(value, language = "es") {
  const source = String(value ?? "");
  if (language !== "en" || !source) return source;
  if (REPORT_TRANSLATIONS[source]) return REPORT_TRANSLATIONS[source];
  let translated = source;
  REPORT_TRANSLATION_ENTRIES.forEach(([es,en]) => {
    if (es.length >= 5 && translated.includes(es)) translated = translated.split(es).join(en);
  });
  return translated;
}
function buildEvaluationPdf(evaluation, options = {}) {
  const language = options.language === "en" ? "en" : "es";
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 55,
          bottom: 55,
          left: 55,
          right: 55
        },
        info: {
          Title: language === "en" ? "NeuroEval Pro Report" : "Informe NeuroEval Pro",
          Author: "NeuroEval Pro",
          Subject: language === "en" ? "Cognitive self-report" : "Informe de autorregistro cognitivo"
        }
      });

      const originalText = doc.text.bind(doc);
      doc.text = (value, ...args) => originalText(
        typeof value === "string" ? translateReportText(value, language) : value,
        ...args
      );
      const chunks = [];

      const drawFooter = () => {
        const previousX = doc.x;
        const previousY = doc.y;
        const page = doc.page;

        // Mantener el pie dentro del área de contenido evita que PDFKit
        // intente crear una página nueva desde el propio evento pageAdded.
        // No modificar page.maxY: en PDFKit es un método, no una propiedad.
        doc.save();
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#9AA1B4")
          .text(
            "NeuroEval Pro · Documento generado electrónicamente",
            55,
            page.height - 70,
            {
              align: "center",
              width: page.width - 110,
              lineBreak: false
            }
          );
        doc.restore();

        // El pie no debe alterar el cursor del contenido del informe.
        doc.x = previousX;
        doc.y = previousY;
      };

      const ensureSpace = (requiredHeight = 36) => {
        const bottomLimit = doc.page.height - doc.page.margins.bottom;
        if (doc.y + requiredHeight > bottomLimit) {
          doc.addPage();
        }
      };

      doc.on("pageAdded", drawFooter);
      drawFooter();

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const navy = "#171B3B";
      const purple = "#966BFF";
      const cyan = "#36CFC7";
      const muted = "#66708B";

      doc.rect(0, 0, doc.page.width, 150).fill(navy);

      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("NeuroEval Pro", 55, 48);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#D8D9F3")
        .text(evaluation.evaluationType === "parent_observation" ? "INFORME DE OBSERVACIÓN FAMILIAR" : "INFORME DE AUTORREGISTRO COGNITIVO", 55, 82);

      doc
        .fillColor("#FFFFFF")
        .fontSize(9)
        .text("Documento de carácter orientativo", 55, 105);

      doc.moveDown(5);

      doc
        .fillColor(navy)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text("Información general", 55, 180);

      doc.moveDown(0.7);

      const details = [
        ["Nombre", evaluation.name || "No registrado"],
        ["Correo", evaluation.email || "No registrado"],
        ...(evaluation.evaluationType === "parent_observation"
          ? [["Franja de edad del menor", evaluation.parentContext?.childAgeBand || evaluation.parentContext?.ageBand || "No especificada"], ["Parentesco de quien responde", evaluation.parentContext?.relationship || "No especificado"], ["Entornos observados", (evaluation.parentContext?.settings || []).join(", ") || "No especificados"]]
          : [["Edad", evaluation.age ?? "No registrada"]]),
        ["Objetivo", evaluation.goal || "No especificado"],
        [
          "Fecha",
          asDate(evaluation.createdAt)?.toLocaleString(language === "en" ? "en-US" : "es-CO") ||
            "No disponible"
        ]
      ];

      details.forEach(([label, value]) => {
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(muted)
          .text(`${label}:`, 55, doc.y, { continued: true });

        doc
          .font("Helvetica")
          .fillColor(navy)
          .text(` ${value}`);
      });

      doc.moveDown(1.4);

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(navy)
        .text("Resumen del autorregistro");

      doc.moveDown(0.5);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(purple)
        .text(evaluation.profile || "Resultado orientativo");

      doc.moveDown(0.4);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(muted)
        .text(
          evaluation.profileDescription || "Sin descripción disponible.",
          {
            width: 485,
            lineGap: 4
          }
        );

      doc.moveDown(1.2);

      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(navy)
        .text("Dimensiones exploradas");

      doc.moveDown(0.7);

      const scores = evaluation.scores || {};

      const dimensionLabels = {
        inattention: evaluation.evaluationType === "parent_observation" ? "Atención y seguimiento de tareas" : "Atención sostenida y memoria cotidiana",
        executive: "Organización y funciones ejecutivas",
        hyperactivity: evaluation.evaluationType === "parent_observation" ? "Actividad motora e inquietud" : "Inquietud e impulsividad",
        impulsivity: "Impulsividad y espera de turnos",
        emotionalContext: "Regulación emocional",
        context: evaluation.evaluationType === "parent_observation" ? "Duración, entornos y observación externa" : "Estrés, preocupación y descanso",
        contextFactors: "Otros factores que conviene considerar",
        impact: "Impacto en la vida cotidiana",
        history: "Historia y presencia en distintos entornos"
      };
      const dimensions = Object.entries(dimensionLabels)
        .filter(([key]) => typeof scores[key] === "number")
        .map(([key, label]) => [label, scores[key], evaluation.dimensions?.[key]?.explanation || "Porcentaje descriptivo de las respuestas de esta dimensión."]);

      dimensions.forEach(([label, value, explanation]) => {
        ensureSpace(76);
        const score = Math.max(0, Math.min(100, Number(value || 0)));
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(navy)
          .text(`${label}: ${score}%`);
        const x = 55;
        const y = doc.y + 4;
        const width = 480;
        doc.roundedRect(x, y, width, 7, 3).fill("#E8EAF4");
        doc.roundedRect(x, y, width * score / 100, 7, 3).fill(purple);
        doc.moveDown(1.1);
        doc.font("Helvetica").fontSize(8).fillColor(muted)
          .text(explanation, { width: 480, lineGap: 2 });
        doc.moveDown(0.7);
      });

      // Gráfica radar comparativa, construida con los valores reales del autorregistro.
      if (dimensions.length >= 3) {
        ensureSpace(190);
        doc.font("Helvetica-Bold").fontSize(13).fillColor(navy)
          .text("Mapa comparativo de dimensiones");
        doc.moveDown(0.35);
        const chartTop = doc.y + 4;
        const cx = doc.page.width / 2;
        const cy = chartTop + 78;
        const radius = 66;
        const radarPoints = (index, value) => {
          const angle = -Math.PI / 2 + index * Math.PI * 2 / dimensions.length;
          const scale = Math.max(0, Math.min(100, Number(value) || 0)) / 100;
          return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
        };
        doc.save();
        [25, 50, 75, 100].forEach(level => {
          const points = dimensions.map((item, index) => radarPoints(index, level));
          doc.moveTo(points[0][0], points[0][1]);
          points.slice(1).forEach(point => doc.lineTo(point[0], point[1]));
          doc.closePath().lineWidth(0.6).strokeColor("#D9DDF0").stroke();
        });
        dimensions.forEach((item, index) => {
          const endpoint = radarPoints(index, 100);
          doc.moveTo(cx, cy).lineTo(endpoint[0], endpoint[1])
            .lineWidth(0.6).strokeColor("#D9DDF0").stroke();
        });
        const values = dimensions.map((item, index) => radarPoints(index, item[1]));
        doc.moveTo(values[0][0], values[0][1]);
        values.slice(1).forEach(point => doc.lineTo(point[0], point[1]));
        doc.closePath().fillColor(purple).fillOpacity(0.22).fill();
        doc.moveTo(values[0][0], values[0][1]);
        values.slice(1).forEach(point => doc.lineTo(point[0], point[1]));
        doc.closePath().lineWidth(2).strokeColor(purple).stroke();
        values.forEach(point => doc.circle(point[0], point[1], 3.2).fillColor(cyan).fill());
        doc.restore();
        doc.y = chartTop + 158;
        doc.font("Helvetica").fontSize(7.5).fillColor(muted)
          .text(dimensions.map(([label, value]) => `• ${label}: ${Math.max(0, Math.min(100, Number(value) || 0))}%`).join("   "), {
            width: 480, align: "center", lineGap: 2
          });
        doc.moveDown(0.7);
      }


      if (evaluation.attentionTasks) {
        ensureSpace(55);
        doc.font("Helvetica-Bold").fontSize(12).fillColor(navy)
          .text("Actividades interactivas de atención y memoria");
        doc.moveDown(0.35);
        doc.font("Helvetica").fontSize(9).fillColor(muted)
          .text(`Retos de selección correctos: ${evaluation.attentionTasks.correct} de ${evaluation.attentionTasks.completed}. Recuerdo de memoria: ${evaluation.attentionTasks.memoryCorrect} de ${evaluation.attentionTasks.memoryCompleted}. Búsqueda visual: ${evaluation.attentionTasks.visualCorrect} de ${evaluation.attentionTasks.visualCompleted}.`, { width: 480, lineGap: 3 });
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(8).fillColor(muted)
          .text(evaluation.attentionTasks.note || "Actividad interactiva no diagnóstica.", { width: 480, lineGap: 3 });
        doc.moveDown(0.7);
      }

      if (evaluation.summary) {
        ensureSpace(70);
        doc.font("Helvetica-Bold").fontSize(13).fillColor(navy)
          .text("Contexto e impacto cotidiano");
        doc.moveDown(0.4);
        const summaryLabels = [
          [evaluation.evaluationType === "parent_observation" ? "Otros factores que pueden influir" : "Estrés y descanso", evaluation.summary.contextInfluence],
          ["Impacto cotidiano", evaluation.summary.dailyImpact],
          ["Historia y contextos", evaluation.summary.childhoodAndSettings]
        ];
        summaryLabels.forEach(([label, value]) => {
          if (!value) return;
          ensureSpace(24);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(navy)
            .text(`${label}: `, { continued: true });
          doc.font("Helvetica").fontSize(9).fillColor(muted).text(Array.isArray(value) ? value.join(" · ") : String(value));
        });
        doc.moveDown(0.8);
      }

      doc.moveDown(0.5);

      ensureSpace(48);
      doc
        .font("Helvetica-Bold")
        .fontSize(15)
        .fillColor(navy)
        .text("Orientaciones generales");

      doc.moveDown(0.5);

      const recommendations = Array.isArray(
        evaluation.recommendations
      )
        ? evaluation.recommendations
        : [];

      recommendations.forEach((item, index) => {
        ensureSpace(48);
        const title = typeof item === "string" ? `${index + 1}. Orientación` : `${index + 1}. ${item.title || "Orientación"}`;
        const detail = typeof item === "string" ? item : (item.detail || "");
        doc.font("Helvetica-Bold").fontSize(9).fillColor(navy)
          .text(title, { width: 480 });
        doc.font("Helvetica").fontSize(9).fillColor(muted)
          .text(detail, { width: 480, lineGap: 3 });
        doc.moveDown(0.5);
      });

      ensureSpace(80);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(navy)
        .text("Alcance y límites del informe");
      doc.moveDown(0.35);
      doc.font("Helvetica").fontSize(8).fillColor(muted)
        .text(evaluation.disclaimer || "Este autorregistro es orientativo y no constituye una prueba diagnóstica. Los porcentajes describen las respuestas y no representan la probabilidad de tener un trastorno.", { width: 480, lineGap: 3 });
      doc.moveDown(0.8);

      if (options.includeAnswers) {
        doc.addPage();

        doc
          .font("Helvetica-Bold")
          .fontSize(17)
          .fillColor(navy)
          .text("Detalle de respuestas");

        doc.moveDown();

        (evaluation.answers || []).forEach((answer, index) => {
          ensureSpace(76);

          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(purple)
            .text(
              `Pregunta ${index + 1} · ${answer.category || "General"}`
            );

          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(navy)
            .text(answer.question || "");

          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor(muted)
            .text(`Respuesta: ${answer.answer || "Sin respuesta"}`);

          doc.moveDown(0.8);
        });
      }

      doc.moveDown(1);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(navy)
        .text("Aviso importante");

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(muted)
        .text(
          "Este documento presenta un autorregistro orientativo y no constituye una evaluación clínica, diagnóstico, tratamiento ni concepto médico. Los porcentajes describen las respuestas de este cuestionario y no representan probabilidades diagnósticas. No sustituye la valoración de un profesional cualificado.",
          { width: 485, lineGap: 3 }
        );

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}
/* =========================================================
   16. DESCARGA DEL INFORME PDF PERSONAL
========================================================= */

app.get(
  "/api/my-evaluations/:id/pdf",
  requireUser,
  async (req, res) => {
    try {
      const result = await getOwnedEvaluation(
        req.user.uid,
        req.params.id
      );

      if (!result) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      if (result.data.paymentStatus !== "paid") {
        return sendError(
          res,
          402,
          "El informe estará disponible cuando se confirme el pago."
        );
      }

      const profileSnapshot = await db.collection("users").doc(req.user.uid).get();
      const requestedLanguage = String(req.query.language || "").trim().toLowerCase();
      const profileLanguage = profileSnapshot.exists && profileSnapshot.data()?.language === "en" ? "en" : "es";
      const reportLanguage = ["es", "en"].includes(requestedLanguage) ? requestedLanguage : profileLanguage;
      const pdf = await buildEvaluationPdf(result.data, { language: reportLanguage });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="NeuroEval-Pro-informe.pdf"'
      );
      res.setHeader("Cache-Control", "private, no-store");

      return res.send(pdf);

    } catch (error) {
      console.error("PDF personal:", error);
      return sendError(res, 500, "No se pudo generar tu informe PDF.");
    }
  }
);

/* =========================================================
   17. PANEL ADMINISTRATIVO
========================================================= */

/* =========================================================
   GESTIÓN DE ADMINISTRADORES SECUNDARIOS (SOLO PRINCIPAL)
========================================================= */

app.get("/api/admin/administrators", requireUser, requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection("adminRoles").orderBy("updatedAt", "desc").limit(200).get();
    const administrators = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        uid: doc.id,
        email: data.email || "",
        displayName: data.displayName || "",
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        status: data.status || "inactive",
        createdAt: asDate(data.createdAt)?.toISOString() || null,
        updatedAt: asDate(data.updatedAt)?.toISOString() || null
      };
    });
    return res.json({ administrators, permissionCatalog: ADMIN_PERMISSION_CATALOG });
  } catch (error) {
    console.error("Listar administradores secundarios:", error);
    return sendError(res, 500, "No se pudieron consultar los colaboradores.");
  }
});

app.post("/api/admin/administrators", requireUser, requireAdmin, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const permissions = normalizeAdminPermissions(req.body.permissions);
    if (!isValidEmail(email)) return sendError(res, 400, "Escribe un correo válido.");
    if (!permissions.length) return sendError(res, 400, "Selecciona al menos un permiso.");
    if (email === ADMIN_EMAIL) return sendError(res, 400, "La cuenta principal no puede registrarse como colaborador.");
    let account;
    try {
      account = await firebaseAuth.getUserByEmail(email);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        return sendError(res, 404, "La persona debe crear primero su cuenta en NeuroEval Pro con ese correo.");
      }
      throw error;
    }
    if (account.disabled) return sendError(res, 400, "La cuenta está deshabilitada.");
    if (account.emailVerified !== true) return sendError(res, 400, "El correo de esa cuenta debe estar verificado antes de conceder permisos.");
    await db.collection("adminRoles").doc(account.uid).set({
      uid: account.uid,
      email,
      displayName: account.displayName || "",
      permissions,
      status: "active",
      grantedBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await writeAdminAudit(req.user.uid, "administrator.created_or_reactivated", account.uid, { email, permissions });
    return res.status(201).json({ ok: true, uid: account.uid, email, permissions, status: "active" });
  } catch (error) {
    console.error("Crear administrador secundario:", error);
    return sendError(res, 500, "No se pudo agregar el colaborador.");
  }
});

app.patch("/api/admin/administrators/:uid", requireUser, requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid || uid === req.user.uid) return sendError(res, 400, "No puedes modificar tu propia cuenta principal.");
    const ref = db.collection("adminRoles").doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) return sendError(res, 404, "No encontramos ese colaborador.");
    const current = snapshot.data() || {};
    if (String(current.email || "").toLowerCase() === ADMIN_EMAIL) {
      return sendError(res, 403, "La cuenta principal está protegida.");
    }
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    if (Array.isArray(req.body.permissions)) {
      updates.permissions = normalizeAdminPermissions(req.body.permissions);
      if (!updates.permissions.length) return sendError(res, 400, "Selecciona al menos un permiso o desactiva al colaborador.");
    }
    if (typeof req.body.active === "boolean") updates.status = req.body.active ? "active" : "inactive";
    await ref.set(updates, { merge: true });
    await writeAdminAudit(req.user.uid, "administrator.updated", uid, {
      permissions: updates.permissions || current.permissions || [],
      status: updates.status || current.status || "active"
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Actualizar administrador secundario:", error);
    return sendError(res, 500, "No se pudo actualizar el colaborador.");
  }
});

app.delete("/api/admin/administrators/:uid", requireUser, requireAdmin, async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid || uid === req.user.uid) return sendError(res, 400, "No puedes eliminar tu cuenta principal.");
    const ref = db.collection("adminRoles").doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) return sendError(res, 404, "No encontramos ese colaborador.");
    const data = snapshot.data() || {};
    if (String(data.email || "").toLowerCase() === ADMIN_EMAIL) {
      return sendError(res, 403, "La cuenta principal está protegida.");
    }
    await ref.delete();
    await writeAdminAudit(req.user.uid, "administrator.revoked", uid, { email: data.email || "" });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Revocar administrador secundario:", error);
    return sendError(res, 500, "No se pudo revocar el acceso del colaborador.");
  }
});

app.get("/api/admin/audit", requireUser, requireStaffAdmin("audit.view"), async (req, res) => {
  try {
    const snapshot = await db.collection("adminAuditLogs").orderBy("createdAt", "desc").limit(200).get();
    const logs = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        actorUid: data.actorUid || "",
        action: data.action || "",
        targetUid: data.targetUid || "",
        details: data.details || {},
        createdAt: asDate(data.createdAt)?.toISOString() || null
      };
    });
    return res.json({ logs });
  } catch (error) {
    console.error("Consultar auditoría administrativa:", error);
    return sendError(res, 500, "No se pudo consultar el historial administrativo.");
  }
});

/* =========================================================
   PRECIOS Y PROMOCIONES
========================================================= */
app.get("/api/admin/pricing", requireUser, requireStaffAdmin("pricing.manage"), async (req, res) => {
  try {
    const pricing = await getPricingConfig();
    const snapshot = await db.collection("promoCodes").orderBy("createdAt", "desc").limit(200).get();
    const promos = snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return { code: doc.id, discountType: data.discountType, discountValue: data.discountValue, maxUses: data.maxUses || 0, uses: data.uses || 0, startsAt: data.startsAt || null, expiresAt: data.expiresAt || null, newCustomersOnly: data.newCustomersOnly === true, active: data.active === true, createdAt: asDate(data.createdAt)?.toISOString() || null };
    });
    return res.json({ pricing, promos });
  } catch (error) {
    console.error("Consultar precios y promociones:", error);
    return sendError(res, 500, "No se pudo consultar la configuración comercial.");
  }
});

app.put("/api/admin/pricing", requireUser, requireStaffAdmin("pricing.manage"), async (req, res) => {
  try {
    const requestedPrice = Number(req.body.priceCop);
    if (requestedPrice !== DEFAULT_EVAL_PRICE_COP) {
      return sendError(res, 409, "El precio de NeuroEval Pro está fijado en $4.000 COP por evaluación.");
    }
    return res.json({
      ok: true,
      fixed: true,
      pricing: await getPricingConfig()
    });
  } catch (error) {
    console.error("Actualizar precio:", error);
    return sendError(res, 500, "No se pudo actualizar el precio.");
  }
});

app.post("/api/admin/promo-codes", requireUser, requireStaffAdmin("pricing.manage"), async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    const discountType = req.body.discountType === "fixed" ? "fixed" : "percentage";
    const discountValue = Number(req.body.discountValue);
    const maxUses = Number(req.body.maxUses || 0);
    const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) return sendError(res, 400, "El código debe tener entre 3 y 40 caracteres alfanuméricos.");
    if (!Number.isSafeInteger(discountValue) || discountValue < 1 || (discountType === "percentage" && discountValue > 99) || (discountType === "fixed" && discountValue > 100000000)) return sendError(res, 400, "El descuento no es válido.");
    if (!Number.isSafeInteger(maxUses) || maxUses < 0 || maxUses > 1000000) return sendError(res, 400, "El límite de usos no es válido.");
    if (startsAt && Number.isNaN(startsAt.getTime())) return sendError(res, 400, "La fecha de inicio no es válida.");
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return sendError(res, 400, "La fecha de vencimiento no es válida.");
    if (startsAt && expiresAt && expiresAt <= startsAt) return sendError(res, 400, "El vencimiento debe ser posterior al inicio.");
    const promoRef = db.collection("promoCodes").doc(code);
    const existing = await promoRef.get();
    if (existing.exists) return sendError(res, 409, "Ese código ya existe. Elige otro.");
    const promo = {
      discountType, discountValue, maxUses, uses: 0,
      startsAt: startsAt ? startsAt.toISOString() : null,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      newCustomersOnly: req.body.newCustomersOnly === true,
      serviceIds: [EVALUATION_SERVICE_ID],
      active: true, createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp()
    };
    await promoRef.create(promo);
    await writeAdminAudit(req.user.uid, "promo.created", null, { code, discountType, discountValue, maxUses });
    return res.status(201).json({ ok: true, code });
  } catch (error) {
    console.error("Crear código promocional:", error);
    return sendError(res, 500, "No se pudo crear el código promocional.");
  }
});

app.patch("/api/admin/promo-codes/:code", requireUser, requireStaffAdmin("pricing.manage"), async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const active = req.body.active === true;
    const ref = db.collection("promoCodes").doc(code);
    const snapshot = await ref.get();
    if (!snapshot.exists) return sendError(res, 404, "No encontramos ese código.");
    await ref.set({ active, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await writeAdminAudit(req.user.uid, active ? "promo.activated" : "promo.disabled", null, { code });
    return res.json({ ok: true, code, active });
  } catch (error) {
    console.error("Actualizar código promocional:", error);
    return sendError(res, 500, "No se pudo actualizar el código.");
  }
});

/* Exportación acotada para respaldo manual. Solo el administrador principal puede descargarla. */
app.get("/api/admin/backups/export", backupExportLimiter, requireUser, requireStaffAdmin("settings.view"), async (req, res) => {
  try {
    if (req.adminAccess?.isPrimaryAdmin !== true) {
      return sendError(res, 403, "La exportación de respaldo está reservada al administrador principal.");
    }

    const collectionNames = [
      "users", "evaluations", "supportTickets", "promoCodes",
      "platformSettings", "adminRoles", "adminAuditLogs"
    ];
    const results = await Promise.all(collectionNames.map(async name => {
      const snapshot = await db.collection(name).limit(501).get();
      const documents = snapshot.docs.slice(0, 500).map(document => ({
        id: document.id,
        data: document.data()
      }));
      return {
        name,
        documents,
        exportedCount: documents.length,
        truncated: snapshot.size > 500
      };
    }));

    // Nunca incluir credenciales, tokens o secretos aunque aparezcan accidentalmente
    // en un documento. passwordResets y datos de sesión quedan fuera del respaldo.
    const sensitiveKey = /(password|passwd|secret|token|authorization|private.?key|api.?key)/i;
    const sanitize = value => {
      if (Array.isArray(value)) return value.map(sanitize);
      if (!value || typeof value !== "object") return value;
      const output = {};
      Object.entries(value).forEach(([key, item]) => {
        if (!sensitiveKey.test(key)) output[key] = sanitize(item);
      });
      return output;
    };

    const backup = {
      product: "NeuroEval Pro",
      formatVersion: 1,
      generatedAt: new Date().toISOString(),
      scope: "Exportación manual de documentos de las colecciones raíz indicadas, con máximo de 500 documentos por colección; no incluye subcolecciones ni sustituye los respaldos administrados de Google Cloud.",
      complete: results.every(item => !item.truncated),
      collections: results.map(item => ({
        name: item.name,
        exportedCount: item.exportedCount,
        truncated: item.truncated,
        documents: sanitize(item.documents)
      }))
    };

    await writeAdminAudit(req.user.uid, "backup.exported", null, {
      collections: results.map(item => ({ name: item.name, count: item.exportedCount, truncated: item.truncated })),
      complete: backup.complete
    });

    const filename = "neuroeval-pro-respaldo-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"');
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(JSON.stringify(backup));
  } catch (error) {
    console.error("Exportación de respaldo:", error);
    return sendError(res, 500, "No se pudo generar la exportación de respaldo.");
  }
});

/* Diagnóstico protegido de servicios y recursos del servidor. */
app.get("/api/admin/health/details", requireUser, requireStaffAdmin("settings.view"), async (req, res) => {
  const startedAt = Date.now();
  const checks = [];
  const add = (id, label, status, detail) => checks.push({ id, label, status, detail });
  add("api", "API NeuroEval Pro", "operational", "El servidor respondió correctamente.");
  add("firebase-auth", "Firebase Authentication", "operational", "La sesión administrativa fue validada.");
  try {
    await db.collection("platformSettings").doc("pricing").get();
    add("firestore", "Base de datos Firestore", "operational", "Consulta de lectura completada.");
  } catch (error) {
    console.error("Health check Firestore:", error.message);
    add("firestore", "Base de datos Firestore", "error", "No fue posible completar una consulta de lectura.");
  }
  const emailStatus = !emailConfigured
    ? "not_configured"
    : EMAIL_PROVIDER === "smtp" && !smtpConnectionVerified
      ? "warning"
      : "configured";
  const emailDetail = !emailConfigured
    ? "No hay un proveedor de correo transaccional configurado."
    : EMAIL_PROVIDER === "smtp"
      ? (smtpConnectionVerified ? "Conexión SMTP verificada." : "SMTP configurado, pero sin verificación de conexión.")
      : "Proveedor " + EMAIL_PROVIDER + " configurado.";
  add("email", "Correo transaccional", emailStatus, emailDetail);
  const wompiConfigured = Boolean(WOMPI_PUBLIC_KEY && WOMPI_INTEGRITY_SECRET && WOMPI_EVENTS_SECRET);
  add("wompi", "Pasarela Wompi", wompiConfigured ? "configured" : "not_configured",
    !wompiConfigured ? "Faltan parámetros de configuración." : WOMPI_PUBLIC_KEY.startsWith("pub_test_") ? "Ambiente de pruebas (sandbox)." : WOMPI_PUBLIC_KEY.startsWith("pub_prod_") ? "Ambiente de producción." : "Ambiente no identificado.");
  const memory = process.memoryUsage();
  return res.json({
    ok: checks.every(item => item.status !== "error"),
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    responseMs: Date.now() - startedAt,
    runtime: process.version,
    memory: { rssMb: Math.round(memory.rss / 1048576), heapUsedMb: Math.round(memory.heapUsed / 1048576), heapTotalMb: Math.round(memory.heapTotal / 1048576) },
    checks
  });
});

app.get(
  "/api/admin/overview",
  (req, res, next) => {
    req.adminOverviewStartedAt = Date.now();
    next();
  },
  requireUser,
  requireStaffAdmin("dashboard.view"),
  async (req, res) => {
    const requestStartedAt = req.adminOverviewStartedAt || Date.now();
    const queryTimings = {};
    const timedQuery = async (name, queryPromise) => {
      const queryStartedAt = Date.now();
      try {
        const result = await queryPromise();
        queryTimings[name] = Date.now() - queryStartedAt;
        return result;
      } catch (error) {
        queryTimings[name] = Date.now() - queryStartedAt;
        console.error("[ADMIN_OVERVIEW_TIMING] consulta fallida:", name, queryTimings[name] + "ms", error?.message || error);
        throw error;
      }
    };

    try {
      const evaluationsRef = db.collection("evaluations");
      const firestoreStartedAt = Date.now();
      const [usersCountSnapshot,evaluationsCountSnapshot,paidAggregateSnapshot,pendingCountSnapshot,failedCountSnapshot,usersSnapshot,evaluationsSnapshot] = await Promise.all([
        timedQuery("users_count", () => db.collection("users").count().get()),
        timedQuery("evaluations_count", () => evaluationsRef.count().get()),
        timedQuery("paid_aggregate", () => evaluationsRef.where("paymentStatus","==","paid").aggregate({
          count: AggregateField.count(),
          revenueCop: AggregateField.sum("amountCop")
        }).get()),
        timedQuery("pending_count", () => evaluationsRef.where("paymentStatus","==","pending").count().get()),
        timedQuery("failed_count", () => evaluationsRef.where("paymentStatus","==","failed").count().get()),
        timedQuery("users_list_limit_100", () => db.collection("users").limit(100).get()),
        timedQuery("evaluations_list_limit_100", () => evaluationsRef.orderBy("createdAt","desc").limit(100).get())
      ]);
      const firestoreMs = Date.now() - firestoreStartedAt;
      const processingStartedAt = Date.now();
      const paidAggregate = paidAggregateSnapshot.data();
      const revenueCop = Number(paidAggregate.revenueCop || 0);
      const usersList=usersSnapshot.docs.map(document=>{
        const data=document.data()||{};
        return {uid:document.id,name:data.name||"",email:data.email||"",age:data.age??null,goal:data.goal||"",createdAt:asDate(data.createdAt)?.toISOString()||null};
      }).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
      const records=evaluationsSnapshot.docs.map(document=>{
        const data=document.data()||{};
        return {
          id:document.id,uid:data.uid||"",name:data.name||"",email:data.email||"",age:data.age??null,goal:data.goal||"",evaluationType:data.evaluationType||"self_report",childAgeBand:data.parentContext?.childAgeBand||data.parentContext?.ageBand||null,
          profile:data.profile||"",paymentStatus:data.paymentStatus||"pending",paymentProvider:data.paymentProvider||"",
          paymentReference:data.paymentReference||"",wompiTransactionId:data.wompiTransactionId||"",
          wompiTransactionStatus:data.wompiTransactionStatus||"",amountCop:Number(data.amountCop||0),currency:data.currency||"COP",
          createdAt:asDate(data.createdAt)?.toISOString()||null,updatedAt:asDate(data.updatedAt)?.toISOString()||null,
          paidAt:asDate(data.paidAt)?.toISOString()||null
        };
      });
      const permissions = req.adminAccess?.permissions || [];
      const can = permission => req.adminAccess?.isPrimaryAdmin === true || permissions.includes(permission);
      const visibleRecords = records.map(record => {
        const item = { ...record };
        if (!can("evaluations.responses")) delete item.profile;
        // La consulta de evaluaciones no concede por sí sola acceso a identidad del cliente.
        if (!can("clients.view")) {
          ["uid", "name", "email", "age"].forEach(key => delete item[key]);
        }
        if (!can("payments.view")) {
          [
            "paymentStatus", "paymentProvider", "paymentReference",
            "wompiTransactionId", "wompiTransactionStatus",
            "amountCop", "currency", "paidAt"
          ].forEach(key => delete item[key]);
        }
        return item;
      });
      console.log("[ADMIN_OVERVIEW_TIMING]", JSON.stringify({
        totalMs: Date.now() - requestStartedAt,
        firestoreParallelMs: firestoreMs,
        processingMs: Date.now() - processingStartedAt,
        queryMs: queryTimings,
        paidEvaluationDocuments: paidAggregate.count,
        returnedUsers: usersList.length,
        returnedEvaluations: records.length
      }));
      return res.json({
        users:can("clients.view") ? usersCountSnapshot.data().count : null,
        evaluations:can("evaluations.view") ? evaluationsCountSnapshot.data().count : null,
        paid:can("payments.view") ? paidAggregate.count : null,
        pending:can("payments.view") ? pendingCountSnapshot.data().count : null,
        failed:can("payments.view") ? failedCountSnapshot.data().count : null,
        revenueCop:can("payments.view") ? revenueCop : null,
        usersList:can("clients.view") ? usersList : [],
        records:can("evaluations.view") || can("payments.view") ? visibleRecords : []
      });

    } catch (error) {
      console.error("[ADMIN_OVERVIEW_TIMING] error totalMs:", Date.now() - requestStartedAt);
      console.error("Panel administrativo:", error);
      return sendError(res, 500, "No se pudo cargar el panel administrativo.");
    }
  }
);

/* Caché breve para evitar repetir lecturas de hasta 10.000 perfiles en cada apertura del panel. */
let globalAnalyticsCache = null;
const GLOBAL_ANALYTICS_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_ANALYTICS_PAGE_SIZE = 1000;
const GLOBAL_ANALYTICS_MAX_USERS = 50000;

/*
 * Lee únicamente los campos necesarios para analítica agregada.
 * Paginación por document ID evita el límite silencioso de 10.000 perfiles.
 * El límite de seguridad evita una lectura ilimitada en una sola petición.
 */
app.get("/api/admin/analytics/global", requireUser, requireStaffAdmin("dashboard.view"), async (req, res) => {
  try {
    if (globalAnalyticsCache && Date.now() - globalAnalyticsCache.cachedAt < GLOBAL_ANALYTICS_CACHE_TTL_MS) {
      return res.json({ ...globalAnalyticsCache.payload, cached: true });
    }

    const sharedCacheRef = db.collection("systemCache").doc("globalAnalytics");
    const sharedCacheSnapshot = await sharedCacheRef.get();
    if (sharedCacheSnapshot.exists) {
      const shared = sharedCacheSnapshot.data() || {};
      const expiresAt = shared.expiresAt?.toDate?.() || new Date(shared.expiresAt || 0);
      if (shared.payload && Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() > Date.now()) {
        globalAnalyticsCache = { cachedAt: Date.now(), payload: shared.payload };
        return res.json({ ...shared.payload, cached: true });
      }
    }

    const profiles = [];
    const usersCollection = db.collection("users");
    let cursor = null;
    let hasMore = false;

    while (profiles.length < GLOBAL_ANALYTICS_MAX_USERS) {
      let query = usersCollection
        .orderBy(FieldPath.documentId())
        .select("country", "city", "detectedCountryCode", "age", "language")
        .limit(Math.min(GLOBAL_ANALYTICS_PAGE_SIZE, GLOBAL_ANALYTICS_MAX_USERS - profiles.length));
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) {
        hasMore = false;
        break;
      }
      profiles.push(...page.docs.map(document => document.data() || {}));
      cursor = page.docs[page.docs.length - 1];
      if (page.size < GLOBAL_ANALYTICS_PAGE_SIZE) {
        hasMore = false;
        break;
      }
      hasMore = profiles.length >= GLOBAL_ANALYTICS_MAX_USERS;
    }

    if (profiles.length >= GLOBAL_ANALYTICS_MAX_USERS && cursor) {
      const next = await usersCollection
        .orderBy(FieldPath.documentId())
        .select("country")
        .startAfter(cursor)
        .limit(1)
        .get();
      hasMore = !next.empty;
    }

    const aggregates = aggregateProfiles(profiles, 10);
    const payload = {
      ok: true,
      generatedAt: new Date().toISOString(),
      users: profiles.length,
      scannedUsers: profiles.length,
      truncated: hasMore,
      aggregationMode: "paginated_profile_scan",
      privacyThreshold: 10,
      countries: aggregates.countries,
      cities: aggregates.cities,
      ages: aggregates.ages,
      languages: aggregates.languages,
      cached: false
    };
    globalAnalyticsCache = { cachedAt: Date.now(), payload };
    await sharedCacheRef.set({
      payload,
      expiresAt: new Date(Date.now() + GLOBAL_ANALYTICS_CACHE_TTL_MS),
      updatedAt: FieldValue.serverTimestamp()
    }).catch(error => {
      console.warn("No se pudo guardar la caché global compartida:", error.message);
    });
    return res.json(payload);
  } catch (error) {
    console.error("Analítica global:", error);
    return sendError(res, 500, "No se pudo calcular la analítica geográfica.");
  }
});

/* Analítica comercial consolidada: acceso exclusivo a personal con permiso de pagos. */
app.get("/api/admin/analytics/commercial", requireUser, requireStaffAdmin("payments.view"), async (req, res) => {
  try {
    const [evaluationsSnapshot, promosSnapshot] = await Promise.all([
      db.collection("evaluations").get(),
      db.collection("promoCodes").orderBy("createdAt", "desc").limit(100).get()
    ]);
    const now = new Date();
    const months = [];
    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      months.push({ key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), label: date.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }).replace(".", ""), evaluations: 0, paid: 0, revenueCop: 0 });
    }
    let total = 0, paid = 0, pending = 0, failed = 0, revenueCop = 0, discountsCop = 0, promoApplied = 0;
    const promoUsage = new Map();
    evaluationsSnapshot.docs.forEach(document => {
      const data = document.data() || {};
      total++;
      const status = String(data.paymentStatus || "pending").toLowerCase();
      const isPaid = status === "paid";
      if (isPaid) paid++;
      else if (status === "pending") pending++;
      else if (["failed", "declined", "error", "cancelled"].includes(status)) failed++;
      if (isPaid) { revenueCop += Number(data.amountCop || 0); discountsCop += Number(data.discountCop || 0); }
      if (data.promoCode) { promoApplied++; promoUsage.set(String(data.promoCode), (promoUsage.get(String(data.promoCode)) || 0) + 1); }
      const createdDate = asDate(data.createdAt);
      if (createdDate) {
        const createdKey = createdDate.getFullYear() + "-" + String(createdDate.getMonth() + 1).padStart(2, "0");
        const createdBucket = months.find(item => item.key === createdKey);
        if (createdBucket) {
          createdBucket.evaluations++;
          if (isPaid) createdBucket.paid++;
        }
      }
      if (isPaid) {
        const paidDate = asDate(data.paidAt || data.updatedAt || data.createdAt);
        if (paidDate) {
          const paidKey = paidDate.getFullYear() + "-" + String(paidDate.getMonth() + 1).padStart(2, "0");
          const paidBucket = months.find(item => item.key === paidKey);
          if (paidBucket) paidBucket.revenueCop += Number(data.amountCop || 0);
        }
      }
    });
    const promos = promosSnapshot.docs.map(document => {
      const data = document.data() || {};
      return { code: document.id, active: data.active === true, uses: Number(data.uses || 0), maxUses: Number(data.maxUses || 0), discountType: data.discountType || "fixed", discountValue: Number(data.discountValue || 0), evaluationsUsingCode: promoUsage.get(document.id) || 0 };
    }).sort((a, b) => b.uses - a.uses);
    return res.json({
      ok: true, generatedAt: now.toISOString(),
      totals: { evaluations: total, paid, pending, failed, conversionPercent: total ? Math.round(paid / total * 1000) / 10 : 0, revenueCop, averageTicketCop: paid ? Math.round(revenueCop / paid) : 0, discountsCop, promoApplied },
      months, promos
    });
  } catch (error) {
    console.error("Analítica comercial:", error);
    return sendError(res, 500, "No se pudo calcular la analítica comercial.");
  }
});

app.get(
  "/api/admin/clients/:uid",
  requireUser,
  requireStaffAdmin("clients.view"),
  async (req, res) => {
    try {
      const uid = String(req.params.uid || "").trim();
      if (!uid || uid.length > 128) return sendError(res, 400, "El identificador del cliente no es válido.");

      const [profileSnapshot, evaluationsSnapshot] = await Promise.all([
        db.collection("users").doc(uid).get(),
        db.collection("evaluations").where("uid", "==", uid).limit(100).get()
      ]);
      let account = null;
      try {
        const authUser = await firebaseAuth.getUser(uid);
        account = {
          email: String(authUser.email || "").toLowerCase(),
          emailVerified: authUser.emailVerified === true,
          disabled: authUser.disabled === true,
          createdAt: authUser.metadata?.creationTime || null,
          lastSignInAt: authUser.metadata?.lastSignInTime || null
        };
      } catch (accountError) {
        console.warn("No se pudo consultar metadatos de autenticación del cliente:", accountError.code || accountError.message);
      }

      const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
      const canViewPayments = req.adminAccess?.isPrimaryAdmin === true || (req.adminAccess?.permissions || []).includes("payments.view");
      const evaluations = evaluationsSnapshot.docs.map(document => {
        const data = document.data() || {};
        const item = {
          id: document.id,
          name: data.name || profile.name || "",
          goal: data.goal || profile.goal || "",
          paymentStatus: data.paymentStatus || "pending",
          createdAt: asDate(data.createdAt)?.toISOString() || null,
          updatedAt: asDate(data.updatedAt)?.toISOString() || null
        };
        if (canViewPayments) {
          item.amountCop = Number(data.amountCop || 0);
          item.paymentProvider = data.paymentProvider || "";
          item.paidAt = asDate(data.paidAt)?.toISOString() || null;
        }
        return item;
      }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

      return res.json({
        client: {
          uid,
          name: profile.name || "",
          email: String(profile.email || account?.email || "").toLowerCase(),
          age: profile.age ?? null,
          goal: profile.goal || "",
          createdAt: asDate(profile.createdAt)?.toISOString() || account?.createdAt || null,
          updatedAt: asDate(profile.updatedAt)?.toISOString() || null,
          account
        },
        evaluations,
        evaluationCount: evaluations.length,
        paymentsVisible: canViewPayments
      });
    } catch (error) {
      console.error("Detalle administrativo del cliente:", error);
      return sendError(res, 500, "No se pudo consultar el expediente del cliente.");
    }
  }
);

app.get(
  "/api/admin/evaluations/:id",
  requireUser,
  requireStaffAdmin("evaluations.responses"),
  async (req, res) => {
    try {
      const snapshot = await db
        .collection("evaluations")
        .doc(req.params.id)
        .get();

      if (!snapshot.exists) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      const evaluationData = snapshot.data() || {};
      const parentContext = evaluationData.parentContext || {};
      // No devolver la edad exacta de menores en registros históricos.
      const { childAge, ...safeParentContext } = parentContext;
      const evaluation = {
        id: snapshot.id,
        ...evaluationData,
        ...(evaluationData.evaluationType === "parent_observation"
          ? { parentContext: safeParentContext }
          : {})
      };
      const canViewClientIdentity = req.adminAccess?.isPrimaryAdmin === true ||
        (req.adminAccess?.permissions || []).includes("clients.view");
      if (!canViewClientIdentity) {
        ["uid", "name", "email", "age"].forEach(key => delete evaluation[key]);
      }
      return res.json({ evaluation });

    } catch (error) {
      console.error("Detalle administrativo:", error);
      return sendError(res, 500, "No se pudo consultar la evaluación.");
    }
  }
);

app.get(
  "/api/admin/evaluations/:id/pdf",
  requireUser,
  requireStaffAdmin("evaluations.pdf"),
  async (req, res) => {
    try {
      const snapshot = await db
        .collection("evaluations")
        .doc(req.params.id)
        .get();

      if (!snapshot.exists) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      const evaluationData = snapshot.data();
      const ownerProfile = evaluationData.uid
        ? await db.collection("users").doc(evaluationData.uid).get()
        : null;
      const canViewClientIdentity = req.adminAccess?.isPrimaryAdmin === true ||
        (req.adminAccess?.permissions || []).includes("clients.view");
      const reportData = { ...evaluationData };
      if (!canViewClientIdentity) {
        reportData.name = "";
        reportData.email = "";
        delete reportData.age;
      }
      const requestedLanguage = String(req.query.language || "").trim().toLowerCase();
      const profileLanguage = ownerProfile?.exists && ownerProfile.data()?.language === "en" ? "en" : "es";
      const reportLanguage = ["es", "en"].includes(requestedLanguage) ? requestedLanguage : profileLanguage;
      const pdf = await buildEvaluationPdf(reportData, {
        includeAnswers: true,
        language: reportLanguage
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="NeuroEval-Pro-admin-${req.params.id}.pdf"`
      );
      res.setHeader("Cache-Control", "private, no-store");

      return res.send(pdf);

    } catch (error) {
      console.error("PDF administrativo:", error);
      return sendError(res, 500, "No se pudo generar el PDF administrativo.");
    }
  }
);

/* =========================================================
   17. RECUPERACIÓN DE CONTRASEÑA CON CÓDIGO DE SEIS DÍGITOS
========================================================= */

app.post(
  "/api/password/request",
  passwordLimiter,
  async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();

      if (!isValidEmail(email)) {
        return sendError(res, 400, "Escribe un correo electrónico válido.");
      }

      // La respuesta no revela si el correo está registrado.
      const genericMessage =
        "Si la cuenta existe, recibirás un código de recuperación.";

      if (!emailConfigured) {
        console.error(`Solicitud de recuperación rechazada: proveedor de correo "${EMAIL_PROVIDER}" no configurado.`);
        return sendError(
          res,
          503,
          "La recuperación por correo no está disponible temporalmente. Intenta más tarde."
        );
      }

      let userRecord;

      try {
        userRecord = await firebaseAuth.getUserByEmail(email);
      } catch (error) {
        if (error.code === "auth/user-not-found") {
          return res.json({ ok: true, message: genericMessage });
        }
        throw error;
      }

      const userProfileSnapshot = await db.collection("users").doc(userRecord.uid).get();
      const resetLanguage = userProfileSnapshot.exists && userProfileSnapshot.data()?.language === "en" ? "en" : "es";
      const code = String(
        crypto.randomInt(0, 1000000)
      ).padStart(6, "0");

      const salt = crypto.randomBytes(16).toString("hex");
      const codeHash = sha256(`${salt}:${code}`);

      const expiresAt = Date.now() + 10 * 60 * 1000;

      await db.collection("passwordResets").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        codeHash,
        salt,
        expiresAt,
        attempts: 0,
        createdAt: FieldValue.serverTimestamp()
      });

      try {
        const emailCopy = resetLanguage === "en"
          ? {
              subject: "Password reset code · NeuroEval Pro",
              text: `Your password reset code is: ${code}\n\nThis code expires in 10 minutes. If you did not request this change, you can ignore this message.`,
              intro: "We received a request to change your account password.",
              label: "Your verification code is:",
              expiry: "This code expires in 10 minutes and can only be used once.",
              ignore: "If you did not request this change, you can ignore this message."
            }
          : {
              subject: "Código de recuperación · NeuroEval Pro",
              text: `Tu código de recuperación es: ${code}\n\nEste código vence en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.`,
              intro: "Recibimos una solicitud para cambiar la contraseña de tu cuenta.",
              label: "Tu código de verificación es:",
              expiry: "El código vence en 10 minutos y solo puede utilizarse una vez.",
              ignore: "Si no solicitaste este cambio, puedes ignorar este mensaje."
            };
        await sendTransactionalEmail({
          to: email,
          subject: emailCopy.subject,
          text: emailCopy.text,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#202642">
              <h2 style="color:#5149bb">NeuroEval Pro</h2>
              <p>${emailCopy.intro}</p>
              <p>${emailCopy.label}</p>
              <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f1f0ff;border-radius:12px;text-align:center;color:#5149bb">${code}</div>
              <p>${emailCopy.expiry}</p>
              <p style="color:#77809b;font-size:12px">${emailCopy.ignore}</p>
            </div>
          `
        });
      } catch (mailError) {
        if (EMAIL_PROVIDER === "smtp") smtpConnectionVerified = false;
        await db.collection("passwordResets").doc(userRecord.uid).delete().catch(() => {});
        throw mailError;
      }

      return res.json({ ok: true, message: genericMessage });

    } catch (error) {
      console.error("Solicitar recuperación:", error);
      return sendError(res, 500, "No se pudo procesar la solicitud de recuperación.");
    }
  }
);

app.post(
  "/api/password/confirm",
  passwordLimiter,
  async (req, res) => {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      const code = String(req.body.code || "").trim();
      const newPassword = String(req.body.newPassword || "");

      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        return sendError(res, 400, "El correo o el código no son válidos.");
      }

      if (newPassword.length < 8) {
        return sendError(res, 400, "La contraseña debe tener al menos 8 caracteres.");
      }

      let userRecord;

      try {
        userRecord = await firebaseAuth.getUserByEmail(email);
      } catch (_) {
        return sendError(res, 400, "El código no es válido o ha vencido.");
      }

      const resetRef = db.collection("passwordResets").doc(userRecord.uid);
      const verification = await db.runTransaction(async (transactionWriter) => {
        const resetSnapshot = await transactionWriter.get(resetRef);

        if (!resetSnapshot.exists) {
          return { error: "invalid" };
        }

        const reset = resetSnapshot.data() || {};

        if (reset.consumedAt || reset.status === "processing") {
          return { error: "used" };
        }

        if (Date.now() > Number(reset.expiresAt || 0)) {
          transactionWriter.delete(resetRef);
          return { error: "expired" };
        }

        if (Number(reset.attempts || 0) >= 5) {
          transactionWriter.delete(resetRef);
          return { error: "locked" };
        }

        const submittedHash = sha256(`${reset.salt}:${code}`);

        if (!safeEqual(submittedHash, reset.codeHash)) {
          transactionWriter.update(resetRef, {
            attempts: Number(reset.attempts || 0) + 1
          });
          return { error: "wrong" };
        }

        // Reservar el código dentro de una transacción evita que dos
        // solicitudes simultáneas puedan utilizarlo a la vez.
        transactionWriter.update(resetRef, {
          status: "processing",
          consumedAt: FieldValue.serverTimestamp()
        });

        return { valid: true };
      });

      if (verification.error === "expired") {
        return sendError(res, 400, "El código ha vencido. Solicita uno nuevo.");
      }
      if (verification.error === "locked") {
        return sendError(res, 429, "Se superó el número de intentos. Solicita un código nuevo.");
      }
      if (verification.error === "wrong") {
        return sendError(res, 400, "El código no es correcto.");
      }
      if (verification.error === "used") {
        return sendError(res, 400, "Este código ya fue utilizado. Solicita uno nuevo.");
      }
      if (!verification.valid) {
        return sendError(res, 400, "El código no es válido o ha vencido.");
      }

      try {
        await firebaseAuth.updateUser(userRecord.uid, {
          password: newPassword
        });
      } catch (passwordError) {
        // El código queda consumido por seguridad. El usuario puede
        // solicitar uno nuevo si Firebase no pudo actualizar la contraseña.
        await resetRef.delete().catch(() => {});
        throw passwordError;
      }

      // La contraseña ya fue actualizada. La limpieza del código y la
      // revocación de sesiones son tareas posteriores: un fallo en ellas
      // no debe informar falsamente que el cambio de contraseña fracasó.
      let sessionsRevoked = true;

      try {
        await resetRef.delete();
      } catch (cleanupError) {
        console.error("No se pudo limpiar el código de recuperación consumido:", cleanupError);
      }

      try {
        // Revoca las sesiones anteriores para que el usuario vuelva a ingresar.
        await firebaseAuth.revokeRefreshTokens(userRecord.uid);
      } catch (revokeError) {
        sessionsRevoked = false;
        console.error("La contraseña cambió, pero no se pudieron revocar todas las sesiones:", revokeError);
      }

      return res.json({
        ok: true,
        sessionsRevoked,
        message: sessionsRevoked
          ? "Tu contraseña fue actualizada. Ya puedes iniciar sesión."
          : "Tu contraseña fue actualizada. Por seguridad, cierra las demás sesiones si siguen abiertas y vuelve a iniciar sesión."
      });

    } catch (error) {
      console.error("Confirmar recuperación:", error);
      return sendError(res, 500, "No se pudo cambiar la contraseña.");
    }
  }
);

/* =========================================================
   18. RUTAS NO ENCONTRADAS Y FRONTEND
========================================================= */

app.use("/api", (req, res) => {
  return sendError(res, 404, "La ruta solicitada no existe.");
});

const publicDirectory = path.join(__dirname, "public");

app.use(
  express.static(publicDirectory, {
    index: "index.html",
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (/\\.(?:js|html)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  })
);

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicDirectory, "index.html"));
});

/* =========================================================
   19. MANEJO DE ERRORES
========================================================= */

app.use((error, req, res, next) => {
  console.error("Error no controlado:", error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message === "Origen no autorizado por CORS") {
    return sendError(res, 403, error.message);
  }

  return sendError(res, 500, "Ocurrió un error interno del servidor.");
});

/* =========================================================
   20. INICIAR SERVIDOR
========================================================= */

app.listen(PORT, () => {
  console.log("-----------------------------------------");
  console.log(" NeuroEval Pro API");
  console.log(` Puerto: ${PORT}`);
  console.log(` Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(` Precio: $${DEFAULT_EVAL_PRICE_COP} COP`);
  console.log(` Firebase: ${FIREBASE_PROJECT_ID || "No especificado"}`);
  console.log(` SMTP: ${mailer ? "Configurado" : "Pendiente"}`);
  console.log(` Wompi: ${WOMPI_PUBLIC_KEY ? "Clave pública detectada" : "Pendiente"}`);
  console.log("-----------------------------------------");
});
