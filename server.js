"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const admin = require("firebase-admin");
const PDFDocument = require("pdfkit");
const path = require("path");
const https = require("https");

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

const EVAL_PRICE_COP = 4000;
const CURRENCY = "COP";

const { calculateEvaluationOnServer } = require("./lib/evaluation");
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

if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      );

      credential = admin.credential.cert(serviceAccount);
    } catch (error) {
      console.error(
        "FIREBASE_SERVICE_ACCOUNT_JSON no es válido:",
        error.message
      );
      process.exit(1);
    }
  } else {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    ...(FIREBASE_PROJECT_ID
      ? { projectId: FIREBASE_PROJECT_ID }
      : {})
  });
}

const db = admin.firestore();
const firebaseAuth = admin.auth();

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
    methods: ["GET", "POST", "OPTIONS"],
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

let smtpConnectionVerified = false;

if (
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

  // La presencia de variables no garantiza que el proveedor SMTP acepte
  // la conexión. Verificarla permite distinguir configuración de conectividad.
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

async function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return sendError(res, 401, "Debes iniciar sesión.");
    }

    // Consultar el estado actual en Firebase evita aceptar un custom
    // claim antiguo que siga presente en un token todavía no expirado.
    const account = await firebaseAuth.getUser(req.user.uid);
    const hasAdminClaim = account.customClaims?.admin === true;
    const isConfiguredAdmin =
      String(account.email || "").trim().toLowerCase() === ADMIN_EMAIL &&
      account.emailVerified === true;

    if (account.disabled || (!hasAdminClaim && !isConfiguredAdmin)) {
      return sendError(
        res,
        403,
        "No tienes permisos administrativos."
      );
    }

    return next();

  } catch (error) {
    console.error("Validación administrativa:", error);
    return sendError(
      res,
      403,
      "No se pudo validar el permiso administrativo."
    );
  }
}

/* =========================================================
   7. SESIÓN Y ROL DE LA CUENTA
========================================================= */

// Devuelve el rol calculado en el servidor. La cuenta administradora debe
// tener el correo configurado y estar verificada en Firebase Authentication.
app.get("/api/session", requireUser, async (req, res) => {
  try {
    const account = await firebaseAuth.getUser(req.user.uid);
    const email = String(account.email || "").trim().toLowerCase();
    const isConfiguredAdmin =
      !account.disabled &&
      account.emailVerified === true &&
      email === ADMIN_EMAIL;
    const hasAdminClaim = account.customClaims?.admin === true;
    const isAdmin = isConfiguredAdmin || hasAdminClaim;

    // Mantener el claim sincronizado facilita futuras sesiones y conserva
    // cualquier otro custom claim que ya tenga la cuenta.
    if (isConfiguredAdmin && !hasAdminClaim) {
      await firebaseAuth.setCustomUserClaims(account.uid, {
        ...(account.customClaims || {}),
        admin: true
      });
    }

    return res.json({ ok: true, isAdmin });
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
    smtpConfigured: Boolean(mailer),
    smtpConnectionVerified: Boolean(mailer) && smtpConnectionVerified,
    wompiConfigured: Boolean(
      WOMPI_PUBLIC_KEY &&
      WOMPI_INTEGRITY_SECRET &&
      WOMPI_EVENTS_SECRET
    ),
    wompiEnvironment,
    demoPaymentEnabled: ALLOW_DEMO_PAY,
    evaluationPriceCop: EVAL_PRICE_COP,
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

    const age =
      req.body.age === null || req.body.age === undefined
        ? null
        : Number(req.body.age);

    if (!name) {
      return sendError(res, 400, "El nombre es obligatorio.");
    }

    if (
      age !== null &&
      (!Number.isInteger(age) || age < 18 || age > 99)
    ) {
      return sendError(res, 400, "La edad no es válida.");
    }

    const userRef = db.collection("users").doc(req.user.uid);
    const existing = await userRef.get();

    const profile = {
      uid: req.user.uid,
      name,
      email: String(req.user.email || "").toLowerCase(),
      age,
      goal: goal || "Autoconocimiento",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (!existing.exists) {
      profile.createdAt =
        admin.firestore.FieldValue.serverTimestamp();
    }

    await userRef.set(profile, { merge: true });

    return res.json({ ok: true, profile });

  } catch (error) {
    console.error("POST perfil:", error);
    return sendError(
      res,
      500,
      "No se pudo guardar el perfil."
    );
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

    const calculated = calculateEvaluationOnServer(body.answers);
    if (calculated.error) {
      return sendError(res, 400, calculated.error);
    }

    const age = body.age === null || body.age === undefined
      ? null
      : Number(body.age);

    if (age !== null && (!Number.isInteger(age) || age < 18 || age > 99)) {
      return sendError(res, 400, "La edad recibida no es válida.");
    }

    const reference = makeReference();
    const evaluation = {
      uid: req.user.uid,
      name,
      email,
      age,
      goal,
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
      amountCop: EVAL_PRICE_COP,
      currency: CURRENCY,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const document = await db.collection("evaluations").add(evaluation);

    // No devolver respuestas ni resultados antes del pago confirmado.
    // El informe completo solo se entrega mediante el endpoint protegido.
    return res.status(201).json({
      ok: true,
      id: document.id,
      reference,
      paymentStatus: "pending",
      amountCop: EVAL_PRICE_COP,
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
      .limit(50)
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
        amountCop: data.amountCop || EVAL_PRICE_COP,
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
        amountCop: result.data.amountCop || EVAL_PRICE_COP,
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

      const payment = await db.runTransaction(async (transactionWriter) => {
        const snapshot = await transactionWriter.get(result.ref);

        if (!snapshot.exists) {
          return { error: "not-found" };
        }

        const evaluation = snapshot.data() || {};

        if (evaluation.paymentStatus === "paid") {
          return { error: "already-paid" };
        }

        const wompiStatus = String(
          evaluation.wompiTransactionStatus || ""
        ).toUpperCase();

        if (wompiStatus === "APPROVED") {
          return { error: "reconciliation-required" };
        }

        // Cada apertura de checkout recibe una referencia nueva. Wompi no permite
        // reutilizar referencias, incluso si el intento anterior quedó pendiente
        // porque su webhook no llegó al servidor.
        const reference = makeReference();

        transactionWriter.set(
          result.ref,
          {
            paymentReference: reference,
            paymentStatus: "pending",
            paymentProvider: "wompi",
            wompiTransactionId: admin.firestore.FieldValue.delete(),
            wompiTransactionStatus: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        return { reference };
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
      if (payment.error) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      const reference = payment.reference;
      const amountInCents = EVAL_PRICE_COP * 100;
      const signatureString =
        `${reference}${amountInCents}${CURRENCY}${WOMPI_INTEGRITY_SECRET}`;
      const signature = sha256(signatureString);
      const redirectUrl =
        `${APP_ORIGIN}/?evaluation=${encodeURIComponent(evaluationId)}`;

      return res.json({
        publicKey: WOMPI_PUBLIC_KEY,
        currency: CURRENCY,
        amountInCents,
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

    if (
      amountInCents !== EVAL_PRICE_COP * 100 ||
      currency !== CURRENCY
    ) {
      console.error("Importe o moneda no coinciden:", {
        reference,
        amountInCents,
        currency
      });

      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "El importe o la moneda no coinciden."
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
    const outcome = await db.runTransaction(async (transactionWriter) => {
      const snapshot = await transactionWriter.get(evaluationRef);

      if (!snapshot.exists) {
        return { ignored: true, reason: "La evaluación ya no existe." };
      }

      const evaluation = snapshot.data() || {};

      // La referencia debe seguir siendo la activa: una notificación de un
      // intento anterior no puede afectar un reintento con nueva referencia.
      if (evaluation.paymentReference !== reference) {
        return {
          ignored: true,
          reason: "La referencia ya no corresponde al intento de pago activo."
        };
      }

      const decision = decideWompiTransition(evaluation, {
        status,
        transactionId
      });

      if (decision.ignored) {
        return decision;
      }

      const update = {
        ...decision.update,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (decision.update.setPaidAt) {
        update.paidAt = admin.firestore.FieldValue.serverTimestamp();
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
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
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

function buildEvaluationPdf(evaluation, options = {}) {
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
          Title: "Informe NeuroEval Pro",
          Author: "NeuroEval Pro",
          Subject: "Informe de autorregistro cognitivo"
        }
      });

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
      const purple = "#6259C9";
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
        .text("INFORME DE AUTORREGISTRO COGNITIVO", 55, 82);

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
        ["Edad", evaluation.age ?? "No registrada"],
        ["Objetivo", evaluation.goal || "No especificado"],
        [
          "Fecha",
          asDate(evaluation.createdAt)?.toLocaleString("es-CO") ||
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
        inattention: "Atención sostenida y memoria cotidiana",
        executive: "Organización y funciones ejecutivas",
        hyperactivity: "Inquietud e impulsividad",
        emotionalContext: "Regulación emocional",
        context: "Estrés, preocupación y descanso",
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
          ["Estrés y descanso", evaluation.summary.contextInfluence],
          ["Impacto cotidiano", evaluation.summary.dailyImpact],
          ["Historia y contextos", evaluation.summary.childhoodAndSettings]
        ];
        summaryLabels.forEach(([label, value]) => {
          if (!value) return;
          ensureSpace(24);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(navy)
            .text(`${label}: `, { continued: true });
          doc.font("Helvetica").fontSize(9).fillColor(muted).text(String(value));
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

      const pdf = await buildEvaluationPdf(result.data);

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

app.get(
  "/api/admin/overview",
  requireUser,
  requireAdmin,
  async (req, res) => {
    try {
      const [
        usersCountSnapshot,
        evaluationsCountSnapshot,
        evaluationsSnapshot
      ] = await Promise.all([
        db.collection("users").count().get(),
        db.collection("evaluations").count().get(),
        db.collection("evaluations")
          .orderBy("createdAt", "desc")
          .limit(100)
          .get()
      ]);

      const records = evaluationsSnapshot.docs.map((document) => {
        const data = document.data();

        return {
          id: document.id,
          name: data.name || "",
          email: data.email || "",
          profile: data.profile || "",
          paymentStatus: data.paymentStatus || "pending",
          createdAt: asDate(data.createdAt)?.toISOString() || null
        };
      });

      return res.json({
        users: usersCountSnapshot.data().count,
        evaluations: evaluationsCountSnapshot.data().count,
        records
      });

    } catch (error) {
      console.error("Panel administrativo:", error);
      return sendError(res, 500, "No se pudo cargar el panel administrativo.");
    }
  }
);

app.get(
  "/api/admin/evaluations/:id",
  requireUser,
  requireAdmin,
  async (req, res) => {
    try {
      const snapshot = await db
        .collection("evaluations")
        .doc(req.params.id)
        .get();

      if (!snapshot.exists) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      return res.json({
        evaluation: {
          id: snapshot.id,
          ...snapshot.data()
        }
      });

    } catch (error) {
      console.error("Detalle administrativo:", error);
      return sendError(res, 500, "No se pudo consultar la evaluación.");
    }
  }
);

app.get(
  "/api/admin/evaluations/:id/pdf",
  requireUser,
  requireAdmin,
  async (req, res) => {
    try {
      const snapshot = await db
        .collection("evaluations")
        .doc(req.params.id)
        .get();

      if (!snapshot.exists) {
        return sendError(res, 404, "No encontramos esa evaluación.");
      }

      const pdf = await buildEvaluationPdf(snapshot.data(), {
        includeAnswers: true
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

      if (!mailer) {
        console.error("Solicitud de recuperación rechazada: SMTP no está configurado.");
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      try {
        await mailer.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: "Código de recuperación · NeuroEval Pro",
          text:
            `Tu código de recuperación es: ${code}\n\n` +
            "Este código vence en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.",
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#202642">
              <h2 style="color:#5149bb">NeuroEval Pro</h2>
              <p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
              <p>Tu código de verificación es:</p>
              <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:18px;background:#f1f0ff;border-radius:12px;text-align:center;color:#5149bb">${code}</div>
              <p>El código vence en 10 minutos y solo puede utilizarse una vez.</p>
              <p style="color:#77809b;font-size:12px">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
            </div>
          `
        });
        smtpConnectionVerified = true;
      } catch (mailError) {
        smtpConnectionVerified = false;
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
          consumedAt: admin.firestore.FieldValue.serverTimestamp()
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
  console.log(` Precio: $${EVAL_PRICE_COP} COP`);
  console.log(` Firebase: ${FIREBASE_PROJECT_ID || "No especificado"}`);
  console.log(` SMTP: ${mailer ? "Configurado" : "Pendiente"}`);
  console.log(` Wompi: ${WOMPI_PUBLIC_KEY ? "Clave pública detectada" : "Pendiente"}`);
  console.log("-----------------------------------------");
});
