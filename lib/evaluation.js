"use strict";

// Banco orientativo propio de NeuroEval Pro. No es una escala clínica validada
// ni debe utilizarse para diagnosticar TDAH u otros trastornos.
const EVALUATION_CHOICES = [
  "Nunca",
  "Rara vez",
  "A veces",
  "Con frecuencia",
  "Casi siempre"
];

const EVALUATION_BANK = [
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

const DIMENSIONS = {
  inattention: {
    label: "Atención sostenida y memoria cotidiana",
    explanation: "Explora la facilidad para mantener el foco, seguir conversaciones, recordar instrucciones y evitar distracciones."
  },
  executive: {
    label: "Organización y funciones ejecutivas",
    explanation: "Explora la planificación, el inicio y finalización de tareas, la gestión del tiempo y la capacidad de retomar actividades."
  },
  hyperactivity: {
    label: "Inquietud e impulsividad",
    explanation: "Explora la necesidad de movimiento, la espera, la tendencia a interrumpir y la pausa antes de actuar."
  },
  emotionalContext: {
    label: "Regulación emocional",
    explanation: "Explora la intensidad de las respuestas emocionales y la recuperación ante frustraciones o cambios."
  },
  context: {
    label: "Estrés, preocupación y descanso",
    explanation: "Explora factores contextuales que pueden influir en la concentración, como el sueño, la tensión y la sobrecarga."
  },
  impact: {
    label: "Impacto en la vida cotidiana",
    explanation: "Explora si las experiencias descritas generan dificultades funcionales y si son observadas por otras personas."
  },
  history: {
    label: "Historia y presencia en distintos entornos",
    explanation: "Explora si las experiencias parecen remontarse a la infancia y si ocurren en más de un contexto."
  }
};

function calculateEvaluationOnServer(receivedAnswers) {
  if (!Array.isArray(receivedAnswers) || receivedAnswers.length !== EVALUATION_BANK.length) {
    return { error: `La evaluación debe contener exactamente ${EVALUATION_BANK.length} respuestas.` };
  }

  const bankByQuestion = new Map(EVALUATION_BANK.map(([category, question, dimension, icon, example, type, options, correctAnswer]) => [
    question, { category, question, dimension, icon, example, type: type || "frequency", options: options || null, correctAnswer: correctAnswer || null }
  ]));
  const seen = new Set();
  const sums = {};
  const counts = {};
  const answers = [];

  for (const received of receivedAnswers) {
    if (!received || typeof received.question !== "string" || typeof received.answer !== "string") {
      return { error: "Una o más respuestas tienen un formato inválido." };
    }
    const canonical = bankByQuestion.get(received.question);
    if (!canonical || seen.has(canonical.question)) {
      return { error: "La evaluación contiene preguntas desconocidas o repetidas." };
    }
    let points;
    if (canonical.type === "task" || canonical.type === "study") {
      if (!canonical.options || !canonical.options.includes(received.answer)) {
        return { error: "Una respuesta de actividad interactiva no es válida." };
      }
      points = canonical.type === "task"
        ? (received.answer === canonical.correctAnswer ? 1 : 0)
        : null;
    } else {
      points = EVALUATION_CHOICES.indexOf(received.answer);
      if (points < 0) return { error: "Una o más opciones de respuesta no son válidas." };
    }

    seen.add(canonical.question);
    if (canonical.type !== "task" && canonical.type !== "study") {
      sums[canonical.dimension] = (sums[canonical.dimension] || 0) + points;
      counts[canonical.dimension] = (counts[canonical.dimension] || 0) + 1;
    }
    answers.push({ ...canonical, answer: received.answer, points });
  }

  const scores = {};
  for (const [dimension, count] of Object.entries(counts)) {
    scores[dimension] = Math.round((sums[dimension] / (count * 4)) * 100);
  }
  const taskAnswers = answers.filter((answer) => answer.type === "task");
  const attentionTasks = {
    completed: taskAnswers.length,
    correct: taskAnswers.filter((answer) => answer.points === 1).length,
    memoryCompleted: taskAnswers.filter((answer) => answer.dimension === "memoryRecall").length,
    memoryCorrect: taskAnswers.filter((answer) => answer.dimension === "memoryRecall" && answer.points === 1).length,
    visualCompleted: taskAnswers.filter((answer) => answer.dimension === "visualTask").length,
    visualCorrect: taskAnswers.filter((answer) => answer.dimension === "visualTask" && answer.points === 1).length,
    note: "Las actividades de memoria y búsqueda visual son ejercicios breves de interacción; no constituyen pruebas neuropsicológicas validadas ni se utilizan para diagnosticar TDAH."
  };

  const elevated = (dimension) => (scores[dimension] || 0) >= 50;
  const profileParts = [];
  if (elevated("inattention")) profileParts.push("atención y memoria cotidiana");
  if (elevated("executive")) profileParts.push("organización y gestión de tareas");
  if (elevated("hyperactivity")) profileParts.push("inquietud e impulsividad");
  if (elevated("emotionalContext")) profileParts.push("regulación emocional");

  let profile = profileParts.length
    ? "Patrones que merecen exploración: " + profileParts.join(", ")
    : "Sin elevaciones marcadas en las áreas principales exploradas";

  const contextElevated = elevated("context");
  const functionalImpact = elevated("impact");
  const childhoodSignal = (scores.history || 0) >= 50;

  let profileDescription = profileParts.length
    ? "Tus respuestas reflejan experiencias frecuentes en " + profileParts.join(", ") + ". Esto describe patrones de autorregistro; no permite establecer por sí solo su causa ni confirmar TDAH."
    : "En este autorregistro no aparecen frecuencias elevadas de forma marcada en las áreas principales. Esto no descarta dificultades: pueden variar según la situación, el entorno o el momento vital.";

  if (contextElevated) {
    profileDescription += " También aparecen señales de que el estrés, la preocupación o el descanso podrían estar influyendo en tu atención y funcionamiento.";
  }
  if (functionalImpact) {
    profileDescription += " Indicas que estas experiencias tienen repercusiones en actividades cotidianas, por lo que conviene explorarlas con mayor detalle.";
  }
  if (childhoodSignal) {
    profileDescription += " Tus respuestas sugieren posibles antecedentes desde la infancia o presencia en más de un entorno; sería útil contrastarlo con recuerdos, informes escolares o familiares si están disponibles.";
  }

  const recommendations = [];
  if (elevated("inattention")) recommendations.push({
    title: "Reduce las distracciones visibles",
    detail: "Trabaja en bloques breves de 15–25 minutos, deja a la vista solo lo necesario y anota en una hoja cualquier idea que te interrumpa para retomarla después."
  }, {
    title: "Apoya la memoria con señales externas",
    detail: "Usa un único calendario, alarmas con nombre de la tarea y un lugar fijo para llaves, documentos y objetos cotidianos."
  });
  if (elevated("executive")) recommendations.push({
    title: "Convierte las tareas en primeros pasos",
    detail: "Escribe la siguiente acción concreta, no el objetivo completo. Por ejemplo, en vez de “organizar el informe”, empieza por “abrir el documento y escribir tres títulos”."
  }, {
    title: "Haz visible el tiempo",
    detail: "Prueba temporizadores, márgenes de preparación y listas con máximo tres prioridades al día."
  });
  if (elevated("hyperactivity")) recommendations.push({
    title: "Programa movimiento y pausas",
    detail: "Incluye pausas breves de movimiento entre actividades y practica una pausa de tres respiraciones antes de responder o decidir."
  });
  if (elevated("emotionalContext")) recommendations.push({
    title: "Crea un intervalo para regular emociones",
    detail: "Nombra la emoción, identifica qué la activó y espera a que baje su intensidad antes de abordar una conversación o decisión importante."
  });
  if (contextElevated) recommendations.push({
    title: "Revisa los factores que cambian tu concentración",
    detail: "Durante dos semanas registra horas de sueño, nivel de estrés y momentos de mayor dificultad. Esto puede ayudar a reconocer patrones y conversar con un profesional."
  });
  if (functionalImpact || profileParts.length >= 2 || childhoodSignal) recommendations.push({
    title: "Considera una valoración profesional",
    detail: "Consulta con psicología clínica, psiquiatría o un profesional capacitado en TDAH. Lleva ejemplos concretos, cuándo comenzaron, en qué entornos ocurren y cómo afectan tu vida."
  });
  if (!recommendations.length) recommendations.push({
    title: "Conserva lo que ya te funciona",
    detail: "Mantén rutinas realistas, descansos y apoyos de organización. Si una dificultad concreta persiste o te preocupa, coméntala con un profesional aunque el resultado no muestre elevaciones."
  });

  const summary = {
    contextInfluence: contextElevated ? "Señales presentes" : "No destacadas en este autorregistro",
    dailyImpact: functionalImpact ? "Impacto referido" : "Impacto no elevado en las respuestas",
    childhoodAndSettings: childhoodSignal ? "Conviene explorar antecedentes y contextos" : "Antecedentes no claramente señalados"
  };

  return {
    answers,
    scores,
    attentionTasks,
    dimensions: DIMENSIONS,
    profile,
    profileDescription,
    recommendations,
    summary,
    disclaimer: "Este autorregistro es orientativo y no es una prueba diagnóstica ni una escala clínica validada. Los porcentajes describen la frecuencia de las respuestas dentro de este cuestionario; no representan la probabilidad de tener TDAH u otro trastorno."
  };
}

module.exports = { EVALUATION_CHOICES, EVALUATION_BANK, calculateEvaluationOnServer };
