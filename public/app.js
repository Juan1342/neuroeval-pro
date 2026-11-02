import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, getIdTokenResult } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const cfg = {
  apiKey: window.NEURO_FIREBASE_API_KEY || "",
  authDomain: window.NEURO_FIREBASE_AUTH_DOMAIN || "",
  projectId: window.NEURO_FIREBASE_PROJECT_ID || "",
  appId: window.NEURO_FIREBASE_APP_ID || ""
};
// El servidor entrega la configuración pública desde /firebase-config.js.
const configResponse = await fetch("/firebase-config.js");
const configText = await configResponse.text();
const config = JSON.parse(configText.match(/window\.FIREBASE_CONFIG\s*=\s*(\{.*\});/s)?.[1] || "{}");
if (!config.apiKey || !config.projectId || !config.authDomain || !config.appId) {
  document.getElementById("auth-message").textContent = "Falta configurar Firebase. Sigue las instrucciones del archivo README.";
  throw new Error("Configuración Firebase incompleta");
}
const firebaseApp = initializeApp(config);
const auth = getAuth(firebaseApp);
const $ = id => document.getElementById(id);
let currentUser = null, currentIsAdmin = false, currentIndex = 0, questions = [], answers = [], lastEvaluationId = null;

const bank = [
["Atención y enfoque","¿Te cuesta mantener la atención en tareas que requieren esfuerzo mental prolongado?","inattention"],
["Atención y enfoque","¿Comienzas proyectos con entusiasmo, pero te cuesta terminarlos?","inattention"],
["Atención y enfoque","¿Pierdes u olvidas objetos cotidianos importantes?","inattention"],
["Atención y enfoque","¿Te distraes fácilmente con ruidos o estímulos del entorno?","inattention"],
["Atención y enfoque","¿Te resulta difícil organizar los pasos para cumplir una meta?","inattention"],
["Atención y enfoque","¿Olvidas citas, compromisos o tareas habituales?","inattention"],
["Inquietud e impulsividad","¿Sientes necesidad de moverte cuando debes permanecer sentado?","hyperactivity"],
["Inquietud e impulsividad","¿Interrumpes o respondes antes de que terminen de hablar?","hyperactivity"],
["Inquietud e impulsividad","¿Tomas decisiones apresuradas de las que luego te arrepientes?","hyperactivity"],
["Inquietud e impulsividad","¿Te cuesta esperar tu turno?","hyperactivity"],
["Inquietud e impulsividad","¿Te sientes inquieto incluso en momentos de descanso?","hyperactivity"],
["Función ejecutiva","¿Pospones tareas hasta que el plazo está muy cerca?","inattention"],
["Función ejecutiva","¿Te cuesta priorizar cuando tienes varias tareas?","inattention"],
["Diagnóstico diferencial","¿Tus dificultades de atención aparecen junto con preocupación o tensión frecuente?","differential"],
["Diagnóstico diferencial","¿Tu concentración empeoró recientemente debido a fatiga o estrés?","differential"],
["Historia","¿Recuerdas dificultades similares durante tu infancia, antes de los 12 años?","inattention"],
["Diagnóstico diferencial","¿Los problemas varían mucho según tu descanso o carga de trabajo?","differential"],
["Organización","¿Te cuesta calcular cuánto tiempo necesitas para completar actividades?","inattention"]
];
const choices = ["Nunca","Raramente","A veces","A menudo","Muy a menudo"];
const points = [0,1,2,3,4];

function show(id) {
  ["auth-view","forgot-view","quiz-view","result-view","admin-view"].forEach(x => $(x).classList.toggle("hidden", x !== id));
}
function message(id, text, error=false) {
  $(id).textContent = text;
  $(id).className = `text-sm mt-3 ${error ? "text-rose-600" : "text-emerald-700"}`;
}
async function api(url, options={}) {
  const token = currentUser ? await currentUser.getIdToken() : null;
  const response = await fetch(url, { ...options, headers: {
    ...(options.body ? {"Content-Type":"application/json"} : {}),
    ...(token ? {Authorization:`Bearer ${token}`} : {}),
    ...(options.headers || {})
  }});
  if (!response.ok) {
    const data = await response.json().catch(()=>({}));
    throw new Error(data.error || "Ocurrió un error.");
  }
  return response;
}
function switchAuth(mode) {
  $("login-form").classList.toggle("hidden", mode !== "login");
  $("register-form").classList.toggle("hidden", mode !== "register");
  $("show-login").className = `btn flex-1 ${mode==="login"?"primary":"muted"}`;
  $("show-register").className = `btn flex-1 ${mode==="register"?"primary":"muted"}`;
  message("auth-message","");
}
$("show-login").onclick=()=>switchAuth("login");
$("show-register").onclick=()=>switchAuth("register");

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth,$("login-email").value.trim(),$("login-password").value);
    message("auth-message","Acceso correcto.");
  } catch(err) { message("auth-message", friendlyAuthError(err), true); }
});
$("register-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    const name=$("reg-name").value.trim(), email=$("reg-email").value.trim().toLowerCase();
    const age=Number($("reg-age").value), goal=$("reg-goal").value;
    if(!$("consent").checked) throw new Error("Debes aceptar el aviso de privacidad.");
    if(email==="jzamorazapata@gmail.com") throw new Error("El correo reservado para administración no puede registrarse como cliente. Usa el acceso administrativo ya configurado.");
    const cred=await createUserWithEmailAndPassword(auth,email,$("reg-password").value);
    currentUser=cred.user;
    window.profileData={name,age,goal};
    await api("/api/profile",{method:"POST",body:JSON.stringify({name,age,goal})});
    startQuiz(name,age,goal);
  } catch(err) { message("auth-message",friendlyAuthError(err),true); }
});
$("google-login").onclick=async()=>{
  try { await signInWithPopup(auth,new GoogleAuthProvider()); }
  catch(err){ message("auth-message",friendlyAuthError(err),true); }
};
function friendlyAuthError(err) {
  const map={"auth/email-already-in-use":"Ese correo ya tiene una cuenta.","auth/invalid-email":"El correo no es válido.","auth/weak-password":"La contraseña debe tener al menos 8 caracteres.","auth/invalid-credential":"Correo o contraseña incorrectos.","auth/popup-closed-by-user":"Se cerró la ventana de Google."};
  return map[err.code] || err.message || "No se pudo completar la operación.";
}

$("forgot-open").onclick=()=>{show("forgot-view");$("confirm-reset-form").classList.add("hidden");$("request-code-form").classList.remove("hidden");};
$("back-login").onclick=()=>show("auth-view");
$("request-code-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const email=$("reset-email").value.trim().toLowerCase();
    const r=await fetch("/api/password/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
    const d=await r.json(); if(!r.ok) throw new Error(d.error);
    $("request-code-form").classList.add("hidden");$("confirm-reset-form").classList.remove("hidden");
    message("reset-message","Si la cuenta existe, recibirás un código. Revisa también la carpeta de spam.");
  }catch(err){message("reset-message",err.message,true);}
});
$("confirm-reset-form").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const r=await fetch("/api/password/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("reset-email").value.trim(),code:$("reset-code").value.trim(),newPassword:$("reset-new-password").value})});
    const d=await r.json();if(!r.ok)throw new Error(d.error);
    message("reset-message",d.message);$("confirm-reset-form").classList.add("hidden");
  }catch(err){message("reset-message",err.message,true);}
});

onAuthStateChanged(auth, async user=>{
  currentUser=user;
  if(!user){$("session-label").textContent="";show("auth-view");return;}
  try{
    const tokenResult=await getIdTokenResult(user,true);
    currentIsAdmin=tokenResult.claims.admin===true && user.email?.toLowerCase()==="jzamorazapata@gmail.com";
    $("session-label").textContent=user.email;
    if(currentIsAdmin){show("admin-view");await loadAdmin();}
    else {
      // Los usuarios de Google reciben un perfil mínimo si aún no existe.
      // Recupera los datos guardados del perfil. No inventa edad ni otros datos personales.
      const profileResponse = await api("/api/profile");
      const profileData = (await profileResponse.json()).profile;
      const displayName = profileData?.name || user.displayName || user.email;
      const age = profileData?.age ?? null;
      const goal = profileData?.goal || "Evaluación cognitiva";
      if (!profileData) {
        await api("/api/profile",{method:"POST",body:JSON.stringify({name:displayName,age:null,goal})});
      }
      startQuiz(displayName,age,goal);
    }
  }catch(e){console.error(e);show("auth-view");message("auth-message","No se pudo validar la sesión.",true);}
});
function startQuiz(name,age,goal){
  window.profileData={name,age,goal};
  questions=[...bank].sort(()=>Math.random()-.5).slice(0,15);
  answers=new Array(15).fill(null);currentIndex=0;renderQuestion();show("quiz-view");
}
function renderQuestion(){
  const q=questions[currentIndex],pct=Math.round((currentIndex+1)/15*100);
  $("progress-label").textContent=`Pregunta ${currentIndex+1} de 15`;$("progress-pct").textContent=pct+"%";$("progress-bar").style.width=pct+"%";
  $("q-category").textContent=q[0];$("q-text").textContent=q[1];$("prev-question").disabled=currentIndex===0;
  $("prev-question").style.opacity=currentIndex===0?".4":"1";
  $("answers").innerHTML="";
  choices.forEach((label,i)=>{
    const b=document.createElement("button");b.type="button";b.className=`w-full text-left btn border ${answers[currentIndex]===i?"border-indigo-600 bg-indigo-50":"border-slate-200 bg-white"}`;
    b.textContent=label+(answers[currentIndex]===i?" ✓":"");b.onclick=()=>{answers[currentIndex]=i;renderQuestion();};$("answers").appendChild(b);
  });
  $("next-question").textContent=currentIndex===14?"Finalizar evaluación":"Siguiente";
  $("next-question").disabled=answers[currentIndex]===null;$("next-question").style.opacity=answers[currentIndex]===null?".45":"1";
}
$("prev-question").onclick=()=>{if(currentIndex>0){currentIndex--;renderQuestion();}};
$("next-question").onclick=async()=>{
  if(answers[currentIndex]===null)return;
  if(currentIndex<14){currentIndex++;renderQuestion();return;}
  await finishEvaluation();
};
async function finishEvaluation(){
  const sums={inattention:0,hyperactivity:0,differential:0},counts={inattention:0,hyperactivity:0,differential:0};
  const qa=questions.map((q,i)=>({category:q[0],question:q[1],dimension:q[2],answer:choices[answers[i]],points:points[answers[i]]}));
  qa.forEach(a=>{sums[a.dimension]+=a.points;counts[a.dimension]++;});
  const scores={};
  Object.keys(sums).forEach(k=>scores[k]=Math.round(sums[k]/(counts[k]*4||1)*100));
  let profile,description,recommendations;
  if(scores.differential>=60){profile="Indicadores asociados a estrés o sobrecarga";description="Las respuestas señalan posibles factores de estrés, fatiga o ansiedad que pueden afectar la atención. Es importante explorar el contexto y otras causas.";recommendations=["Revisar sueño, descanso y carga de actividades.","Registrar cuándo aparecen las dificultades y qué las empeora.","Consultar con un profesional de salud para explorar factores emocionales, médicos y ambientales."];}
  else if(scores.inattention>=60&&scores.hyperactivity>=60){profile="Elevación de indicadores de inatención e hiperactividad";description="Se observan respuestas frecuentes en ambas dimensiones. Este patrón no confirma TDAH y requiere valoración clínica.";recommendations=["Solicitar una valoración con psicología clínica o psiquiatría.","Preparar ejemplos concretos de dificultades en distintos contextos.","Explorar historia de síntomas desde la infancia y su impacto funcional."];}
  else if(scores.inattention>=60){profile="Elevación de indicadores de inatención";description="Las respuestas muestran dificultades frecuentes relacionadas con atención y organización. Se requiere evaluación profesional para conocer su origen.";recommendations=["Usar recordatorios externos y dividir tareas en pasos breves.","Registrar el impacto en estudio, trabajo y vida cotidiana.","Consultar con un profesional cualificado."];}
  else if(scores.hyperactivity>=60){profile="Elevación de indicadores de inquietud e impulsividad";description="Se observan respuestas frecuentes relacionadas con inquietud o impulsividad. No constituyen por sí solas un diagnóstico.";recommendations=["Practicar pausas planificadas y estrategias de autorregulación.","Registrar situaciones que desencadenan inquietud o impulsividad.","Consultar con un profesional si afecta el funcionamiento diario."];}
  else {profile="Indicadores bajos o moderados en este autorregistro";description="Las respuestas no muestran una elevación marcada en las dimensiones exploradas. Esto no descarta dificultades ni sustituye una evaluación si existe preocupación.";recommendations=["Mantener hábitos de sueño y organización saludables.","Solicitar orientación profesional si las dificultades persisten o afectan tu vida diaria."];}
  const payload={name:window.profileData.name,email:currentUser.email,age:window.profileData.age,goal:window.profileData.goal,answers:qa,scores,profile,profileDescription:description,recommendations};
  try{
    const r=await api("/api/evaluations",{method:"POST",body:JSON.stringify(payload)});const d=await r.json();lastEvaluationId=d.id;
    $("result-name").textContent=`${payload.name} · ${currentUser.email}`;$("result-profile").textContent=profile;$("result-description").textContent=description;
    $("score-list").innerHTML="";
    [["Inatención y función ejecutiva","inattention"],["Hiperactividad e impulsividad","hyperactivity"],["Indicadores diferenciales","differential"]].forEach(([label,key])=>{
      const div=document.createElement("div");div.innerHTML=`<div class="flex justify-between text-sm"><span>${label}</span><b>${scores[key]}%</b></div><div class="h-2 bg-slate-100 rounded-full mt-1 overflow-hidden"><div class="h-full bg-indigo-600" style="width:${scores[key]}%"></div></div>`;$("score-list").appendChild(div);
    });
    $("recommendations").innerHTML="";recommendations.forEach(x=>{const li=document.createElement("li");li.textContent=x;$("recommendations").appendChild(li);});
    show("result-view");
  }catch(e){alert("No se pudo guardar tu evaluación: "+e.message);}
}
$("download-own-pdf").onclick=async()=>{if(!lastEvaluationId)return;try{const r=await api(`/api/my-evaluations/${lastEvaluationId}/pdf`);downloadBlob(await r.blob(),"NeuroEval-informe.pdf");}catch(e){alert(e.message);}};
function downloadBlob(blob,name){const a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$("logout-result").onclick=()=>signOut(auth);
$("admin-refresh").onclick=loadAdmin;
$("admin-logout").onclick=()=>signOut(auth);
async function loadAdmin(){
  try{
    const r=await api("/api/admin/overview"),data=await r.json();
    $("stat-users").textContent=data.users;$("stat-evals").textContent=data.evaluations;
    $("admin-rows").innerHTML="";
    data.records.forEach(x=>{
      const tr=document.createElement("tr");tr.className="border-b";
      const date=x.createdAt?new Date(x.createdAt).toLocaleString("es-CO"):"—";
      [date,x.name||"—",x.email||"—",x.profile||"—"].forEach(v=>{const td=document.createElement("td");td.className="p-2";td.textContent=v;tr.appendChild(td);});
      const td=document.createElement("td"),b=document.createElement("button");b.className="text-indigo-600 underline";b.textContent="Ver / PDF";b.onclick=()=>downloadAdminPdf(x.id);td.appendChild(b);tr.appendChild(td);$("admin-rows").appendChild(tr);
    });
    if(!data.records.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.className="p-4 text-slate-500";td.textContent="Aún no hay evaluaciones.";tr.appendChild(td);$("admin-rows").appendChild(tr);}
  }catch(e){alert(e.message);}
}
async function downloadAdminPdf(id){
  try{const r=await api(`/api/admin/evaluations/${id}/pdf`);downloadBlob(await r.blob(),`NeuroEval-${id}.pdf`);}
  catch(e){alert(e.message);}
}
