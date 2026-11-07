
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
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
  "Raramente",
  "A veces",
  "A menudo",
  "Muy a menudo"
];

const points = [0, 1, 2, 3, 4];

/* =========================================================
   2. BANCO DE PREGUNTAS
========================================================= */

const bank = [
  ["Atención y enfoque", "¿Te cuesta mantener la atención en tareas que requieren esfuerzo mental prolongado?", "inattention"],
  ["Atención y enfoque", "¿Comienzas proyectos con entusiasmo, pero te cuesta terminarlos?", "inattention"],
  ["Atención y enfoque", "¿Pierdes u olvidas objetos cotidianos importantes?", "inattention"],
  ["Atención y enfoque", "¿Te distraes fácilmente con ruidos o estímulos del entorno?", "inattention"],
  ["Atención y enfoque", "¿Te resulta difícil organizar los pasos para cumplir una meta?", "inattention"],
  ["Atención y enfoque", "¿Olvidas citas, compromisos o tareas habituales?", "inattention"],
  ["Inquietud e impulsividad", "¿Sientes necesidad de moverte cuando debes permanecer sentado?", "hyperactivity"],
  ["Inquietud e impulsividad", "¿Interrumpes o respondes antes de que terminen de hablar?", "hyperactivity"],
  ["Inquietud e impulsividad", "¿Tomas decisiones apresuradas de las que luego te arrepientes?", "hyperactivity"],
  ["Inquietud e impulsividad", "¿Te cuesta esperar tu turno?", "hyperactivity"],
  ["Inquietud e impulsividad", "¿Te sientes inquieto incluso en momentos de descanso?", "hyperactivity"],
  ["Función ejecutiva", "¿Pospones tareas hasta que el plazo está muy cerca?", "inattention"],
  ["Función ejecutiva", "¿Te cuesta priorizar cuando tienes varias tareas?", "inattention"],
  ["Diagnóstico diferencial", "¿Tus dificultades de atención aparecen junto con preocupación o tensión frecuente?", "differential"],
  ["Diagnóstico diferencial", "¿Tu concentración empeoró recientemente debido a fatiga o estrés?", "differential"],
  ["Historia", "¿Recuerdas dificultades similares durante tu infancia, antes de los 12 años?", "inattention"],
  ["Diagnóstico diferencial", "¿Los problemas varían mucho según tu descanso o carga de trabajo?", "differential"],
  ["Organización", "¿Te cuesta calcular cuánto tiempo necesitas para completar actividades?", "inattention"]
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

    registerEventListeners();

    onAuthStateChanged(auth, handleAuthState);

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
    "auth/popup-closed-by-user": "Se cerró la ventana de Google.",
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
    await signInWithPopup(auth, provider);
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

  questions = [...bank]
    .sort(() => Math.random() - 0.5)
    .slice(0, 15);

  answers = new Array(15).fill(null);
  currentIndex = 0;

  renderQuestion();
  show("quiz-view");
}

function renderQuestion() {
  const question = questions[currentIndex];
  const percentage = Math.round(((currentIndex + 1) / questions.length) * 100);

  $("progress-label").textContent =
    `Pregunta ${currentIndex + 1} de ${questions.length}`;

  $("progress-pct").textContent = `${percentage}%`;
  $("progress-bar").style.width = `${percentage}%`;

  $("q-category").textContent = question[0];
  $("q-text").textContent = question[1];

  $("prev-question").disabled = currentIndex === 0;

  const answersContainer = $("answers");
  answersContainer.innerHTML = "";

  choices.forEach((label, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "answer-option";

    if (answers[currentIndex] === index) {
      button.classList.add("selected");
    }

    button.textContent =
      `${answers[currentIndex] === index ? "✓  " : ""}${label}`;

    button.addEventListener("click", () => {
      answers[currentIndex] = index;
      renderQuestion();
    });

    answersContainer.appendChild(button);
  });

  const isLast = currentIndex === questions.length - 1;

  $("next-question").textContent = isLast
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
  const sums = {
    inattention: 0,
    hyperactivity: 0,
    differential: 0
  };

  const counts = {
    inattention: 0,
    hyperactivity: 0,
    differential: 0
  };

  const qa = questions.map((question, index) => ({
    category: question[0],
    question: question[1],
    dimension: question[2],
    answer: choices[answers[index]],
    points: points[answers[index]]
  }));

  qa.forEach((answer) => {
    sums[answer.dimension] += answer.points;
    counts[answer.dimension]++;
  });

  const scores = {};

  Object.keys(sums).forEach((key) => {
    scores[key] = counts[key]
      ? Math.round((sums[key] / (counts[key] * 4)) * 100)
      : 0;
  });

  let profile;
  let description;
  let recommendations;

  if (scores.differential >= 60) {
    profile = "Indicadores asociados a estrés o sobrecarga";
    description =
      "Tus respuestas señalan factores que podrían relacionarse con estrés, fatiga o tensión y que pueden influir en la concentración. Es importante explorar el contexto y otras posibles causas.";

    recommendations = [
      "Revisar hábitos de sueño, descanso y carga de actividades.",
      "Registrar cuándo aparecen las dificultades y qué situaciones las intensifican.",
      "Consultar con un profesional de salud si estas dificultades afectan tu vida cotidiana."
    ];

  } else if (scores.inattention >= 60 && scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inatención e inquietud";
    description =
      "Tus respuestas muestran frecuencia elevada en las dimensiones exploradas. Este resultado no confirma TDAH y requiere una valoración profesional para comprender su origen.";

    recommendations = [
      "Solicitar orientación con psicología clínica o psiquiatría.",
      "Preparar ejemplos concretos de dificultades en distintos contextos.",
      "Explorar la historia de estas experiencias y su impacto funcional."
    ];

  } else if (scores.inattention >= 60) {
    profile = "Elevación de indicadores de inatención";
    description =
      "Tus respuestas muestran dificultades frecuentes relacionadas con atención y organización. Se requiere una evaluación profesional para conocer su origen.";

    recommendations = [
      "Dividir tareas grandes en pasos breves y concretos.",
      "Utilizar recordatorios externos y calendarios.",
      "Consultar con un profesional cualificado si las dificultades persisten."
    ];

  } else if (scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inquietud e impulsividad";
    description =
      "Se observan respuestas frecuentes relacionadas con inquietud o impulsividad. Estas respuestas no constituyen por sí solas un diagnóstico.";

    recommendations = [
      "Practicar pausas planificadas y estrategias de autorregulación.",
      "Registrar situaciones que desencadenan inquietud o impulsividad.",
      "Buscar orientación profesional si afecta el funcionamiento diario."
    ];

  } else {
    profile = "Indicadores bajos o moderados en este autorregistro";
    description =
      "Las respuestas no muestran una elevación marcada en las dimensiones exploradas. Esto no descarta dificultades ni sustituye una evaluación si existe preocupación.";

    recommendations = [
      "Mantener hábitos de sueño y organización saludables.",
      "Observar si las dificultades aparecen en situaciones específicas.",
      "Solicitar orientación profesional si las dificultades persisten o afectan tu vida diaria."
    ];
  }

  return {
    answers: qa,
    scores,
    profile,
    profileDescription: description,
    recommendations
  };
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

    $("result-profile").textContent =
      evaluation.profile || "Resumen de autorregistro";

    $("result-description").textContent =
      evaluation.profileDescription || evaluation.description || "";

    const scores = evaluation.scores || currentScores || {};

    const dimensions = [
      ["Atención y función ejecutiva", "inattention"],
      ["Inquietud e impulsividad", "hyperactivity"],
      ["Indicadores de estrés y contexto", "differential"]
    ];

    $("score-list").innerHTML = "";

    dimensions.forEach(([label, key]) => {
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
    });

    $("recommendations").innerHTML = "";

    const recommendations =
      evaluation.recommendations || currentRecommendations || [];

    recommendations.forEach((recommendation) => {
      const item = document.createElement("li");
      item.textContent = recommendation;
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
        item.textContent = String(recommendation);
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
