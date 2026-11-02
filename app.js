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

// Configuración pública servida por el backend (sin secretos)
const configResponse = await fetch("/firebase-config.js");
const configText = await configResponse.text();
const match = configText.match(/window\.FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\});/);
const config = match ? JSON.parse(match[1]) : {};

if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
  const el = document.getElementById("auth-message");
  if (el) el.textContent = "Falta configurar Firebase. Sigue las instrucciones del README.";
  throw new Error("Configuración Firebase incompleta");
}

const firebaseApp = initializeApp(config);
const auth = getAuth(firebaseApp);
const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentIsAdmin = false;
let currentIndex = 0;
let questions = [];
let answers = [];
let lastEvaluationId = null;
let lastEvaluation = null;

const ADMIN_EMAIL = "jzamorazapata@gmail.com";

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

const VIEWS = ["auth-view", "forgot-view", "dashboard-view", "quiz-view", "result-view", "admin-view"];

function show(id) {
  VIEWS.forEach((x) => $(x).classList.toggle("hidden", x !== id));
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
  setTimeout(() => el.classList.add("hidden"), 3200);
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
    const data = await response.json().catch(() => ({}));
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

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("login-btn");
  setLoading(btn, true);
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
    message("auth-message", "Acceso correcto.");
  } catch (err) {
    message("auth-message", friendlyAuthError(err), true);
  } finally {
    setLoading(btn, false);
  }
});

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
    if (email === ADMIN_EMAIL) {
      throw new Error("El correo reservado para administración no puede registrarse como cliente.");
    }
    const cred = await createUserWithEmailAndPassword(auth, email, $("reg-password").value);
    currentUser = cred.user;
    window.profileData = { name, age, goal };
    await api("/api/profile", {
      method: "POST",
      body: JSON.stringify({ name, age, goal })
    });
    startQuiz(name, age, goal);
  } catch (err) {
    message("auth-message", friendlyAuthError(err), true);
  } finally {
    setLoading(btn, false);
  }
});

$("google-login").onclick = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    message("auth-message", friendlyAuthError(err), true);
  }
};

function friendlyAuthError(err) {
  const map = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google.",
    "auth/too-many-requests": "Demasiados intentos. Espera un momento."
  };
  return map[err.code] || err.message || "No se pudo completar la operación.";
}

// Password recovery
$("forgot-open").onclick = () => {
  show("forgot-view");
  $("confirm-reset-form").classList.add("hidden");
  $("request-code-form").classList.remove("hidden");
  message("reset-message", "");
};
$("back-login").onclick = () => show("auth-view");

$("request-code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const email = $("reset-email").value.trim().toLowerCase();
    const r = await fetch("/api/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    $("request-code-form").classList.add("hidden");
    $("confirm-reset-form").classList.remove("hidden");
    message("reset-message", "Si la cuenta existe, recibirás un código. Revisa también la carpeta de spam.");
  } catch (err) {
    message("reset-message", err.message, true);
  }
});

$("confirm-reset-form").addEventListener("submit", async (e) => {
  e.preventDefault();
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
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    message("reset-message", d.message);
    $("confirm-reset-form").classList.add("hidden");
  } catch (err) {
    message("reset-message", err.message, true);
  }
});

// Auth state
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    $("session-label").textContent = "";
    show("auth-view");
    return;
  }
  try {
    const tokenResult = await getIdTokenResult(user, true);
    currentIsAdmin =
      tokenResult.claims.admin === true &&
      user.email?.toLowerCase() === ADMIN_EMAIL;

    $("session-label").textContent = user.email || "";

    if (currentIsAdmin) {
      show("admin-view");
      await loadAdmin();
      return;
    }

    // Perfil del cliente
    let profileData = null;
    try {
      const profileResponse = await api("/api/profile");
      profileData = (await profileResponse.json()).profile;
    } catch (_) {}

    const displayName = profileData?.name || user.displayName || user.email?.split("@")[0] || "Usuario";
    const age = profileData?.age ?? null;
    const goal = profileData?.goal || "Evaluación cognitiva";

    if (!profileData) {
      // Crear perfil mínimo (edad puede ser null)
      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({ name: displayName, age: null, goal })
      });
    }

    window.profileData = { name: displayName, age, goal };

    // Cargar evaluaciones previas
    let evaluations = [];
    try {
      const evRes = await api("/api/my-evaluations");
      evaluations = (await evRes.json()).evaluations || [];
    } catch (_) {}

    if (evaluations.length > 0) {
      lastEvaluation = evaluations[0];
      lastEvaluationId = lastEvaluation.id;
      showDashboard(displayName, lastEvaluation);
    } else {
      showDashboard(displayName, null);
    }
  } catch (e) {
    console.error(e);
    show("auth-view");
    message("auth-message", "No se pudo validar la sesión.", true);
  }
});

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

    const scores = lastEval.scores || {};
    $("dash-scores").innerHTML = "";
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
          <b class="text-slate-900">${val}%</b>
        </div>
        <div class="score-bar"><div class="score-fill" style="width:${val}%"></div></div>`;
      $("dash-scores").appendChild(div);
    });
  } else {
    $("dash-last-result").classList.add("hidden");
    $("dash-empty").classList.remove("hidden");
  }
}

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
$("logout-dash").onclick = () => signOut(auth);
$("go-dashboard").onclick = () => {
  const p = window.profileData || {};
  showDashboard(p.name || "Usuario", lastEvaluation);
};

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
  $("progress-label").textContent = `Pregunta ${currentIndex + 1} de 15`;
  $("progress-pct").textContent = pct + "%";
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

  $("next-question").textContent = currentIndex === 14 ? "Finalizar evaluación" : "Siguiente";
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

async function finishEvaluation() {
  const sums = { inattention: 0, hyperactivity: 0, differential: 0 };
  const counts = { inattention: 0, hyperactivity: 0, differential: 0 };

  const qa = questions.map((q, i) => ({
    category: q[0],
    question: q[1],
    dimension: q[2],
    answer: choices[answers[i]],
    points: points[answers[i]]
  }));

  qa.forEach((a) => {
    sums[a.dimension] += a.points;
    counts[a.dimension]++;
  });

  const scores = {};
  Object.keys(sums).forEach((k) => {
    scores[k] = Math.round((sums[k] / (counts[k] * 4 || 1)) * 100);
  });

  let profile, description, recommendations;
  if (scores.differential >= 60) {
    profile = "Indicadores asociados a estrés o sobrecarga";
    description =
      "Las respuestas señalan posibles factores de estrés, fatiga o ansiedad que pueden afectar la atención. Es importante explorar el contexto y otras causas.";
    recommendations = [
      "Revisar sueño, descanso y carga de actividades.",
      "Registrar cuándo aparecen las dificultades y qué las empeora.",
      "Consultar con un profesional de salud para explorar factores emocionales, médicos y ambientales."
    ];
  } else if (scores.inattention >= 60 && scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inatención e hiperactividad";
    description =
      "Se observan respuestas frecuentes en ambas dimensiones. Este patrón no confirma TDAH y requiere valoración clínica.";
    recommendations = [
      "Solicitar una valoración con psicología clínica o psiquiatría.",
      "Preparar ejemplos concretos de dificultades en distintos contextos.",
      "Explorar historia de síntomas desde la infancia y su impacto funcional."
    ];
  } else if (scores.inattention >= 60) {
    profile = "Elevación de indicadores de inatención";
    description =
      "Las respuestas muestran dificultades frecuentes relacionadas con atención y organización. Se requiere evaluación profesional para conocer su origen.";
    recommendations = [
      "Usar recordatorios externos y dividir tareas en pasos breves.",
      "Registrar el impacto en estudio, trabajo y vida cotidiana.",
      "Consultar con un profesional cualificado."
    ];
  } else if (scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inquietud e impulsividad";
    description =
      "Se observan respuestas frecuentes relacionadas con inquietud o impulsividad. No constituyen por sí solas un diagnóstico.";
    recommendations = [
      "Practicar pausas planificadas y estrategias de autorregulación.",
      "Registrar situaciones que desencadenan inquietud o impulsividad.",
      "Consultar con un profesional si afecta el funcionamiento diario."
    ];
  } else {
    profile = "Indicadores bajos o moderados en este autorregistro";
    description =
      "Las respuestas no muestran una elevación marcada en las dimensiones exploradas. Esto no descarta dificultades ni sustituye una evaluación si existe preocupación.";
    recommendations = [
      "Mantener hábitos de sueño y organización saludables.",
      "Solicitar orientación profesional si las dificultades persisten o afectan tu vida diaria."
    ];
  }

  const payload = {
    name: window.profileData.name,
    email: currentUser.email,
    age: window.profileData.age,
    goal: window.profileData.goal,
    answers: qa,
    scores,
    profile,
    profileDescription: description,
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
    lastEvaluation = { ...payload, id: d.id, createdAt: new Date().toISOString() };

    $("result-name").textContent = `${payload.name} · ${currentUser.email}`;
    $("result-profile").textContent = profile;
    $("result-description").textContent = description;

    $("score-list").innerHTML = "";
    [
      ["Inatención y función ejecutiva", "inattention"],
      ["Hiperactividad e impulsividad", "hyperactivity"],
      ["Indicadores diferenciales", "differential"]
    ].forEach(([label, key]) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <div class="flex justify-between text-sm mb-1">
          <span class="text-slate-600">${label}</span>
          <b class="text-slate-900">${scores[key]}%</b>
        </div>
        <div class="score-bar"><div class="score-fill" style="width:${scores[key]}%"></div></div>`;
      $("score-list").appendChild(div);
    });

    $("recommendations").innerHTML = "";
    recommendations.forEach((x) => {
      const li = document.createElement("li");
      li.textContent = x;
      $("recommendations").appendChild(li);
    });

    show("result-view");
  } catch (e) {
    toast("No se pudo guardar tu evaluación: " + e.message, true);
    $("next-question").disabled = false;
    $("next-question").textContent = "Finalizar evaluación";
  }
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
  URL.revokeObjectURL(url);
}

$("logout-result").onclick = () => signOut(auth);

// Admin
$("admin-refresh").onclick = loadAdmin;
$("admin-logout").onclick = () => signOut(auth);

async function loadAdmin() {
  try {
    const r = await api("/api/admin/overview");
    const data = await r.json();
    $("stat-users").textContent = data.users;
    $("stat-evals").textContent = data.evaluations;
    $("admin-rows").innerHTML = "";

    data.records.forEach((x) => {
      const tr = document.createElement("tr");
      tr.className = "border-b border-slate-100 hover:bg-slate-50/80";
      const date = x.createdAt ? new Date(x.createdAt).toLocaleString("es-CO") : "—";
      [date, x.name || "—", x.email || "—", x.profile || "—"].forEach((v) => {
        const td = document.createElement("td");
        td.className = "p-3";
        td.textContent = v;
        tr.appendChild(td);
      });
      const td = document.createElement("td");
      td.className = "p-3";
      const b = document.createElement("button");
      b.className = "text-brand-600 font-medium hover:underline";
      b.textContent = "Ver / PDF";
      b.onclick = () => downloadAdminPdf(x.id);
      td.appendChild(b);
      tr.appendChild(td);
      $("admin-rows").appendChild(tr);
    });

    if (!data.records.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "p-6 text-slate-500 text-center";
      td.textContent = "Aún no hay evaluaciones.";
      tr.appendChild(td);
      $("admin-rows").appendChild(tr);
    }
  } catch (e) {
    toast(e.message, true);
  }
}

async function downloadAdminPdf(id) {
  try {
    const r = await api(`/api/admin/evaluations/${id}/pdf`);
    downloadBlob(await r.blob(), `NeuroEval-${id}.pdf`);
  } catch (e) {
    toast(e.message, true);
  }
}
