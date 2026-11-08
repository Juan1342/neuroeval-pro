/* NEUROEVAL_PUBLIC_AUTH_BUILD: 20261107-5 */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

/* =========================================================
   1. CONFIGURACIÓN Y ESTADO
========================================================= */

const $ = (id) => document.getElementById(id);

const EVALUATION_PRICE_COP = 4000;
// Solo bloquea el registro público de la cuenta reservada; no concede permisos.
const ADMIN_EMAIL = "jzamorazapata@gmail.com";

let auth;
let currentUser = null;
let currentIsAdmin = false;
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

const choices = [
  "Nunca",
  "Rara vez",
  "A veces",
  "Con frecuencia",
  "Casi siempre"
];

const points = [0, 1, 2, 3, 4];

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
    "admin-view"
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
    nav.classList.toggle("hidden", !currentUser || currentIsAdmin || !navViews.includes(viewId));
  }
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

    const tokenResult = await getIdTokenResult(user, true);
    // La interfaz sigue el mismo permiso que valida el backend.
    // Un correo coincidente no concede acceso administrativo.
    currentIsAdmin = tokenResult.claims.admin === true;

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
      // El retorno desde Wompi debe conservar el flujo de pago pendiente.
      lastEvaluationId = evaluationIdFromUrl;
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
      const len=Math.min(3+Math.floor((level-1)/2),14),seq=Array.from({length:len},()=>Math.floor(Math.random()*10));
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
      const target=game==="search"?"★":"●",total=Math.min(18+level*2,64),amount=Math.min(3+Math.floor(level/2),Math.floor(total/3));
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
      const len=Math.min(3+Math.floor(level/2),10),selected=bank.slice().sort(()=>Math.random()-.5).slice(0,len);
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
      const total=Math.min(12+level,40),odd=level<4?"◆":level<8?"◉":level<12?"◎":"◌",index=Math.floor(Math.random()*total),grid=document.createElement("div");grid.className="game-symbol-grid";
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
      const arrows=["↑","→","↓","←"],start=Math.floor(Math.random()*4),turns=1+Math.floor(Math.random()*Math.min(level+1,7)),answer=arrows[(start+turns)%4];
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
      const starCount=3+Math.floor(Math.random()*Math.min(5+level,12)),triCount=2+Math.floor(Math.random()*Math.min(4+level,10));
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
  const labels = { breathing:"Respiración consciente", planning:"Divide una tarea", grounding:"Pausa de observación", focus:"Enfoque de 10 minutos", recall:"Recuerdo del día", movement:"Pausa de movimiento" };
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

function openForgotPassword() {
  show("forgot-view");
  $("confirm-reset-form").classList.add("hidden");
  $("request-code-form").classList.remove("hidden");
  showMessage("reset-message", "");
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
    $("confirm-reset-form").classList.add("hidden");

  } catch (error) {
    showMessage("reset-message", error.message, true);
  }
}

/* =========================================================
   9. INICIAR Y MOSTRAR EVALUACIÓN
========================================================= */

async function startQuiz(name, age, goal) {
  profileData = { name, age, goal };
  // Orden temático fijo para que la experiencia tenga una progresión comprensible.
  questions = [...bank];
  answers = new Array(questions.length).fill(null);
  currentIndex = 0;
  renderQuestion();
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
  const options = isInteractive ? question[6] : choices;
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
    answer: question[5] === "task" || question[5] === "study" ? answers[index] : choices[answers[index]]
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
    showMessage("payment-message", error.message, true);
  }
}

async function createWompiCheckout() {
  const container = $("wompi-checkout");
  container.innerHTML = "";

  try {
    const response = await api("/api/payments/wompi-signature", {
      method: "POST",
      body: JSON.stringify({ evaluationId: lastEvaluationId })
    });

    const data = await response.json();

    if (!data.publicKey || !data.signature || !data.reference) {
      throw new Error("El servidor no entregó los datos necesarios para Wompi.");
    }

    if (Number(data.amountInCents) !== EVALUATION_PRICE_COP * 100) {
      throw new Error("El valor de pago recibido no coincide con el precio configurado.");
    }

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

    $("result-name").textContent =
      `${evaluation.name || profileData?.name || ""} · ${currentUser.email}`;
    $("result-profile").textContent = evaluation.profile || "Resumen orientativo";
    $("result-description").textContent = evaluation.profileDescription || "";

    const dimensionMeta = evaluation.dimensions || {};
    const scores = evaluation.scores || {};
    const labels = {
      inattention: "Atención sostenida y memoria cotidiana",
      executive: "Organización y funciones ejecutivas",
      hyperactivity: "Inquietud e impulsividad",
      emotionalContext: "Regulación emocional",
      context: "Estrés, preocupación y descanso",
      impact: "Impacto en la vida cotidiana",
      history: "Historia y presencia en distintos entornos"
    };
    $("score-list").innerHTML = "";
    $("result-dimension-explanations").innerHTML = "";

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
      ["Estrés y descanso", summary.contextInfluence],
      ["Impacto cotidiano", summary.dailyImpact],
      ["Historia y contextos", summary.childhoodAndSettings]
    ].forEach(([label, value]) => {
      if (!value) return;
      const p = document.createElement("p");
      p.className = "text-sm text-slate-600 mb-2";
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      p.append(strong, document.createTextNode(value));
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

async function loadAdmin() {
  if (!currentIsAdmin) {
    alert("No tienes permisos para consultar esta sección.");
    await signOut(auth);
    return;
  }

  try {
    const response = await api("/api/admin/overview");
    const data = await response.json();

    $("stat-users").textContent = data.users ?? 0;
    $("stat-evals").textContent = data.evaluations ?? 0;

    const tbody = $("admin-rows");
    tbody.innerHTML = "";

    const records = Array.isArray(data.records) ? data.records : [];

    if (!records.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "p-4 text-slate-500";
      cell.textContent = "Aún no hay evaluaciones registradas.";

      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    records.forEach((record) => {
      const row = document.createElement("tr");

      const date = record.createdAt
        ? new Date(record.createdAt).toLocaleString("es-CO")
        : "—";

      const values = [
        date,
        record.name || "—",
        record.email || "—",
        record.profile || "—"
      ];

      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      const actionCell = document.createElement("td");
      actionCell.className = "space-y-2";
      
      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.className = "text-indigo-600 underline font-bold block";
      detailButton.textContent = "Ver detalle";
      detailButton.addEventListener("click", () => viewAdminEvaluation(record.id));
      
      const pdfButton = document.createElement("button");
      pdfButton.type = "button";
      pdfButton.className = "text-indigo-600 underline font-bold block";
      pdfButton.textContent = "Descargar PDF";
      pdfButton.addEventListener("click", () => downloadAdminPdf(record.id));

      actionCell.append(detailButton, pdfButton);
      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

  } catch (error) {
    console.error("Panel administrativo:", error);
    alert("No se pudo cargar el panel: " + error.message);
  }
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
  $("back-login").addEventListener("click", () => show("auth-view"));

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
  $("profile-back").addEventListener("click", () =>
    showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email));
  $("settings-back").addEventListener("click", () =>
    showDashboard(profileData?.name || currentUser?.displayName || currentUser?.email));
  $("settings-password").addEventListener("click", () => {
    if (currentUser?.email) $("reset-email").value = currentUser.email;
    closeAccountMenu();
    openForgotPassword();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".account-menu-wrap")) closeAccountMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAccountMenu();
  });

  $("start-adhd-evaluation").addEventListener("click", startAdhdEvaluation);
  document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => navigateSection(button.dataset.nav)));
  document.querySelectorAll("[data-game]").forEach(button => button.addEventListener("click", () => openGame(button.dataset.game)));
  document.querySelectorAll("[data-activity]").forEach(button => button.addEventListener("click", () => completeActivity(button.dataset.activity)));
  $("refresh-progress").addEventListener("click", renderProgress);
  $("menu-tests").addEventListener("click", () => { closeAccountMenu(); navigateSection("tests"); });
  $("dashboard-logout").addEventListener("click", logout);

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
  $("admin-logout").addEventListener("click", logout);

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
