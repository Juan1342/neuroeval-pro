import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
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

const configResponse = await fetch("/firebase-config.js");
const configText = await configResponse.text();
const match = configText.match(/window\.FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\});/);
const config = match ? JSON.parse(match[1]) : {};

if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
  const el = document.getElementById("auth-message");
  if (el) {
    el.textContent = "Falta configurar Firebase en el servidor (FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID).";
    el.className = "text-sm mt-4 text-center text-rose-600";
  }
  console.error("Configuración Firebase incompleta", config);
}

let firebaseApp, auth;
try {
  firebaseApp = initializeApp(config);
  auth = getAuth(firebaseApp);
} catch (e) {
  console.error("Firebase init failed", e);
  const el = document.getElementById("auth-message");
  if (el) {
    el.textContent = "No se pudo iniciar Firebase. Revisa las variables FIREBASE_* en Render.";
    el.className = "text-sm mt-4 text-center text-rose-600";
  }
}

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentIsAdmin = false;
let currentIndex = 0;
let questions = [];
let answers = [];
let lastEvaluationId = null;
let lastEvaluation = null;

const ADMIN_EMAIL = "jzamorazapata@gmail.com";
const PRICE_LABEL = "$19.900 COP";

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

const choices = ["Nunca", "Raramente", "A veces", "A menudo", "Muy a menudo"];
const points = [0, 1, 2, 3, 4];
const VIEWS = ["auth-view", "forgot-view", "dashboard-view", "quiz-view", "result-view", "receipt-view", "admin-view"];

function show(id) {
  VIEWS.forEach((x) => $(x)?.classList.toggle("hidden", x !== id));
}

function message(id, text, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = `text-sm mt-4 text-center min-h-[1.25rem] ${error ? "text-rose-600" : "text-emerald-700"}`;
}

function toast(text, error = false) {
  const el = $("toast");
  el.textContent = text;
  el.className = `toast ${error ? "bg-rose-600 text-white" : "bg-slate-900 text-white"}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3500);
}

function setLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector(".btn-text");
  if (loading) {
    btn.disabled = true;
    btn.dataset.original = text ? text.textContent : btn.textContent;
    if (text) text.innerHTML = `<span class="spinner inline-block"></span>`;
    else btn.innerHTML = `<span class="spinner inline-block"></span>`;
  } else {
    btn.disabled = false;
    if (text) text.textContent = btn.dataset.original || "Continuar";
    else if (btn.dataset.original) btn.textContent = btn.dataset.original;
  }
}

async function parseResponse(r) {
  const raw = await r.text();
  let d = {};
  try {
    d = JSON.parse(raw);
  } catch {
    d = { error: raw || "Error del servidor" };
  }
  return { ok: r.ok, status: r.status, data: d };
}

async function api(url, options = {}) {
  const token = currentUser ? await currentUser.getIdToken() : null;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const { data } = await parseResponse(response);
    throw new Error(data.error || "Ocurrió un error.");
  }
  return response;
}

function switchAuth(mode) {
  $("login-form").classList.toggle("hidden", mode !== "login");
  $("register-form").classList.toggle("hidden", mode !== "register");
  $("show-login").className = `btn flex-1 !py-2.5 text-sm ${mode === "login" ? "primary" : "muted"}`;
  $("show-register").className = `btn flex-1 !py-2.5 text-sm ${mode === "register" ? "primary" : "muted"}`;
  message("auth-message", "");
}

$("show-login").onclick = () => switchAuth("login");
$("show-register").onclick = () => switchAuth("register");

async function doEmailLogin() {
  const btn = $("login-btn") || $("login-form")?.querySelector('button[type="submit"]');
  const email = ($("login-email")?.value || "").trim();
  const password = $("login-password")?.value || "";

  if (!email || !password) {
    message("auth-message", "Escribe tu correo y contraseña.", true);
    return;
  }

  setLoading(btn, true);
  message("auth-message", "Iniciando sesión…");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    message("auth-message", "Acceso correcto. Cargando…");
  } catch (err) {
    console.error("Login error:", err);
    message("auth-message", friendlyAuthError(err), true);
  } finally {
    setLoading(btn, false);
  }
}

// CORRECCIÓN DEL BOTÓN INICIAR SESIÓN
const loginForm = $("login-form");
const loginButton = $("login-btn");

if (loginForm && loginButton && loginButton.form === loginForm) {
  loginButton.type = "submit";
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await doEmailLogin();
  });
}

if (loginButton && (!loginForm || loginButton.form !== loginForm)) {
  loginButton.type = "button";
  loginButton.addEventListener("click", async (e) => {
    e.preventDefault();
    await doEmailLogin();
  });
}

$("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("register-btn");
  setLoading(btn, true);

  try {
    const name = $("reg-name").value.trim();
    const email = $("reg-email").value.trim().toLowerCase();
    const age = Number($("reg-age").value);
    const goal = $("reg-goal").value;

    if (!$("consent").checked) throw new Error("Debes aceptar el aviso de privacidad.");
    if (email === ADMIN_EMAIL) throw new Error("El correo reservado para administración no puede registrarse como cliente.");

    const cred = await createUserWithEmailAndPassword(auth, email, $("reg-password").value);
    currentUser = cred.user;
    window.profileData = { name, age, goal };

    await api("/api/profile", {
  method: "POST",
  body: JSON.stringify({ name, age, goal })
});

window.profileData = { name, age, goal };
showDashboard(name, null);

    showDashboard(name, null);
  } catch (err) {
    message("auth-message", friendlyAuthError(err), true);
  } finally {
    setLoading(btn, false);
  }
});

$("google-login").onclick = async () => {
  const btn = $("google-login");
  btn.disabled = true;
  message("auth-message", "Abriendo Google…");

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });

    const result = await signInWithPopup(auth, provider);
    if (result?.user) {
      message("auth-message", "Acceso con Google correcto. Cargando…");
    }
  } catch (err) {
    console.error("Google login error:", err);
    message("auth-message", friendlyAuthError(err), true);
  } finally {
    btn.disabled = false;
  }
};

function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Usa Iniciar sesión.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar. Vuelve a intentarlo y no cierres la ventana emergente.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.",
    "auth/cancelled-popup-request": "Se canceló el inicio con Google. Inténtalo otra vez.",
    "auth/network-request-failed": "Error de red. Revisa tu conexión a internet.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase. En Firebase Console → Authentication → Settings → Authorized domains, agrega tu dominio de Render (ej: tu-app.onrender.com).",
    "auth/internal-error": "Error interno de autenticación. Revisa la configuración de Firebase."
  };

  if (err?.code && map[err.code]) return map[err.code];

  const msg = err?.message || "";
  if (/session|sesión/i.test(msg) && /closed|cerr/i.test(msg)) {
    return "La ventana de Google se cerró antes de completar el acceso. Inténtalo de nuevo.";
  }

  return msg || "No se pudo completar la operación.";
}

// Recuperación de contraseña
$("forgot-open").onclick = () => {
  show("forgot-view");
  $("confirm-reset-form").classList.add("hidden");
  $("request-code-form").classList.remove("hidden");
  message("reset-message", "");
};

$("back-login").onclick = () => show("auth-view");

$("request-code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Enviando…";
  }

  try {
    const email = $("reset-email").value.trim().toLowerCase();
    const r = await fetch("/api/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const { ok, status, data } = await parseResponse(r);

    if (!ok) {
      if (status === 429) throw new Error(data.error || "Demasiados intentos. Espera un minuto.");
      throw new Error(data.error || "No se pudo enviar el código.");
    }

    $("request-code-form").classList.add("hidden");
    $("confirm-reset-form").classList.remove("hidden");
    message("reset-message", "Si la cuenta existe, recibirás un código. Revisa también la carpeta de spam.");
  } catch (err) {
    message("reset-message", err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enviar código";
    }
  }
});

$("confirm-reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Restableciendo…";
  }

  try {
    const r = await fetch("/api/password/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: $("reset-email").value.trim(),
        code: $("reset-code").value.trim(),
        newPassword: $("reset-new-password").value
      })
    });

    const { ok, status, data } = await parseResponse(r);

    if (!ok) {
      if (status === 429) throw new Error(data.error || "Demasiados intentos.");
      throw new Error(data.error || "No se pudo restablecer la contraseña.");
    }

    message("reset-message", data.message || "Contraseña actualizada.");
    $("confirm-reset-form").classList.add("hidden");
  } catch (err) {
    message("reset-message", err.message, true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Restablecer contraseña";
    }
  }
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    $("session-label").textContent = "";
    currentIsAdmin = false;
    show("auth-view");
    return;
  }

  $("session-label").textContent = user.email || "";

  try {
    let tokenResult;

    try {
      tokenResult = await getIdTokenResult(user, true);
    } catch (tokenErr) {
      console.warn("No se pudo refrescar token, usando claims en caché", tokenErr);
      tokenResult = await getIdTokenResult(user, false);
    }

    currentIsAdmin = tokenResult.claims.admin === true &&
      user.email?.toLowerCase() === ADMIN_EMAIL;

    if (currentIsAdmin) {
      show("admin-view");
      try {
        await loadAdmin();
      } catch (e) {
        console.error(e);
        toast("Panel admin: " + e.message, true);
      }
      return;
    }

    let profileData = null;

    try {
      const profileResponse = await api("/api/profile");
      profileData = (await profileResponse.json()).profile;
    } catch (e) {
      console.warn("Perfil no disponible aún", e);
    }

    const displayName = profileData?.name ||
      user.displayName ||
      (user.email ? user.email.split("@")[0] : "Usuario");

    const age = profileData?.age ?? null;
    const goal = profileData?.goal || "Evaluación cognitiva";

    if (!profileData) {
      try {
        await api("/api/profile", {
          method: "POST",
          body: JSON.stringify({ name: displayName, age: null, goal })
        });
      } catch (e) {
        console.warn("No se pudo crear perfil mínimo", e);
      }
    }

    window.profileData = { name: displayName, age, goal };

    let evaluations = [];

    try {
      const evRes = await api("/api/my-evaluations");
      evaluations = (await evRes.json()).evaluations || [];
    } catch (e) {
      console.warn("No se pudieron cargar evaluaciones", e);
    }

    if (evaluations.length > 0) {
      lastEvaluation = evaluations[0];
      lastEvaluationId = lastEvaluation.id;
      showDashboard(displayName, lastEvaluation);
    } else {
      lastEvaluation = null;
      lastEvaluationId = null;
      showDashboard(displayName, null);
    }
  } catch (e) {
    console.error("onAuthStateChanged error:", e);

    const fallbackName = user.displayName ||
      (user.email ? user.email.split("@")[0] : "Usuario");

    window.profileData = window.profileData || {
      name: fallbackName,
      age: null,
      goal: "Evaluación cognitiva"
    };

    showDashboard(fallbackName, lastEvaluation);
    toast("Algunos datos no cargaron, pero tu sesión sigue activa.", true);
  }
});
function isPaid(ev) {
  return ev && ev.paymentStatus === "paid";
}

function showDashboard(name, lastEval) {
  $("dash-greeting").textContent = `Hola, ${name}`;
  show("dashboard-view");

  if (lastEval) {
    $("dash-last-result").classList.remove("hidden");
    $("dash-empty").classList.add("hidden");
    $("dash-profile").textContent = lastEval.profile || "Sin perfil";

    $("dash-date").textContent = lastEval.createdAt
      ? `Realizado el ${new Date(lastEval.createdAt).toLocaleString("es-CO")}`
      : "";

    const badge = $("dash-pay-badge");

    if (isPaid(lastEval)) {
      badge.textContent = "Pagado";
      badge.className = "badge badge-paid";
      $("dash-locked").classList.add("hidden");
      $("pay-report-btn").classList.add("hidden");
      $("view-last-pdf").classList.remove("hidden");
      $("view-receipt-btn").classList.remove("hidden");
    } else {
      badge.textContent = "Pendiente de pago";
      badge.className = "badge badge-pending";
      $("dash-locked").classList.remove("hidden");
      $("pay-report-btn").classList.remove("hidden");
      $("pay-report-btn").textContent = `Pagar informe y desbloquear (${PRICE_LABEL})`;
      $("view-last-pdf").classList.add("hidden");
      $("view-receipt-btn").classList.add("hidden");
    }

    const scores = lastEval.scores || {};
    $("dash-scores").innerHTML = "";

    if (isPaid(lastEval)) {
      [
        ["Inatención y función ejecutiva", "inattention"],
        ["Hiperactividad e impulsividad", "hyperactivity"],
        ["Indicadores diferenciales", "differential"]
      ].forEach(([label, key]) => {
        const val = scores[key] ?? 0;
        const div = document.createElement("div");

        div.innerHTML = `
          <div class="flex justify-between text-sm mb-1">
            <span class="text-slate-600">${label}</span>
            <b>${val}%</b>
          </div>
          <div class="score-bar">
            <div class="score-fill" style="width:${val}%"></div>
          </div>
        `;

        $("dash-scores").appendChild(div);
      });
    } else {
      $("dash-scores").innerHTML =
        `<p class="text-sm text-slate-500">Los puntajes detallados se muestran tras el pago.</p>`;
    }
  } else {
    $("dash-last-result").classList.add("hidden");
    $("dash-empty").classList.remove("hidden");
  }
}

async function processPayment(evalId) {
  try {
    toast("Procesando pago…");

    const r = await api(`/api/my-evaluations/${evalId}/pay`, {
      method: "POST",
      body: JSON.stringify({ method: "online" })
    });

    const d = await r.json();

    lastEvaluation = {
      ...lastEvaluation,
      paymentStatus: "paid",
      paymentRef: d.paymentRef,
      paidAt: new Date().toISOString()
    };

    toast("Pago confirmado. Informe desbloqueado.");
    return d;
  } catch (e) {
    toast(e.message, true);
    throw e;
  }
}

$("pay-report-btn").onclick = async () => {
  if (!lastEvaluationId) return;

  try {
    await processPayment(lastEvaluationId);
    showDashboard(window.profileData?.name || "Usuario", lastEvaluation);
    openResultView(lastEvaluation, true);
  } catch (_) {}
};

$("pay-from-result").onclick = async () => {
  if (!lastEvaluationId) return;

  try {
    await processPayment(lastEvaluationId);
    openResultView(lastEvaluation, true);
  } catch (_) {}
};

$("start-first-quiz").onclick = () => {
  const p = window.profileData || {};
  startQuiz(p.name, p.age, p.goal);
};

$("retake-quiz").onclick = () => {
  const p = window.profileData || {};
  startQuiz(p.name, p.age, p.goal);
};

$("view-last-pdf").onclick = async () => {
  if (!lastEvaluationId) return;

  try {
    const r = await api(`/api/my-evaluations/${lastEvaluationId}/pdf`);
    downloadBlob(await r.blob(), "NeuroEval-informe.pdf");
  } catch (e) {
    toast(e.message, true);
  }
};

$("view-receipt-btn").onclick = () => showReceipt(lastEvaluation);
$("view-receipt-result").onclick = () => showReceipt(lastEvaluation);
$("logout-dash").onclick = () => signOut(auth);
$("go-dashboard").onclick = () =>
  showDashboard(window.profileData?.name || "Usuario", lastEvaluation);
$("receipt-back").onclick = () =>
  showDashboard(window.profileData?.name || "Usuario", lastEvaluation);

function showReceipt(ev) {
  if (!ev || !isPaid(ev)) {
    toast("Aún no hay pago registrado.", true);
    return;
  }

  const body = $("receipt-body");

  body.innerHTML = `
    <p><strong>Concepto:</strong> Informe de autorregistro NeuroEval Pro</p>
    <p><strong>Cliente:</strong> ${ev.name || "—"}</p>
    <p><strong>Correo:</strong> ${ev.email || currentUser?.email || "—"}</p>
    <p><strong>Referencia:</strong> ${ev.paymentRef || "—"}</p>
    <p><strong>Monto:</strong> ${PRICE_LABEL}</p>
    <p><strong>Estado:</strong> Pagado</p>
    <p><strong>Fecha:</strong> ${
      ev.paidAt
        ? new Date(ev.paidAt).toLocaleString("es-CO")
        : new Date().toLocaleString("es-CO")
    }</p>
  `;

  show("receipt-view");
}

function startQuiz(name, age, goal) {
  window.profileData = { name, age, goal };
  questions = [...bank].sort(() => Math.random() - 0.5).slice(0, 15);
  answers = new Array(15).fill(null);
  currentIndex = 0;
  renderQuestion();
  show("quiz-view");
}

function renderQuestion() {
  const q = questions[currentIndex];
  const pct = Math.round(((currentIndex + 1) / 15) * 100);

 $("progress-label").textContent =
  `Pregunta ${currentIndex + 1} de 15 — ${pct}%`;

$("progress-pct").textContent = "";
  $("progress-bar").style.width = pct + "%";
  $("q-category").textContent = q[0];
  $("q-text").textContent = q[1];
  $("prev-question").disabled = currentIndex === 0;
  $("prev-question").style.opacity = currentIndex === 0 ? "0.4" : "1";
  $("answers").innerHTML = "";

  choices.forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `answer-btn ${answers[currentIndex] === i ? "selected" : ""}`;
    b.textContent = label + (answers[currentIndex] === i ? "  ✓" : "");

    b.onclick = () => {
      answers[currentIndex] = i;
      renderQuestion();
    };

    $("answers").appendChild(b);
  });

  $("next-question").textContent =
    currentIndex === 14 ? "Finalizar evaluación" : "Siguiente";

  $("next-question").disabled = answers[currentIndex] === null;
}

$("prev-question").onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
};

$("next-question").onclick = async () => {
  if (answers[currentIndex] === null) return;

  if (currentIndex < 14) {
    currentIndex++;
    renderQuestion();
    return;
  }

  await finishEvaluation();
};

function buildAnalysisText(scores, profile) {
  const parts = [];

  parts.push(`El perfil orientativo obtenido es: “${profile}”.`);

  if (scores.inattention >= 60) {
    parts.push(`La inatención y función ejecutiva aparecen elevadas (${scores.inattention}%), lo que sugiere dificultades frecuentes para sostener la atención, organizar o concluir tareas.`);
  } else if (scores.inattention >= 40) {
    parts.push(`La inatención se sitúa en rango moderado (${scores.inattention}%).`);
  } else {
    parts.push(`Los indicadores de inatención están en rango bajo (${scores.inattention}%).`);
  }

  if (scores.hyperactivity >= 60) {
    parts.push(`La hiperactividad/impulsividad está elevada (${scores.hyperactivity}%).`);
  } else if (scores.hyperactivity >= 40) {
    parts.push(`La inquietud e impulsividad se observan en nivel moderado (${scores.hyperactivity}%).`);
  } else {
    parts.push(`Los indicadores de hiperactividad están en rango bajo (${scores.hyperactivity}%).`);
  }

  if (scores.differential >= 60) {
    parts.push(`Los indicadores de estrés o fatiga están elevados (${scores.differential}%). Conviene valorar sueño, carga y factores emocionales antes de atribuir todo a un patrón atencional.`);
  } else {
    parts.push(`Los indicadores diferenciales de estrés/fatiga no muestran elevación marcada (${scores.differential}%).`);
  }

  parts.push("Estos resultados son orientativos y no constituyen un diagnóstico de TDAH ni de ningún otro trastorno.");

  return parts.join(" ");
}
async function finishEvaluation() {
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

  const qa = questions.map((q, i) => ({
    category: q[0],
    question: q[1],
    dimension: q[2],
    answer: choices[answers[i]],
    points: points[answers[i]]
  }));

  qa.forEach(a => {
    sums[a.dimension] += a.points;
    counts[a.dimension]++;
  });

  const scores = {};

  Object.keys(sums).forEach(k => {
    scores[k] = Math.round(
      (sums[k] / (counts[k] * 4 || 1)) * 100
    );
  });

  let profile, description, recommendations;

  if (scores.differential >= 60) {
    profile = "Indicadores asociados a estrés o sobrecarga";
    description = "Las respuestas señalan posibles factores de estrés, fatiga o ansiedad que pueden afectar la atención. Es importante explorar el contexto y otras causas.";

    recommendations = [
      "Revisar sueño, descanso y carga de actividades.",
      "Registrar cuándo aparecen las dificultades y qué las empeora.",
      "Consultar con un profesional de salud para explorar factores emocionales, médicos y ambientales."
    ];

  } else if (scores.inattention >= 60 && scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inatención e hiperactividad";
    description = "Se observan respuestas frecuentes en ambas dimensiones. Este patrón no confirma TDAH y requiere valoración clínica.";

    recommendations = [
      "Solicitar una valoración con psicología clínica o psiquiatría.",
      "Preparar ejemplos concretos de dificultades en distintos contextos.",
      "Explorar historia de síntomas desde la infancia y su impacto funcional."
    ];

  } else if (scores.inattention >= 60) {
    profile = "Elevación de indicadores de inatención";
    description = "Las respuestas muestran dificultades frecuentes relacionadas con atención y organización. Se requiere evaluación profesional para conocer su origen.";

    recommendations = [
      "Usar recordatorios externos y dividir tareas en pasos breves.",
      "Registrar el impacto en estudio, trabajo y vida cotidiana.",
      "Consultar con un profesional cualificado."
    ];

  } else if (scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inquietud e impulsividad";
    description = "Se observan respuestas frecuentes relacionadas con inquietud o impulsividad. No constituyen por sí solas un diagnóstico.";

    recommendations = [
      "Practicar pausas planificadas y estrategias de autorregulación.",
      "Registrar situaciones que desencadenan inquietud o impulsividad.",
      "Consultar con un profesional si afecta el funcionamiento diario."
    ];

  } else {
    profile = "Indicadores bajos o moderados en este autorregistro";
    description = "Las respuestas no muestran una elevación marcada en las dimensiones exploradas. Esto no descarta dificultades ni sustituye una evaluación si existe preocupación.";

    recommendations = [
      "Mantener hábitos de sueño y organización saludables.",
      "Solicitar orientación profesional si las dificultades persisten o afectan tu vida diaria."
    ];
  }

  const analysis = buildAnalysisText(scores, profile);

  const payload = {
    name: window.profileData.name,
    email: currentUser.email,
    age: window.profileData.age,
    goal: window.profileData.goal,
    answers: qa,
    scores,
    profile,
    profileDescription: description + " " + analysis,
    recommendations
  };

  try {
    $("next-question").disabled = true;
    $("next-question").textContent = "Guardando…";

    const r = await api("/api/evaluations", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const d = await r.json();

    lastEvaluationId = d.id;

    lastEvaluation = {
      ...payload,
      id: d.id,
      paymentStatus: d.paymentStatus || "pending",
      paymentRef: d.paymentRef,
      createdAt: new Date().toISOString()
    };

    openResultView(lastEvaluation, false);

  } catch (e) {
    toast("No se pudo guardar tu evaluación: " + e.message, true);
    $("next-question").disabled = false;
    $("next-question").textContent = "Finalizar evaluación";
  }
}

function openResultView(ev, paid) {
  paid = paid || isPaid(ev);

  $("result-name").textContent =
    `${ev.name || ""} · ${currentUser?.email || ""}`;

  if (!paid) {
    $("result-pay-banner").classList.remove("hidden");
    $("result-content").classList.add("hidden");

  } else {
    $("result-pay-banner").classList.add("hidden");
    $("result-content").classList.remove("hidden");

    $("result-profile").textContent = ev.profile || "";

    $("result-description").textContent =
      (ev.profileDescription || "").split(".")[0] + ".";

    $("result-analysis").textContent =
      buildAnalysisText(ev.scores || {}, ev.profile || "");

    $("score-list").innerHTML = "";

    [
      ["Inatención y función ejecutiva", "inattention"],
      ["Hiperactividad e impulsividad", "hyperactivity"],
      ["Indicadores diferenciales", "differential"]
    ].forEach(([label, key]) => {
      const val = (ev.scores || {})[key] ?? 0;
      const div = document.createElement("div");

      div.innerHTML = `
        <div class="flex justify-between text-sm mb-1">
          <span class="text-slate-600">${label}</span>
          <b>${val}%</b>
        </div>
        <div class="score-bar">
          <div class="score-fill" style="width:${val}%"></div>
        </div>
      `;

      $("score-list").appendChild(div);
    });

    $("recommendations").innerHTML = "";

    (ev.recommendations || []).forEach(x => {
      const li = document.createElement("li");
      li.textContent = x;
      $("recommendations").appendChild(li);
    });
  }

  show("result-view");
}

$("download-own-pdf").onclick = async () => {
  if (!lastEvaluationId) return;

  try {
    const r = await api(`/api/my-evaluations/${lastEvaluationId}/pdf`);
    downloadBlob(await r.blob(), "NeuroEval-informe.pdf");
  } catch (e) {
    toast(e.message, true);
  }
};

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);

  a.href = url;
  a.download = name;
  a.click();

  // Se espera antes de liberar la URL para evitar interrumpir la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("logout-result").onclick = () => signOut(auth);

// ADMINISTRACIÓN

$("admin-refresh").onclick = loadAdmin;
$("admin-logout").onclick = () => signOut(auth);

async function loadAdmin() {
  try {
    const r = await api("/api/admin/overview");
    const data = await r.json();

    $("stat-users").textContent = data.users;
    $("stat-evals").textContent = data.evaluations;
    $("stat-paid").textContent = data.paid ?? 0;
    $("stat-pending").textContent = data.pending ?? 0;

    $("admin-users").innerHTML = "";

    (data.userList || []).forEach(u => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100";

      const date = u.createdAt
        ? new Date(u.createdAt).toLocaleString("es-CO")
        : "—";

      [date, u.name || "—", u.email || "—", u.age ?? "—", u.goal || "—"]
        .forEach(v => {
          const td = document.createElement("td");
          td.className = "p-3";
          td.textContent = v;
          tr.appendChild(td);
        });

      $("admin-users").appendChild(tr);
    });

    if (!(data.userList || []).length) {
      $("admin-users").innerHTML =
        `<tr><td colspan="5" class="p-6 text-slate-500 text-center">Sin clientes registrados.</td></tr>`;
    }

    $("admin-rows").innerHTML = "";

    (data.records || []).forEach(x => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 hover:bg-slate-50/80";

      const date = x.createdAt
        ? new Date(x.createdAt).toLocaleString("es-CO")
        : "—";

      const tdDate = document.createElement("td");
      tdDate.className = "p-3";
      tdDate.textContent = date;
      tr.appendChild(tdDate);

      const tdName = document.createElement("td");
      tdName.className = "p-3";

      tdName.innerHTML = `
        <div class="font-medium">${x.name || "—"}</div>
        <div class="text-xs text-slate-500">${x.email || ""}</div>
      `;

      tr.appendChild(tdName);

      const tdProfile = document.createElement("td");
      tdProfile.className = "p-3 text-xs";
      tdProfile.textContent = x.profile || "—";
      tr.appendChild(tdProfile);

      const tdPay = document.createElement("td");
      tdPay.className = "p-3";

      const st = x.paymentStatus || "pending";

      tdPay.innerHTML = `
        <span class="badge ${
          st === "paid"
            ? "badge-paid"
            : st === "failed"
              ? "badge-failed"
              : "badge-pending"
        }">
          ${
            st === "paid"
              ? "Pagado"
              : st === "failed"
                ? "Fallido"
                : "Pendiente"
          }
        </span>
      `;

      tr.appendChild(tdPay);

      const tdAct = document.createElement("td");
      tdAct.className = "p-3";

      const wrap = document.createElement("div");
      wrap.className = "flex flex-col gap-1";

      const bPdf = document.createElement("button");
      bPdf.className = "text-brand-600 font-medium hover:underline text-left";
      bPdf.textContent = "PDF completo";
      bPdf.onclick = () => downloadAdminPdf(x.id);

      wrap.appendChild(bPdf);

      if (st !== "paid") {
        const bPay = document.createElement("button");
        bPay.className = "text-emerald-600 font-medium hover:underline text-left";
        bPay.textContent = "Marcar pagado";

        bPay.onclick = async () => {
          try {
            await api(`/api/admin/evaluations/${x.id}/payment`, {
              method: "POST",
              body: JSON.stringify({
                status: "paid",
                method: "admin"
              })
            });

            toast("Marcado como pagado");
            loadAdmin();

          } catch (e) {
            toast(e.message, true);
          }
        };

        wrap.appendChild(bPay);
      }

      tdAct.appendChild(wrap);
      tr.appendChild(tdAct);
      $("admin-rows").appendChild(tr);
    });

    if (!(data.records || []).length) {
      $("admin-rows").innerHTML =
        `<tr><td colspan="5" class="p-6 text-slate-500 text-center">Aún no hay evaluaciones.</td></tr>`;
    }

  } catch (e) {
    toast(e.message, true);
  }
}

async function downloadAdminPdf(id) {
  try {
    const r = await api(`/api/admin/evaluations/${id}/pdf`);
    downloadBlob(await r.blob(), `NeuroEval-admin-${id}.pdf`);

  } catch (e) {
    toast(e.message, true);
  }
}
