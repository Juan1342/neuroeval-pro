"use strict";

const EVALUATION_CHOICES = [
  "Nunca",
  "Raramente",
  "A veces",
  "A menudo",
  "Muy a menudo"
];

const EVALUATION_BANK = [
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

function calculateEvaluationOnServer(receivedAnswers) {
  if (!Array.isArray(receivedAnswers) || receivedAnswers.length !== 15) {
    return { error: "La evaluación debe contener exactamente 15 respuestas." };
  }

  const bankByQuestion = new Map(
    EVALUATION_BANK.map(([category, question, dimension]) => [
      question,
      { category, question, dimension }
    ])
  );
  const seen = new Set();
  const sums = { inattention: 0, hyperactivity: 0, differential: 0 };
  const counts = { inattention: 0, hyperactivity: 0, differential: 0 };
  const answers = [];

  for (const received of receivedAnswers) {
    if (!received || typeof received.question !== "string" ||
        typeof received.answer !== "string") {
      return { error: "Una o más respuestas tienen un formato inválido." };
    }

    const canonical = bankByQuestion.get(received.question);
    if (!canonical || seen.has(canonical.question)) {
      return { error: "La evaluación contiene preguntas desconocidas o repetidas." };
    }

    const points = EVALUATION_CHOICES.indexOf(received.answer);
    if (points < 0) {
      return { error: "Una o más opciones de respuesta no son válidas." };
    }

    seen.add(canonical.question);
    sums[canonical.dimension] += points;
    counts[canonical.dimension] += 1;
    answers.push({
      category: canonical.category,
      question: canonical.question,
      dimension: canonical.dimension,
      answer: received.answer,
      points
    });
  }

  const scores = {};
  for (const dimension of Object.keys(sums)) {
    scores[dimension] = counts[dimension]
      ? Math.round((sums[dimension] / (counts[dimension] * 4)) * 100)
      : 0;
  }

  let profile;
  let profileDescription;
  let recommendations;

  if (scores.differential >= 60) {
    profile = "Indicadores asociados a estrés o sobrecarga";
    profileDescription = "Tus respuestas señalan factores que podrían relacionarse con estrés, fatiga o tensión y que pueden influir en la concentración. Es importante explorar el contexto y otras posibles causas.";
    recommendations = [
      "Revisar hábitos de sueño, descanso y carga de actividades.",
      "Registrar cuándo aparecen las dificultades y qué situaciones las intensifican.",
      "Consultar con un profesional de salud si estas dificultades afectan tu vida cotidiana."
    ];
  } else if (scores.inattention >= 60 && scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inatención e inquietud";
    profileDescription = "Tus respuestas muestran frecuencia elevada en las dimensiones exploradas. Este resultado no confirma TDAH y requiere una valoración profesional para comprender su origen.";
    recommendations = [
      "Solicitar orientación con psicología clínica o psiquiatría.",
      "Preparar ejemplos concretos de dificultades en distintos contextos.",
      "Explorar la historia de estas experiencias y su impacto funcional."
    ];
  } else if (scores.inattention >= 60) {
    profile = "Elevación de indicadores de inatención";
    profileDescription = "Tus respuestas muestran dificultades frecuentes relacionadas con atención y organización. Se requiere una evaluación profesional para conocer su origen.";
    recommendations = [
      "Dividir tareas grandes en pasos breves y concretos.",
      "Utilizar recordatorios externos y calendarios.",
      "Consultar con un profesional cualificado si las dificultades persisten."
    ];
  } else if (scores.hyperactivity >= 60) {
    profile = "Elevación de indicadores de inquietud e impulsividad";
    profileDescription = "Se observan respuestas frecuentes relacionadas con inquietud o impulsividad. Estas respuestas no constituyen por sí solas un diagnóstico.";
    recommendations = [
      "Practicar pausas planificadas y estrategias de autorregulación.",
      "Registrar situaciones que desencadenan inquietud o impulsividad.",
      "Buscar orientación profesional si afecta el funcionamiento diario."
    ];
  } else {
    profile = "Indicadores bajos o moderados en este autorregistro";
    profileDescription = "Las respuestas no muestran una elevación marcada en las dimensiones exploradas. Esto no descarta dificultades ni sustituye una evaluación si existe preocupación.";
    recommendations = [
      "Mantener hábitos de sueño y organización saludables.",
      "Observar si las dificultades aparecen en situaciones específicas.",
      "Solicitar orientación profesional si las dificultades persisten o afectan tu vida diaria."
    ];
  }

  return { answers, scores, profile, profileDescription, recommendations };
}

module.exports = {
  EVALUATION_CHOICES,
  EVALUATION_BANK,
  calculateEvaluationOnServer
};
