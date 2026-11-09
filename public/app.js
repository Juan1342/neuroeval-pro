/* NEUROEVAL_PUBLIC_AUTH_BUILD: 20261108-1 */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

/* =========================================================
   1. CONFIGURACIÓN Y ESTADO
========================================================= */

const $ = (id) => document.getElementById(id);

const EVALUATION_PRICE_COP = 4000; // Valor de respaldo visual; el servidor determina el importe real.
// Solo bloquea el registro público de la cuenta reservada; no concede permisos.
const ADMIN_EMAIL = "jzamorazapata@gmail.com";

let auth;
let currentUser = null;
let currentIsAdmin = false;
let currentIsPrimaryAdmin = false;
let currentAdminPermissions = [];
let currentIndex = 0;
let questions = [];
let answers = [];
let lastEvaluationId = null;
let paymentReference = null;
let paymentPollTimer = null;
let isHandlingAuth = false;
let profileData = null;
let currentScores = null;
let currentRecommendations = [];
let currentEvaluationType = "self_report";
let parentEvaluationContext = null;
let activeChoices;

const choices = [
  "Nunca",
  "Rara vez",
  "A veces",
  "Con frecuencia",
  "Casi siempre"
];

const points = [0, 1, 2, 3, 4];
activeChoices = choices;

/* =========================================================
   2. BANCO DE PREGUNTAS
========================================================= */

const bank = [
  [
    "Memoria inmediata",
    "Memoriza estas tres palabras. Más adelante te pediremos recordarlas.",
    "memoryStudy",
    "🧠",
    "LUNA   ·   LLAVE   ·   RÍO",
    "study",
    [
      "Ya memoricé la secuencia"
    ],
    null
  ],
  [
    "Atención sostenida",
    "Cuando lees, estudias o trabajas, ¿pierdes el hilo aunque quieras prestar atención?",
    "inattention",
    "📚",
    "Por ejemplo: relees el mismo párrafo varias veces y al final no recuerdas qué decía."
  ],
  [
    "Búsqueda visual",
    "Cuenta cuántas estrellas aparecen entre los símbolos.",
    "visualTask",
    "👁️",
    "⭐  🔺  ⭐  ⚪  🔺  ⭐",
    "task",
    [
      "2",
      "3",
      "4",
      "5"
    ],
    "3"
  ],
  [
    "Organización y planificación",
    "¿Te cuesta dividir una tarea grande en pasos y decidir por dónde empezar?",
    "executive",
    "🧩",
    "Por ejemplo: tienes varias cosas pendientes y no sabes cómo ordenarlas."
  ],
  [
    "Memoria inmediata",
    "Memoriza estos números en el mismo orden. Más adelante tendrás que seleccionarlos.",
    "memoryStudy",
    "🔢",
    "8   –   2   –   5   –   9",
    "study",
    [
      "Ya memoricé la secuencia"
    ],
    null
  ],
  [
    "Inquietud e impulsividad",
    "¿Sientes inquietud física o necesidad de moverte cuando debes permanecer sentado?",
    "hyperactivity",
    "🪑",
    "Por ejemplo: mueves manos o pies, cambias de postura o te levantas."
  ],
  [
    "Búsqueda visual",
    "¿Qué color aparece más veces en esta secuencia?",
    "visualTask",
    "🎨",
    "🔵  🟡  🟣  🟡  🔵  🟢  🟡",
    "task",
    [
      "Azul",
      "Amarillo",
      "Morado",
      "Verde"
    ],
    "Amarillo"
  ],
  [
    "Regulación emocional",
    "¿Una frustración pequeña puede provocarte una reacción emocional intensa o difícil de regular?",
    "emotionalContext",
    "🌦️",
    "Observa cuánto tarda en bajar la intensidad de la emoción."
  ],
  [
    "Recuerdo de palabras",
    "¿Qué grupo contiene exactamente las tres palabras que memorizaste al comienzo?",
    "memoryRecall",
    "🧠",
    "Elige la secuencia que recuerdes, sin volver atrás.",
    "task",
    [
      "LUNA · LLAVE · RÍO",
      "LUNA · LIBRO · RÍO",
      "LLAVE · RÍO · ROSA",
      "LUNA · LLAVE · SOL"
    ],
    "LUNA · LLAVE · RÍO"
  ],
  [
    "Estrés y descanso",
    "¿Notas que tu concentración empeora cuando duermes poco o descansas mal?",
    "context",
    "🌙",
    "Compara tus días descansados con los días de poco sueño."
  ],
  [
    "Organización y planificación",
    "¿Postergas tareas importantes aunque tengas claro que debes hacerlas?",
    "executive",
    "📋",
    "No se trata de pereza: observa si te cuesta iniciar o sostener el primer paso."
  ],
  [
    "Memoria de secuencias",
    "Memoriza el orden de estos símbolos. Más adelante tendrás que reconocer la secuencia exacta.",
    "memoryStudy",
    "🔷",
    "▲   ●   ■   ◆",
    "study",
    [
      "Ya memoricé la secuencia"
    ],
    null
  ],
  [
    "Impacto cotidiano",
    "¿Estas experiencias dificultan tus estudios, trabajo, tareas domésticas o relaciones?",
    "impact",
    "🏡",
    "Responde pensando en consecuencias concretas y repetidas."
  ],
  [
    "Recuerdo de números",
    "¿Cuál era la secuencia numérica que viste anteriormente?",
    "memoryRecall",
    "🔢",
    "Selecciona los cuatro números en el mismo orden.",
    "task",
    [
      "8 – 2 – 5 – 9",
      "8 – 5 – 2 – 9",
      "9 – 2 – 5 – 8",
      "8 – 2 – 9 – 5"
    ],
    "8 – 2 – 5 – 9"
  ],
  [
    "Inquietud e impulsividad",
    "¿Actúas o respondes rápidamente y luego piensas que habrías preferido hacer una pausa?",
    "hyperactivity",
    "⚡",
    "Puede ocurrir al hablar, comprar, decidir o reaccionar."
  ],
  [
    "Historia y contexto",
    "¿Recuerdas que algunas de estas dificultades ya estaban presentes antes de los 12 años?",
    "history",
    "🧒",
    "Piensa en recuerdos escolares, familiares o relatos de personas cercanas."
  ],
  [
    "Búsqueda visual",
    "Cuenta cuántos círculos negros aparecen en la secuencia.",
    "visualTask",
    "⚫",
    "●  ▲  ●  ■  ◆  ●  ▲  ●",
    "task",
    [
      "2",
      "3",
      "4",
      "5"
    ],
    "4"
  ],
  [
    "Memoria inmediata",
    "Memoriza estas cuatro palabras. Después de varias actividades te preguntaremos por ellas.",
    "memoryStudy",
    "🗝️",
    "NUBE   ·   PAN   ·   RELOJ   ·   FLOR",
    "study",
    [
      "Ya memoricé las palabras"
    ],
    null
  ],
  [
    "Recuerdo de patrones",
    "¿Cuál era el orden exacto de los cuatro símbolos que memorizaste?",
    "memoryRecall",
    "🔷",
    "Elige la secuencia que viste, en el mismo orden.",
    "task",
    [
      "▲ – ● – ■ – ◆",
      "● – ▲ – ■ – ◆",
      "▲ – ■ – ● – ◆",
      "▲ – ● – ◆ – ■"
    ],
    "▲ – ● – ■ – ◆"
  ],
  [
    "Estrés y descanso",
    "¿La preocupación, tensión o ansiedad ocupa tu mente e interfiere con lo que estás haciendo?",
    "context",
    "☁️",
    "Por ejemplo: intentas trabajar, pero sigues pensando en un problema."
  ],
  [
    "Atención sostenida",
    "¿Te cuesta terminar una actividad cuando aparecen notificaciones, conversaciones o ruidos?",
    "inattention",
    "🔔",
    "Piensa en lo que ocurre cuando intentas concentrarte y algo interrumpe tu tarea."
  ],
  [
    "Búsqueda visual",
    "Cuenta cuántos triángulos aparecen en esta secuencia.",
    "visualTask",
    "🔺",
    "🔺  ●  ■  🔺  ◆  ●  🔺  ■  🔺",
    "task",
    [
      "2",
      "3",
      "4",
      "5"
    ],
    "4"
  ],
  [
    "Historia y contexto",
    "¿Estas dificultades aparecen en más de un entorno, por ejemplo casa, estudio, trabajo o vida social?",
    "history",
    "🏠",
    "No tienen que presentarse igual en todos los lugares."
  ],
  [
    "Regulación emocional",
    "¿Te cuesta recuperar la calma cuando algo interrumpe tus planes?",
    "emotionalContext",
    "🧘",
    "Piensa en cambios inesperados o tareas que no salen como esperabas."
  ],
  [
    "Impacto cotidiano",
    "¿Otras personas te han señalado dificultades de atención, organización, inquietud o impulsividad?",
    "impact",
    "👥",
    "Considera comentarios respetuosos de personas que te conocen bien."
  ],
  [
    "Recuerdo final de palabras",
    "Al inicio de esta parte memorizaste cuatro palabras. ¿Cuál es el grupo exacto?",
    "memoryRecall",
    "🗝️",
    "Selecciona las cuatro palabras que aparecieron juntas.",
    "task",
    [
      "NUBE · PAN · RELOJ · FLOR",
      "NUBE · PAN · RELOJ · LUNA",
      "NUBE · LIBRO · RELOJ · FLOR",
      "PAN · RELOJ · FLOR · ROSA"
    ],
    "NUBE · PAN · RELOJ · FLOR"
  ]
];

/* =========================================================
   3. INICIALIZAR FIREBASE
========================================================= */

async function initializeFirebase() {
  try {
    const response = await fetch("/firebase-config.js", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No se pudo obtener la configuración de Firebase.");
    }

    const configText = await response.text();
    const match = configText.match(
      /window\.FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\});/
    );

    const config = match ? JSON.parse(match[1]) : {};

    if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
      throw new Error("La configuración pública de Firebase está incompleta.");
    }

    const firebaseApp = initializeApp(config);
    auth = getAuth(firebaseApp);
    console.info("[NeuroEval Pro] Google redirect diagnostic build 20261107-6");

    // Diagnóstico temporal: registra únicamente estados, nunca tokens ni datos personales.
    try {
      const redirectResult = await getRedirectResult(auth);
      console.info("[NeuroEval Pro][Google redirect result]", {
        resultReceived: Boolean(redirectResult),
        resultHasUser: Boolean(redirectResult?.user),
        authCurrentUserPresent: Boolean(auth.currentUser),
        providerId: redirectResult?.providerId || null
      });
    } catch (error) {
      console.error("[NeuroEval Pro][Google redirect result]", {
        code: error?.code || "sin-codigo",
        message: error?.message || "Sin mensaje"
      });
      showMessage(
        "auth-message",
        `No se pudo completar el acceso con Google. Código: ${error?.code || "sin-codigo"}. Detalle: ${error?.message || "Sin detalles"}`,
        true
      );
    }

    registerEventListeners();

    onAuthStateChanged(auth, (user) => {
      console.info("[NeuroEval Pro][Auth state observer]", {
        userPresent: Boolean(user),
        authCurrentUserPresent: Boolean(auth.currentUser),
        emailVerified: user ? Boolean(user.emailVerified) : null,
        providerIds: user?.providerData?.map((provider) => provider.providerId) || []
      });
      handleAuthState(user);
    });

  } catch (error) {
    console.error("Firebase:", error);
    showMessage("auth-message", error.message, true);
  }
}

/* =========================================================
   4. UTILIDADES GENERALES
========================================================= */

function show(viewId) {
  const views = [
    "auth-view",
    "forgot-view",
    "dashboard-view",
    "games-view",
    "activities-view",
    "recommendations-view",
    "progress-view",
    "profile-view",
    "settings-view",
    "quiz-view",
    "payment-view",
    "result-view",
    "admin-view",
    "parent-intro-view"
  ];

  views.forEach((id) => {
    const element = $(id);
    if (element) {
      element.classList.toggle("hidden", id !== viewId);
    }
  });

  const nav = $("app-nav");
  if (nav) {
    const navViews = ["dashboard-view","games-view","activities-view","recommendations-view","progress-view","profile-view","settings-view"];
    nav.classList.toggle("hidden", !currentUser || !navViews.includes(viewId));
  }
  const adminShortcut = $("menu-admin");
  if (adminShortcut) adminShortcut.classList.toggle("hidden", !currentUser || !currentIsAdmin);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showMessage(id, text, isError = false) {
  const element = $(id);
  if (!element) return;

  element.textContent = text || "";
  element.classList.toggle("error", Boolean(isError));
}

function friendlyAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/invalid-email": "El correo electrónico no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No encontramos una cuenta con ese correo.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/network-request-failed": "No se pudo conectar. Verifica tu internet.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento."
  };

  return messages[error.code] || error.message || "No se pudo completar la operación.";
}

async function api(url, options = {}) {
  const token = currentUser ? await currentUser.getIdToken() : null;

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // Respuesta sin JSON.
    }

    throw new Error(data.error || `Error del servidor (${response.status}).`);
  }

  return response;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* =========================================================
   5. PESTAÑAS DE ACCESO
========================================================= */

function switchAuth(mode) {
  $("login-form").classList.toggle("hidden", mode !== "login");
  $("register-form").classList.toggle("hidden", mode !== "register");

  $("show-login").classList.toggle("active", mode === "login");
  $("show-register").classList.toggle("active", mode === "register");

  showMessage("auth-message", "");
}

/* =========================================================
   6. REGISTRO E INICIO DE SESIÓN
========================================================= */

async function loginWithEmail(event) {
  event.preventDefault();

  const email = $("login-email").value.trim().toLowerCase();
  const password = $("login-password").value;

  try {
    showMessage("auth-message", "Validando acceso...");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showMessage("auth-message", friendlyAuthError(error), true);
  }
}

async function registerWithEmail(event) {
  event.preventDefault();

  const name = $("reg-name").value.trim();
  const email = $("reg-email").value.trim().toLowerCase();
  const password = $("reg-password").value;
  const age = Number($("reg-age").value);
  const goal = $("reg-goal").value;

  try {
    if (name.length < 2) {
      throw new Error("Escribe tu nombre completo.");
    }

    if (age < 18 || age > 99) {
      throw new Error("La edad debe estar entre 18 y 99 años.");
    }

    if (password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }

    if (!goal) {
      throw new Error("Selecciona el objetivo de tu evaluación.");
    }

    if (!$("consent").checked) {
      throw new Error("Debes aceptar el aviso de privacidad.");
    }

    if (email === ADMIN_EMAIL) {
      throw new Error("Este correo está reservado para administración.");
    }

    showMessage("auth-message", "Creando tu cuenta...");

    profileData = { name, age, goal };

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    currentUser = credential.user;

    await api("/api/profile", {
      method: "POST",
      body: JSON.stringify({ name, age, goal })
    });

    // La pantalla de evaluación se inicia desde el observador de sesión.
  } catch (error) {
    showMessage("auth-message", friendlyAuthError(error), true);
  }
}

async function loginWithGoogle() {
  try {
    showMessage("auth-message", "Conectando con Google...");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    showMessage("auth-message", "Redirigiendo a Google para completar el acceso...");
    await signInWithRedirect(auth, provider);
  } catch (error) {
    // Diagnóstico temporal para identificar fallos de OAuth en staging.
    console.error("[NeuroEval Pro][Google sign-in]", {
      code: error?.code || "sin-codigo",
      message: error?.message || "Sin mensaje",
      name: error?.name || "Error"
    });

    const code = error?.code || "sin-codigo";
    const detail = error?.message || "Firebase no proporcionó detalles adicionales.";
    showMessage(
      "auth-message",
      `No se pudo iniciar sesión con Google. Código: ${code}. Detalle: ${detail}`,
      true
    );
  }
}

/* =========================================================
   7. OBSERVADOR DE SESIÓN
========================================================= */

async function handleAuthState(user) {
  if (isHandlingAuth) return;
  isHandlingAuth = true;

  currentUser = user;
  currentIsAdmin = false;
  currentIsPrimaryAdmin = false;
  currentAdminPermissions = [];

  try {
    if (!user) {
      $("account-menu").classList.add("hidden");
      $("account-menu-toggle").setAttribute("aria-expanded", "false");
      $("account-menu-toggle").classList.add("hidden");
      stopPaymentPolling();
      lastEvaluationId = null;
      paymentReference = null;
      profileData = null;

      $("session-label").textContent = "";
      show("auth-view");
      isHandlingAuth = false;
      return;
    }

    $("session-label").textContent = user.email || "";
    $("account-menu-toggle").classList.remove("hidden");
    $("account-name").textContent = profileData?.name || user.displayName || user.email || "Mi cuenta";
    $("account-menu-name").textContent = profileData?.name || user.displayName || "Mi cuenta";
    $("account-email").textContent = user.email || "";

    // El servidor es la fuente de verdad del rol. Esto permite reconocer
    // la cuenta administradora incluso si nunca creó un perfil de evaluación.
    const sessionResponse = await api("/api/session");
    const sessionData = await sessionResponse.json();
    currentIsAdmin = sessionData.isAdmin === true;
    currentIsPrimaryAdmin = sessionData.isPrimaryAdmin === true;
    const backupExportButton = $("admin-backup-export");
    if (backupExportButton) backupExportButton.hidden = !currentIsPrimaryAdmin;
    currentAdminPermissions = Array.isArray(sessionData.permissions)
      ? sessionData.permissions
      : [];

    if (currentIsAdmin) {
      $("account-name").textContent = user.displayName || user.email || "Administración";
      $("account-menu-name").textContent = user.displayName || "Administración";
      $("account-email").textContent = user.email || "";
      show("admin-view");
      await loadAdmin();
      isHandlingAuth = false;
      return;
    }

    const profileResponse = await api("/api/profile");
    const data = await profileResponse.json();

    const savedProfile = data.profile || null;

    if (profileData) {
      // El registro acaba de crear el perfil en esta sesión.
    } else if (savedProfile) {
      profileData = {
        name: savedProfile.name || user.displayName || user.email,
        age: savedProfile.age ?? null,
        goal: savedProfile.goal || "Autoconocimiento"
      };
    } else {
      profileData = {
        name: user.displayName || user.email,
        age: null,
        goal: "Autoconocimiento"
      };

      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify(profileData)
      });
    }

    // Si la pasarela devolvió al usuario a la plataforma, consultar primero
    // si existe una evaluación pendiente de pago.
    const params = new URLSearchParams(window.location.search);
    const evaluationIdFromUrl = params.get("evaluation");

    if (evaluationIdFromUrl) {
      // Consumir el parámetro de retorno una sola vez. Evita que una sesión
      // posterior, incluso de otra cuenta en el mismo navegador, herede una
      // evaluación anterior.
      lastEvaluationId = evaluationIdFromUrl;
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("evaluation");
      window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
      );
      await showPaymentForExistingEvaluation();
    } else {
      // El usuario siempre llega primero al panel y elige qué evaluación iniciar.
      $("account-name").textContent = profileData.name || user.displayName || user.email;
      $("account-menu-name").textContent = profileData.name || user.displayName || "Mi cuenta";
      $("account-email").textContent = user.email || "";
      showDashboard(profileData.name);
    }

  } catch (error) {
    console.error("Error de sesión:", error);
    show("auth-view");
    showMessage("auth-message", error.message || "No se pudo validar la sesión.", true);
  } finally {
    isHandlingAuth = false;
  }
}

/* =========================================================
   8. PANEL PRINCIPAL Y CATÁLOGO DE EVALUACIONES
========================================================= */

function showDashboard(name) {
  document.querySelectorAll("[data-nav]").forEach(button => button.classList.toggle("active", button.dataset.nav === "tests"));
  const displayName = (name || "bienvenido").trim();
  $("dashboard-greeting").textContent = displayName
    ? `Hola, ${displayName}`
    : "Bienvenido a NeuroEval Pro";
  show("dashboard-view");
  loadCustomerSupportTickets();
}

function showAdmin() {
  if (!currentUser || !currentIsAdmin) {
    showMessage("auth-message", "Esta sección requiere permisos administrativos.", true);
    return show("auth-view");
  }
  closeAccountMenu();
  show("admin-view");
  loadAdmin();
}

function hasAdminPermission(permission) {
  return currentIsPrimaryAdmin || currentAdminPermissions.includes(permission);
}

function setAdminTab(tab) {
  const visibility = {
    overview: hasAdminPermission("dashboard.view"),
    clients: hasAdminPermission("clients.view"),
    evaluations: hasAdminPermission("evaluations.view"),
    payments: hasAdminPermission("payments.view"),
    analytics: hasAdminPermission("payments.view"),
    pricing: hasAdminPermission("pricing.manage"),
    settings: hasAdminPermission("settings.view"),
    health: hasAdminPermission("settings.view"),
    administrators: currentIsPrimaryAdmin,
    audit: hasAdminPermission("audit.view"),
    support: hasAdminPermission("support.view")
  };
  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    button.classList.toggle("hidden", !visibility[button.dataset.adminTab]);
  });
  const allowed = Object.keys(visibility).filter(key => visibility[key]);
  const selected = allowed.includes(tab) ? tab : (allowed[0] || "overview");
  document.querySelectorAll(".admin-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== "admin-panel-" + selected));
  document.querySelectorAll("[data-admin-tab]").forEach(button => {
    const active = button.dataset.adminTab === selected;
    button.classList.toggle("primary", active);
    button.classList.toggle("outline", !active);
    button.setAttribute("aria-selected", String(active));
  });
  if (selected === "analytics") loadAdminCommercialAnalytics();
  if (selected === "pricing") loadAdminPricing();
  if (selected === "administrators") loadAdminAdministrators();
  if (selected === "audit") loadAdminAudit();
  if (selected === "settings") loadAdminHealth();
  if (selected === "health") loadAdminHealthDetails();
  if (selected === "support") loadAdminSupportTickets();
}

function showProfile() {
  if (!currentUser) return show("auth-view");
  $("profile-name").textContent = profileData?.name || currentUser.displayName || "No registrado";
  $("profile-email").textContent = currentUser.email || "No disponible";
  $("profile-age").textContent = profileData?.age == null ? "No registrada" : String(profileData.age) + " años";
  $("profile-goal").textContent = profileData?.goal || "Autoconocimiento";
  closeAccountMenu();
  show("profile-view");
}

function showSettings() {
  if (!currentUser) return show("auth-view");
  $("settings-email").textContent = currentUser.email || "No disponible";
  closeAccountMenu();
  show("settings-view");
}

function closeAccountMenu() {
  $("account-menu").classList.add("hidden");
  $("account-menu-toggle").setAttribute("aria-expanded", "false");
}

function toggleAccountMenu() {
  const menu = $("account-menu");
  const willOpen = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !willOpen);
  $("account-menu-toggle").setAttribute("aria-expanded", String(willOpen));
}

const parentFrequencyChoices = ["Nunca", "Algunas veces", "A menudo", "Muy a menudo"];
const parentQuestionBank = [
["Atención","¿Comete errores por descuido en tareas, deberes o actividades que sabe realizar?","inattention","🔎","Por ejemplo, omite partes de una instrucción o no revisa lo que hizo."],
["Atención","¿Le cuesta mantener la atención durante juegos, lecturas, conversaciones o tareas apropiadas para su edad?","inattention","📚","Piensa en actividades que normalmente disfruta y requieren continuidad."],
["Atención","¿Parece no escuchar cuando un adulto le habla directamente, aunque no haya una distracción evidente?","inattention","👂","Por ejemplo, hay que repetirle varias veces una indicación sencilla."],
["Atención","¿Empieza instrucciones o tareas, pero deja pasos sin completar aunque haya entendido qué debe hacer?","inattention","🧩","Considera rutinas, deberes y pequeñas responsabilidades."],
["Atención","¿Tiene dificultad para organizar sus tareas, materiales o actividades diarias?","inattention","📋","Por ejemplo, no sabe por dónde empezar o pierde el orden de los pasos."],
["Atención","¿Evita o demora actividades que requieren concentración sostenida?","inattention","📖","Por ejemplo, deberes, lectura o tareas que exigen esfuerzo mental continuo."],
["Atención","¿Pierde con frecuencia objetos necesarios para sus actividades?","inattention","🎒","Por ejemplo, útiles escolares, juguetes, libros, prendas o materiales."],
["Atención","¿Se distrae fácilmente con ruidos, movimientos, conversaciones u otros estímulos del entorno?","inattention","🔔","Observa si le cuesta retomar lo que estaba haciendo."],
["Atención","¿Olvida con frecuencia actividades o responsabilidades habituales para su edad?","inattention","🗓️","Por ejemplo, llevar materiales, terminar una rutina o recordar una indicación."],
["Actividad e inquietud","¿Mueve constantemente manos o pies, se retuerce en la silla o cambia de postura cuando se espera que permanezca sentado?","hyperactivity","🪑","Ten en cuenta lo esperable para su edad y la situación."],
["Actividad e inquietud","¿Se levanta de su asiento en momentos en los que normalmente se espera que permanezca sentado?","hyperactivity","🚶","Por ejemplo, durante comidas, clase o actividades tranquilas."],
["Actividad e inquietud","¿Corre, trepa o se mueve en situaciones en las que no resulta apropiado?","hyperactivity","🏃","En adolescentes puede manifestarse como inquietud interna."],
["Actividad e inquietud","¿Le cuesta jugar o realizar actividades tranquilas sin hacer mucho ruido o movimiento?","hyperactivity","🎲","Compara con otros niños de edad y contexto similares."],
["Actividad e inquietud","¿Parece estar constantemente en movimiento, como si le costara bajar el ritmo?","hyperactivity","⚡","Observa si ocurre incluso cuando la actividad requiere calma."],
["Actividad e inquietud","¿Habla mucho más de lo esperado para la situación y le cuesta detenerse?","hyperactivity","💬","Considera conversaciones, clase y reuniones familiares."],
["Impulsividad","¿Responde antes de que terminen de hacerle una pregunta o interrumpe para contestar?","impulsivity","🙋","Observa si puede esperar a escuchar la pregunta completa."],
["Impulsividad","¿Le cuesta esperar su turno en juegos, filas o conversaciones?","impulsivity","⏳","Piensa en situaciones cotidianas repetidas."],
["Impulsividad","¿Interrumpe conversaciones, juegos o actividades de otras personas sin advertirlo?","impulsivity","🗣️","Por ejemplo, se incorpora a una actividad o toma la palabra repentinamente."],
["Contexto","¿Las conductas que has señalado se presentan desde hace aproximadamente seis meses o más?","context","📆","Si comenzaron hace poco, anota cuándo aparecieron."],
["Contexto","¿Recuerdas que algunas de estas conductas ya estaban presentes en etapas anteriores de su desarrollo?","context","🧒","Piensa en informes escolares, recuerdos familiares o comentarios docentes."],
["Contexto","¿Has observado estas conductas en al menos dos entornos, como casa y colegio?","context","🏠","También pueden ser actividades extracurriculares u otros espacios."],
["Impacto cotidiano","¿Estas conductas afectan de forma clara su aprendizaje, convivencia, amistades o rutinas?","impact","🎯","Describe consecuencias concretas, no solo que el comportamiento resulte molesto."],
["Contexto","¿Un docente u otro cuidador ha expresado preocupaciones similares?","context","👥","Si es posible, contrasta lo observado con alguien que lo conozca en otro entorno."],
["Factores adicionales","¿Hay factores recientes que podrían influir, como cambios familiares, sueño insuficiente, estrés, dificultades de aprendizaje o problemas de salud?","context","🌙","No atribuyas automáticamente estas conductas al TDAH."]
];

function openParentEvaluation() {
  if (!currentUser) return show("auth-view");
  $("parent-observer-name").value = profileData?.name || currentUser.displayName || "";
  $("parent-child-age").value = "";
  $("parent-relationship").value = "";
  $("parent-setting-home").checked = true;
  $("parent-setting-school").checked = false;
  $("parent-setting-social").checked = false;
  $("parent-guardian-consent").checked = false;
  showMessage("parent-intro-message", "");
  show("parent-intro-view");
}

function startParentEvaluation(event) {
  event.preventDefault();
  const childAge = Number($("parent-child-age").value);
  const relationship = $("parent-relationship").value;
  const settings = [
    $("parent-setting-home").checked ? "casa" : null,
    $("parent-setting-school").checked ? "colegio" : null,
    $("parent-setting-social").checked ? "social" : null
  ].filter(Boolean);
  if (!Number.isInteger(childAge) || childAge < 4 || childAge > 17) {
    return showMessage("parent-intro-message", "Esta orientación está diseñada para edades de 4 a 17 años.", true);
  }
  if (!relationship || !settings.length) {
    return showMessage("parent-intro-message", "Indica tu parentesco y al menos un entorno de observación.", true);
  }
  if (!$("parent-guardian-consent").checked) {
    return showMessage("parent-intro-message", "Confirma que tienes autorización para proporcionar esta información.", true);
  }
  currentEvaluationType = "parent_observation";
  parentEvaluationContext = { childAge, relationship, settings, consent: true };
  profileData = { ...(profileData || {}), name: profileData?.name || currentUser.displayName || currentUser.email, goal: "Observación familiar de indicadores asociados al TDAH" };
  questions = parentQuestionBank.map(([category, question, dimension, icon, example]) => {
    const ageExample = childAge <= 7
      ? example + " Considera juegos, cuentos y rutinas breves propias de su edad."
      : childAge <= 12
        ? example + " Considera deberes, actividades escolares y rutinas en casa."
        : example + " Considera responsabilidades, actividades académicas y relaciones propias de la adolescencia.";
    return [category, question, dimension, icon, ageExample, "frequency"];
  });
  activeChoices = parentFrequencyChoices;
  answers = new Array(questions.length).fill(null);
  currentIndex = 0;
  renderQuestion();
  const quizIntro = $("quiz-view").querySelector(".hero-copy");
  if (quizIntro) { quizIntro.querySelector(".eyebrow").textContent = "Observación familiar · 24 preguntas"; quizIntro.querySelector("p").textContent = "Responde según las conductas que has observado en el menor durante los últimos seis meses. Elige la frecuencia que mejor describa lo que ocurre."; }
  show("quiz-view");
}

function startAdhdEvaluation() {
  if (!currentUser) {
    show("auth-view");
    showMessage("auth-message", "Inicia sesión para comenzar una evaluación.", true);
    return;
  }

  startQuiz(
    profileData?.name || currentUser.displayName || currentUser.email,
    profileData?.age ?? null,
    profileData?.goal || "Autoconocimiento"
  );
}


/* =========================================================
   8. JUEGOS Y ACTIVIDADES GRATUITAS
========================================================= */

function progressKey() {
  return currentUser?.uid ? `neuroeval-progress-${currentUser.uid}` : "neuroeval-progress-guest";
}

function readProgress() {
  try {
    const data = JSON.parse(localStorage.getItem(progressKey()) || '{"games":[],"activities":[],"history":[]}');
    data.games ||= []; data.activities ||= []; data.history ||= []; data.gameLevels ||= {};
    return data;
  } catch (_) { return { games: [], activities: [], history: [], gameLevels: {} }; }
}

function saveProgress(data) {
  try { localStorage.setItem(progressKey(), JSON.stringify(data)); } catch (error) { console.warn("No se pudo guardar el progreso local.", error); }
}

function recordGame(name, score, detail, gameId, level) {
  const data = readProgress();
  data.games.push({ name, score, detail, date: new Date().toISOString(), gameId, level });
  if (gameId && level) data.gameLevels[gameId] = Math.max(Number(data.gameLevels[gameId] || 0), level);
  data.history.unshift({ type: "Juego", name, detail: `${score}% · ${detail}`, date: new Date().toISOString() });
  data.history = data.history.slice(0, 12);
  saveProgress(data);
  renderProgress();
}

function renderProgress() {
  const data = readProgress();
  const games = data.games || [];
  const activities = data.activities || [];
  $("progress-games").textContent = games.length;
  $("progress-activities").textContent = activities.length;
  $("progress-best").textContent = `${games.length ? Math.max(...games.map(item => Number(item.score) || 0)) : 0}%`;
  const levels = Object.values(data.gameLevels || {}).reduce((sum,value) => sum + Number(value || 0), 0);
  const levelSummary = $("games-level-summary");
  if (levelSummary) levelSummary.textContent = levels + " niveles";
  const history = $("progress-history");
  history.innerHTML = "";
  if (!(data.history || []).length) { history.textContent = "Aún no hay actividades registradas. ¡Prueba tu primer juego!"; return; }
  data.history.forEach(item => {
    const row = document.createElement("div"); row.className = "profile-row";
    const label = document.createElement("span"); label.textContent = `${item.type}: ${item.name}`;
    const detail = document.createElement("strong"); detail.textContent = item.detail;
    row.append(label, detail); history.appendChild(row);
  });
}

function gameLevel(game) {
  const data = readProgress();
  return Math.max(1, Number(data.gameLevels?.[game] || 0) + 1);
}

function gameButton(label, onClick, className = "game-choice") {
  const button = document.createElement("button");
  button.type = "button"; button.className = className; button.textContent = label;
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

function openGame(game) {
  const games = {
    memory:["Secuencia relámpago","Memoria de trabajo"], search:["Cazador de símbolos","Atención selectiva"],
    pattern:["Completa el patrón","Razonamiento abstracto"], math:["Mente veloz","Cálculo mental"],
    words:["Archivo de palabras","Memoria verbal"], odd:["El intruso","Discriminación visual"],
    stroop:["Color bajo presión","Control inhibitorio"], spatial:["Giro mental","Orientación espacial"],
    reaction:["Reflejos","Velocidad de reacción"], logic:["Código secreto","Lógica deductiva"],
    count:["Cuenta y encuentra","Atención y conteo"], dual:["Doble misión","Atención dividida"]
  };
  if (!games[game]) return;
  const stage=$("game-stage"); let timer=null, active=true, level=gameLevel(game);
  stage.classList.remove("hidden"); stage.innerHTML="";
  const heading=document.createElement("div"); heading.className="flex flex-wrap items-center justify-between gap-3";
  const title=document.createElement("h3"); title.className="text-xl font-extrabold"; title.textContent=games[game][0];
  const badge=document.createElement("span"); badge.className="pill";
  const intro=document.createElement("p"); intro.className="muted-text mt-2";
  const meter=document.createElement("div"); meter.className="progress-wrap mt-4";
  const fill=document.createElement("div"); fill.className="progress-fill"; meter.appendChild(fill);
  const content=document.createElement("div"); content.className="mt-5";
  const feedback=document.createElement("p"); feedback.className="message mt-4"; feedback.setAttribute("aria-live","polite");
  const controls=document.createElement("div"); controls.className="flex flex-wrap gap-3 mt-4";
  const close=gameButton("Cerrar juego",()=>{active=false;if(timer){clearTimeout(timer);clearInterval(timer);}stage.classList.add("hidden");},"btn outline mt-4");
  heading.append(title,badge); stage.append(heading,intro,meter,content,feedback,controls,close);

  function clearClock(){if(timer){clearTimeout(timer);clearInterval(timer);timer=null;}}
  function updateLevel(){badge.textContent="Nivel "+level+" · "+games[game][1];fill.style.width=Math.min(100,25+level*3)+"%";}
  function nextLevel(){if(!active)return;level++;renderChallenge();}
  function finish(ok,score,detail){
    if(!active)return;clearClock();
    content.querySelectorAll("button,input").forEach(el=>el.disabled=true);
    controls.innerHTML="";
    if(ok){
      recordGame(games[game][0],score,"Nivel "+level+" · "+detail,game,level);
      feedback.textContent="¡Nivel "+level+" superado! "+detail+" · "+score+"%";
      controls.appendChild(gameButton("Continuar al nivel "+(level+1)+" →",nextLevel,"btn primary"));
    }else{
      feedback.textContent="No se superó el nivel "+level+". "+detail;
      controls.appendChild(gameButton("Intentar de nuevo",renderChallenge,"btn primary"));
    }
  }
  function choices(options,correct,explain,seconds){
    const grid=document.createElement("div");grid.className="game-choice-grid";let answered=false;
    options.forEach(value=>grid.appendChild(gameButton(String(value),()=>{
      if(answered)return;answered=true;const ok=String(value)===String(correct);
      finish(ok,ok?100:0,ok?explain:"La respuesta correcta era "+correct+".");
    })));
    content.appendChild(grid);
    if(seconds){
      const clock=document.createElement("p");clock.className="muted-text mt-3";let left=seconds;
      clock.textContent="Tiempo: "+left+" s";content.appendChild(clock);
      timer=window.setInterval(()=>{left--;clock.textContent="Tiempo: "+left+" s";if(left<=0&&!answered){answered=true;finish(false,0,"Se agotó el tiempo.");}},1000);
    }
  }
  function renderChallenge(){
    if(!active)return;clearClock();updateLevel();content.innerHTML="";controls.innerHTML="";feedback.textContent="";
    if(game==="memory"){
      const len=Math.min(3+Math.floor((level-1)/2),24),seq=Array.from({length:len},()=>Math.floor(Math.random()*10));
      const display=document.createElement("div");display.className="game-sequence";display.textContent=seq.join(" · ");
      intro.textContent="Memoriza los "+len+" dígitos. Luego escríbelos en el mismo orden.";content.appendChild(display);
      const begin=gameButton("Estoy listo",()=>{
        begin.disabled=true;feedback.textContent="Observa y memoriza…";
        timer=window.setTimeout(()=>{
          if(!active)return;display.textContent="●  ●  ●  ●  ●";
          const form=document.createElement("form");form.className="max-w-sm mx-auto";
          const input=document.createElement("input");input.className="field text-center";input.inputMode="numeric";input.maxLength=len;input.placeholder="Escribe "+len+" dígitos";input.required=true;
          const submit=gameButton("Comprobar",null,"btn primary mt-3");submit.type="submit";form.append(input,submit);content.appendChild(form);
          form.addEventListener("submit",e=>{e.preventDefault();const answer=input.value.replace(/\D/g,"").split("").map(Number);const hit=answer.filter((v,i)=>v===seq[i]).length;finish(hit===len,Math.round(hit/len*100),hit+" de "+len+" posiciones correctas.");});
        },Math.max(900,3200-level*130));
      },"btn primary");content.appendChild(begin);
    }
    if(game==="search"||game==="count"){
      const target=game==="search"?"★":"●",total=Math.min(18+level*2,100),amount=Math.min(3+Math.floor(level/2),Math.floor(total/3));
      const symbols=Array.from({length:total},()=>"▲");const positions=new Set();
      while(positions.size<amount)positions.add(Math.floor(Math.random()*total));positions.forEach(i=>symbols[i]=target);
      const grid=document.createElement("div");grid.className="game-symbol-grid";
      if(game==="search"){
        let found=0,mistakes=0,ended=false;intro.textContent="Encuentra las "+amount+" estrellas. Hay más distractores y menos tiempo en cada nivel.";
        symbols.forEach(symbol=>{let b; b=gameButton(symbol,()=>{if(ended||b.disabled)return;b.disabled=true;if(symbol===target){found++;b.classList.add("selected");}else{mistakes++;b.style.opacity=".35";}
          feedback.textContent="Encontradas: "+found+"/"+amount+" · Errores: "+mistakes;
          if(found===amount){ended=true;finish(true,Math.max(0,100-mistakes*8),found+" objetivos encontrados con "+mistakes+" errores.");}
        },"game-symbol");grid.appendChild(b);});
        content.appendChild(grid);let left=Math.max(7,22-Math.floor(level*.7));const clock=document.createElement("p");clock.className="muted-text mt-3";clock.textContent="Tiempo: "+left+" s";content.appendChild(clock);
        timer=window.setInterval(()=>{left--;clock.textContent="Tiempo: "+left+" s";if(left<=0&&!ended){ended=true;finish(false,0,"Encontraste "+found+" de "+amount+".");}},1000);
      }else{
        intro.textContent="Cuenta los círculos negros entre "+total+" figuras.";symbols.forEach(symbol=>{const cell=document.createElement("div");cell.className="game-symbol";cell.textContent=symbol;grid.appendChild(cell);});
        content.appendChild(grid);choices([amount,amount+1,Math.max(1,amount-1),amount+2].sort(()=>Math.random()-.5),amount,"Contaste "+amount+" círculos.");
      }
    }
    if(game==="pattern"){
      const first=level+2,step=level+2,seq=[first,first+step,first+2*step,first+3*step],answer=first+4*step;
      const box=document.createElement("div");box.className="game-sequence";box.textContent=seq.join(" · ")+" · ?";intro.textContent="Descubre la regla y elige el siguiente número.";content.appendChild(box);
      choices([answer,answer+step,answer-2,answer+2*step].sort(()=>Math.random()-.5),answer,"La secuencia aumenta de "+step+" en "+step+".");
    }
    if(game==="math"){
      const x=2+Math.floor(Math.random()*(10+level*4)),y=2+Math.floor(Math.random()*Math.max(5,level*3));
      const mul=level>=4&&Math.random()>.45,sub=!mul&&level>=2&&Math.random()>.5;
      const answer=mul?x*y:sub?x:x+y,question=mul?x+" × "+y:sub?(x+y)+" − "+y:x+" + "+y;
      const box=document.createElement("div");box.className="game-sequence";box.textContent=question+" = ?";
      intro.textContent="Resuelve mentalmente antes de que termine el tiempo.";content.appendChild(box);
      choices([answer,answer+2,Math.max(0,answer-3),answer+5].sort(()=>Math.random()-.5),answer,"¡Cálculo correcto!",Math.max(5,15-Math.floor(level/2)));
    }
    if(game==="words"){
      const bank=["NUBE","LÁPIZ","RÍO","TAZA","LUNA","FLOR","RELOJ","PAN","LLAVE","MONTAÑA","LIBRO","VENTANA","CAMINO","NARANJA","ESTRELLA","JARDÍN","MÚSICA","TREN"];
      const len=Math.min(3+Math.floor(level/2),16),selected=bank.slice().sort(()=>Math.random()-.5).slice(0,len);
      const display=document.createElement("div");display.className="game-sequence";display.textContent=selected.join(" · ");intro.textContent="Memoriza estas "+len+" palabras y después reconoce una.";content.appendChild(display);
      content.appendChild(gameButton("Ocultar y jugar",()=>{
        const correct=selected[Math.floor(Math.random()*selected.length)],decoys=bank.filter(w=>!selected.includes(w)).sort(()=>Math.random()-.5).slice(0,3);
        display.textContent="¿Qué palabra estaba en la lista?";content.querySelectorAll("button").forEach(b=>b.remove());
        const grid=document.createElement("div");grid.className="game-choice-grid";
        [...decoys,correct].sort(()=>Math.random()-.5).forEach(word=>grid.appendChild(gameButton(word,()=>finish(word===correct,word===correct?100:0,word===correct?"Reconociste una palabra.":"La palabra correcta era "+correct+"."))));
        content.appendChild(grid);
      },"btn primary"));
    }
    if(game==="odd"){
      const total=Math.min(12+level,80),odd=level<4?"◆":level<8?"◉":level<12?"◎":"◌",index=Math.floor(Math.random()*total),grid=document.createElement("div");grid.className="game-symbol-grid";
      intro.textContent="Toca el único símbolo diferente. Los distractores se parecen cada vez más.";
      for(let i=0;i<total;i++){const symbol=i===index?odd:"●";grid.appendChild(gameButton(symbol,()=>finish(i===index,i===index?100:0,i===index?"¡Detectaste el intruso!":"Ese no era el símbolo diferente."),"game-symbol"));}
      content.appendChild(grid);
    }
    if(game==="stroop"){
      const colors=[["ROJO","#dc2626"],["AZUL","#2563eb"],["VERDE","#16a34a"],["MORADO","#9333ea"],["NARANJA","#ea580c"]];
      const word=colors[Math.floor(Math.random()*colors.length)];let ink=colors[Math.floor(Math.random()*colors.length)];
      if(level>1&&ink[0]===word[0])ink=colors[(colors.indexOf(ink)+1)%colors.length];
      const label=document.createElement("div");label.className="game-sequence";label.textContent=word[0];label.style.color=ink[1];label.style.fontWeight="900";
      intro.textContent="Ignora la palabra. Selecciona el COLOR DE LA TINTA.";content.appendChild(label);
      const grid=document.createElement("div");grid.className="game-choice-grid";colors.slice().sort(()=>Math.random()-.5).forEach(c=>grid.appendChild(gameButton(c[0],()=>finish(c[0]===ink[0],c[0]===ink[0]?100:0,c[0]===ink[0]?"¡Controlaste la distracción!":"La tinta era "+ink[0]+"."))));
      content.appendChild(grid);
    }
    if(game==="spatial"){
      const arrows=["↑","→","↓","←"],start=Math.floor(Math.random()*4),turns=1+Math.floor(Math.random()*Math.min(level+1,30)),answer=arrows[(start+turns)%4];
      const box=document.createElement("div");box.className="game-sequence";box.textContent=arrows[start]+" ↻ "+turns+" giros";
      intro.textContent="Imagina que la flecha gira 90° a la derecha en cada giro. ¿Hacia dónde apunta?";content.appendChild(box);
      choices(arrows.slice().sort(()=>Math.random()-.5),answer,"Después de "+turns+" giros apunta "+answer+".");
    }
    if(game==="reaction"){
      const signal=document.createElement("button");signal.type="button";signal.className="game-sequence w-full";signal.textContent="Espera la señal…";content.appendChild(signal);
      intro.textContent="Cuando el panel cambie a VERDE, pulsa lo más rápido posible. No te anticipes.";
      let ready=false,started=0;signal.addEventListener("click",()=>{
        if(!ready){finish(false,0,"Te anticipaste. Espera a que aparezca VERDE.");return;}
        const ms=Math.round(performance.now()-started),limit=Math.max(260,850-level*18);
        finish(ms<=limit,Math.max(0,Math.min(100,Math.round(limit/ms*100))),"Tu reacción: "+ms+" ms. Objetivo: "+limit+" ms o menos.");
      });
      timer=window.setTimeout(()=>{if(!active)return;ready=true;started=performance.now();signal.textContent="🟢 ¡AHORA!";signal.style.background="#dcfce7";signal.style.color="#166534";},1200+Math.random()*2600);
    }
    if(game==="logic"){
      const n=level+2,answer=n*n+(n+1)*(n+1),box=document.createElement("div");box.className="game-sequence";
      box.textContent="Si "+n+" → "+(n*n)+" y "+(n+1)+" → "+((n+1)*(n+1))+", suma los dos resultados.";
      intro.textContent="Usa las pistas para resolver el código lógico.";content.appendChild(box);
      choices([answer,answer+n,answer-2,answer+5].sort(()=>Math.random()-.5),answer,"¡Deducción correcta!");
    }
    if(game==="dual"){
      const starCount=3+Math.floor(Math.random()*Math.min(5+level,20)),triCount=2+Math.floor(Math.random()*Math.min(4+level,20));
      const all=[...Array.from({length:starCount},()=>"★"),...Array.from({length:triCount},()=>"▲")].sort(()=>Math.random()-.5);
      const box=document.createElement("div");box.className="game-sequence";box.textContent=all.join("  ");intro.textContent="Doble misión: cuenta las estrellas y los triángulos. Debes acertar ambas cantidades.";content.appendChild(box);
      const form=document.createElement("form");form.className="max-w-sm mx-auto grid grid-cols-2 gap-3";
      const a=document.createElement("input"),b=document.createElement("input");a.className=b.className="field";a.type=b.type="number";a.min=b.min="0";a.placeholder="Estrellas";b.placeholder="Triángulos";a.required=b.required=true;
      const submit=gameButton("Comprobar las dos",null,"btn primary col-span-2");submit.type="submit";form.append(a,b,submit);content.appendChild(form);
      form.addEventListener("submit",e=>{e.preventDefault();const ok=Number(a.value)===starCount&&Number(b.value)===triCount;finish(ok,ok?100:0,ok?"¡Atendiste a las dos reglas!":"Había "+starCount+" estrellas y "+triCount+" triángulos.");});
    }
  }
  renderChallenge();stage.scrollIntoView({behavior:"smooth",block:"start"});
}
function completeActivity(activity) {
  const labels = { breathing:"Respiración consciente", planning:"Divide una tarea", grounding:"Pausa de observación", focus:"Enfoque de 10 minutos", recall:"Recuerdo del día", movement:"Pausa de movimiento", reading:"Lectura con intención", organize:"Ordena tu espacio", countback:"Cuenta hacia atrás", priorities:"Plan de tres prioridades", listening:"Escucha atenta", journal:"Diario de bienestar" };
  const data = readProgress(); data.activities.push({ name: labels[activity] || activity, date: new Date().toISOString() });
  data.history.unshift({ type:"Actividad", name:labels[activity] || activity, detail:"Completada", date:new Date().toISOString() }); data.history = data.history.slice(0,12); saveProgress(data);
  showMessage("activity-message", "¡Bien hecho! Registramos esta actividad en tu progreso.");
}

function navigateSection(section) {
  document.querySelectorAll("[data-nav]").forEach(button => button.classList.toggle("active", button.dataset.nav === section));
  const views = { tests:"dashboard-view", games:"games-view", activities:"activities-view", recommendations:"recommendations-view", progress:"progress-view" };
  if (section === "progress" || section === "games") renderProgress();
  show(views[section] || "dashboard-view");
}

/* =========================================================
   8. RECUPERACIÓN DE CONTRASEÑA
========================================================= */

function resetPasswordRecoveryForm(email = "") {
  // Cada proceso comienza limpio: no reutilizar datos de otra cuenta
  // que haya utilizado este navegador o dispositivo.
  $("request-code-form").reset();
  $("confirm-reset-form").reset();
  $("reset-email").value = String(email || "").trim().toLowerCase();
  $("reset-code").value = "";
  $("reset-new-password").value = "";
  $("confirm-reset-form").classList.add("hidden");
  $("request-code-form").classList.remove("hidden");
  showMessage("reset-message", "");
}

function openForgotPassword(email = "") {
  resetPasswordRecoveryForm(email);
  show("forgot-view");
}

async function requestPasswordCode(event) {
  event.preventDefault();

  try {
    const email = $("reset-email").value.trim().toLowerCase();

    const response = await fetch("/api/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo solicitar el código.");
    }

    $("request-code-form").classList.add("hidden");
    $("confirm-reset-form").classList.remove("hidden");

    showMessage(
      "reset-message",
      "Si la cuenta existe, recibirás un código. Revisa también la carpeta de spam."
    );

  } catch (error) {
    showMessage("reset-message", error.message, true);
  }
}

async function confirmPasswordReset(event) {
  event.preventDefault();

  try {
    const email = $("reset-email").value.trim().toLowerCase();
    const code = $("reset-code").value.trim();
    const newPassword = $("reset-new-password").value;

    if (!/^\d{6}$/.test(code)) {
      throw new Error("El código debe tener seis dígitos.");
    }

    if (newPassword.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }

    const response = await fetch("/api/password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "No se pudo cambiar la contraseña.");
    }

    showMessage("reset-message", data.message || "Contraseña actualizada.");
    // Evitar que el código y la contraseña queden visibles o reutilizables
    // al iniciar una recuperación posterior desde el mismo dispositivo.
    $("reset-code").value = "";
    $("reset-new-password").value = "";
    $("confirm-reset-form").reset();
    $("confirm-reset-form").classList.add("hidden");

  } catch (error) {
    showMessage("reset-message", error.message, true);
  }
}

/* =========================================================
   9. INICIAR Y MOSTRAR EVALUACIÓN
========================================================= */

async function startQuiz(name, age, goal) {
  currentEvaluationType = "self_report";
  parentEvaluationContext = null;
  activeChoices = choices;
  profileData = { name, age, goal };
  // Orden temático fijo para que la experiencia tenga una progresión comprensible.
  questions = [...bank];
  answers = new Array(questions.length).fill(null);
  currentIndex = 0;
  renderQuestion();
  const quizIntro = $("quiz-view").querySelector(".hero-copy");
  if (quizIntro) { quizIntro.querySelector(".eyebrow").textContent = "Tu espacio de exploración"; quizIntro.querySelector("p").textContent = "Responde según tus propias experiencias de atención, organización e impulsividad. No hay respuestas buenas ni malas."; }
  show("quiz-view");
}

function renderQuestion() {
  const question = questions[currentIndex];
  const percentage = Math.round(((currentIndex + 1) / questions.length) * 100);
  const progress = (currentIndex + 1) / questions.length;

  $("progress-label").textContent = `Pregunta ${currentIndex + 1} de ${questions.length}`;
  $("progress-pct").textContent = `${percentage}%`;
  $("progress-bar").style.width = `${percentage}%`;
  $("q-category").textContent = question[0];
  $("q-text").textContent = question[1];
  $("q-visual").textContent = question[3] || "💭";
  $("q-example").textContent = question[4] || "Piensa en una situación habitual de tu vida cotidiana.";
  $("prev-question").disabled = currentIndex === 0;

  const encouragement = progress < 0.25
    ? "Tómate tu tiempo. Responde pensando en lo que suele ocurrirte, no en un día excepcional."
    : progress < 0.5
      ? "¡Vas muy bien! Sigue a tu ritmo; cada respuesta ayuda a construir una imagen más completa."
      : progress < 0.75
        ? "¡Ya superaste la mitad! Mantén la concentración: estás avanzando muy bien."
        : progress < 0.92
          ? "¡Último tramo! Ya falta poco. Respira y responde con tranquilidad."
          : "¡Casi terminamos! Una respuesta honesta es más útil que intentar elegir la respuesta perfecta.";
  $("quiz-encouragement").textContent = encouragement;

  const answersContainer = $("answers");
  answersContainer.innerHTML = "";
  const isInteractive = question[5] === "task" || question[5] === "study";
  const options = isInteractive ? question[6] : activeChoices;
  $("q-example").classList.toggle("memory-stimulus", question[5] === "study");
  if (question[5] === "study") {
    $("q-text").textContent = "Observa y memoriza estos elementos. No los anotes: te preguntaremos por ellos más adelante.";
    $("q-example").textContent = question[4];
  }
  options.forEach((label, index) => {
    const value = isInteractive ? label : index;
    const selected = answers[currentIndex] === value;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    if (selected) button.classList.add("selected");
    button.textContent = `${selected ? "✓  " : ""}${label}`;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      answers[currentIndex] = value;
      renderQuestion();
    });
    answersContainer.appendChild(button);
  });

  $("next-question").textContent = currentIndex === questions.length - 1
    ? "Finalizar evaluación"
    : "Siguiente →";
  $("next-question").disabled = answers[currentIndex] === null;
}

function previousQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

async function nextQuestion() {
  if (answers[currentIndex] === null) return;

  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
    return;
  }

  await finishEvaluation();
}

/* =========================================================
   10. CALCULAR Y GUARDAR RESPUESTAS
========================================================= */

function calculateEvaluation() {
  const qa = questions.map((question, index) => ({
    category: question[0],
    question: question[1],
    dimension: question[2],
    answer: question[5] === "task" || question[5] === "study" ? answers[index] : activeChoices[answers[index]]
  }));
  return { answers: qa, scores: {}, recommendations: [] };
}

async function finishEvaluation() {
  try {
    $("next-question").disabled = true;
    $("next-question").textContent = "Guardando respuestas...";

    const result = calculateEvaluation();

    currentScores = result.scores;
    currentRecommendations = result.recommendations;

    const payload = {
      name: profileData.name,
      email: currentUser.email,
      age: profileData.age,
      goal: profileData.goal,
      evaluationType: currentEvaluationType,
      parentContext: currentEvaluationType === "parent_observation" ? parentEvaluationContext : null,
      answers: result.answers,
      scores: result.scores,
      profile: result.profile,
      profileDescription: result.profileDescription,
      recommendations: result.recommendations
    };

    const response = await api("/api/evaluations", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    lastEvaluationId = data.id;
    paymentReference = data.reference || null;
    if ($("payment-price")) $("payment-price").textContent = "$" + Number(data.amountCop || 4000).toLocaleString("es-CO") + " COP";

    await showPaymentForExistingEvaluation();

  } catch (error) {
    console.error(error);
    alert("No se pudo guardar tu evaluación: " + error.message);
    $("next-question").disabled = false;
    $("next-question").textContent = "Finalizar evaluación";
  }
}

/* =========================================================
   11. PANTALLA DE PAGO WOMPI
========================================================= */

async function showPaymentForExistingEvaluation() {
  if (!lastEvaluationId) {
    throw new Error("No se encontró la evaluación que deseas consultar.");
  }

  stopPaymentPolling();

  show("payment-view");
  showMessage("payment-message", "Consultando el estado de tu evaluación...");

  try {
    const response = await api(
      `/api/my-evaluations/${encodeURIComponent(lastEvaluationId)}/payment-status`
    );

    const data = await response.json();

    if (data.paymentStatus === "paid") {
      showMessage("payment-message", "Pago confirmado. Preparando tu informe.");
      await loadOwnResult(lastEvaluationId);
      return;
    }

    paymentReference = data.reference || paymentReference;

    showMessage(
      "payment-message",
      "Completa el pago para desbloquear tu informe."
    );

    await createWompiCheckout();

  } catch (error) {
    // Un enlace de retorno de otra cuenta o una evaluación inexistente no
    // debe dejar al usuario atrapado en la pantalla de pago.
    if (/no encontramos esa evaluación/i.test(error.message || "")) {
      lastEvaluationId = null;
      paymentReference = null;
      showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email);
      alert("Este enlace de evaluación no pertenece a esta cuenta o ya no está disponible. Puedes iniciar una evaluación nueva desde tu panel.");
      return;
    }
    showMessage("payment-message", error.message, true);
  }
}

async function createWompiCheckout(promoCode = "") {
  const container = $("wompi-checkout");
  container.innerHTML = "";

  try {
    const response = await api("/api/payments/wompi-signature", {
      method: "POST",
      body: JSON.stringify({ evaluationId: lastEvaluationId, promoCode })
    });

    const data = await response.json();

    if (!data.publicKey || !data.signature || !data.reference) {
      throw new Error("El servidor no entregó los datos necesarios para Wompi.");
    }

    if (Number(data.amountInCents) !== Number(data.amountCop) * 100) {
      throw new Error("El valor de pago recibido no coincide con el precio configurado.");
    }
    const money = amount => "$" + Number(amount || 0).toLocaleString("es-CO") + " COP";
    $("payment-price").textContent = money(data.amountCop);
    $("payment-discount").textContent = Number(data.discountCop) > 0
      ? "Precio original: " + money(data.originalAmountCop) + " · Descuento " + (data.promoCode || "") + ": −" + money(data.discountCop)
      : "Pago único por informe";

    const script = document.createElement("script");

    script.src = "https://checkout.wompi.co/widget.js";
    script.async = true;

    script.setAttribute("data-render", "button");
    script.setAttribute("data-public-key", data.publicKey);
    script.setAttribute("data-currency", data.currency || "COP");
    script.setAttribute("data-amount-in-cents", String(data.amountInCents));
    script.setAttribute("data-reference", data.reference);
    script.setAttribute("data-signature:integrity", data.signature);

    if (data.redirectUrl) {
      script.setAttribute("data-redirect-url", data.redirectUrl);
    }

    script.onload = () => {
      showMessage(
        "payment-message",
        "Pasarela de pago cargada. Continúa con el botón de Wompi."
      );
    };

    script.onerror = () => {
      showMessage(
        "payment-message",
        "No se pudo cargar Wompi. Recarga la página o intenta más tarde.",
        true
      );
    };

    container.appendChild(script);

    startPaymentPolling();

  } catch (error) {
    showMessage("payment-message", error.message, true);
  }
}

function startPaymentPolling() {
  stopPaymentPolling();

  paymentPollTimer = setInterval(async () => {
    try {
      await checkPaymentStatus(false);
    } catch (error) {
      console.warn("Consulta de pago:", error.message);
    }
  }, 8000);
}

function stopPaymentPolling() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
}

async function checkPaymentStatus(showFeedback = true) {
  if (!lastEvaluationId) {
    if (showFeedback) {
      showMessage("payment-message", "No se encontró una evaluación pendiente.", true);
    }
    return;
  }

  try {
    const response = await api(
      `/api/my-evaluations/${encodeURIComponent(lastEvaluationId)}/payment-status`
    );

    const data = await response.json();

    if (data.paymentStatus === "paid") {
      stopPaymentPolling();

      showMessage("payment-message", "¡Pago confirmado! Cargando informe.");

      await loadOwnResult(lastEvaluationId);
      return;
    }

    if (showFeedback) {
      showMessage(
        "payment-message",
        "Aún no recibimos la confirmación del pago. Si acabas de pagar, espera unos segundos."
      );
    }

  } catch (error) {
    if (showFeedback) {
      showMessage("payment-message", error.message, true);
    }
  }
}

/* =========================================================
   12. MOSTRAR INFORME
========================================================= */

async function loadOwnResult(evaluationId) {
  try {
    const response = await api(
      `/api/my-evaluations/${encodeURIComponent(evaluationId)}`
    );
    const data = await response.json();
    const evaluation = data.evaluation || data;

    if (evaluation.paymentStatus !== "paid") {
      show("payment-view");
      showMessage("payment-message", "El pago aún no aparece confirmado.", true);
      return;
    }

    $("result-name").textContent = evaluation.evaluationType === "parent_observation"
      ? `Informe de observación familiar · ${evaluation.parentContext?.childAge || "—"} años (${evaluation.parentContext?.ageBand || "etapa no especificada"}) · Familiar: ${evaluation.parentContext?.relationship || "no especificado"} · ${currentUser.email}`
      : `${evaluation.name || profileData?.name || ""} · ${currentUser.email}`;
    $("result-profile").textContent = evaluation.profile || "Resumen orientativo";
    $("result-description").textContent = evaluation.profileDescription || "";
    if (evaluation.evaluationType === "parent_observation") {
      const hero = $("result-view").querySelector(".hero-copy");
      if (hero) {
        hero.querySelector(".eyebrow").textContent = "Observación familiar";
        hero.querySelector("h1").textContent = "Una mirada a las conductas observadas.";
        hero.querySelector("p").textContent = "Este informe organiza tus observaciones y ofrece orientaciones generales para acompañar al menor.";
      }
      const cardEyebrow = $("result-view").querySelector(".card > .eyebrow");
      if (cardEyebrow) cardEyebrow.textContent = "Informe de observación familiar";
      const headings = $("result-view").querySelectorAll(".section-heading h2");
      if (headings[2]) headings[2].textContent = "Orientaciones para padres y cuidadores";
      $("attention-task-summary").textContent = "Esta evaluación recoge observaciones del familiar; no incluye pruebas de rendimiento cognitivo ni actividades para el menor.";
    } else {
      const hero = $("result-view").querySelector(".hero-copy");
      if (hero) {
        hero.querySelector(".eyebrow").textContent = "Tu informe personal";
        hero.querySelector("h1").textContent = "Un espacio para comprenderte.";
        hero.querySelector("p").textContent = "Este resumen organiza tus respuestas y ofrece orientaciones generales para reflexionar sobre tu bienestar cognitivo.";
      }
      const cardEyebrow = $("result-view").querySelector(".card > .eyebrow");
      if (cardEyebrow) cardEyebrow.textContent = "Resultado del autorregistro";
    }

    const dimensionMeta = evaluation.dimensions || {};
    const scores = evaluation.scores || {};
    const labels = {
      inattention: evaluation.evaluationType === "parent_observation" ? "Atención y seguimiento de tareas" : "Atención sostenida y memoria cotidiana",
      executive: "Organización y funciones ejecutivas",
      hyperactivity: evaluation.evaluationType === "parent_observation" ? "Actividad motora e inquietud" : "Inquietud e impulsividad",
      emotionalContext: "Regulación emocional",
      context: evaluation.evaluationType === "parent_observation" ? "Duración, entornos y observación externa" : "Estrés, preocupación y descanso",
      contextFactors: "Otros factores que conviene considerar",
      impact: "Impacto en la vida cotidiana",
      history: "Historia y presencia en distintos entornos",
      impulsivity: "Impulsividad y espera de turnos"
    };
    $("score-list").innerHTML = "";
    $("result-dimension-explanations").innerHTML = "";

    renderResultRadar(scores, labels);

    Object.entries(labels).forEach(([key, label]) => {
      if (typeof scores[key] !== "number") return;
      const value = Math.max(0, Math.min(100, Number(scores[key] || 0)));
      const card = document.createElement("div");
      card.className = "score-card";
      const title = document.createElement("p");
      title.className = "text-xs font-bold text-slate-500";
      title.textContent = label;
      const number = document.createElement("div");
      number.className = "score-number";
      number.textContent = `${value}%`;
      const track = document.createElement("div");
      track.className = "score-track";
      const fill = document.createElement("span");
      fill.style.width = `${value}%`;
      track.appendChild(fill);
      card.append(title, number, track);
      $("score-list").appendChild(card);

      const explanation = document.createElement("p");
      explanation.className = "muted-text mb-3";
      explanation.textContent = dimensionMeta[key]?.explanation || "Porcentaje descriptivo de las respuestas de esta dimensión; no equivale a una probabilidad clínica.";
      $("result-dimension-explanations").appendChild(explanation);
    });

    const taskSummary = evaluation.attentionTasks;
    $("attention-task-summary").textContent = taskSummary
      ? `Actividades interactivas: ${taskSummary.correct} de ${taskSummary.completed} retos de selección correctos. Memoria: ${taskSummary.memoryCorrect} de ${taskSummary.memoryCompleted}; búsqueda visual: ${taskSummary.visualCorrect} de ${taskSummary.visualCompleted}. ${taskSummary.note}`
      : "";
    const summary = evaluation.summary || {};
    $("result-summary").innerHTML = "";
    [
      [evaluation.evaluationType === "parent_observation" ? "Otros factores que pueden influir" : "Estrés y descanso", summary.contextInfluence],
      ["Impacto cotidiano", summary.dailyImpact],
      ["Historia y contextos", summary.childhoodAndSettings]
    ].forEach(([label, value]) => {
      if (!value) return;
      const p = document.createElement("p");
      p.className = "text-sm text-slate-600 mb-2";
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      p.append(strong, document.createTextNode(Array.isArray(value) ? value.join(" · ") : String(value)));
      $("result-summary").appendChild(p);
    });

    $("recommendations").innerHTML = "";
    (evaluation.recommendations || []).forEach((recommendation) => {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = recommendation.title || "Orientación";
      const detail = document.createElement("p");
      detail.className = "muted-text";
      detail.textContent = recommendation.detail || String(recommendation);
      item.append(title, detail);
      item.className = "mb-4";
      $("recommendations").appendChild(item);
    });
    show("result-view");
  } catch (error) {
    alert("No se pudo cargar el informe: " + error.message);
  }
}

async function downloadOwnPdf() {
  if (!lastEvaluationId) {
    alert("No se encontró el identificador de tu evaluación.");
    return;
  }

  try {
    const response = await api(
      `/api/my-evaluations/${encodeURIComponent(lastEvaluationId)}/pdf`
    );

    downloadBlob(await response.blob(), "NeuroEval-Pro-informe.pdf");

  } catch (error) {
    alert(error.message);
  }
}

/* =========================================================
   13. PANEL ADMINISTRATIVO
========================================================= */

let adminOverviewCache = null;
function formatAdminDate(value) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO"); }
function formatCop(value) { return new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(value||0)); }
function adminCell(row,value) { const cell=document.createElement("td"); cell.textContent=value===null||value===undefined||value===""?"—":String(value); row.appendChild(cell); return cell; }
function adminEmptyRow(tbody,colspan,message) { tbody.replaceChildren(); const row=document.createElement("tr"),cell=document.createElement("td"); cell.colSpan=colspan; cell.className="muted-text"; cell.textContent=message; row.appendChild(cell); tbody.appendChild(row); }
function renderAdminEvaluations(records,targetId="admin-rows") {
  const tbody=$(targetId); if(!tbody)return; tbody.replaceChildren();
  if(!records.length)return adminEmptyRow(tbody,targetId==="admin-recent-rows"?5:6,"No hay evaluaciones que coincidan con la búsqueda.");
  records.forEach(record=>{
    const row=document.createElement("tr"); adminCell(row,formatAdminDate(record.createdAt)); adminCell(row,record.name); adminCell(row,record.email);
    const paymentLabel = record.paymentStatus
      ? (record.paymentStatus === "paid" ? "Pagado" : record.paymentStatus)
      : "Sin permiso";
    if(targetId==="admin-recent-rows") adminCell(row,paymentLabel);
    else {
      const evaluationTypeLabel = record.evaluationType === "parent_observation" ? "Observación familiar" : "Autorregistro personal";
      const resultLabel = record.profile || (hasAdminPermission("evaluations.responses") ? "Sin resultado" : "Restringido");
      adminCell(row, evaluationTypeLabel + " · " + resultLabel);
      adminCell(row,paymentLabel);
    }
    const actions=document.createElement("td"); actions.className="space-x-2 whitespace-nowrap";
    if (hasAdminPermission("evaluations.responses")) {
      const detail=document.createElement("button"); detail.type="button";detail.className="text-indigo-600 font-bold underline";detail.textContent="Ver detalle";detail.addEventListener("click",()=>viewAdminEvaluation(record.id));actions.appendChild(detail);
    }
    if (hasAdminPermission("evaluations.pdf")) {
      const pdf=document.createElement("button");pdf.type="button";pdf.className="text-indigo-600 font-bold underline";pdf.textContent="PDF";pdf.addEventListener("click",()=>downloadAdminPdf(record.id));actions.appendChild(pdf);
    }
    if (actions.childNodes.length) { row.appendChild(actions); }
    else { adminCell(row,"Sin permisos de detalle"); }
    tbody.appendChild(row);
  });
}
function renderAdminClients(users) {
  const tbody=$("admin-client-rows");if(!tbody)return;tbody.replaceChildren();
  if(!users.length)return adminEmptyRow(tbody,6,"Todavía no hay perfiles registrados.");
  users.forEach(user=>{
    const row=document.createElement("tr");
    adminCell(row,formatAdminDate(user.createdAt));
    const nameCell=document.createElement("td");
    const open=document.createElement("button");
    open.type="button";open.className="text-indigo-600 font-bold underline";
    open.textContent=user.name||"Ver expediente";
    open.addEventListener("click",()=>viewAdminClient(user.uid));
    nameCell.appendChild(open);row.appendChild(nameCell);
    adminCell(row,user.email);adminCell(row,user.age==null?"—":user.age);adminCell(row,user.goal);adminCell(row,user.uid);
    tbody.appendChild(row);
  });
}
function renderAdminPayments(records) {
  const tbody=$("admin-payment-rows");if(!tbody)return;tbody.replaceChildren();
  if(!records.length)return adminEmptyRow(tbody,7,"No hay transacciones registradas.");
  records.forEach(record=>{const row=document.createElement("tr");adminCell(row,formatAdminDate(record.paidAt||record.updatedAt||record.createdAt));adminCell(row,record.name||record.email);adminCell(row,formatCop(record.amountCop));adminCell(row,record.paymentStatus==="paid"?"Aprobado":record.paymentStatus||"Pendiente");adminCell(row,record.paymentReference);adminCell(row,record.wompiTransactionId);adminCell(row,record.wompiTransactionStatus);tbody.appendChild(row);});
}
async function exportAdminBackup() {
  const button = $("admin-backup-export");
  const status = $("admin-backup-status");
  if (!button || !status || !currentIsPrimaryAdmin) {
    if (status) status.textContent = "Esta acción está reservada al administrador principal.";
    return;
  }
  button.disabled = true;
  status.textContent = "Preparando exportación segura…";
  try {
    const response = await api("/api/admin/backups/export");
    const backup = await response.json();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const date = new Date(backup.generatedAt || Date.now()).toISOString().slice(0, 10);
    downloadBlob(blob, "neuroeval-pro-respaldo-" + date + ".json");
    const partial = Array.isArray(backup.collections) ? backup.collections.filter(item => item.truncated) : [];
    status.textContent = backup.complete
      ? "Exportación generada. " + backup.collections.reduce((sum, item) => sum + Number(item.exportedCount || 0), 0) + " documentos incluidos. Guarda el archivo en un lugar seguro."
      : "Exportación parcial: " + partial.map(item => item.name).join(", ") + " superó el límite de 500 documentos. No la uses como respaldo completo; solicita una copia administrada en Google Cloud.";
  } catch (error) {
    status.textContent = "No se pudo generar el respaldo: " + error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadAdminHealthDetails() {
  const target = $("admin-health-checks"), summary = $("admin-health-summary"), runtime = $("admin-health-runtime");
  if (!target || !hasAdminPermission("settings.view")) return;
  summary.textContent = "Ejecutando diagnóstico…"; target.replaceChildren(); runtime.replaceChildren();
  try {
    const response = await api("/api/admin/health/details");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar el diagnóstico.");
    summary.textContent = data.ok ? "Diagnóstico completado. No se detectaron errores en las comprobaciones ejecutadas." : "Se detectaron errores. Revisa el detalle.";
    const labels = { operational: "● Operativo", configured: "● Configurado", warning: "● Advertencia", not_configured: "● No configurado", error: "● Error" };
    data.checks.forEach(check => {
      const card=document.createElement("div"); card.className="card";
      const title=document.createElement("strong"); title.textContent=check.label;
      const state=document.createElement("p"); state.className="text-sm font-bold mt-2"; state.textContent=labels[check.status]||"Estado desconocido";
      state.className += check.status==="error" ? " text-red-400" : ["warning","not_configured"].includes(check.status) ? " text-amber-300" : " text-emerald-400";
      const detail=document.createElement("p"); detail.className="muted-text text-sm mt-1"; detail.textContent=check.detail;
      card.append(title,state,detail); target.appendChild(card);
    });
    [["Tiempo activo",Math.floor(data.uptimeSeconds/3600)+" h"],["Respuesta",data.responseMs+" ms"],["Memoria RAM",data.memory.rssMb+" MB"],["Motor Node.js",data.runtime]].forEach(([label,value])=>{
      const card=document.createElement("div");card.className="card";const title=document.createElement("p");title.className="muted-text text-xs";title.textContent=label;const amount=document.createElement("strong");amount.className="text-lg";amount.textContent=value;card.append(title,amount);runtime.appendChild(card);
    });
    $("admin-health-checked-at").textContent="Última comprobación: "+new Date(data.checkedAt).toLocaleString("es-CO");
  } catch(error) { summary.textContent="No fue posible ejecutar el diagnóstico: "+error.message; }
}

async function loadAdminHealth() {
  const target=$("admin-system-status");if(!target||!hasAdminPermission("settings.view"))return;target.textContent="Consultando servicios…";
  try{
    const response=await fetch("/api/health",{cache:"no-store"});if(!response.ok)throw new Error("No se pudo consultar el estado del servidor.");
    const data=await response.json();target.replaceChildren();
    [["Servidor",data.ok?"Operativo":"No disponible"],["Firebase",data.firebaseProject?"Configurado":"Sin configurar"],["Correo SMTP",data.smtpConnectionVerified?"Conexión verificada":data.smtpConfigured?"Configurado, sin verificación":"No configurado"],["Wompi",data.wompiConfigured?"Configurado":"No configurado"],["Ambiente de pagos",data.wompiEnvironment||"No disponible"],["Precio por evaluación",formatCop(data.evaluationPriceCop)],["Pagos de demostración",data.demoPaymentEnabled?"Activos":"Desactivados"]].forEach(([label,value])=>{const line=document.createElement("div");line.className="profile-row";const left=document.createElement("span");left.textContent=label;const right=document.createElement("strong");right.textContent=value;line.append(left,right);target.appendChild(line);});
  }catch(error){target.textContent="No fue posible consultar los servicios: "+error.message;}
}

function renderAdminDashboardCharts(records) {
  const monthly = $("admin-monthly-chart"), donut = $("admin-payment-donut");
  if (!monthly || !donut) return;
  monthly.replaceChildren();
  if (!hasAdminPermission("evaluations.view")) {
    const note=document.createElement("p");note.className="chart-subtitle";note.textContent="Tu rol no permite consultar estadísticas de evaluaciones.";
    monthly.appendChild(note);
  } else if (!records.length) {
    const note=document.createElement("p");note.className="chart-subtitle";note.textContent="No hay registros suficientes para construir esta gráfica.";
    monthly.appendChild(note);
  } else {
    const now=new Date(), buckets=[];
  for(let offset=5;offset>=0;offset--){
    const date=new Date(now.getFullYear(),now.getMonth()-offset,1);
    buckets.push({key:date.getFullYear()+"-"+date.getMonth(),label:date.toLocaleDateString("es-CO",{month:"short"}).replace(".",""),count:0});
  }
  records.forEach(record=>{
    const date=new Date(record.createdAt);
    if(Number.isNaN(date.getTime()))return;
    const bucket=buckets.find(item=>item.key===date.getFullYear()+"-"+date.getMonth());
    if(bucket)bucket.count++;
  });
  const max=Math.max(1,...buckets.map(item=>item.count));
  buckets.forEach(item=>{
    const col=document.createElement("div");col.className="chart-bar-col";
    const bar=document.createElement("div");bar.className="chart-bar";bar.style.height=Math.max(4,item.count/max*100)+"%";bar.title=item.count+" evaluaciones";
    const label=document.createElement("span");label.className="chart-bar-label";label.textContent=item.label;
    col.append(bar,label);monthly.appendChild(col);
  });
  }
  if (!hasAdminPermission("payments.view")) {
    donut.style.background="conic-gradient(#394363 0 100%)";
    donut.innerHTML='<div class="status-donut-center">🔒<small>Acceso restringido</small></div>';
    $("admin-payment-legend").textContent="Tu rol no permite consultar los pagos.";
    $("admin-chart-sample-note").textContent="Basado en registros visibles";
    return;
  }
  const paid=records.filter(item=>item.paymentStatus==="paid").length;
  const pending=records.filter(item=>item.paymentStatus==="pending").length;
  const failed=records.filter(item=>["failed","declined","error"].includes(String(item.paymentStatus||"").toLowerCase())).length;
  const total=paid+pending+failed;
  if(total){
    const p1=paid/total*100,p2=(paid+pending)/total*100;
    donut.style.background="conic-gradient(#a16bff 0 "+p1+"%,#51d9d1 "+p1+"% "+p2+"%,#f39b66 "+p2+"% 100%)";
    donut.innerHTML='<div class="status-donut-center">'+total+'<small>pagos evaluados</small></div>';
    $("admin-payment-legend").innerHTML='<span><i class="legend-dot" style="background:#a16bff"></i>Pagados '+paid+'</span><span><i class="legend-dot" style="background:#51d9d1"></i>Pendientes '+pending+'</span><span><i class="legend-dot" style="background:#f39b66"></i>Fallidos '+failed+'</span>';
  } else {
    donut.style.background="conic-gradient(#394363 0 100%)";donut.innerHTML='<div class="status-donut-center">0<small>pagos</small></div>';$("admin-payment-legend").textContent="Sin movimientos";
  }
  if (hasAdminPermission("evaluations.view")) {
    $("admin-chart-sample-note").textContent="Basado en "+records.length+" registros visibles";
  } else {
    $("admin-chart-sample-note").textContent="Acceso restringido";
  }
}
function renderResultRadar(scores, labels) {
  const host=$("result-radar"),chart=$("result-radar-chart");
  if(!host||!chart)return;
  const entries=Object.entries(labels).filter(([key])=>typeof scores[key]==="number").slice(0,7);
  if(entries.length<3){host.classList.add("hidden");return;}
  const n=entries.length,cx=150,cy=135,r=92;
  const point=(index,value)=>{const angle=-Math.PI/2+index*2*Math.PI/n,scale=Math.max(0,Math.min(100,Number(value)||0))/100;return [cx+Math.cos(angle)*r*scale,cy+Math.sin(angle)*r*scale];};
  const rings=[25,50,75,100].map(level=>Array.from({length:n},(_,i)=>{const [x,y]=point(i,level);return x+","+y;}).join(" ")).map(points=>'<polygon points="'+points+'" fill="none" stroke="#455071" stroke-width="1"/>').join("");
  const axes=Array.from({length:n},(_,i)=>{const [x,y]=point(i,100);return '<line x1="'+cx+'" y1="'+cy+'" x2="'+x+'" y2="'+y+'" stroke="#455071" stroke-width="1"/>';}).join("");
  const values=entries.map(([key],i)=>point(i,scores[key]).join(",")).join(" ");
  const dots=entries.map(([key],i)=>{const [x,y]=point(i,scores[key]);return '<circle cx="'+x+'" cy="'+y+'" r="4" fill="#5de4dc" stroke="#fff" stroke-width="1.5"><title>'+labels[key]+': '+scores[key]+'%</title></circle>';}).join("");
  const svg='<svg class="radar-svg" viewBox="0 0 300 270" role="img" aria-label="Gráfica radar de indicadores"><defs><linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a16bff" stop-opacity=".48"/><stop offset="1" stop-color="#51d9d1" stop-opacity=".2"/></linearGradient></defs>'+rings+axes+'<polygon points="'+values+'" fill="url(#radarFill)" stroke="#b78aff" stroke-width="2.5"/>'+dots+'</svg>';
  chart.innerHTML=svg;host.classList.remove("hidden");
  const copy=host.querySelector(".radar-copy");
  if(copy){copy.innerHTML="<strong>Mapa de dimensiones</strong>"+entries.map(([key,label])=>'<div>'+label+': <b>'+Math.max(0,Math.min(100,Number(scores[key])))+'%</b></div>').join("")+'<p>Los valores describen respuestas del autorregistro; no son probabilidades ni un diagnóstico.</p>';}
}

async function loadAdmin() {
  if(!currentIsAdmin){alert("No tienes permisos para consultar esta sección.");return;}
  try{
    const response=await api("/api/admin/overview");const data=await response.json();adminOverviewCache=data;
    $("stat-users").textContent=data.users==null?"—":data.users;$("stat-evals").textContent=data.evaluations==null?"—":data.evaluations;$("stat-paid").textContent=data.paid==null?"—":data.paid;$("stat-pending").textContent=data.pending==null?"—":data.pending;$("stat-failed").textContent=data.failed==null?"—":data.failed;$("stat-revenue").textContent=data.revenueCop==null?"Restringido":formatCop(data.revenueCop);
    $("admin-account-name").textContent=currentUser?.displayName||"Administrador";$("admin-account-email").textContent=currentUser?.email||"—";
    const records=Array.isArray(data.records)?data.records:[],users=Array.isArray(data.usersList)?data.usersList:[];
    renderAdminEvaluations(records.slice(0,8),"admin-recent-rows");renderAdminEvaluations(records);renderAdminClients(users);
    renderAdminPayments(records.filter(record=>record.paymentProvider==="wompi"||record.paymentReference||record.wompiTransactionId));
    renderAdminDashboardCharts(records);
    setAdminTab("overview");
  }catch(error){console.error("Panel administrativo:",error);alert("No se pudo cargar el panel: "+error.message);}
}
const ADMIN_PERMISSION_LABELS = {
  "dashboard.view": "Ver resumen general",
  "clients.view": "Consultar clientes",
  "evaluations.view": "Consultar evaluaciones",
  "evaluations.responses": "Ver respuestas y resultados privados",
  "evaluations.pdf": "Descargar informes PDF",
  "payments.view": "Consultar pagos e ingresos",
  "settings.view": "Consultar estado técnico",
  "pricing.manage": "Administrar precios y promociones",
  "audit.view": "Consultar historial administrativo",
  "support.view": "Consultar solicitudes de soporte",
  "support.manage": "Responder y gestionar soporte"
};

async function loadAdminCommercialAnalytics() {
  const summary = $("admin-analytics-summary"), revenue = $("admin-analytics-revenue");
  const conversion = $("admin-analytics-conversion"), promos = $("admin-analytics-promos");
  if (!summary || !hasAdminPermission("payments.view")) return;
  summary.textContent = "Calculando indicadores…"; revenue.textContent = "Cargando…"; conversion.textContent = "Cargando…"; promos.textContent = "Cargando…";
  try {
    const response = await api("/api/admin/analytics/commercial");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar la analítica.");
    const totals = data.totals || {};
    summary.replaceChildren();
    [["Ingresos confirmados",formatCop(totals.revenueCop)],["Conversión a pago",Number(totals.conversionPercent||0).toLocaleString("es-CO")+"%"],["Ticket promedio",formatCop(totals.averageTicketCop)],["Evaluaciones pagadas",totals.paid||0],["Pagos pendientes",totals.pending||0],["Descuentos aplicados",formatCop(totals.discountsCop)]].forEach(([label,value])=>{
      const card=document.createElement("div");card.className="card";const title=document.createElement("p");title.className="muted-text";title.textContent=label;
      const amount=document.createElement("p");amount.className="text-2xl font-extrabold mt-2";amount.textContent=value;card.append(title,amount);summary.appendChild(card);
    });
    const months=Array.isArray(data.months)?data.months:[];
    revenue.replaceChildren();
    if(!months.length){revenue.textContent="No hay datos mensuales disponibles.";}
    else{
      const max=Math.max(1,...months.map(item=>Number(item.revenueCop||0)));
      months.forEach(item=>{
        const col=document.createElement("div");col.className="chart-bar-col";
        const value=document.createElement("span");value.className="text-xs muted-text";value.textContent=formatCop(item.revenueCop||0);
        const bar=document.createElement("div");bar.className="chart-bar";bar.style.height=Math.max(4,Number(item.revenueCop||0)/max*100)+"%";bar.title=formatCop(item.revenueCop||0);
        const label=document.createElement("span");label.className="chart-bar-label";label.textContent=item.label||"";col.append(value,bar,label);revenue.appendChild(col);
      });
    }
    conversion.replaceChildren();
    months.forEach(item=>{
      const row=document.createElement("div");row.className="space-y-1";
      const line=document.createElement("div");line.className="flex justify-between gap-2 text-sm";
      const label=document.createElement("strong");label.textContent=item.label||"";
      const value=document.createElement("span");value.textContent=(item.evaluations?Math.round(item.paid/item.evaluations*100):0)+"% · "+(item.paid||0)+"/"+(item.evaluations||0);
      line.append(label,value);const track=document.createElement("div");track.className="h-2 rounded-full bg-slate-700/30 overflow-hidden";
      const fill=document.createElement("div");fill.className="h-full rounded-full";fill.style.width=(item.evaluations?Math.min(100,item.paid/item.evaluations*100):0)+"%";fill.style.background="linear-gradient(90deg,#a16bff,#51d9d1)";
      track.appendChild(fill);row.append(line,track);conversion.appendChild(row);
    });
    promos.replaceChildren();
    const promoItems=Array.isArray(data.promos)?data.promos:[];
    if(!promoItems.length){const empty=document.createElement("p");empty.className="muted-text";empty.textContent="Todavía no hay promociones registradas.";promos.appendChild(empty);}
    else promoItems.forEach(item=>{
      const row=document.createElement("div");row.className="flex flex-wrap justify-between gap-2 border-b border-slate-700/20 pb-3";
      const left=document.createElement("div");const name=document.createElement("strong");name.textContent=item.code+(item.active?" · Activa":" · Inactiva");
      const detail=document.createElement("p");detail.className="muted-text text-sm";detail.textContent="Evaluaciones asociadas: "+item.evaluationsUsingCode+" · Límite: "+(item.maxUses>0?item.maxUses:"Sin límite");
      left.append(name,detail);const count=document.createElement("span");count.className="font-bold";count.textContent="Usos reservados: "+item.uses;row.append(left,count);promos.appendChild(row);
    });
    $("admin-analytics-updated").textContent="Actualizado: "+new Date(data.generatedAt||Date.now()).toLocaleString("es-CO")+" · Fuente: registros almacenados.";
  }catch(error){summary.textContent="No se pudo cargar la analítica: "+error.message;revenue.textContent="—";conversion.textContent="—";promos.textContent="—";}
}

async function loadCustomerSupportTickets() {
  const target = $("customer-support-list");
  if (!target || !currentUser) return;
  target.textContent = "Cargando tus solicitudes…";
  try {
    const response = await api("/api/support/tickets");
    const data = await response.json();
    renderCustomerSupportTickets(Array.isArray(data.tickets) ? data.tickets : []);
  } catch (error) {
    target.textContent = "No se pudieron cargar tus solicitudes: " + error.message;
  }
}

function renderCustomerSupportTickets(tickets) {
  const target = $("customer-support-list");
  if (!target) return;
  target.replaceChildren();
  if (!tickets.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text text-sm";
    empty.textContent = "Todavía no tienes solicitudes. Si necesitas ayuda, puedes crear la primera desde el formulario.";
    target.appendChild(empty);
    return;
  }
  const statusLabels = { open: "Abierto", in_progress: "En gestión", waiting_customer: "Necesitamos tu respuesta", resolved: "Resuelto", closed: "Cerrado" };
  const categoryLabels = { cuenta: "Cuenta", evaluacion: "Evaluación", pago: "Pago", informe: "Informe", tecnico: "Técnico", otro: "Otro" };
  tickets.forEach(ticket => {
    const card = document.createElement("article");
    card.className = "rounded-2xl border border-slate-200 p-4 space-y-3";
    const header = document.createElement("div");
    header.className = "flex flex-wrap items-start justify-between gap-2";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h4");
    title.className = "font-extrabold";
    title.textContent = ticket.subject || "Solicitud de soporte";
    const meta = document.createElement("p");
    meta.className = "muted-text text-xs mt-1";
    meta.textContent = (categoryLabels[ticket.category] || "Otro") + " · Actualizada " + formatAdminDate(ticket.updatedAt || ticket.createdAt);
    titleWrap.append(title, meta);
    const state = document.createElement("span");
    state.className = "pill";
    state.textContent = statusLabels[ticket.status] || ticket.status;
    header.append(titleWrap, state);
    card.appendChild(header);

    const conversation = document.createElement("div");
    conversation.className = "space-y-2";
    (ticket.messages || []).forEach(message => {
      const bubble = document.createElement("div");
      bubble.className = "rounded-xl p-3 " + (message.senderRole === "admin" ? "bg-violet-500/10 mr-4" : "bg-slate-500/10 ml-4");
      const who = document.createElement("strong");
      who.className = "text-xs";
      who.textContent = message.senderRole === "admin" ? "Equipo de NeuroEval Pro" : "Tú";
      const body = document.createElement("p");
      body.className = "text-sm whitespace-pre-wrap mt-1";
      body.textContent = message.message || "";
      bubble.append(who, body);
      conversation.appendChild(bubble);
    });
    card.appendChild(conversation);

    if (ticket.status !== "closed" && (ticket.messages || []).length < 100) {
      const replyForm = document.createElement("form");
      replyForm.className = "flex flex-col sm:flex-row gap-2";
      const reply = document.createElement("textarea");
      reply.className = "input flex-1";
      reply.rows = 2;
      reply.maxLength = 3000;
      reply.required = true;
      reply.placeholder = "Escribe un mensaje para continuar la conversación…";
      const send = document.createElement("button");
      send.type = "submit";
      send.className = "btn primary";
      send.textContent = "Enviar mensaje";
      replyForm.append(reply, send);
      replyForm.addEventListener("submit", async event => {
        event.preventDefault();
        const message = reply.value.trim();
        if (message.length < 2) return;
        send.disabled = true;
        try {
          await api("/api/support/tickets/" + encodeURIComponent(ticket.id) + "/messages", {
            method: "POST",
            body: JSON.stringify({ message })
          });
          await loadCustomerSupportTickets();
        } catch (error) {
          alert(error.message);
          send.disabled = false;
        }
      });
      card.appendChild(replyForm);
    } else if (ticket.status === "closed") {
      const note = document.createElement("p");
      note.className = "muted-text text-xs";
      note.textContent = "Esta solicitud está cerrada. Si necesitas más ayuda, crea una nueva solicitud.";
      card.appendChild(note);
    }
    target.appendChild(card);
  });
}

async function createCustomerSupportTicket(event) {
  event.preventDefault();
  const submit = $("customer-support-submit");
  const status = $("customer-support-status");
  const subject = $("customer-support-subject").value.trim();
  const message = $("customer-support-message").value.trim();
  status.textContent = "Enviando tu solicitud…";
  submit.disabled = true;
  try {
    await api("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify({
        subject,
        message,
        category: $("customer-support-category").value
      })
    });
    $("customer-support-form").reset();
    status.textContent = "Tu solicitud fue enviada. Podrás seguir aquí las respuestas del equipo.";
    await loadCustomerSupportTickets();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function loadAdminSupportTickets() {
  const target = $("admin-support-list");
  if (!target || !hasAdminPermission("support.view")) return;
  target.textContent = "Cargando solicitudes…";
  try {
    const response = await api("/api/admin/support/tickets");
    const data = await response.json();
    renderAdminSupportTickets(Array.isArray(data.tickets) ? data.tickets : []);
  } catch (error) {
    target.textContent = "No se pudieron cargar las solicitudes: " + error.message;
  }
}

function renderAdminSupportTickets(tickets) {
  const target = $("admin-support-list");
  target.replaceChildren();
  if (!tickets.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text";
    empty.textContent = "No hay solicitudes de soporte registradas.";
    target.appendChild(empty);
    return;
  }
  const labels = { open: "Abierto", in_progress: "En gestión", waiting_customer: "Espera al cliente", resolved: "Resuelto", closed: "Cerrado" };
  tickets.forEach(ticket => {
    const card = document.createElement("article");
    card.className = "card space-y-3";
    const heading = document.createElement("div");
    heading.className = "flex flex-wrap justify-between gap-2";
    const title = document.createElement("div");
    const subject = document.createElement("strong");
    subject.textContent = ticket.subject || "Solicitud sin asunto";
    const meta = document.createElement("p");
    meta.className = "muted-text text-xs mt-1";
    meta.textContent = (ticket.displayName || ticket.email || ticket.uid) + " · " + ticket.category + " · " + formatAdminDate(ticket.createdAt);
    title.append(subject, meta);
    const status = document.createElement("span");
    status.className = "pill";
    status.textContent = labels[ticket.status] || ticket.status;
    heading.append(title, status);
    const conversation = document.createElement("div");
    conversation.className = "space-y-2";
    (ticket.messages || []).forEach(message => {
      const bubble = document.createElement("div");
      bubble.className = "rounded-xl p-3 " + (message.senderRole === "admin" ? "bg-violet-500/10 ml-4" : "bg-slate-500/10 mr-4");
      const who = document.createElement("strong");
      who.className = "text-xs";
      who.textContent = message.senderRole === "admin" ? "Equipo de soporte" : "Cliente";
      const body = document.createElement("p");
      body.className = "text-sm whitespace-pre-wrap mt-1";
      body.textContent = message.message || "";
      bubble.append(who, body);
      conversation.appendChild(bubble);
    });
    card.append(heading, conversation);
    if (hasAdminPermission("support.manage")) {
      const controls = document.createElement("div");
      controls.className = "grid sm:grid-cols-3 gap-2";
      const state = document.createElement("select");
      state.className = "input";
      [["open","Abierto"],["in_progress","En gestión"],["waiting_customer","Espera al cliente"],["resolved","Resuelto"],["closed","Cerrado"]].forEach(([value,label]) => {
        const option = document.createElement("option"); option.value=value; option.textContent=label; option.selected=ticket.status===value; state.appendChild(option);
      });
      const priority = document.createElement("select");
      priority.className = "input";
      [["low","Baja"],["normal","Normal"],["high","Alta"],["urgent","Urgente"]].forEach(([value,label]) => {
        const option=document.createElement("option"); option.value=value; option.textContent="Prioridad: "+label; option.selected=(ticket.priority||"normal")===value; priority.appendChild(option);
      });
      const reply = document.createElement("textarea");
      reply.className = "input sm:col-span-3";
      reply.rows = 2; reply.maxLength = 3000; reply.placeholder = "Escribe una respuesta para el cliente (opcional)…";
      const save = document.createElement("button");
      save.type = "button"; save.className = "btn primary";
      save.textContent = "Guardar gestión";
      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          await api("/api/admin/support/tickets/" + encodeURIComponent(ticket.id), {
            method: "PATCH",
            body: JSON.stringify({ status: state.value, priority: priority.value, reply: reply.value.trim() })
          });
          await loadAdminSupportTickets();
        } catch (error) { alert(error.message); save.disabled = false; }
      });
      controls.append(state, priority, save, reply);
      card.appendChild(controls);
    }
    target.appendChild(card);
  });
}

async function loadAdminPricing() {
  const priceInput = $("admin-service-price");
  const list = $("admin-promo-list");
  if (!priceInput || !hasAdminPermission("pricing.manage")) return;
  list.textContent = "Cargando precios y promociones…";
  try {
    const response = await api("/api/admin/pricing");
    const data = await response.json();
    priceInput.value = Number(data.pricing?.priceCop || 4000);
    renderAdminPromos(Array.isArray(data.promos) ? data.promos : []);
  } catch (error) {
    list.textContent = "No se pudo cargar la configuración comercial: " + error.message;
  }
}

function renderAdminPromos(items) {
  const target = $("admin-promo-list");
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text";
    empty.textContent = "Todavía no has creado códigos promocionales.";
    target.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-slate-700/30 p-4 flex flex-wrap items-center justify-between gap-3";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.code + " · " + (item.discountType === "percentage" ? item.discountValue + "% de descuento" : formatCop(item.discountValue) + " de descuento");
    const detail = document.createElement("p");
    detail.className = "muted-text text-sm mt-1";
    detail.textContent = "Usos: " + item.uses + (Number(item.maxUses) > 0 ? " / " + item.maxUses : " · Sin límite") +
      (item.expiresAt ? " · Vence: " + new Date(item.expiresAt).toLocaleDateString("es-CO") : " · Sin vencimiento") +
      (item.newCustomersOnly ? " · Solo nuevos clientes" : "");
    const status = document.createElement("span");
    status.className = "text-xs font-bold " + (item.active ? "text-emerald-500" : "text-amber-500");
    status.textContent = item.active ? "Activo" : "Desactivado";
    info.append(title, detail, status);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn outline";
    toggle.textContent = item.active ? "Desactivar" : "Activar";
    toggle.addEventListener("click", async () => {
      try {
        await api("/api/admin/promo-codes/" + encodeURIComponent(item.code), {
          method: "PATCH", body: JSON.stringify({ active: !item.active })
        });
        await loadAdminPricing();
      } catch (error) { alert(error.message); }
    });
    card.append(info, toggle);
    target.appendChild(card);
  });
}

async function saveAdminPrice(event) {
  event.preventDefault();
  const priceCop = Number($("admin-service-price").value);
  const message = $("admin-price-message");
  message.textContent = "Guardando nuevo precio…";
  try {
    await api("/api/admin/pricing", { method: "PUT", body: JSON.stringify({ priceCop }) });
    message.textContent = "Precio actualizado. Las nuevas evaluaciones usarán este valor; las que ya fueron creadas conservan su precio.";
    await loadAdminPricing();
  } catch (error) { message.textContent = error.message; }
}

async function createPromoCode(event) {
  event.preventDefault();
  const form = $("admin-promo-form");
  const value = Number($("admin-promo-value").value);
  const toIso = id => $(id).value ? new Date($(id).value).toISOString() : null;
  const payload = {
    code: $("admin-promo-code").value,
    discountType: $("admin-promo-type").value,
    discountValue: value,
    maxUses: Number($("admin-promo-max-uses").value || 0),
    startsAt: toIso("admin-promo-start"),
    expiresAt: toIso("admin-promo-expiry"),
    newCustomersOnly: $("admin-promo-new-only").checked
  };
  const message = $("admin-promo-message");
  message.textContent = "Creando código…";
  try {
    const response = await api("/api/admin/promo-codes", { method: "POST", body: JSON.stringify(payload) });
    const data = await response.json();
    message.textContent = "Código " + data.code + " creado correctamente.";
    form.reset();
    await loadAdminPricing();
  } catch (error) { message.textContent = error.message; }
}

async function loadAdminAdministrators() {
  const target = $("admin-managers-list");
  if (!target || !currentIsPrimaryAdmin) return;
  target.textContent = "Consultando colaboradores…";
  try {
    const response = await api("/api/admin/administrators");
    const data = await response.json();
    renderAdminAdministrators(Array.isArray(data.administrators) ? data.administrators : []);
  } catch (error) {
    target.textContent = "No se pudieron consultar los colaboradores: " + error.message;
  }
}

function renderAdminAdministrators(items) {
  const target = $("admin-managers-list");
  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "muted-text";
    empty.textContent = "Todavía no has agregado administradores secundarios.";
    target.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "border border-slate-200 rounded-xl p-4";
    const heading = document.createElement("div");
    heading.className = "flex flex-wrap justify-between gap-2";
    const identity = document.createElement("div");
    const email = document.createElement("strong");
    email.textContent = item.email || item.uid;
    const status = document.createElement("p");
    status.className = "text-xs mt-1 " + (item.status === "active" ? "text-emerald-700" : "text-amber-700");
    status.textContent = item.status === "active" ? "Acceso activo" : "Acceso suspendido";
    identity.append(email, status);
    const uid = document.createElement("span");
    uid.className = "text-xs text-slate-400";
    uid.textContent = item.uid;
    heading.append(identity, uid);
    const permissions = document.createElement("div");
    permissions.className = "grid sm:grid-cols-2 gap-2 my-4";
    Object.entries(ADMIN_PERMISSION_LABELS).forEach(([key, label]) => {
      const wrapper = document.createElement("label");
      wrapper.className = "flex items-center gap-2 text-sm";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = key;
      checkbox.checked = (item.permissions || []).includes(key);
      checkbox.dataset.permission = key;
      wrapper.append(checkbox, document.createTextNode(label));
      permissions.appendChild(wrapper);
    });
    const actions = document.createElement("div");
    actions.className = "flex flex-wrap gap-2";
    const save = document.createElement("button");
    save.type = "button"; save.className = "btn primary"; save.textContent = "Guardar permisos";
    save.addEventListener("click", async () => {
      const selected = Array.from(permissions.querySelectorAll("input:checked")).map(input => input.value);
      if (!selected.length) return alert("Selecciona al menos un permiso. Para retirar todo el acceso, suspende al colaborador.");
      try {
        await api("/api/admin/administrators/" + encodeURIComponent(item.uid), {
          method: "PATCH", body: JSON.stringify({ permissions: selected })
        });
        alert("Permisos actualizados correctamente.");
        loadAdminAdministrators();
      } catch (error) { alert(error.message); }
    });
    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "btn outline";
    toggle.textContent = item.status === "active" ? "Suspender acceso" : "Reactivar acceso";
    toggle.addEventListener("click", async () => {
      try {
        await api("/api/admin/administrators/" + encodeURIComponent(item.uid), {
          method: "PATCH", body: JSON.stringify({ active: item.status !== "active" })
        });
        loadAdminAdministrators();
      } catch (error) { alert(error.message); }
    });
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "btn outline"; remove.textContent = "Revocar y eliminar";
    remove.addEventListener("click", async () => {
      if (!confirm("¿Revocar definitivamente el acceso administrativo de " + item.email + "?")) return;
      try {
        await api("/api/admin/administrators/" + encodeURIComponent(item.uid), { method: "DELETE" });
        loadAdminAdministrators();
      } catch (error) { alert(error.message); }
    });
    actions.append(save, toggle, remove);
    card.append(heading, permissions, actions);
    target.appendChild(card);
  });
}

async function createAdminFromForm(event) {
  event.preventDefault();
  if (!currentIsPrimaryAdmin) return;
  const email = $("admin-new-email").value.trim();
  const permissions = Array.from(document.querySelectorAll('input[name="admin-permission"]:checked')).map(input => input.value);
  if (!permissions.includes("dashboard.view")) permissions.push("dashboard.view");
  const message = $("admin-add-message");
  message.textContent = "Agregando colaborador…";
  try {
    await api("/api/admin/administrators", {
      method: "POST", body: JSON.stringify({ email, permissions })
    });
    message.textContent = "Colaborador agregado. Ya puede iniciar sesión con su cuenta.";
    $("admin-add-form").reset();
    document.querySelector('input[name="admin-permission"][value="dashboard.view"]').checked = true;
    await loadAdminAdministrators();
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadAdminAudit() {
  const target = $("admin-audit-list");
  if (!target || !hasAdminPermission("audit.view")) return;
  target.textContent = "Consultando historial…";
  try {
    const response = await api("/api/admin/audit");
    const data = await response.json();
    target.replaceChildren();
    const logs = Array.isArray(data.logs) ? data.logs : [];
    if (!logs.length) {
      const empty = document.createElement("p"); empty.className = "muted-text";
      empty.textContent = "Todavía no hay movimientos administrativos registrados.";
      target.appendChild(empty); return;
    }
    logs.forEach(log => {
      const row = document.createElement("div");
      row.className = "border-b border-slate-200 pb-3";
      const title = document.createElement("strong");
      title.textContent = log.action || "Actividad administrativa";
      const detail = document.createElement("p");
      detail.className = "muted-text text-sm";
      detail.textContent = "Responsable: " + (log.actorUid || "—") + " · Cuenta afectada: " + (log.targetUid || "—");
      const date = document.createElement("p");
      date.className = "text-xs text-slate-400";
      date.textContent = formatAdminDate(log.createdAt);
      row.append(title, detail, date); target.appendChild(row);
    });
  } catch (error) {
    target.textContent = "No se pudo consultar el historial: " + error.message;
  }
}

function filterAdminTables() {
  if(!adminOverviewCache)return;
  const records=adminOverviewCache.records||[],clients=adminOverviewCache.usersList||[];
  const clientTerm=($("admin-client-search")?.value||"").trim().toLowerCase(),evalTerm=($("admin-evaluation-search")?.value||"").trim().toLowerCase();
  renderAdminClients(clients.filter(user=>[user.name,user.email,user.goal,user.uid].some(value=>String(value||"").toLowerCase().includes(clientTerm))));
  renderAdminEvaluations(records.filter(record=>[record.name,record.email,record.profile,record.paymentStatus].some(value=>String(value||"").toLowerCase().includes(evalTerm))));
}

function appendAdminDetailLine(container, label, value) {
  const line = document.createElement("p");
  line.className = "text-sm text-slate-700 mb-2";
  const strong = document.createElement("strong");
  strong.textContent = label + ": ";
  line.append(strong, document.createTextNode(
    value === null || value === undefined || value === "" ? "—" : String(value)
  ));
  container.appendChild(line);
}

async function viewAdminClient(uid) {
  if (!currentIsAdmin || !hasAdminPermission("clients.view")) {
    alert("No tienes permisos para consultar expedientes de clientes.");
    return;
  }
  const dialog=$("admin-detail"),content=$("admin-detail-content");
  content.replaceChildren();
  const loading=document.createElement("p");loading.textContent="Cargando expediente protegido…";content.appendChild(loading);
  dialog.classList.remove("hidden");dialog.setAttribute("aria-hidden","false");$("admin-detail-close").focus();
  try {
    const response=await api(`/api/admin/clients/${encodeURIComponent(uid)}`);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"No se pudo consultar el expediente.");
    const client=data.client||{};
    content.replaceChildren();
    const heading=document.createElement("h3");heading.className="text-lg font-extrabold mb-3";heading.textContent="Expediente del cliente";content.appendChild(heading);
    appendAdminDetailLine(content,"Nombre",client.name);
    appendAdminDetailLine(content,"Correo",client.email);
    appendAdminDetailLine(content,"Edad",client.age);
    appendAdminDetailLine(content,"Objetivo",client.goal);
    appendAdminDetailLine(content,"UID",client.uid);
    appendAdminDetailLine(content,"Registro",formatAdminDate(client.createdAt));
    if(client.account){
      appendAdminDetailLine(content,"Correo verificado",client.account.emailVerified?"Sí":"No");
      appendAdminDetailLine(content,"Cuenta",client.account.disabled?"Deshabilitada":"Activa");
      appendAdminDetailLine(content,"Último acceso",formatAdminDate(client.account.lastSignInAt));
    }
    const sub=document.createElement("h4");sub.className="font-extrabold mt-5 mb-2";sub.textContent=`Historial de evaluaciones (${data.evaluationCount||0})`;content.appendChild(sub);
    const evaluations=Array.isArray(data.evaluations)?data.evaluations:[];
    if(!evaluations.length){const empty=document.createElement("p");empty.className="muted-text";empty.textContent="Este cliente todavía no tiene evaluaciones.";content.appendChild(empty);}
    evaluations.forEach(item=>{
      const card=document.createElement("div");card.className="rounded-xl border border-slate-200 p-3 mb-2";
      const title=document.createElement("p");title.className="font-bold";title.textContent=item.name||"Evaluación";
      const meta=document.createElement("p");meta.className="text-sm text-slate-600";meta.textContent=`${formatAdminDate(item.createdAt)} · Estado: ${item.paymentStatus||"pendiente"}`;
      card.append(title,meta);
      if(data.paymentsVisible){const amount=document.createElement("p");amount.className="text-sm text-slate-600";amount.textContent="Importe: "+formatCop(item.amountCop);card.appendChild(amount);}
      content.appendChild(card);
    });
    const note=document.createElement("p");note.className="notice mt-4";note.textContent="Este expediente muestra datos de perfil y metadatos de evaluaciones. Las respuestas clínicas y los informes completos mantienen sus permisos independientes.";content.appendChild(note);
  } catch(error) {
    content.replaceChildren();const message=document.createElement("p");message.textContent="No se pudo cargar el expediente: "+error.message;content.appendChild(message);
  }
}

async function viewAdminEvaluation(id) {
  if (!currentIsAdmin) {
    alert("No tienes permisos para consultar esta información.");
    return;
  }

  const dialog = $("admin-detail");
  const content = $("admin-detail-content");
  content.replaceChildren();
  const loading = document.createElement("p");
  loading.textContent = "Cargando información protegida…";
  content.appendChild(loading);
  dialog.classList.remove("hidden");
  dialog.setAttribute("aria-hidden", "false");
  $("admin-detail-close").focus();

  try {
    const response = await api(`/api/admin/evaluations/${encodeURIComponent(id)}`);
    const data = await response.json();
    const evaluation = data.evaluation;

    if (!evaluation || typeof evaluation !== "object") {
      throw new Error("La respuesta del servidor no contiene una evaluación válida.");
    }

    content.replaceChildren();
    const heading = document.createElement("h3");
    heading.className = "text-lg font-extrabold mb-3";
    heading.textContent = "Datos del participante";
    content.appendChild(heading);

    appendAdminDetailLine(content, "Nombre", evaluation.name);
    appendAdminDetailLine(content, "Correo", evaluation.email);
    appendAdminDetailLine(content, "Edad", evaluation.age);
    appendAdminDetailLine(content, "Objetivo", evaluation.goal);
    appendAdminDetailLine(content, "Estado del pago", evaluation.paymentStatus);
    appendAdminDetailLine(content, "Fecha", evaluation.createdAt
      ? new Date(evaluation.createdAt).toLocaleString("es-CO") : "—");

    const resultHeading = document.createElement("h3");
    resultHeading.className = "text-lg font-extrabold mt-6 mb-2";
    resultHeading.textContent = "Resultado del autorregistro";
    content.appendChild(resultHeading);
    appendAdminDetailLine(content, "Perfil orientativo", evaluation.profile);
    appendAdminDetailLine(content, "Descripción", evaluation.profileDescription);

    if (evaluation.scores && typeof evaluation.scores === "object") {
      const scoreHeading = document.createElement("h4");
      scoreHeading.className = "font-bold mt-3 mb-2";
      scoreHeading.textContent = "Dimensiones";
      content.appendChild(scoreHeading);
      Object.entries(evaluation.scores).forEach(([dimension, score]) => {
        appendAdminDetailLine(content, dimension, `${score}%`);
      });
    }

    if (Array.isArray(evaluation.recommendations) && evaluation.recommendations.length) {
      const recHeading = document.createElement("h4");
      recHeading.className = "font-bold mt-4 mb-2";
      recHeading.textContent = "Recomendaciones";
      content.appendChild(recHeading);
      const list = document.createElement("ul");
      list.className = "list-disc pl-5 text-sm text-slate-700 space-y-1";
      evaluation.recommendations.forEach((recommendation) => {
        const item = document.createElement("li");
        if (recommendation && typeof recommendation === "object") {
          const title = document.createElement("strong");
          title.textContent = recommendation.title || "Orientación";
          const detail = document.createElement("p");
          detail.textContent = recommendation.detail || "";
          detail.className = "text-sm text-slate-600";
          item.append(title, detail);
        } else {
          item.textContent = String(recommendation);
        }
        list.appendChild(item);
      });
      content.appendChild(list);
    }

    const answersHeading = document.createElement("h3");
    answersHeading.className = "text-lg font-extrabold mt-6 mb-3";
    answersHeading.textContent = "Respuestas registradas";
    content.appendChild(answersHeading);

    if (Array.isArray(evaluation.answers) && evaluation.answers.length) {
      evaluation.answers.forEach((answer, index) => {
        const item = document.createElement("div");
        item.className = "border-b border-slate-200 py-3";
        appendAdminDetailLine(item, `Pregunta ${index + 1}`, answer.question);
        appendAdminDetailLine(item, "Respuesta", answer.answer);
        appendAdminDetailLine(item, "Dimensión", answer.dimension);
        content.appendChild(item);
      });
    } else {
      appendAdminDetailLine(content, "Respuestas", "No hay respuestas almacenadas.");
    }
  } catch (error) {
    content.replaceChildren();
    const message = document.createElement("p");
    message.className = "text-red-600";
    message.textContent = "No fue posible consultar el detalle: " + error.message;
    content.appendChild(message);
  }
}

function closeAdminDetail() {
  const dialog = $("admin-detail");
  dialog.classList.add("hidden");
  dialog.setAttribute("aria-hidden", "true");
}

async function downloadAdminPdf(id) {
  try {
    const response = await api(
      `/api/admin/evaluations/${encodeURIComponent(id)}/pdf`
    );

    downloadBlob(await response.blob(), `NeuroEval-Pro-${id}.pdf`);

  } catch (error) {
    alert(error.message);
  }
}

/* =========================================================
   14. CERRAR SESIÓN
========================================================= */

async function logout() {
  stopPaymentPolling();
  closeAccountMenu();

  try {
    if (!auth) throw new Error("La autenticación todavía no está disponible.");
    await signOut(auth);
    currentUser = null;
    currentIsAdmin = false;
    profileData = null;
    $("session-label").textContent = "";
    $("account-menu-toggle").classList.add("hidden");
    show("auth-view");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("No se pudo cerrar la sesión. " + (error.message || "Inténtalo nuevamente."));
  }
}

/* =========================================================
   15. EVENTOS
========================================================= */

function registerEventListeners() {
  $("show-login").addEventListener("click", () => switchAuth("login"));
  $("show-register").addEventListener("click", () => switchAuth("register"));

  $("login-form").addEventListener("submit", loginWithEmail);
  $("register-form").addEventListener("submit", registerWithEmail);
  $("google-login").addEventListener("click", loginWithGoogle);

  $("forgot-open").addEventListener("click", openForgotPassword);
  $("back-login").addEventListener("click", () => {
    resetPasswordRecoveryForm();
    show("auth-view");
  });

  $("request-code-form").addEventListener("submit", requestPasswordCode);
  $("confirm-reset-form").addEventListener("submit", confirmPasswordReset);

  $("account-menu-toggle").addEventListener("click", toggleAccountMenu);
  $("menu-profile").addEventListener("click", showProfile);
  $("menu-tests").addEventListener("click", () => {
    closeAccountMenu();
    showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email);
  });
  $("menu-settings").addEventListener("click", showSettings);
  $("menu-logout").addEventListener("click", logout);
  $("menu-admin").addEventListener("click", () => { closeAccountMenu(); showAdmin(); });
  $("profile-back").addEventListener("click", () => {
    if (currentIsAdmin) showAdmin();
    else showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email);
  });
  $("settings-back").addEventListener("click", () => {
    if (currentIsAdmin) showAdmin();
    else showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email);
  });
  $("settings-password").addEventListener("click", () => {
    closeAccountMenu();
    openForgotPassword(currentUser?.email || "");
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu-wrap")) closeAccountMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAccountMenu();
  });

  $("start-adhd-evaluation").addEventListener("click", startAdhdEvaluation);
  $("start-parent-evaluation").addEventListener("click", openParentEvaluation);
  $("parent-evaluation-form").addEventListener("submit", startParentEvaluation);
  document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => navigateSection(button.dataset.nav)));
  document.querySelectorAll("[data-game]").forEach(button => button.addEventListener("click", () => openGame(button.dataset.game)));
  document.querySelectorAll("[data-activity]").forEach(button => button.addEventListener("click", () => completeActivity(button.dataset.activity)));
  $("refresh-progress").addEventListener("click", renderProgress);
  $("menu-tests").addEventListener("click", () => { closeAccountMenu(); navigateSection("tests"); });
  $("dashboard-logout").addEventListener("click", logout);
  $("customer-support-form").addEventListener("submit", createCustomerSupportTicket);
  $("customer-support-refresh").addEventListener("click", loadCustomerSupportTickets);

  $("prev-question").addEventListener("click", previousQuestion);
  $("next-question").addEventListener("click", nextQuestion);

  $("download-own-pdf").addEventListener("click", downloadOwnPdf);

  $("check-payment").addEventListener("click", () => checkPaymentStatus(true));
  $("logout-payment").addEventListener("click", logout);

  $("logout-result").addEventListener("click", logout);

  $("admin-detail-close").addEventListener("click", closeAdminDetail);
  $("admin-detail").addEventListener("click", (event) => {
    if (event.target === $("admin-detail")) closeAdminDetail();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("admin-detail").classList.contains("hidden")) {
      closeAdminDetail();
    }
  });

  $("admin-refresh").addEventListener("click", loadAdmin);
  $("admin-add-form").addEventListener("submit", createAdminFromForm);
  $("admin-price-form").addEventListener("submit", saveAdminPrice);
  $("admin-promo-form").addEventListener("submit", createPromoCode);
  $("admin-pricing-refresh").addEventListener("click", loadAdminPricing);
  $("promo-apply").addEventListener("click", () => createWompiCheckout($("promo-code").value.trim()));
  $("admin-managers-refresh").addEventListener("click", loadAdminAdministrators);
  $("admin-audit-refresh").addEventListener("click", loadAdminAudit);
  $("admin-logout").addEventListener("click", logout);
  document.querySelectorAll("[data-admin-tab]").forEach(button => button.addEventListener("click", () => setAdminTab(button.dataset.adminTab)));
  $("admin-open-evaluations").addEventListener("click", () => setAdminTab("evaluations"));
  $("admin-client-search").addEventListener("input", filterAdminTables);
  $("admin-evaluation-search").addEventListener("input", filterAdminTables);
  $("admin-health-refresh").addEventListener("click", loadAdminHealth);
  $("admin-analytics-refresh").addEventListener("click", loadAdminCommercialAnalytics);
  $("admin-health-details-refresh").addEventListener("click", loadAdminHealthDetails);
  $("admin-backup-export").addEventListener("click", exportAdminBackup);
  $("admin-support-refresh").addEventListener("click", loadAdminSupportTickets);
  $("admin-profile-open").addEventListener("click", showProfile);

  // Limpia el parámetro de retorno después de procesar la sesión.
  window.addEventListener("pageshow", () => {
    if (window.location.search.includes("evaluation=")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("evaluation");
      window.history.replaceState({}, document.title, url.pathname + url.search);
    }
  });
}

/* =========================================================
   16. ARRANQUE
========================================================= */

initializeFirebase();
