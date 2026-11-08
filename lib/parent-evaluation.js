"use strict";

// Cuestionario orientativo propio para observación familiar.
// No es una escala clínica validada ni permite diagnosticar TDAH.
const FREQUENCY_OPTIONS = ["Nunca", "Algunas veces", "A menudo", "Muy a menudo"];

const PARENT_QUESTIONS = [
  ["inattention", "¿Comete errores por descuido en tareas, deberes o actividades que sabe realizar?", "Por ejemplo, omite partes de una instrucción o no revisa lo que hizo."],
  ["inattention", "¿Le cuesta mantener la atención durante juegos, lecturas, conversaciones o tareas apropiadas para su edad?", "Piensa en actividades que normalmente disfruta y que requieren continuidad."],
  ["inattention", "¿Parece no escuchar cuando un adulto le habla directamente, aunque no haya una distracción evidente?", "Por ejemplo, hay que repetirle varias veces una indicación sencilla."],
  ["inattention", "¿Empieza instrucciones o tareas, pero deja pasos sin completar aunque haya entendido qué debe hacer?", "Considera rutinas, deberes y pequeñas responsabilidades."],
  ["inattention", "¿Tiene dificultad para organizar sus tareas, materiales o actividades diarias?", "Por ejemplo, no sabe por dónde empezar o pierde el orden de los pasos."],
  ["inattention", "¿Evita o demora actividades que requieren concentración sostenida?", "Por ejemplo, deberes, lectura o tareas que exigen esfuerzo mental continuo."],
  ["inattention", "¿Pierde con frecuencia objetos necesarios para sus actividades?", "Por ejemplo, útiles escolares, juguetes, libros, prendas o materiales."],
  ["inattention", "¿Se distrae fácilmente con ruidos, movimientos, conversaciones u otros estímulos del entorno?", "Observa si le cuesta retomar lo que estaba haciendo."],
  ["inattention", "¿Olvida con frecuencia actividades o responsabilidades habituales para su edad?", "Por ejemplo, llevar materiales, terminar una rutina o recordar una indicación."],
  ["hyperactivity", "¿Mueve constantemente manos o pies, se retuerce en la silla o cambia de postura cuando se espera que permanezca sentado?", "Ten en cuenta lo esperable para su edad y la situación."],
  ["hyperactivity", "¿Se levanta de su asiento en momentos en los que normalmente se espera que permanezca sentado?", "Por ejemplo, durante comidas, clase o actividades tranquilas."],
  ["hyperactivity", "¿Corre, trepa o se mueve en situaciones en las que no resulta apropiado?", "En adolescentes, puede manifestarse como inquietud interna o dificultad para estar quieto."],
  ["hyperactivity", "¿Le cuesta jugar o realizar actividades tranquilas sin hacer mucho ruido o movimiento?", "Compara con otros niños de edad y contexto similares."],
  ["hyperactivity", "¿Parece estar constantemente en movimiento, como si le costara bajar el ritmo?", "Observa si ocurre incluso cuando la actividad requiere calma."],
  ["hyperactivity", "¿Habla mucho más de lo esperado para la situación y le cuesta detenerse?", "Considera conversaciones, clase y reuniones familiares."],
  ["impulsivity", "¿Responde antes de que terminen de hacerle una pregunta o interrumpe para contestar?", "Observa si puede esperar a escuchar la pregunta completa."],
  ["impulsivity", "¿Le cuesta esperar su turno en juegos, filas o conversaciones?", "Piensa en situaciones cotidianas repetidas."],
  ["impulsivity", "¿Interrumpe conversaciones, juegos o actividades de otras personas sin advertirlo?", "Por ejemplo, se incorpora a una actividad o toma la palabra de forma repentina."],
  ["context", "¿Las conductas que has señalado se presentan desde hace aproximadamente seis meses o más?", "Si comenzaron hace poco, anota cuándo aparecieron."],
  ["context", "¿Recuerdas comportamientos similares antes de los 12 años?", "Piensa en informes escolares, recuerdos familiares o comentarios de docentes."],
  ["context", "¿Has observado estas conductas en al menos dos entornos, como casa y colegio?", "También pueden ser actividades extracurriculares o convivencia con otros familiares."],
  ["context", "¿Estas conductas afectan de forma clara su aprendizaje, convivencia, amistades o rutinas?", "Describe consecuencias concretas, no solo que el comportamiento resulte molesto."],
  ["context", "¿Un docente u otro cuidador ha expresado preocupaciones similares?", "Si es posible, contrasta lo observado con alguien que lo conozca en otro entorno."],
  ["context", "¿Hay factores recientes que podrían influir, como cambios familiares, sueño insuficiente, estrés, dificultades de aprendizaje o problemas de salud?", "No atribuyas automáticamente estas conductas al TDAH."]
];

const DOMAIN_LABELS = {
  inattention: "Atención y seguimiento de tareas",
  hyperactivity: "Actividad motora e inquietud",
  impulsivity: "Impulsividad y espera de turnos",
  context: "Duración, entornos e impacto cotidiano"
};

function calculateParentEvaluation(receivedAnswers, metadata = {}) {
  if (!Array.isArray(receivedAnswers) || receivedAnswers.length !== PARENT_QUESTIONS.length) {
    return { error: "La evaluación familiar debe contener las 24 respuestas." };
  }
  const allowedAges = [4,5,6,7,8,9,10,11,12,13,14,15,16,17];
  const age = Number(metadata.childAge);
  if (!allowedAges.includes(age)) return { error: "La edad del menor debe estar entre 4 y 17 años." };
  const ageBand = age <= 7 ? "4–7 años" : age <= 12 ? "8–12 años" : "13–17 años";
  const relationship = String(metadata.relationship || "").trim().slice(0, 50);
  const settings = Array.isArray(metadata.settings)
    ? metadata.settings.filter(v => ["casa","colegio","social"].includes(v))
    : [];
  if (!relationship || !settings.length) return { error: "Indica tu parentesco y al menos un entorno de observación." };

  const byQuestion = new Map(PARENT_QUESTIONS.map(([dimension, question, example], index) => [
    question, { dimension, question, example, index }
  ]));
  const seen = new Set();
  const sums = {};
  const counts = {};
  const answers = [];
  for (const received of receivedAnswers) {
    if (!received || typeof received.question !== "string" || typeof received.answer !== "string") {
      return { error: "Una o más respuestas tienen un formato inválido." };
    }
    const canonical = byQuestion.get(received.question);
    if (!canonical || seen.has(canonical.question)) return { error: "Hay preguntas desconocidas o repetidas." };
    const points = FREQUENCY_OPTIONS.indexOf(received.answer);
    if (points < 0) return { error: "Una opción de respuesta no es válida." };
    seen.add(canonical.question);
    sums[canonical.dimension] = (sums[canonical.dimension] || 0) + points;
    counts[canonical.dimension] = (counts[canonical.dimension] || 0) + 1;
    answers.push({ ...canonical, answer: received.answer, points });
  }

  const scores = {};
  for (const [dimension, count] of Object.entries(counts)) {
    scores[dimension] = Math.round((sums[dimension] / (count * 3)) * 100);
  }
  const frequent = dimension => answers.filter(a => a.dimension === dimension && a.points >= 2).length;
  const symptomFrequent = frequent("inattention") + frequent("hyperactivity") + frequent("impulsivity");
  const impairment = answers.find(a => a.dimension === "context" && a.index === 21)?.points >= 2;
  const multipleSettings = settings.length >= 2;
  const duration = answers.find(a => a.dimension === "context" && a.index === 18)?.points >= 2;
  const onset = answers.find(a => a.dimension === "context" && a.index === 19)?.points >= 2;
  const teacherConcern = answers.find(a => a.dimension === "context" && a.index === 22)?.points >= 2;
  const recommendations = [
    { title: "Registra ejemplos concretos", detail: "Durante las próximas semanas anota qué ocurrió, cuándo, dónde, qué pasó antes y cómo afectó al menor. Evita etiquetas como perezoso, desobediente o problemático." },
    { title: "Contrasta la observación con el colegio", detail: "Solicita al docente ejemplos específicos sobre atención, seguimiento de instrucciones, movimiento, turnos y finalización de tareas." },
    { title: "Prueba apoyos cotidianos", detail: "Da instrucciones breves de una en una, utiliza rutinas visuales, divide las tareas en pasos pequeños y reconoce el esfuerzo." }
  ];
  const shouldConsult = symptomFrequent >= 5 && (impairment || multipleSettings || teacherConcern);
  if (shouldConsult) recommendations.unshift({
    title: "Solicita una valoración profesional",
    detail: "Las respuestas describen conductas frecuentes junto con señales de impacto o presencia en distintos contextos. Conviene comentarlo con pediatría o un profesional de salud mental infantil; lleva ejemplos y, si es posible, información del colegio."
  });
  else recommendations.push({
    title: "Consulta si la preocupación continúa",
    detail: "Aunque este cuestionario no muestre un patrón destacado, si algo te preocupa o afecta al menor, puedes solicitar orientación profesional. Este resultado no descarta TDAH ni otras dificultades."
  });

  const profile = shouldConsult
    ? "Se observan comportamientos que conviene explorar con un profesional"
    : "Observaciones para seguir registrando y contextualizando";
  const profileDescription = shouldConsult
    ? "Varias conductas fueron descritas como frecuentes o muy frecuentes y se señalaron aspectos de impacto o presencia en distintos entornos. Esto no confirma TDAH: una valoración profesional debe considerar el desarrollo, la historia, otros posibles factores y distintas fuentes de información."
    : "Las respuestas ofrecen una descripción inicial, pero no permiten confirmar ni descartar TDAH. La frecuencia, la edad, las circunstancias y el impacto deben analizarse con más información y, cuando exista preocupación, con un profesional.";
  const summary = {
    contextInfluence: duration ? "Se refiere una duración aproximada de seis meses o más" : "La duración requiere mayor observación",
    dailyImpact: impairment ? "Se refiere impacto en actividades cotidianas" : "No se señaló impacto frecuente en esta respuesta",
    childhoodAndSettings: [onset ? "Se señalan antecedentes antes de los 12 años" : "Antecedentes no claramente señalados", multipleSettings ? "Se observan varios entornos" : "Conviene contrastar otros entornos", teacherConcern ? "Otro cuidador o docente también expresa preocupación" : "Conviene contrastar con otros cuidadores"]
  };
  return {
    answers, scores, dimensions: Object.fromEntries(Object.entries(DOMAIN_LABELS).map(([key,label]) => [key,{label,explanation:"Frecuencia descriptiva de las conductas observadas por el familiar; no equivale a una probabilidad clínica."}])),
    profile, profileDescription, recommendations, summary,
    attentionTasks: null,
    parentContext: { childAge: age, ageBand, relationship, settings, duration, onset, multipleSettings, impairment, teacherConcern },
    disclaimer: "Cuestionario orientativo de observación familiar creado para NeuroEval Pro. No es una escala clínica validada, no diagnostica ni descarta TDAH. Las puntuaciones describen únicamente la frecuencia de las respuestas. La evaluación clínica requiere valoración profesional y datos de más de un entorno."
  };
}

module.exports = { PARENT_QUESTIONS, FREQUENCY_OPTIONS, calculateParentEvaluation };
