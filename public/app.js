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
let currentLanguage = "es";
const uiTranslations = {
  "Plataforma segura": "Secure platform",
  "🌐 Español": "🌐 Spanish",
  "Azul": "Blue",
  "Amarillo": "Yellow",
  "Morado": "Purple",
  "Verde": "Green",
  "← Anterior": "← Previous",
  "Mi cuenta": "My account",
  "Panel de administración": "Admin dashboard",
  "Perfil": "Profile",
  "Pruebas": "Assessments",
  "Juegos": "Games",
  "Actividades": "Activities",
  "Recomendaciones": "Recommendations",
  "Mi progreso": "My progress",
  "Configuración": "Settings",
  "Cerrar sesión": "Sign out",
  "Conocimiento · Atención · Bienestar": "Awareness · Attention · Well-being",
  "Conoce mejor cómo funciona tu mente.": "Understand how your mind works.",
  "Explora tus hábitos de atención, organización y autorregulación mediante una experiencia interactiva diseñada para ayudarte a conocerte mejor.": "Explore your attention, organization, and self-regulation habits through an interactive experience designed to help you understand yourself better.",
  "Comienza tu experiencia": "Start your experience",
  "Accede a tu cuenta o crea una nueva en pocos pasos.": "Sign in or create an account in a few steps.",
  "Bienvenido a NeuroEval": "Welcome to NeuroEval",
  "Ingresa tus datos para continuar.": "Enter your details to continue.",
  "Iniciar sesión": "Sign in",
  "Crear cuenta": "Create account",
  "Correo electrónico": "Email address",
  "Contraseña": "Password",
  "Ingresar a mi cuenta →": "Sign in →",
  "¿Olvidaste tu contraseña?": "Forgot your password?",
  "Nombre completo": "Full name",
  "Crea una contraseña": "Create a password",
  "Edad": "Age",
  "Objetivo": "Goal",
  "Seleccionar": "Select",
  "Explorar atención": "Explore attention",
  "Concentración": "Focus",
  "Debes aceptar el aviso de privacidad.": "You must accept the privacy notice.",
  "Tu cuenta": "Your account",
  "Mi perfil": "My profile",
  "Consulta la información asociada a tu cuenta.": "Review the information associated with your account.",
  "Nombre": "Name",
  "País (opcional)": "Country (optional)",
  "Ciudad (opcional)": "City (optional)",
  "Idioma preferido": "Preferred language",
  "Guardar preferencias regionales": "Save regional preferences",
  "La ciudad y el país son voluntarios. Se utilizan en estadísticas agregadas y no para localizarte individualmente.": "City and country are optional. They are used for aggregate statistics, not to locate you individually.",
  "Volver a mis pruebas": "Back to my assessments",
  "Guardando preferencias…": "Saving preferences…",
  "Preferencias regionales guardadas.": "Regional preferences saved.",
  "Nunca": "Never",
  "Rara vez": "Rarely",
  "A veces": "Sometimes",
  "Con frecuencia": "Often",
  "Casi siempre": "Almost always",
  "Finalizar evaluación": "Finish assessment",
  "Siguiente →": "Next →",
  "Anterior": "Previous",
  "Memoria inmediata": "Immediate memory",
  "Atención sostenida": "Sustained attention",
  "Búsqueda visual": "Visual search",
  "Organización y planificación": "Organization and planning",
  "Inquietud e impulsividad": "Restlessness and impulsivity",
  "Regulación emocional": "Emotional regulation",
  "Estrés y descanso": "Stress and rest",
  "Impacto cotidiano": "Everyday impact",
  "Historia y contexto": "History and context",
  "Recuerdo de palabras": "Word recall",
  "Memoria de secuencias": "Sequence memory",
  "Recuerdo de números": "Number recall",
  "Recuerdo de patrones": "Pattern recall",
  "Recuerdo final de palabras": "Final word recall",
  "Memoriza estas tres palabras. Más adelante te pediremos recordarlas.": "Memorize these three words. We will ask you to recall them later.",
  "Cuando lees, estudias o trabajas, ¿pierdes el hilo aunque quieras prestar atención?": "When reading, studying or working, do you lose track even when you want to pay attention?",
  "Cuenta cuántas estrellas aparecen entre los símbolos.": "Count how many stars appear among the symbols.",
  "¿Te cuesta dividir una tarea grande en pasos y decidir por dónde empezar?": "Do you find it difficult to break a large task into steps and decide where to start?",
  "Memoriza estos números en el mismo orden. Más adelante tendrás que seleccionarlos.": "Memorize these numbers in the same order. You will select them later.",
  "¿Sientes inquietud física o necesidad de moverte cuando debes permanecer sentado?": "Do you feel physically restless or need to move when you have to remain seated?",
  "¿Qué color aparece más veces en esta secuencia?": "Which color appears most often in this sequence?",
  "¿Una frustración pequeña puede provocarte una reacción emocional intensa o difícil de regular?": "Can a small frustration trigger an intense or difficult-to-regulate emotional reaction?",
  "¿Qué grupo contiene exactamente las tres palabras que memorizaste al comienzo?": "Which group contains exactly the three words you memorized at the beginning?",
  "¿Notas que tu concentración empeora cuando duermes poco o descansas mal?": "Does your concentration get worse when you sleep too little or rest poorly?",
  "¿Postergas tareas importantes aunque tengas claro que debes hacerlas?": "Do you put off important tasks even when you know you need to do them?",
  "Memoriza el orden de estos símbolos. Más adelante tendrás que reconocer la secuencia exacta.": "Memorize the order of these symbols. You will need to recognize the exact sequence later.",
  "¿Estas experiencias dificultan tus estudios, trabajo, tareas domésticas o relaciones?": "Do these experiences make studying, working, household tasks or relationships more difficult?",
  "¿Cuál era la secuencia numérica que viste anteriormente?": "What was the number sequence you saw earlier?",
  "¿Actúas o respondes rápidamente y luego piensas que habrías preferido hacer una pausa?": "Do you act or respond quickly and later wish you had paused first?",
  "¿Recuerdas que algunas de estas dificultades ya estaban presentes antes de los 12 años?": "Do you remember some of these difficulties being present before age 12?",
  "Cuenta cuántos círculos negros aparecen en la secuencia.": "Count how many black circles appear in the sequence.",
  "Memoriza estas cuatro palabras. Después de varias actividades te preguntaremos por ellas.": "Memorize these four words. We will ask you about them after several activities.",
  "¿Cuál era el orden exacto de los cuatro símbolos que memorizaste?": "What was the exact order of the four symbols you memorized?",
  "¿La preocupación, tensión o ansiedad ocupa tu mente e interfiere con lo que estás haciendo?": "Do worry, tension or anxiety occupy your mind and interfere with what you are doing?",
  "¿Te cuesta terminar una actividad cuando aparecen notificaciones, conversaciones o ruidos?": "Do you find it difficult to finish an activity when notifications, conversations or noise appear?",
  "Cuenta cuántos triángulos aparecen en esta secuencia.": "Count how many triangles appear in this sequence.",
  "¿Estas dificultades aparecen en más de un entorno, por ejemplo casa, estudio, trabajo o vida social?": "Do these difficulties occur in more than one setting, such as home, school, work or social life?",
  "¿Te cuesta recuperar la calma cuando algo interrumpe tus planes?": "Do you find it difficult to regain your calm when something disrupts your plans?",
  "¿Otras personas te han señalado dificultades de atención, organización, inquietud o impulsividad?": "Have other people pointed out difficulties with attention, organization, restlessness or impulsivity?",
  "Al inicio de esta parte memorizaste cuatro palabras. ¿Cuál es el grupo exacto?": "At the beginning of this section, you memorized four words. Which group is exact?",
  "Ya memoricé la secuencia": "I memorized the sequence",
  "Ya memoricé los números": "I memorized the numbers",
  "Ya memoricé las palabras": "I memorized the words",
  "Por ejemplo: relees el mismo párrafo varias veces y al final no recuerdas qué decía.": "For example: you reread the same paragraph several times and still cannot remember what it said.",
  "Por ejemplo: tienes varias cosas pendientes y no sabes cómo ordenarlas.": "For example: you have several pending tasks and do not know how to organize them.",
  "Observa cuánto tarda en bajar la intensidad de la emoción.": "Notice how long it takes for the intensity of the emotion to decrease.",
  "Compara tus días descansados con los días de poco sueño.": "Compare well-rested days with days when you sleep little.",
  "No se trata de pereza: observa si te cuesta iniciar o sostener el primer paso.": "This is not about laziness: notice whether starting or maintaining the first step is difficult.",
  "Responde pensando en consecuencias concretas y repetidas.": "Answer by thinking about specific, recurring consequences.",
  "Selecciona los cuatro números en el mismo orden.": "Select the four numbers in the same order.",
  "Piensa en recuerdos escolares, familiares o relatos de personas cercanas.": "Think about school or family memories, or accounts from people close to you.",
  "Elige la secuencia que viste, en el mismo orden.": "Choose the sequence you saw, in the same order.",
  "Por ejemplo: intentas trabajar, pero sigues pensando en un problema.": "For example: you try to work, but keep thinking about a problem.",
  "Piensa en lo que ocurre cuando intentas concentrarte y algo interrumpe tu tarea.": "Think about what happens when you try to focus and something interrupts your task.",
  "No tienen que presentarse igual en todos los lugares.": "They do not have to appear in the same way in every setting.",
  "Piensa en cambios inesperados o tareas que no salen como esperabas.": "Think about unexpected changes or tasks that do not go as planned.",
  "Considera comentarios respetuosos de personas que te conocen bien.": "Consider thoughtful feedback from people who know you well.",
  "Elige la secuencia que recuerdes, sin volver atrás.": "Choose the sequence you remember without going back.",
  "Observa y memoriza estos elementos. No los anotes: te preguntaremos por ellos más adelante.": "Observe and memorize these items. Do not write them down: we will ask you about them later.",
  "Piensa en una situación habitual de tu vida cotidiana.": "Think of a typical situation in your everyday life.",
  "¡Vas muy bien! Sigue a tu ritmo; cada respuesta ayuda a construir una imagen más completa.": "You are doing great! Keep your own pace; every answer helps build a more complete picture.",
  "¡Ya superaste la mitad! Mantén la concentración: estás avanzando muy bien.": "You are past the halfway point! Stay focused; you are making great progress.",
  "¡Último tramo! Ya falta poco. Respira y responde con tranquilidad.": "Final stretch! You are almost there. Breathe and answer calmly.",
  "¡Casi terminamos! Una respuesta honesta es más útil que intentar elegir la respuesta perfecta.": "Almost done! An honest answer is more useful than trying to choose the perfect answer.",
  "Tómate tu tiempo. Responde pensando en lo que suele ocurrirte, no en un día excepcional.": "Take your time. Think about what usually happens to you, not an unusual day.",
  "NeuroEval Pro | Conoce cómo funciona tu mente": "NeuroEval Pro | Understand how your mind works",
  "Idioma / Language": "Language",
  "🛡️ &nbsp; Panel de administración": "🛡️ &nbsp; Admin dashboard",
  "👤 &nbsp; Perfil": "👤 &nbsp; Profile",
  "🧠 &nbsp; Pruebas": "🧠 &nbsp; Assessments",
  "⚙️ &nbsp; Configuración": "⚙️ &nbsp; Settings",
  "↪ &nbsp; Cerrar sesión": "↪ &nbsp; Sign out",
  "Estrés y fatiga": "Stress and fatigue",
  "Autoconocimiento": "Self-awareness",
  "País y ciudad son voluntarios y se usan para estadísticas generales. No se almacena tu ubicación GPS.": "Country and city are optional and used for aggregate statistics. Your GPS location is not stored.",
  "He leído y acepto el aviso de privacidad y el tratamiento de mis datos para esta experiencia.": "I have read and accept the privacy notice and the processing of my data for this experience.",
  "Crear cuenta y comenzar →": "Create account and start →",
  "O continúa con": "Or continue with",
  "Continuar con Google": "Continue with Google",
  "NeuroEval Pro ofrece un autorregistro orientativo. No es una prueba diagnóstica, no confirma ni descarta TDAH y no reemplaza la valoración de un profesional de salud.": "NeuroEval Pro provides an informational self-report. It is not a diagnostic test, does not confirm or rule out ADHD, and does not replace assessment by a health professional.",
  "Tu mente merece atención": "Your mind deserves attention",
  "Pequeños descubrimientos pueden abrir nuevas perspectivas.": "Small discoveries can open new perspectives.",
  "Responde con calma, reflexiona sobre tus experiencias y recibe un resumen orientativo de tus respuestas.": "Answer calmly, reflect on your experiences, and receive an informational summary of your responses.",
  "Experiencia guiada": "Guided experience",
  "Informe personal": "Personal report",
  "Recupera tu acceso": "Recover your access",
  "Te enviaremos un código de verificación de seis dígitos a tu correo.": "We will send a six-digit verification code to your email.",
  "Correo de tu cuenta": "Your account email",
  "Enviar código": "Send code",
  "Código de seis dígitos": "Six-digit code",
  "Nueva contraseña": "New password",
  "Cambiar contraseña": "Change password",
  "Volver al inicio de sesión": "Back to sign in",
  "Tu espacio personal": "Your personal space",
  "Bienvenido a NeuroEval Pro": "Welcome to NeuroEval Pro",
  "Elige la evaluación que deseas realizar. Podrás regresar a este panel para consultar las opciones disponibles.": "Choose the assessment you want to take. You can return to this dashboard to view available options.",
  "Catálogo de evaluaciones": "Assessment catalog",
  "Selecciona una evaluación para conocer sus características y comenzar.": "Select an assessment to learn about its features and get started.",
  "● Disponible ahora": "● Available now",
  "Autorregistro de atención e indicadores asociados al TDAH": "Attention self-report and ADHD-related indicators",
  "Explora experiencias relacionadas con atención, organización, inquietud e impulsividad. Es orientativo y no constituye un diagnóstico.": "Explore experiences related to attention, organization, restlessness, and impulsivity. This is informational and is not a diagnosis.",
  "Comenzar evaluación →": "Start assessment →",
  "● Nueva evaluación": "● New assessment",
  "Observación familiar de indicadores asociados al TDAH": "Family observation of ADHD-related indicators",
  "Cuestionario para padres y cuidadores de menores de 4 a 17 años. Explora conductas observables en casa, colegio y otros entornos.": "Questionnaire for parents and caregivers of children aged 4–17. Explore observable behaviors at home, school, and other settings.",
  "Mismo precio que la evaluación actual · Informe individual": "Same price as the current assessment · Individual report",
  "Comenzar observación →": "Start observation →",
  "Próximamente": "Coming soon",
  "Una futura evaluación orientativa sobre atención, planificación y organización de actividades.": "A future informational assessment of attention, planning, and task organization.",
  "Una futura evaluación orientativa para explorar factores que pueden influir en el bienestar y la concentración.": "A future informational assessment of factors that may affect well-being and concentration.",
  "Las evaluaciones disponibles ofrecen información orientativa y no sustituyen una valoración profesional ni constituyen diagnósticos clínicos.": "Available assessments provide informational insights and do not replace professional evaluation or constitute clinical diagnoses.",
  "Estamos para ayudarte": "We're here to help",
  "Centro de soporte": "Support center",
  "Crea una solicitud y sigue la conversación con nuestro equipo.": "Create a request and follow the conversation with our team.",
  "↻ Actualizar solicitudes": "↻ Refresh requests",
  "Asunto": "Subject",
  "Categoría": "Category",
  "Cuenta y acceso": "Account and access",
  "Evaluaciones": "Assessments",
  "Pagos": "Payments",
  "Informe y PDF": "Report and PDF",
  "Problema técnico": "Technical issue",
  "Otro": "Other",
  "¿En qué podemos ayudarte?": "How can we help?",
  "Enviar solicitud": "Submit request",
  "Mis solicitudes": "My requests",
  "Tus conversaciones son privadas.": "Your conversations are private.",
  "Cargando tus solicitudes…": "Loading your requests…",
  "Entrena jugando": "Train through games",
  "Desafíos cognitivos por niveles": "Level-based cognitive challenges",
  "12 juegos diferentes, gratuitos y con dificultad progresiva. Supera cada reto para desbloquear el siguiente nivel.": "12 free games with progressive difficulty. Complete each challenge to unlock the next level.",
  "100 % gratis": "100% free",
  "Juegos disponibles": "Available games",
  "Niveles progresivos": "Progressive levels",
  "Tu avance": "Your progress",
  "0 niveles": "0 levels",
  "Memoria de trabajo": "Working memory",
  "1. Secuencia relámpago": "1. Flash sequence",
  "Recuerda números cada vez más largos y en el orden exacto.": "Remember increasingly long number sequences in the exact order.",
  "Jugar →": "Play →",
  "Atención selectiva": "Selective attention",
  "2. Cazador de símbolos": "2. Symbol hunter",
  "Encuentra objetivos entre más distractores y con menos tiempo.": "Find targets among more distractors and with less time.",
  "Razonamiento abstracto": "Abstract reasoning",
  "3. Completa el patrón": "3. Complete the pattern",
  "Descubre reglas numéricas y secuencias que se vuelven más complejas.": "Discover numerical rules and increasingly complex sequences.",
  "Cálculo mental · contrarreloj": "Mental math · timed",
  "4. Mente veloz": "4. Quick mind",
  "Resuelve operaciones con dificultad y ritmo crecientes.": "Solve calculations with increasing difficulty and pace.",
  "Memoria verbal": "Verbal memory",
  "5. Archivo de palabras": "5. Word archive",
  "Memoriza palabras y reconócelas entre opciones parecidas.": "Memorize words and recognize them among similar options.",
  "Discriminación visual": "Visual discrimination",
  "6. El intruso": "6. The odd one out",
  "Detecta el elemento diferente en grupos cada vez más parecidos.": "Spot the different item in increasingly similar groups.",
  "Control inhibitorio": "Inhibitory control",
  "7. Color bajo presión": "7. Color under pressure",
  "Responde al color de la tinta, no a la palabra que intenta distraerte.": "Respond to the ink color, not the distracting word.",
  "Orientación espacial": "Spatial orientation",
  "8. Giro mental": "8. Mental rotation",
  "Rota flechas y figuras mentalmente para elegir su orientación final.": "Mentally rotate arrows and shapes to choose their final orientation.",
  "Velocidad de reacción": "Reaction speed",
  "9. Reflejos": "9. Reflexes",
  "Espera la señal y reacciona sin anticiparte. Mejora tu marca personal.": "Wait for the signal and react without anticipating. Improve your personal best.",
  "Lógica deductiva": "Deductive logic",
  "10. Código secreto": "10. Secret code",
  "Usa pistas para descubrir combinaciones y resolver el código.": "Use clues to discover combinations and solve the code.",
  "Atención y conteo": "Attention and counting",
  "11. Cuenta y encuentra": "11. Count and find",
  "Cuenta objetivos en tableros con más elementos y distractores.": "Count targets on boards with more items and distractors.",
  "Atención dividida": "Divided attention",
  "12. Doble misión": "12. Double mission",
  "Atiende dos reglas al mismo tiempo y cambia de estrategia por ronda.": "Follow two rules at the same time and switch strategies each round.",
  "Cada juego guarda tu nivel más alto en este dispositivo. Los retos son recreativos y sus resultados no constituyen diagnósticos ni pruebas neuropsicológicas validadas.": "Each game saves your highest level on this device. These challenges are recreational; their results are not diagnoses or validated neuropsychological tests.",
  "Pausas que ayudan": "Helpful breaks",
  "Actividades para tu día": "Daily activities",
  "Pequeños ejercicios gratuitos para practicar enfoque, organización y autorregulación.": "Short free exercises to practice focus, organization, and self-regulation.",
  "Respiración consciente": "Mindful breathing",
  "Inhala suavemente durante 4 segundos, exhala durante 6. Repite cinco veces sin forzar la respiración.": "Breathe in gently for 4 seconds and out for 6. Repeat five times without forcing your breath.",
  "Marcar como realizada": "Mark as completed",
  "Divide una tarea": "Break down a task",
  "Escribe una tarea pendiente y divídela en tres pasos pequeños y concretos. Empieza por el primero.": "Write down a pending task and divide it into three small, concrete steps. Start with the first.",
  "Pausa de observación": "Observation break",
  "Mira a tu alrededor y nombra mentalmente cinco cosas que ves, cuatro que sientes y tres que escuchas.": "Look around and mentally name five things you see, four you feel, and three you hear.",
  "Enfoque de 10 minutos": "10-minute focus",
  "Elige una sola tarea, elimina una distracción y trabaja en ella durante diez minutos.": "Choose one task, remove one distraction, and work on it for ten minutes.",
  "Recuerdo del día": "Daily recall",
  "Sin consultar el teléfono, recuerda tres cosas que aprendiste o hiciste hoy y en qué orden ocurrieron.": "Without checking your phone, recall three things you learned or did today and the order in which they happened.",
  "Pausa de movimiento": "Movement break",
  "Levántate, cambia de postura y camina suavemente unos minutos si tus condiciones lo permiten.": "Stand up, change posture, and walk gently for a few minutes if your circumstances allow.",
  "Lectura con intención": "Intentional reading",
  "Lee un párrafo corto. Después, explica con tus palabras tres ideas principales sin mirar el texto.": "Read a short paragraph. Then explain three main ideas in your own words without looking at the text.",
  "Ordena tu espacio": "Organize your space",
  "Dedica cinco minutos a organizar una pequeña zona de trabajo. Deja a la vista solo lo que necesitas.": "Spend five minutes organizing a small work area. Keep only what you need in view.",
  "Cuenta hacia atrás": "Count backwards",
  "Cuenta desde 50 hacia atrás de tres en tres. Hazlo a tu ritmo y vuelve a empezar si pierdes la cuenta.": "Count backwards from 50 in steps of three. Go at your own pace and start again if you lose track.",
  "Plan de tres prioridades": "Three-priority plan",
  "Elige tres tareas importantes para hoy. Marca cuál es la primera y estima cuánto tiempo necesitas.": "Choose three important tasks for today. Mark the first one and estimate how much time you need.",
  "Escucha atenta": "Active listening",
  "Escucha durante dos minutos un sonido o una canción. Identifica cinco detalles que normalmente pasarías por alto.": "Listen to a sound or song for two minutes. Identify five details you would normally overlook.",
  "Diario de bienestar": "Well-being journal",
  "Anota cómo te sientes, qué pudo influir en ese estado y una acción pequeña que te ayudaría ahora.": "Write down how you feel, what may have influenced it, and one small action that could help now.",
  "Hábitos y bienestar": "Habits and well-being",
  "Recomendaciones prácticas": "Practical recommendations",
  "Ideas generales que puedes adaptar a tu rutina. No sustituyen una orientación profesional.": "General ideas you can adapt to your routine. They do not replace professional guidance.",
  "1. Trabaja en bloques pequeños": "1. Work in small blocks",
  "Elige una tarea, define un primer paso y dedica un periodo breve a completarlo. Haz una pausa antes de continuar.": "Choose a task, define a first step, and spend a short period completing it. Take a break before continuing.",
  "2. Reduce las distracciones visibles": "2. Reduce visible distractions",
  "Deja a mano solo lo que necesitas y silencia notificaciones que no sean importantes durante tu bloque de enfoque.": "Keep only what you need nearby and mute nonessential notifications during your focus block.",
  "3. Usa recordatorios externos": "3. Use external reminders",
  "Apóyate en listas, alarmas y calendarios. No necesitas depender únicamente de la memoria.": "Use lists, alarms, and calendars. You do not need to rely on memory alone.",
  "4. Practica de forma breve y constante": "4. Practice briefly and consistently",
  "Alterna juegos de memoria, búsqueda visual y actividades de organización. Observa cómo te sientes, sin convertir el puntaje en una etiqueta.": "Alternate memory games, visual search, and organizational activities. Notice how you feel without turning scores into labels.",
  "5. Cuida el descanso y las pausas": "5. Look after rest and breaks",
  "Procura horarios de sueño regulares y pausas de movimiento adecuadas a tus posibilidades.": "Aim for regular sleep times and movement breaks suited to your circumstances.",
  "6. Convierte las metas en acciones observables": "6. Turn goals into observable actions",
  "En lugar de proponerte “ser más organizado”, define una acción concreta: preparar los materiales antes de empezar.": "Instead of aiming to “be more organized,” define a concrete action: prepare materials before starting.",
  "7. Usa una señal para comenzar": "7. Use a starting cue",
  "Asocia el inicio de una tarea con una señal sencilla, como abrir tu agenda, poner un temporizador o despejar el escritorio.": "Link the start of a task to a simple cue, such as opening your planner, setting a timer, or clearing your desk.",
  "8. Alterna esfuerzo y recuperación": "8. Alternate effort and recovery",
  "Prueba bloques de trabajo adaptados a tu energía y realiza pausas breves entre ellos. Ajusta la duración según cómo te sientas.": "Try work blocks adapted to your energy and take short breaks between them. Adjust the duration to how you feel.",
  "9. Repite la información de otra manera": "9. Repeat information in another way",
  "Resume en voz alta, dibuja un esquema o escribe palabras clave. Cambiar de formato puede facilitar la comprensión.": "Summarize aloud, draw an outline, or write keywords. Changing the format can make information easier to understand.",
  "10. Prepara el día siguiente": "10. Prepare for the next day",
  "Antes de terminar, anota el primer paso de mañana y deja listo lo que puedas necesitar.": "Before finishing, write down tomorrow's first step and prepare what you may need.",
  "11. Reconoce los avances pequeños": "11. Recognize small steps forward",
  "Registra lo que sí lograste, incluso si fue un paso breve. Evita comparar tu ritmo con el de otras personas.": "Record what you achieved, even if it was a small step. Avoid comparing your pace with others.",
  "12. Observa tus momentos de mayor energía": "12. Notice when your energy is highest",
  "Identifica en qué momentos te resulta más sencillo concentrarte y reserva, cuando sea posible, las tareas exigentes para esos periodos.": "Identify when it is easiest for you to focus and, when possible, reserve demanding tasks for those periods.",
  "13. Reduce la carga de memoria": "13. Reduce memory load",
  "Deja notas visibles, utiliza listas de verificación y establece un lugar fijo para objetos importantes.": "Leave visible notes, use checklists, and establish a fixed place for important items.",
  "14. Haz una cosa a la vez cuando sea posible": "14. Do one thing at a time when possible",
  "Cierra pestañas innecesarias y termina un paso antes de cambiar de actividad. La multitarea puede aumentar los olvidos.": "Close unnecessary tabs and finish one step before switching activities. Multitasking can increase forgetfulness.",
  "15. Pide apoyo de forma específica": "15. Ask for specific support",
  "Si lo necesitas, explica qué tarea te cuesta y qué ayuda concreta te serviría: recordar una fecha, dividir un proyecto o revisar prioridades.": "If needed, explain which task is difficult and what specific help would be useful: remembering a date, breaking down a project, or reviewing priorities.",
  "Si las dificultades de atención, memoria, impulsividad o estado de ánimo afectan tu vida diaria, consulta con un profesional cualificado.": "If difficulties with attention, memory, impulsivity, or mood affect your daily life, consult a qualified professional.",
  "Tu recorrido": "Your journey",
  "Resumen de los juegos y actividades completados en este dispositivo y cuenta.": "Summary of games and activities completed on this device and account.",
  "Actualizar": "Refresh",
  "Juegos completados": "Games completed",
  "Actividades realizadas": "Activities completed",
  "Mejor puntuación": "Best score",
  "Actividad reciente": "Recent activity",
  "Aún no hay actividades registradas. ¡Prueba tu primer juego!": "No activities recorded yet. Try your first game!",
  "Mis evaluaciones": "My assessments",
  "Historial de evaluaciones y acceso a tus informes.": "Assessment history and access to your reports.",
  "Total de evaluaciones": "Total assessments",
  "Pagadas": "Paid",
  "Pendientes de pago": "Pending payment",
  "Inicia sesión para consultar tus evaluaciones.": "Sign in to view your assessments.",
  "El progreso de esta sección se guarda en el navegador de este dispositivo. Si borras los datos del navegador o cambias de dispositivo, el historial local puede perderse.": "Progress in this section is saved in this device's browser. If you clear browser data or change devices, local history may be lost.",
  "Preferencias y seguridad": "Preferences and security",
  "Administra opciones básicas de acceso y conoce cómo se utiliza tu cuenta.": "Manage basic access options and learn how your account is used.",
  "Cuenta activa": "Active account",
  "Seguridad de la cuenta": "Account security",
  "Puedes iniciar el proceso de recuperación para establecer una contraseña nueva mediante el código enviado a tu correo.": "You can start the recovery process to set a new password using the code sent to your email.",
  "Tus respuestas de evaluación se utilizan para generar el informe orientativo. Evita compartir tu contraseña y cierra sesión si utilizas un dispositivo compartido.": "Your assessment answers are used to generate the informational report. Do not share your password and sign out if you use a shared device.",
  "Observación familiar · 4 a 17 años": "Family observation · Ages 4–17",
  "Cuéntanos sobre el menor que observas": "Tell us about the child you are observing",
  "Responde como padre, madre o cuidador. No hay respuestas correctas o incorrectas. La evaluación se refiere a conductas observadas durante los últimos seis meses, teniendo en cuenta la edad y las circunstancias. Ten en cuenta las diferencias esperables entre las etapas de 4–7, 8–12 y 13–17 años.": "Answer as a parent or caregiver. There are no right or wrong answers. This assessment concerns behaviors observed over the last six months, taking age and circumstances into account. Consider expected differences across ages 4–7, 8–12, and 13–17.",
  "Nombre del familiar que responde": "Name of the responding family member",
  "Edad del menor": "Child's age",
  "Seleccionar edad": "Select age",
  "¿Qué parentesco tienes con el menor?": "What is your relationship to the child?",
  "Madre": "Mother",
  "Padre": "Father",
  "Tutor legal": "Legal guardian",
  "Abuelo/a": "Grandparent",
  "Otro familiar": "Other family member",
  "Cuidador/a": "Caregiver",
  "¿En qué entornos puedes observar su comportamiento? (Selecciona al menos uno)": "In which settings can you observe their behavior? (Select at least one)",
  "Casa": "Home",
  "Colegio": "School",
  "Actividades sociales u otros espacios": "Social activities or other settings",
  "Importante: esta herramienta no diagnostica ni descarta TDAH y no es una escala clínica validada. No escribas el nombre del menor, su colegio ni otros datos que permitan identificarlo. Si te preocupa su desarrollo o bienestar, consulta con pediatría o un profesional de salud infantil.": "Important: this tool does not diagnose or rule out ADHD and is not a validated clinical scale. Do not enter the child's name, school, or other identifying details. If you are concerned about their development or well-being, consult a pediatrician or child health professional.",
  "Confirmo que soy su padre, madre, tutor o cuidador autorizado y que puedo proporcionar esta información para recibir orientación.": "I confirm that I am the child's parent, guardian, or authorized caregiver and may provide this information to receive guidance.",
  "Continuar al cuestionario →": "Continue to questionnaire →",
  "Volver al catálogo": "Back to catalog",
  "Tu espacio de exploración": "Your exploration space",
  "Vamos paso a paso.": "Let's take it step by step.",
  "Responde según lo que observas habitualmente; no hay respuestas buenas ni malas.": "Answer based on what you usually observe; there are no right or wrong answers.",
  "Atención y enfoque": "Attention and focus",
  "Tu progreso": "Your progress",
  "Selecciona la frecuencia que mejor describa tu experiencia.": "Select the frequency that best describes your experience.",
  "Tómate tu tiempo. No hay respuestas correctas o incorrectas.": "Take your time. There are no right or wrong answers.",
  "Evaluación completada": "Assessment completed",
  "Tu informe está casi listo.": "Your report is almost ready.",
  "Tu autorregistro fue recibido. Completa el pago para desbloquear el informe detallado y descargar tu PDF.": "Your self-report has been received. Complete payment to unlock the detailed report and download your PDF.",
  "Pago único por informe": "One-time payment per report",
  "¿Tienes un código promocional?": "Do you have a promo code?",
  "Aplicar código": "Apply code",
  "Resumen de dimensiones": "Dimension summary",
  "Orientaciones personales": "Personal guidance",
  "Informe descargable": "Downloadable report",
  "Ya realicé el pago · Verificar estado": "I've paid · Verify status",
  "El estado del pago se confirma en el servidor mediante la notificación de Wompi. El regreso desde la pasarela no constituye por sí solo una confirmación de pago.": "Payment status is confirmed on the server through a Wompi notification. Returning from the payment gateway alone does not confirm payment.",
  "Tu informe personal": "Your personal report",
  "Un espacio para comprenderte.": "A space to understand yourself.",
  "Este resumen organiza tus respuestas y ofrece orientaciones generales para reflexionar sobre tu bienestar cognitivo.": "This summary organizes your answers and offers general guidance to help you reflect on your cognitive well-being.",
  "Resultado del autorregistro": "Self-report result",
  "Indicadores descriptivos calculados a partir de tus respuestas.": "Descriptive indicators calculated from your answers.",
  "Mapa de dimensiones": "Dimensions map",
  "Comparación visual de los indicadores del autorregistro. Los valores describen respuestas y no representan probabilidades ni un diagnóstico clínico.": "Visual comparison of self-report indicators. Values describe responses and do not represent probabilities or a clinical diagnosis.",
  "Actividades interactivas de atención y memoria": "Interactive attention and memory activities",
  "Aspectos que ayudan a interpretar las respuestas con cautela.": "Aspects that help interpret responses with caution.",
  "Orientaciones personalizadas": "Personalized guidance",
  "Estrategias relacionadas con las áreas que destacaron en tus respuestas.": "Strategies related to the areas that stood out in your responses.",
  "Este informe no es un diagnóstico clínico ni una escala validada. Los porcentajes representan únicamente la distribución de respuestas de este cuestionario y no deben interpretarse como probabilidad de tener un trastorno. Si tienes inquietudes, consulta con un profesional cualificado.": "This report is not a clinical diagnosis or a validated scale. Percentages represent only the distribution of responses in this questionnaire and must not be interpreted as the probability of having a disorder. If you have concerns, consult a qualified professional.",
  "↓ Descargar informe PDF": "↓ Download PDF report",
  "Administración segura": "Secure administration",
  "Centro de administración.": "Administration center.",
  "Gestiona clientes, evaluaciones, pagos e informes desde un solo lugar.": "Manage clients, assessments, payments, and reports in one place.",
  "📊 Resumen": "📊 Overview",
  "👥 Clientes": "👥 Clients",
  "🧠 Evaluaciones": "🧠 Assessments",
  "💳 Pagos": "💳 Payments",
  "📈 Analítica comercial": "📈 Business analytics",
  "🌍 Alcance internacional": "🌍 International reach",
  "🏷️ Precios y promociones": "🏷️ Pricing and promotions",
  "⚙️ Configuración": "⚙️ Settings",
  "🩺 Salud del sistema": "🩺 System health",
  "🛡️ Colaboradores": "🛡️ Team members",
  "🎧 Centro de soporte": "🎧 Support center",
  "📋 Actividad": "📋 Activity",
  "Clientes registrados": "Registered clients",
  "Pendientes": "Pending",
  "Fallidos": "Failed",
  "Ingresos confirmados": "Confirmed revenue",
  "Evolución de evaluaciones": "Assessment trends",
  "Distribución mensual de los registros recientes disponibles": "Monthly distribution of available recent records",
  "Tendencia": "Trend",
  "Cargando datos…": "Loading data…",
  "Evaluaciones registradas": "Assessments recorded",
  "Muestra disponible": "Available sample",
  "Estado de pagos": "Payment status",
  "Proporción según los registros disponibles": "Proportion based on available records",
  "Sin datos": "No data",
  "Últimas evaluaciones recibidas.": "Latest assessments received.",
  "Ver todas": "View all",
  "↻ Actualizar": "↻ Refresh",
  "Fecha": "Date",
  "Cliente": "Client",
  "Correo": "Email",
  "Estado": "Status",
  "Acciones": "Actions",
  "Cargando...": "Loading...",
  "Perfiles asociados a las cuentas de la plataforma.": "Profiles associated with platform accounts.",
  "Registro": "Registration",
  "UID": "UID",
  "Se muestran hasta 100 perfiles registrados.": "Up to 100 registered profiles are shown.",
  "Historial de evaluaciones": "Assessment history",
  "Consulta estados, respuestas, resultados e informes.": "View statuses, answers, results, and reports.",
  "Resultado": "Result",
  "Pago": "Payment",
  "Se muestran hasta las 100 evaluaciones más recientes. El detalle protegido incluye respuestas y resultados almacenados.": "Up to the 100 most recent assessments are shown. Protected details include stored answers and results.",
  "Analítica comercial": "Business analytics",
  "Indicadores calculados con los registros de evaluaciones y pagos guardados en Firestore.": "Indicators calculated from assessment and payment records stored in Firestore.",
  "↻ Actualizar analítica": "↻ Refresh analytics",
  "Cargando indicadores…": "Calculating indicators…",
  "Ingresos confirmados · últimos 6 meses": "Confirmed revenue · last 6 months",
  "Solo pagos con estado confirmado.": "Confirmed payments only.",
  "Conversiones por mes": "Monthly conversions",
  "Evaluaciones pagadas frente al total creado en cada mes.": "Paid assessments compared with the total created each month.",
  "Rendimiento de promociones": "Promotion performance",
  "Usos reservados por código y evaluaciones que lo tienen asociado. Un uso reservado no garantiza que el pago haya sido aprobado.": "Reserved uses by code and associated assessments. A reserved use does not guarantee payment approval.",
  "Países resaltados cuando tienen grupos agregados de al menos 10 usuarios.": "Countries are highlighted when they have aggregated groups of at least 10 users.",
  "Solo se resaltan países con al menos 10 perfiles y código reconocible. No se muestran ubicaciones individuales.": "Only countries with at least 10 profiles and a recognized code are highlighted. Individual locations are not shown.",
  "Cartografía: Natural Earth, escala 1:110m. Datos de dominio público; límites esquemáticos, no oficiales.": "Cartography: Natural Earth, 1:110m scale. Public-domain data; schematic, non-official boundaries.",
  "No se pudo cargar la cartografía mundial.": "The world map could not be loaded.",
  "El archivo cartográfico no es válido.": "The map data file is invalid.",
  "No se pudo calcular la analítica geográfica.": "Global geographic analytics could not be calculated.",
  "No fue posible cargar las estadísticas:": "Could not load statistics:",
  "No se pudo cargar el mapa mundial.": "The world map could not be loaded.",
  "No se pudo cargar la lista de países:": "Could not load the country list:",
  "No se pudo obtener la configuración de Firebase.": "Could not retrieve the Firebase configuration.",
  "La configuración pública de Firebase está incompleta.": "The public Firebase configuration is incomplete.",
  "Se requiere una edad adulta válida para continuar.": "A valid adult age is required to continue.",
  "La edad debe estar entre 18 y 99 años.": "Age must be between 18 and 99.",
  "Selecciona el objetivo de tu evaluación.": "Select the goal of your assessment.",
  "Este correo está reservado para administración.": "This email address is reserved for administration.",
  "Administración": "Administration",
  "Error de sesión:": "Session error:",
  "No se pudo validar la sesión.": "Could not validate the session.",
  "Evaluación NeuroEval Pro": "NeuroEval Pro Assessment",
  "Secuencia relámpago": "Flash sequence",
  "Cazador de símbolos": "Symbol hunter",
  "Completa el patrón": "Complete the pattern",
  "Cálculo mental": "Mental math",
  "Color bajo presión": "Color under pressure",
  "Código secreto": "Secret code",
  "Doble misión": "Double mission",
  "¡Nivel ": "Level ",
  " superado! ": " completed! ",
  "No se superó el nivel ": "Level not passed ",
  " dígitos. Luego escríbelos en el mismo orden.": " digits. Then enter them in the same order.",
  " dígitos": " digits",
  " estrellas. Hay más distractores y menos tiempo en cada nivel.": " stars. Each level has more distractors and less time.",
  "Cuenta los círculos negros entre ": "Count the black circles among ",
  " círculos.": " circles.",
  "¡Cálculo correcto!": "Correct calculation!",
  "Ese no era el símbolo diferente.": "That was not the odd symbol.",
  "Después de ": "After ",
  "Tu reacción: ": "Your reaction: ",
  "¡Deducción correcta!": "Correct deduction!",
  "¡Atendiste a las dos reglas!": "You followed both rules!",
  "Había ": "There were ",
  "No se pudo solicitar el código.": "Could not request the code.",
  "El código debe tener seis dígitos.": "The code must contain six digits.",
  "No se pudo cambiar la contraseña.": "Could not change the password.",
  "No se pudo guardar tu evaluación: ": "Could not save your assessment: ",
  "No se encontró la evaluación que deseas consultar.": "The assessment you want to view could not be found.",
  "El servidor no entregó los datos necesarios para Wompi.": "The server did not provide the information required by Wompi.",
  "Informe de observación familiar · ": "Family observation report · ",
  " · Familiar: ": " · Relationship: ",
  " · no especificado": " · not specified",
  "Atención y seguimiento de tareas": "Attention and task follow-up",
  "Atención sostenida y memoria cotidiana": "Sustained attention and everyday memory",
  "Organización y funciones ejecutivas": "Organization and executive functions",
  "Duración, entornos y observación externa": "Duration, settings, and external observation",
  "Estrés, preocupación y descanso": "Stress, worry, and rest",
  "Orientación": "Guidance",
  "No hay evaluaciones que coincidan con la búsqueda.": "No assessments match your search.",
  "Todavía no hay perfiles registrados.": "No profiles have been registered yet.",
  "Exportación generada. ": "Export created. ",
  "Exportación parcial: ": "Partial export: ",
  " superó el límite de 500 documentos. No la uses como respaldo completo; solicita una copia administrada en Google Cloud.": " exceeded the 500-document limit. Do not use it as a complete backup; request a managed copy in Google Cloud.",
  "Última comprobación: ": "Last checked: ",
  "No fue posible ejecutar el diagnóstico: ": "Could not run the diagnostic: ",
  "Precio por evaluación": "Price per assessment",
  "Pagos de demostración": "Demo payments",
  "Mapa mundial con países que tienen grupos agregados de usuarios": "World map showing countries with aggregated user groups",
  "Aún no hay grupos de países que cumplan el umbral de privacidad": "No country groups meet the privacy threshold yet",
  "No fue posible cargar el mapa mundial. Las estadísticas por país siguen disponibles abajo.": "The world map could not be loaded. Country statistics remain available below.",
  "No fue posible cargar el mapa. Las estadísticas por país siguen disponibles abajo.": "The map could not be loaded. Country statistics remain available below.",
  "No fue posible cargar las estadísticas: ": "Could not load statistics: ",
  "No se pudo consultar la analítica.": "Could not retrieve analytics.",
  "Conversión a pago": "Payment conversion",
  "No se pudo cargar la analítica: ": "Could not load analytics: ",
  "En gestión": "In progress",
  "Evaluación": "Assessment",
  "Escribe un mensaje para continuar la conversación…": "Write a message to continue the conversation…",
  "Rectificación": "Correction",
  "Revisión de eliminación": "Deletion review",
  "Retiro de autorización de datos sensibles": "Withdrawal of sensitive-data consent",
  "En revisión": "Under review",
  "Marcar en revisión": "Mark as under review",
  "No se pudo cargar la configuración comercial: ": "Could not load commercial settings: ",
  "Código ": "Code ",
  "¿Revocar definitivamente el acceso administrativo de ": "Permanently revoke administrative access for ",
  "Último acceso": "Last access",
  "La respuesta del servidor no contiene una evaluación válida.": "The server response does not contain a valid assessment.",
  "Descripción": "Description",
  "Dimensión": "Dimension",
  "La autenticación todavía no está disponible.": "Authentication is not available yet.",
  "Error al cerrar sesión:": "Sign-out error:",
  "No se pudo cerrar la sesión. ": "Could not sign out. ",
  "Inténtalo nuevamente.": "Please try again.",
  "Preparando la exportación de tus datos…": "Preparing your data export…",
  "Se preparó la copia de tus datos.": "Your data copy is ready.",
  "Esto registra una solicitud de revisión de eliminación; no borra inmediatamente tu cuenta ni tus registros. ¿Continuar?": "This records a deletion-review request; it does not immediately delete your account or records. Continue?",
  "Tu solicitud de privacidad quedó registrada para revisión.": "Your privacy request has been submitted for review.",
  "No se pudo completar el acceso con Google. Código:": "Could not complete Google sign-in. Code:",
  "No se pudo iniciar sesión con Google. Código:": "Could not sign in with Google. Code:",
  " triángulos.": " triangles.",
  "franja no especificada": "unspecified age band",
  "Los valores describen respuestas del autorregistro; no son probabilidades ni un diagnóstico.": "The values describe self-report responses; they are not probabilities or a diagnosis.",
  "Alcance internacional": "International reach",
  "Distribución agregada por país, ciudad, edad, idioma y objetivo declarado.": "Aggregated distribution by country, city, age, language, and stated goal.",
  "↻ Actualizar datos": "↻ Refresh data",
  "Los grupos de menos de 10 usuarios se ocultan para proteger la privacidad.": "Groups with fewer than 10 users are hidden to protect privacy.",
  "Mapa mundial de usuarios": "World map of users",
  "Ubicaciones agregadas por país; cada punto representa un grupo, no una persona.": "Aggregated locations by country; each point represents a group, not an individual.",
  "Vista global": "Global view",
  "Cargando mapa mundial…": "Loading world map…",
  "Solo se representan países con al menos 10 perfiles y código de país reconocible. No se muestran ubicaciones individuales.": "Only countries with at least 10 profiles and a recognized country code are shown. Individual locations are not displayed.",
  "Usuarios por país": "Users by country",
  "Usuarios por ciudad": "Users by city",
  "Distribución por edades": "Age distribution",
  "Idioma": "Language",
  "No se muestran nombres, correos, identificadores, respuestas ni ubicaciones individuales. Los grupos inferiores a 10 se ocultan. La ciudad es voluntaria; no se usa GPS.": "Names, emails, identifiers, answers, and individual locations are not shown. Groups under 10 are hidden. City is optional; GPS is not used.",
  "Pagos y transacciones Wompi": "Wompi payments and transactions",
  "Seguimiento de referencias, identificadores y confirmaciones recibidas por webhook.": "Track references, identifiers, and confirmations received by webhook.",
  "Valor": "Amount",
  "Referencia": "Reference",
  "ID transacción": "Transaction ID",
  "Confirmación": "Confirmation",
  "Precios de las evaluaciones": "Assessment pricing",
  "Actualmente hay una evaluación de pago. Modifica su precio; las evaluaciones futuras adicionales podrán tener tarifas independientes cuando se incorporen al catálogo. Los registros ya creados conservan su precio original.": "There is currently one paid assessment. Change its price; future assessments may have separate rates when added to the catalog. Existing records keep their original price.",
  "Evaluación integral (TDAH y concentración) · COP": "Comprehensive assessment (ADHD and focus) · COP",
  "Guardar precio": "Save price",
  "Crear código promocional": "Create promo code",
  "Define descuentos porcentuales o por valor fijo, vigencia, límite de usos y condiciones para nuevos clientes. Cada uso se reserva cuando el cliente aplica el código y genera el pago.": "Set percentage or fixed-value discounts, validity, usage limits, and conditions for new clients. Each use is reserved when a client applies the code and creates a payment.",
  "Código promocional": "Promo code",
  "Tipo de descuento": "Discount type",
  "Valor del descuento": "Discount amount",
  "Máximo de usos (0 = ilimitado)": "Maximum uses (0 = unlimited)",
  "Inicio (opcional)": "Start (optional)",
  "Vencimiento (opcional)": "Expiration (optional)",
  "Exclusivo para clientes que todavía no hayan pagado una evaluación.": "Only for clients who have not yet paid for an assessment.",
  "Promociones y códigos": "Promotions and codes",
  "Consulta los usos y activa o desactiva campañas.": "Review usage and activate or deactivate campaigns.",
  "Salud del sistema": "System health",
  "Colaboradores": "Team members",
  "Actividad": "Activity",
  "Algunas veces": "Sometimes",
  "A menudo": "Often",
  "Muy a menudo": "Very often",
  "Atención": "Attention",
  "Actividad e inquietud": "Activity and restlessness",
  "Impulsividad": "Impulsivity",
  "Contexto": "Context",
  "Factores adicionales": "Additional factors",
  "Informe de observación familiar": "Family observation report",
  "Observación familiar": "Family observation",
  "Una mirada a las conductas observadas.": "A closer look at the observed behaviors.",
  "Este informe organiza tus observaciones y ofrece orientaciones generales para acompañar al menor.": "This report organizes your observations and offers general guidance to support the child.",
  "Orientaciones para padres y cuidadores": "Guidance for parents and caregivers",
  "Esta evaluación recoge observaciones del familiar; no incluye pruebas de rendimiento cognitivo ni actividades para el menor.": "This assessment collects family observations; it does not include cognitive performance tests or activities for the child.",
  "Resumen orientativo": "Informational summary",
  "Porcentaje descriptivo de las respuestas de esta dimensión; no equivale a una probabilidad clínica.": "Descriptive percentage of responses in this dimension; it is not a clinical probability.",
  "Actividades interactivas:": "Interactive activities:",
  "retos de selección correctos. Memoria:": "correct selection tasks. Memory:",
  "búsqueda visual:": "visual search:",
  "Otros factores que pueden influir": "Other factors that may influence",
  "Historia y contextos": "History and settings",
  "Se observan comportamientos que conviene explorar con un profesional": "Behaviors are observed that may warrant professional exploration",
  "Observaciones para seguir registrando y contextualizando": "Observations to continue documenting and contextualizing",
  "Varias conductas fueron descritas como frecuentes o muy frecuentes y se señalaron aspectos de impacto o presencia en distintos entornos. Esto no confirma TDAH: una valoración profesional debe considerar el desarrollo, la historia, otros posibles factores y distintas fuentes de información.": "Several behaviors were described as frequent or very frequent, with reported impact or presence across settings. This does not confirm ADHD: a professional assessment should consider development, history, other possible factors, and multiple sources of information.",
  "Las respuestas ofrecen una descripción inicial, pero no permiten confirmar ni descartar TDAH. La frecuencia, la edad, las circunstancias y el impacto deben analizarse con más información y, cuando exista preocupación, con un profesional.": "The answers provide an initial description but cannot confirm or rule out ADHD. Frequency, age, circumstances, and impact should be considered with more information and, when there is concern, with a professional.",
  "Patrones que merecen exploración:": "Patterns worth exploring:",
  "Sin elevaciones marcadas en las áreas principales exploradas": "No marked elevations in the main areas explored",
  "atención y memoria cotidiana": "attention and everyday memory",
  "organización y gestión de tareas": "organization and task management",
  "inquietud e impulsividad": "restlessness and impulsivity",
  "regulación emocional": "emotional regulation",
  "Reduce las distracciones visibles": "Reduce visible distractions",
  "Apoya la memoria con señales externas": "Support memory with external cues",
  "Convierte las tareas en primeros pasos": "Break tasks into first steps",
  "Haz visible el tiempo": "Make time visible",
  "Programa movimiento y pausas": "Schedule movement and breaks",
  "Crea un intervalo para regular emociones": "Create a pause to regulate emotions",
  "Revisa los factores que cambian tu concentración": "Review factors that affect your concentration",
  "Considera una valoración profesional": "Consider a professional assessment",
  "Conserva lo que ya te funciona": "Keep what already works for you",
  "Registra ejemplos concretos": "Record concrete examples",
  "Contrasta la observación con el colegio": "Compare observations with the school",
  "Prueba apoyos cotidianos": "Try everyday supports",
  "Revisa otros factores que pueden influir": "Review other factors that may influence behavior",
  "Solicita una valoración profesional": "Request a professional assessment",
  "Consulta si la preocupación continúa": "Seek guidance if concerns continue",
  "Durante las próximas semanas anota qué ocurrió, cuándo, dónde, qué pasó antes y cómo afectó al menor. Evita etiquetas como perezoso, desobediente o problemático.": "Over the next few weeks, note what happened, when, where, what came before, and how it affected the child. Avoid labels such as lazy, disobedient, or problematic.",
  "Solicita al docente ejemplos específicos sobre atención, seguimiento de instrucciones, movimiento, turnos y finalización de tareas.": "Ask the teacher for specific examples of attention, following instructions, movement, turn-taking, and task completion.",
  "Da instrucciones breves de una en una, utiliza rutinas visuales, divide las tareas en pasos pequeños y reconoce el esfuerzo.": "Give brief instructions one at a time, use visual routines, break tasks into small steps, and acknowledge effort.",
  "El sueño, el estrés, los cambios familiares, la salud o las dificultades de aprendizaje pueden modificar la conducta y la atención. Coméntalos con un profesional sin asumir una causa única.": "Sleep, stress, family changes, health, or learning difficulties may affect behavior and attention. Discuss them with a professional without assuming a single cause.",
  "Las respuestas describen conductas frecuentes junto con señales de impacto o presencia en distintos contextos. Conviene comentarlo con pediatría o un profesional de salud mental infantil; lleva ejemplos y, si es posible, información del colegio.": "The answers describe frequent behaviors alongside signs of impact or presence across settings. Consider discussing this with a pediatrician or child mental health professional; bring examples and, if possible, information from school.",
  "Aunque este cuestionario no muestre un patrón destacado, si algo te preocupa o afecta al menor, puedes solicitar orientación profesional. Este resultado no descarta TDAH ni otras dificultades.": "Even if this questionnaire does not show a prominent pattern, seek professional guidance if something concerns you or affects the child. This result does not rule out ADHD or other difficulties.",
  "Se mencionan factores adicionales que también podrían influir y conviene explorar": "Additional factors that may also influence behavior are mentioned and are worth exploring",
  "No se señalaron con frecuencia factores adicionales en esta respuesta": "No additional factors were frequently reported in this response",
  "Se refiere impacto en actividades cotidianas": "Impact on everyday activities is reported",
  "No se señaló impacto frecuente en esta respuesta": "No frequent impact was reported in this response",
  "Se refiere una duración aproximada de seis meses o más": "A duration of approximately six months or more is reported",
  "La duración requiere mayor observación": "Duration requires further observation",
  "Se señalan antecedentes desde etapas anteriores del desarrollo": "History from earlier developmental stages is reported",
  "Conviene contrastar otros entornos": "Other settings should be compared",
  "Otro cuidador o docente también expresa preocupación": "Another caregiver or teacher also expresses concern",
  "Se observan varios entornos": "Several settings are observed",
  "Fecha no disponible": "Date unavailable",
  "Consultando tus evaluaciones...": "Checking your assessments...",
  "Pago confirmado. Preparando tu informe.": "Payment confirmed. Preparing your report.",
  "El pago aún no aparece confirmado.": "Payment has not yet been confirmed.",
  "Completa el pago para desbloquear tu informe.": "Complete payment to unlock your report.",
  "Guardando respuestas...": "Saving answers...",
  "No fue posible cargar las estadísticas:": "Could not load statistics:",
  "NeuroEval": "NeuroEval",
  "Pro": "Pro",
  "🌐 English": "🌐 English",
  "🛡️   Panel de administración": "🛡️   Admin dashboard",
  "👤   Perfil": "👤   Profile",
  "🧠   Pruebas": "🧠   Assessments",
  "↪   Cerrar sesión": "↪   Sign out",
  "15 preguntas": "15 questions",
  "Concentración y organización": "Focus and organization",
  "Estrés, fatiga y sobrecarga": "Stress, fatigue, and overload",
  "Español": "Spanish",
  "4 años": "4 years",
  "5 años": "5 years",
  "6 años": "6 years",
  "7 años": "7 years",
  "8 años": "8 years",
  "9 años": "9 years",
  "10 años": "10 years",
  "11 años": "11 years",
  "12 años": "12 years",
  "13 años": "13 years",
  "14 años": "14 years",
  "15 años": "15 years",
  "16 años": "16 years",
  "17 años": "17 years",
  "Pregunta 1 de 24": "Question 1 of 24",
  "¿Te cuesta mantener la atención?": "Do you find it difficult to maintain attention?",
  "COP": "COP",
  "Dimensiones exploradas": "Dimensions explored",
  "Contexto e impacto cotidiano": "Everyday context and impact",
  "$0 COP": "COP 0",
  "Cargando…": "Loading…",
  "Porcentaje (%)": "Percentage (%)",
  "Valor fijo (COP)": "Fixed amount (COP)",
  "Cargando promociones…": "Loading promotions…",
  "Centro de salud de NeuroEval Pro": "NeuroEval Pro system health center",
  "Conectividad y recursos del servidor. No muestra claves ni secretos.": "Server connectivity and resources. No keys or secrets are displayed.",
  "↻ Ejecutar diagnóstico": "↻ Run diagnostics",
  "Ejecuta el diagnóstico para consultar los servicios.": "Run diagnostics to check services.",
  "Respaldo manual de datos": "Manual data backup",
  "Exporta registros seleccionados de Firestore en JSON. Solo disponible para el administrador principal; no reemplaza los respaldos automáticos de Google Cloud.": "Export selected Firestore records as JSON. Available only to the primary administrator; it does not replace automatic Google Cloud backups.",
  "⬇️ Exportar respaldo": "⬇️ Export backup",
  "Incluye hasta 500 documentos por colección. Si el archivo indica que está incompleto, algunos registros superan ese límite.": "Includes up to 500 documents per collection. If the file indicates it is incomplete, some records exceed that limit.",
  "Perfil administrador": "Administrator profile",
  "Cuenta autenticada y permisos activos.": "Authenticated account and active permissions.",
  "Rol": "Role",
  "Administrador": "Administrator",
  "Ver perfil de cuenta": "View account profile",
  "Estado de servicios": "Service status",
  "Consulta el estado de los servicios conectados.": "Check the status of connected services.",
  "Esta vista muestra estados de conexión, nunca claves privadas ni secretos de integración.": "This view shows connection statuses, never private keys or integration secrets.",
  "Agregar administrador secundario": "Add secondary administrator",
  "La persona debe tener una cuenta creada en NeuroEval Pro con el correo que registres aquí. Tu cuenta principal conserva el control exclusivo de este módulo.": "The person must have a NeuroEval Pro account using the email entered here. Your primary account retains exclusive control of this module.",
  "Correo electrónico del colaborador": "Team member email",
  "Permisos que deseas conceder": "Permissions to grant",
  "Ver resumen general": "View general overview",
  "Consultar clientes": "View clients",
  "Consultar evaluaciones": "View assessments",
  "Ver respuestas y resultados privados": "View private answers and results",
  "Descargar informes PDF": "Download PDF reports",
  "Consultar pagos e ingresos": "View payments and revenue",
  "Consultar estado técnico": "View technical status",
  "Administrar precios y promociones": "Manage pricing and promotions",
  "Consultar historial administrativo": "View admin activity log",
  "Consultar solicitudes de soporte": "View support requests",
  "Responder y gestionar soporte": "Respond to and manage support",
  "Agregar colaborador": "Add team member",
  "Administradores secundarios": "Secondary administrators",
  "Modifica permisos, suspende o revoca accesos cuando quieras.": "Change permissions, suspend, or revoke access at any time.",
  "Cargando colaboradores…": "Loading team members…",
  "Solicitudes de clientes, conversación, prioridad y seguimiento.": "Customer requests, conversations, priority, and follow-up.",
  "Cargando solicitudes…": "Loading requests…",
  "Actividad administrativa": "Administrative activity",
  "Registro de altas, cambios y revocaciones de permisos.": "Log of permission grants, changes, and revocations.",
  "Cargando historial…": "Loading history…",
  "Detalle de evaluación": "Assessment details",
  "Cerrar ✕": "Close ✕",
  "NeuroEval Pro · Una herramienta de autorregistro orientativo.": "NeuroEval Pro · An informational self-report tool.",
  "4–7 años": "Ages 4–7",
  "8–12 años": "Ages 8–12",
  "13–17 años": "Ages 13–17",
  "casa": "home",
  "colegio": "school",
  "social": "social",
  "Explora la facilidad para mantener el foco, seguir conversaciones, recordar instrucciones y evitar distracciones.": "Explores the ability to maintain focus, follow conversations, remember instructions, and avoid distractions.",
  "Explora la planificación, el inicio y finalización de tareas, la gestión del tiempo y la capacidad de retomar actividades.": "Explores planning, starting and completing tasks, time management, and the ability to resume activities.",
  "Explora la necesidad de movimiento, la espera, la tendencia a interrumpir y la pausa antes de actuar.": "Explores the need for movement, waiting, interrupting, and pausing before acting.",
  "Explora la intensidad de las respuestas emocionales y la recuperación ante frustraciones o cambios.": "Explores the intensity of emotional responses and recovery after frustration or change.",
  "Explora factores contextuales que pueden influir en la concentración, como el sueño, la tensión y la sobrecarga.": "Explores contextual factors that may affect concentration, such as sleep, tension, and overload.",
  "Explora si las experiencias descritas generan dificultades funcionales y si son observadas por otras personas.": "Explores whether the described experiences cause functional difficulties and are noticed by other people.",
  "Explora si las experiencias parecen remontarse a la infancia y si ocurren en más de un contexto.": "Explores whether the experiences may date back to childhood and occur in more than one setting.",
  "Frecuencia descriptiva de las conductas observadas por el familiar; no equivale a una probabilidad clínica.": "Descriptive frequency of behaviors observed by the family member; it is not a clinical probability.",
  "Señala circunstancias que también podrían influir en la conducta; no son síntomas de TDAH ni aumentan una puntuación de síntomas.": "Indicates circumstances that may also affect behavior; they are not ADHD symptoms and do not increase a symptom score.",
  "LUNA   ·   LLAVE   ·   RÍO": "MOON   ·   KEY   ·   RIVER",
  "Selecciona las cuatro palabras que aparecieron juntas.": "Select the four words that appeared together.",
  "Firebase no proporcionó detalles adicionales.": "Firebase did not provide additional details.",
  "Ese correo ya tiene una cuenta.": "An account already exists with this email.",
  "El correo electrónico no es válido.": "The email address is invalid.",
  "La contraseña debe tener al menos 8 caracteres.": "The password must contain at least 8 characters.",
  "Correo o contraseña incorrectos.": "Incorrect email or password.",
  "No encontramos una cuenta con ese correo.": "We could not find an account with that email.",
  "La contraseña es incorrecta.": "The password is incorrect.",
  "No se pudo conectar. Verifica tu internet.": "Could not connect. Check your internet connection.",
  "No se pudo completar la operación.": "The operation could not be completed.",
  "Creando tu cuenta...": "Creating your account...",
  "Esta sección requiere permisos administrativos.": "This section requires administrative permissions.",
  "¿Comete errores por descuido en tareas, deberes o actividades que sabe realizar?": "Does the child make careless mistakes in tasks, homework, or activities they know how to do?",
  "Por ejemplo, omite partes de una instrucción o no revisa lo que hizo.": "For example, they miss parts of an instruction or do not review their work.",
  "¿Le cuesta mantener la atención durante juegos, lecturas, conversaciones o tareas apropiadas para su edad?": "Does the child find it difficult to maintain attention during age-appropriate games, reading, conversations, or tasks?",
  "Piensa en actividades que normalmente disfruta y que requieren continuidad.": "Think about activities the child usually enjoys and that require sustained attention.",
  "¿Parece no escuchar cuando un adulto le habla directamente, aunque no haya una distracción evidente?": "Does the child seem not to listen when an adult speaks directly to them, even when there is no obvious distraction?",
  "Por ejemplo, hay que repetirle varias veces una indicación sencilla.": "For example, a simple instruction may need to be repeated several times.",
  "¿Empieza instrucciones o tareas, pero deja pasos sin completar aunque haya entendido qué debe hacer?": "Does the child start instructions or tasks but leave steps unfinished even when they understand what to do?",
  "Considera rutinas, deberes y pequeñas responsabilidades.": "Consider routines, homework, and small responsibilities.",
  "¿Tiene dificultad para organizar sus tareas, materiales o actividades diarias?": "Does the child have difficulty organizing tasks, materials, or daily activities?",
  "Por ejemplo, no sabe por dónde empezar o pierde el orden de los pasos.": "For example, they do not know where to start or lose track of the steps.",
  "¿Evita o demora actividades que requieren concentración sostenida?": "Does the child avoid or delay activities that require sustained concentration?",
  "Por ejemplo, deberes, lectura o tareas que exigen esfuerzo mental continuo.": "For example, homework, reading, or tasks requiring continuous mental effort.",
  "¿Pierde con frecuencia objetos necesarios para sus actividades?": "Does the child frequently lose items needed for activities?",
  "Por ejemplo, útiles escolares, juguetes, libros, prendas o materiales.": "For example, school supplies, toys, books, clothing, or materials.",
  "¿Se distrae fácilmente con ruidos, movimientos, conversaciones u otros estímulos del entorno?": "Is the child easily distracted by noises, movement, conversations, or other environmental stimuli?",
  "Observa si le cuesta retomar lo que estaba haciendo.": "Notice whether the child finds it difficult to return to what they were doing.",
  "¿Olvida con frecuencia actividades o responsabilidades habituales para su edad?": "Does the child frequently forget activities or responsibilities that are usual for their age?",
  "Por ejemplo, llevar materiales, terminar una rutina o recordar una indicación.": "For example, bringing materials, finishing a routine, or remembering an instruction.",
  "¿Mueve constantemente manos o pies, se retuerce en la silla o cambia de postura cuando se espera que permanezca sentado?": "Does the child constantly move their hands or feet, squirm in their chair, or change position when expected to remain seated?",
  "Ten en cuenta lo esperable para su edad y la situación.": "Consider what is typical for the child's age and the situation.",
  "¿Se levanta de su asiento en momentos en los que normalmente se espera que permanezca sentado?": "Does the child get up from their seat when they are usually expected to remain seated?",
  "Por ejemplo, durante comidas, clase o actividades tranquilas.": "For example, during meals, class, or quiet activities.",
  "¿Corre, trepa o se mueve en situaciones en las que no resulta apropiado?": "Does the child run, climb, or move around in situations where it is not appropriate?",
  "En adolescentes, puede manifestarse como inquietud interna o dificultad para estar quieto.": "In adolescents, this may appear as inner restlessness or difficulty staying still.",
  "¿Le cuesta jugar o realizar actividades tranquilas sin hacer mucho ruido o movimiento?": "Does the child find it difficult to play or do quiet activities without making a lot of noise or moving around?",
  "Compara con otros niños de edad y contexto similares.": "Compare with other children of a similar age and context.",
  "¿Parece estar constantemente en movimiento, como si le costara bajar el ritmo?": "Does the child seem to be constantly on the move, as if it were difficult to slow down?",
  "Observa si ocurre incluso cuando la actividad requiere calma.": "Notice whether this happens even when the activity requires calm.",
  "¿Habla mucho más de lo esperado para la situación y le cuesta detenerse?": "Does the child talk much more than expected for the situation and find it difficult to stop?",
  "Considera conversaciones, clase y reuniones familiares.": "Consider conversations, class, and family gatherings.",
  "¿Responde antes de que terminen de hacerle una pregunta o interrumpe para contestar?": "Does the child answer before a question is finished or interrupt to respond?",
  "Observa si puede esperar a escuchar la pregunta completa.": "Notice whether the child can wait to hear the whole question.",
  "¿Le cuesta esperar su turno en juegos, filas o conversaciones?": "Does the child find it difficult to wait their turn in games, lines, or conversations?",
  "Piensa en situaciones cotidianas repetidas.": "Think about recurring everyday situations.",
  "¿Interrumpe conversaciones, juegos o actividades de otras personas sin advertirlo?": "Does the child interrupt other people's conversations, games, or activities without noticing?",
  "Por ejemplo, se incorpora a una actividad o toma la palabra de forma repentina.": "For example, they join an activity or suddenly start speaking.",
  "¿Las conductas que has señalado se presentan desde hace aproximadamente seis meses o más?": "Have the behaviors you identified been present for approximately six months or longer?",
  "Si comenzaron hace poco, anota cuándo aparecieron.": "If they began recently, note when they appeared.",
  "¿Recuerdas que algunas de estas conductas ya estaban presentes en etapas anteriores de su desarrollo?": "Do you remember some of these behaviors being present at earlier stages of the child's development?",
  "Piensa en informes escolares, recuerdos familiares o comentarios de docentes.": "Think about school reports, family memories, or teachers' comments.",
  "¿Has observado estas conductas en al menos dos entornos, como casa y colegio?": "Have you observed these behaviors in at least two settings, such as home and school?",
  "También pueden ser actividades extracurriculares u otros espacios.": "These may also include extracurricular activities or other settings.",
  "¿Estas conductas afectan de forma clara su aprendizaje, convivencia, amistades o rutinas?": "Do these behaviors clearly affect the child's learning, relationships, friendships, or routines?",
  "Describe consecuencias concretas, no solo que el comportamiento resulte molesto.": "Describe concrete consequences, not only that the behavior is bothersome.",
  "¿Un docente u otro cuidador ha expresado preocupaciones similares?": "Has a teacher or another caregiver expressed similar concerns?",
  "Si es posible, contrasta lo observado con alguien que lo conozca en otro entorno.": "If possible, compare your observations with someone who knows the child in another setting.",
  "¿Hay factores recientes que podrían influir, como cambios familiares, sueño insuficiente, estrés, dificultades de aprendizaje o problemas de salud?": "Are there recent factors that could have an influence, such as family changes, insufficient sleep, stress, learning difficulties, or health problems?",
  "No atribuyas automáticamente estas conductas al TDAH.": "Do not automatically attribute these behaviors to ADHD.",
  "Esta orientación está diseñada para edades de 4 a 17 años.": "This guidance is designed for ages 4–17.",
  "Indica tu parentesco y al menos un entorno de observación.": "Enter your relationship to the child and at least one observation setting.",
  "Confirma que tienes autorización para proporcionar esta información.": "Confirm that you are authorized to provide this information.",
  "Considera responsabilidades, actividades académicas y relaciones propias de la adolescencia.": "Consider responsibilities, academic activities, and relationships typical of adolescence.",
  "Observación familiar · 24 preguntas": "Family observation · 24 questions",
  "Inicia sesión para comenzar una evaluación.": "Sign in to begin an assessment.",
  "Consultando el estado de tu evaluación...": "Checking your assessment status...",
  "No se encontró una evaluación pendiente.": "No pending assessment was found.",
  "¡Pago confirmado! Cargando informe.": "Payment confirmed! Loading report.",
  "Aún no recibimos la confirmación del pago. Si acabas de pagar, espera unos segundos.": "We have not received payment confirmation yet. If you just paid, please wait a few seconds.",
  "Esta acción está reservada al administrador principal.": "This action is reserved for the primary administrator.",
  "Preparando exportación segura…": "Preparing secure export…",
  "No se pudo consultar el diagnóstico.": "Could not retrieve diagnostics.",
  "Diagnóstico completado. No se detectaron errores en las comprobaciones ejecutadas.": "Diagnostics completed. No errors were detected in the checks performed.",
  "Calculando estadísticas agregadas…": "Calculating aggregate statistics…",
  "No se pudo consultar la analítica internacional.": "Could not retrieve international analytics.",
  "Todavía no hay grupos con suficientes usuarios para mostrarlos.": "There are not yet enough users in any group to display them.",
  "Usuarios agrupados por país": "Users grouped by country",
  "Aún no hay grupos de países que puedan ubicarse": "There are no mappable country groups yet.",
  " años": " years",
  "⚙️   Configuración": "⚙️   Settings",
  "Información sobre privacidad y uso de datos": "Privacy and data use information",
  "NeuroEval Pro es una herramienta de autorregistro orientativo para personas adultas. No diagnostica ni sustituye la valoración de profesionales.": "NeuroEval Pro is an informational self-report tool for adults. It does not diagnose or replace professional assessment.",
  "Se procesan datos de cuenta, edad adulta, idioma, respuestas y resultados para prestar el servicio, generar informes, gestionar pagos y proteger la plataforma.": "Account details, adult age, language, answers, and results are processed to provide the service, generate reports, manage payments, and protect the platform.",
  "País y ciudad son opcionales. No se solicita GPS. Los datos geográficos y demográficos se muestran al equipo autorizado únicamente de forma agregada y con un mínimo de 10 personas por grupo.": "Country and city are optional. GPS is not requested. Geographic and demographic data are shown to authorized staff only in aggregate, with at least 10 people per group.",
  "La observación de menores debe realizarla un adulto autorizado. No escribas nombres, colegios ni otros datos que identifiquen al menor; el sistema conserva una franja de edad, no su edad exacta.": "Observation of minors must be completed by an authorized adult. Do not enter names, schools, or other identifying details; the system stores an age band, not the child's exact age.",
  "Puedes solicitar acceso, rectificación o revisión de eliminación desde los canales de privacidad. Algunos registros pueden conservarse cuando existan obligaciones legales, contables o relacionadas con pagos. Consulta la política de privacidad completa antes del lanzamiento internacional.": "You may request access, correction, or review of deletion through the privacy channels. Some records may be retained where legal, accounting, or payment obligations apply. Consult the full privacy policy before the international launch.",
  "Versión del aviso: 2026-11-11.": "Notice version: 2026-11-11.",
  "Tus datos y privacidad": "Your data and privacy",
  "Puedes descargar una copia de los datos asociados a tu cuenta o registrar una solicitud de acceso, rectificación o revisión de eliminación.": "You can download a copy of the data associated with your account or submit a request for access, correction, or deletion review.",
  "Descargar mis datos": "Download my data",
  "Acceso a mis datos": "Access my data",
  "Rectificar mis datos": "Correct my data",
  "Solicitar revisión de eliminación": "Request deletion review",
  "La solicitud queda registrada para revisión; no elimina datos automáticamente. Algunos registros pueden estar sujetos a obligaciones legales o de pago.": "The request is recorded for review; it does not automatically delete data. Some records may be subject to legal or payment obligations.",
  "Solicitudes de privacidad": "Privacy requests",
  "Bandeja restringida al administrador principal. Revisar no implica borrar automáticamente datos.": "Inbox restricted to the primary administrator. Reviewing a request does not automatically delete data.",
  "Leer el aviso completo (ES)": "Read the full notice (Spanish)",
  "Read full notice (EN)": "Read full notice (English)",
  "Aviso completo (ES)": "Full notice (Spanish)",
  "Full notice (EN)": "Full notice (English)",
  "No se pudo guardar tu evaluación:": "Could not save your assessment:",
  "Este enlace de evaluación no pertenece a esta cuenta o ya no está disponible. Puedes iniciar una evaluación nueva desde tu panel.": "This assessment link does not belong to this account or is no longer available. You can start a new assessment from your dashboard.",
  "No se encontró el identificador de la evaluación.": "The assessment identifier could not be found.",
  "No tienes permisos para consultar esta sección.": "You do not have permission to view this section.",
  "No tienes permisos para consultar esta información.": "You do not have permission to view this information.",
  "No se pudo cerrar la sesión.": "Could not sign out.",
  "¿Revocar definitivamente el acceso administrativo de": "Permanently revoke administrative access for",
  "¡Bien hecho! Registramos esta actividad en tu progreso.": "Well done! This activity has been added to your progress.",
  "Si la cuenta existe, recibirás un código. Revisa también la carpeta de spam.": "If the account exists, you will receive a code. Please also check your spam folder.",
  "Tu contraseña se actualizó correctamente.": "Your password was updated successfully.",
  "Pasarela de pago cargada. Continúa con el botón de Wompi.": "Payment gateway loaded. Continue using the Wompi button.",
  "No se pudo cargar Wompi. Recarga la página o intenta más tarde.": "Wompi could not be loaded. Refresh the page or try again later.",
  "Responde según las conductas que has observado en el menor durante los últimos seis meses. Elige la frecuencia que mejor describa lo que ocurre.": "Answer based on the behaviors you have observed in the child over the last six months. Choose the frequency that best describes what happens.",
  "Todavía no tienes evaluaciones registradas.": "You do not have any assessments yet.",
  "Puedes retomar esta evaluación.": "You can resume this assessment.",
  "No se superó el nivel": "Level not completed:",
  "Cuenta los círculos negros entre": "Count the black circles among",
  "Descubre la regla y elige el siguiente número.": "Discover the rule and choose the next number.",
  "¿Qué palabra estaba en la lista?": "Which word was on the list?",
  "Toca el único símbolo diferente. Los distractores se parecen cada vez más.": "Tap the only different symbol. The distractors become increasingly similar.",
  "Imagina que la flecha gira 90° a la derecha en cada giro. ¿Hacia dónde apunta?": "Imagine the arrow rotates 90° clockwise each turn. Which direction is it pointing?",
  "Espera la señal…": "Wait for the signal…",
  "Cuando el panel cambie a VERDE, pulsa lo más rápido posible. No te anticipes.": "When the panel turns GREEN, click as quickly as possible. Do not anticipate it.",
  "🟢 ¡AHORA!": "🟢 NOW!",
  "Usa las pistas para resolver el código lógico.": "Use the clues to solve the logic code.",
  "Doble misión: cuenta las estrellas y los triángulos. Debes acertar ambas cantidades.": "Double task: count the stars and triangles. You must get both numbers right.",
  "Responde según tus propias experiencias de atención, organización e impulsividad. No hay respuestas buenas ni malas.": "Answer based on your own experiences with attention, organization and impulsivity. There are no right or wrong answers.",
  "Ejecutando diagnóstico…": "Running diagnostics…",
  "Última comprobación:": "Final check:",
  "No fue posible ejecutar el diagnóstico:": "Could not run diagnostics:",
  "Tu rol no permite consultar estadísticas de evaluaciones.": "Your role does not allow you to view assessment statistics.",
  "No hay registros suficientes para construir esta gráfica.": "There are not enough records to build this chart.",
  "Todavía no hay promociones registradas.": "There are no promotions yet.",
  "No se pudo cargar la analítica:": "Could not load analytics:",
  "Todavía no tienes solicitudes. Si necesitas ayuda, puedes crear la primera desde el formulario.": "You do not have any requests yet. If you need help, you can create your first one using the form.",
  "Esta solicitud está cerrada. Si necesitas más ayuda, crea una nueva solicitud.": "This request is closed. If you need further help, create a new request.",
  "Tu solicitud fue enviada. Podrás seguir aquí las respuestas del equipo.": "Your request has been submitted. You can follow the team's replies here.",
  "Guardar gestión": "Save changes",
  "No se pudo cargar la configuración comercial:": "Could not load commercial settings:",
  "Todavía no has creado códigos promocionales.": "You have not created any promo codes yet.",
  "El precio está fijado en $4.000 COP por evaluación. Puedes gestionar códigos promocionales, pero no modificar el precio base.": "The price is fixed at COP 4,000 per assessment. You can manage promo codes, but you cannot change the base price.",
  "Creando código…": "Creating code…",
  "Todavía no has agregado administradores secundarios.": "You have not added any secondary administrators yet.",
  "Colaborador agregado. Ya puede iniciar sesión con su cuenta.": "Team member added. They can now sign in with their account.",
  "Todavía no hay movimientos administrativos registrados.": "There are no administrative activity records yet.",
  "Este cliente todavía no tiene evaluaciones.": "This client does not have any assessments yet.",
  "Este expediente muestra datos de perfil y metadatos de evaluaciones. Las respuestas clínicas y los informes completos mantienen sus permisos independientes.": "This record shows profile data and assessment metadata. Assessment answers and full reports have separate access permissions.",
  "Cargando información protegida…": "Loading protected information…",
  "Por ejemplo: mueves manos o pies, cambias de postura o te levantas.": "For example: you move your hands or feet, change posture, or stand up.",  "Puede ocurrir al hablar, comprar, decidir o reaccionar.": "It may happen when speaking, shopping, making decisions or reacting.",
  "NUBE   ·   PAN   ·   RELOJ   ·   FLOR": "CLOUD   ·   BREAD   ·   CLOCK   ·   FLOWER",
  "Piensa en actividades que normalmente disfruta y requieren continuidad.": "Think about activities the child normally enjoys and that require sustained attention.",
  "En adolescentes puede manifestarse como inquietud interna.": "In teenagers, it may appear as inner restlessness.",
  "Por ejemplo, se incorpora a una actividad o toma la palabra repentinamente.": "For example, they join an activity or suddenly start speaking.",
  "Piensa en informes escolares, recuerdos familiares o comentarios docentes.": "Think about school reports, family memories or teachers' comments.",
  "LUNA · LLAVE · RÍO": "MOON · KEY · RIVER",
  "LUNA · LIBRO · RÍO": "MOON · BOOK · RIVER",
  "LLAVE · RÍO · ROSA": "KEY · RIVER · ROSE",
  "LUNA · LLAVE · SOL": "MOON · KEY · SUN",
  "NUBE · PAN · RELOJ · FLOR": "CLOUD · BREAD · CLOCK · FLOWER",
  "NUBE · PAN · RELOJ · LUNA": "CLOUD · BREAD · CLOCK · MOON",
  "NUBE · LIBRO · RELOJ · FLOR": "CLOUD · BOOK · CLOCK · FLOWER",
  "PAN · RELOJ · FLOR · ROSA": "BREAD · CLOCK · FLOWER · ROSE",
  "Autorizo expresamente el tratamiento de mis respuestas, que pueden revelar datos sensibles relacionados con salud, atención y bienestar cognitivo, para generar mi autorregistro e informe. Entiendo que puedo no aceptar y no iniciar la evaluación.": "I explicitly authorize the processing of my answers, which may reveal sensitive data about health, attention and cognitive well-being, to generate my self-report and report. I understand that I may decline and not start the assessment.",
  "Autorizo expresamente el tratamiento de esta información del menor, que puede revelar datos sensibles relacionados con su salud y bienestar, únicamente para generar esta orientación. Entiendo que puedo no autorizarlo y no continuar.": "I explicitly authorize the processing of this minor's information, which may reveal sensitive data about health and well-being, solely to generate this guidance. I understand that I may decline and not continue.",
  "Debes autorizar expresamente el tratamiento de los datos sensibles del menor para continuar.": "You must explicitly authorize the processing of the minor's sensitive data to continue.",
  "Esta orientación no es un diagnóstico ni sustituye la valoración de profesionales.": "This guidance is not a diagnosis and does not replace professional assessment.",
  "Autorización expresa para datos sensibles": "Explicit authorization for sensitive data",
  "Datos sensibles relacionados con salud, atención y bienestar cognitivo": "Sensitive data related to health, attention and cognitive well-being",
  "Retirar autorización de datos sensibles": "Withdraw sensitive-data consent",
  "Retirar autorización de datos sensibles.": "Withdraw sensitive-data consent.",

  "El cobro se realiza en COP. Si tu tarjeta está en otra moneda, tu banco o emisor puede aplicar conversión y cargos adicionales.": "The charge is made in COP. If your card is in another currency, your bank or card issuer may apply conversion and additional fees.",
};


const reverseUiTranslations = Object.fromEntries(Object.entries(uiTranslations).map(([es,en]) => [en,es]));
const UI_TRANSLATION_ENTRIES = Object.entries(uiTranslations).sort((a,b)=>b[0].length-a[0].length);
const UI_REVERSE_ENTRIES = Object.entries(reverseUiTranslations).sort((a,b)=>b[0].length-a[0].length);
function translateUiText(value) {
  const source = String(value ?? ""), trimmed = source.trim();
  if (!trimmed) return source;
  const map = currentLanguage === "en" ? uiTranslations : reverseUiTranslations;
  let translated = map[trimmed] || trimmed;
  if (translated === trimmed) {
    const entries = currentLanguage === "en" ? UI_TRANSLATION_ENTRIES : UI_REVERSE_ENTRIES;
    entries.forEach(([from,to]) => { if (from.length >= 5 && translated.includes(from)) translated = translated.split(from).join(to); });
  }
  if (translated === trimmed) return source;
  const leading = source.match(/^\\s*/)?.[0] || "", trailing = source.match(/\\s*$/)?.[0] || "";
  return leading + translated + trailing;
}
const nativeAlert = window.alert.bind(window);
const nativeConfirm = window.confirm.bind(window);
const nativePrompt = window.prompt.bind(window);
window.alert = message => nativeAlert(translateUiText(message));
window.confirm = message => nativeConfirm(translateUiText(message));
window.prompt = (message, defaultValue) => nativePrompt(translateUiText(message), defaultValue);
function setLanguage(language, options = {}) {
  currentLanguage = language === "en" ? "en" : "es";
  try { localStorage.setItem("neuroeval-language", currentLanguage); } catch (_) {}
  document.documentElement.lang = currentLanguage;
  document.title = currentLanguage === "en" ? "NeuroEval Pro | Understand how your mind works" : "NeuroEval Pro | Conoce cómo funciona tu mente";
  const selector = $("global-language");
  if (selector) selector.value = currentLanguage;
  applyLanguageToDom();
  const globalPanel = $("admin-panel-global");
  if (currentIsAdmin && globalPanel && !globalPanel.classList.contains("hidden")) loadAdminGlobalAnalytics();
  if (options.persist && currentUser && !currentIsAdmin) {
    profileData = { ...(profileData || {}), language: currentLanguage };
    api("/api/profile", { method: "POST", body: JSON.stringify({ ...(profileData || {}), language: currentLanguage }) })
      .catch(error => console.warn("No se pudo sincronizar el idioma del perfil:", error));
  }
}
function preferredLanguage(profileLanguage) {
  if (profileLanguage === "en" || profileLanguage === "es") return profileLanguage;
  try {
    const saved = localStorage.getItem("neuroeval-language");
    if (saved === "en" || saved === "es") return saved;
  } catch (_) {}
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
}

function applyLanguageToDom(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT","STYLE","NOSCRIPT","TEXTAREA"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const translated = translateUiText(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });
  root.querySelectorAll?.("input[placeholder],textarea[placeholder]").forEach(element => {
    const translated = translateUiText(element.getAttribute("placeholder"));
    if (translated !== element.getAttribute("placeholder")) element.setAttribute("placeholder", translated);
  });
  root.querySelectorAll?.("input[type=button][value],input[type=submit][value],input[type=reset][value]").forEach(element => {
    const translated = translateUiText(element.getAttribute("value"));
    if (translated !== element.getAttribute("value")) element.setAttribute("value", translated);
  });
  root.querySelectorAll?.("[title],[aria-label],[alt]").forEach(element => {
    ["title","aria-label","alt"].forEach(attribute => {
      const original = element.getAttribute(attribute);
      const translated = translateUiText(original);
      if (original && translated !== original) element.setAttribute(attribute, translated);
    });
  });
  root.querySelectorAll?.("option").forEach(element => {
    const translated = translateUiText(element.textContent);
    if (translated !== element.textContent) element.textContent = translated;
  });
}

let languageDomObserver = null;
function startLanguageObserver() {
  if (languageDomObserver || !document.body) return;
  languageDomObserver = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === "characterData") {
        const translated = translateUiText(record.target.nodeValue);
        if (translated !== record.target.nodeValue) record.target.nodeValue = translated;
      } else if (record.type === "attributes") {
        const attribute = record.attributeName;
        const target = record.target;
        const original = target.getAttribute(attribute);
        if (attribute === "value" && !["button", "submit", "reset"].includes(target.type)) return;
        const translated = translateUiText(original);
        if (original && translated !== original) target.setAttribute(attribute, translated);
      }
      record.addedNodes?.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          const translated = translateUiText(node.nodeValue);
          if (translated !== node.nodeValue) node.nodeValue = translated;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          applyLanguageToDom(node);
        }
      });
    });
  });
  languageDomObserver.observe(document.body, { childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "title", "aria-label", "alt", "value"], subtree: true });
}



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
        message: error?.message || "Sin mensaje",
        name: error?.name || "Error"
      });
      showMessage(
        "auth-message",
        `No se pudo completar el acceso con Google. Código: ${error?.code || "sin-codigo"}. Detalle: ${error?.message || "Firebase no proporcionó detalles adicionales."}`,
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

    profileData = { name, age, goal, language: currentLanguage };

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    currentUser = credential.user;

    await api("/api/profile", {
      method: "POST",
      body: JSON.stringify(profileData)
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
    console.error("[NeuroEval Pro][Google redirect sign-in]", {
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
        goal: savedProfile.goal || "Autoconocimiento",
        country: savedProfile.country || "",
        city: savedProfile.city || "",
        language: savedProfile.language || "es"
      };
    } else {
      profileData = {
        name: user.displayName || user.email,
        age: null,
        goal: "Autoconocimiento",
        country: "",
        city: "",
        language: preferredLanguage()
      };

      await api("/api/profile", {
        method: "POST",
        body: JSON.stringify(profileData)
      });
    }

    setLanguage(preferredLanguage(profileData?.language));

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
    global: hasAdminPermission("dashboard.view"),
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
  if (selected === "global") loadAdminGlobalAnalytics();
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
  $("profile-country-input").value = profileData?.country || "";
  $("profile-city-input").value = profileData?.city || "";
  $("profile-language-input").value = profileData?.language || currentLanguage;
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
  $("progress-best").textContent = (games.length ? Math.max(...games.map(item => Number(item.score) || 0)) : 0) + "%";
  const levels = Object.values(data.gameLevels || {}).reduce((sum,value) => sum + Number(value || 0), 0);
  const levelSummary = $("games-level-summary");
  if (levelSummary) levelSummary.textContent = levels + " niveles";
  const history = $("progress-history");
  history.innerHTML = "";
  if (!(data.history || []).length) { history.textContent = "Aún no hay actividades registradas. ¡Prueba tu primer juego!"; }
  else data.history.forEach(item => {
    const row = document.createElement("div"); row.className = "profile-row";
    const label = document.createElement("span"); label.textContent = item.type + ": " + item.name;
    const detail = document.createElement("strong"); detail.textContent = item.detail;
    row.append(label, detail); history.appendChild(row);
  });
  loadEvaluationHistory();
}

function formatProgressEvaluationDate(value) {
  if (!value) return "Fecha no disponible";
  let dateValue = value;
  if (typeof value === "object") {
    const seconds = Number(value._seconds ?? value.seconds);
    if (Number.isFinite(seconds)) dateValue = seconds * 1000;
  }
  const date = new Date(dateValue);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

async function loadEvaluationHistory() {
  const container = $("progress-evaluations");
  const count = $("progress-evaluation-count");
  const pendingCount = $("progress-pending-count");
  const totalCount = $("progress-total-count");
  if (!container || !count) return;
  if (!currentUser) { count.textContent = "0"; if (pendingCount) pendingCount.textContent = "0"; if (totalCount) totalCount.textContent = "0"; container.textContent = "Inicia sesión para consultar tus evaluaciones."; return; }
  container.textContent = "Consultando tus evaluaciones...";
  try {
    const response = await api("/api/my-evaluations");
    const payload = await response.json();
    const evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : [];
    const getTime = value => {
      if (value && typeof value === "object") return Number(value._seconds ?? value.seconds ?? 0) * 1000;
      return new Date(value || 0).getTime() || 0;
    };
    evaluations.sort((a,b) => getTime(b.createdAt) - getTime(a.createdAt));
    const paid = evaluations.filter(item => item.paymentStatus === "paid");
    const pendingEvaluations = evaluations.filter(item => item.paymentStatus === "pending");
    count.textContent = String(paid.length);
    if (pendingCount) pendingCount.textContent = String(pendingEvaluations.length);
    if (totalCount) totalCount.textContent = String(evaluations.length);
    container.replaceChildren();
    if (!evaluations.length) { container.textContent = "Todavía no tienes evaluaciones registradas."; return; }
    evaluations.forEach(evaluation => {
      const paymentStatus = String(evaluation.paymentStatus || "pending").toLowerCase();
      const isPaid = paymentStatus === "paid";
      const isPending = paymentStatus === "pending";
      const card = document.createElement("article");
      card.className = "profile-row";
      card.style.alignItems = "center"; card.style.gap = "1rem"; card.style.flexWrap = "wrap";
      const info = document.createElement("div"); info.style.flex = "1"; info.style.minWidth = "220px";
      const title = document.createElement("strong"); title.textContent = evaluation.name || "Evaluación NeuroEval Pro";
      const meta = document.createElement("p"); meta.className = "muted-text text-sm";
      meta.textContent = formatProgressEvaluationDate(evaluation.createdAt) + " · " + (evaluation.goal || "Evaluación integral");
      const status = document.createElement("p"); status.className = "text-sm font-bold";
      if (isPaid) {
        status.textContent = "Pago confirmado · PDF disponible";
        status.style.color = "#047857";
      } else if (isPending) {
        status.textContent = "Pago pendiente";
        status.style.color = "#b45309";
      } else {
        const labels = {
          failed: "Pago no completado",
          declined: "Pago rechazado",
          error: "Error al procesar el pago",
          cancelled: "Pago cancelado"
        };
        status.textContent = labels[paymentStatus] || "Pago no confirmado";
        status.style.color = "#b91c1c";
      }
      info.append(title, meta, status); card.appendChild(info);
      if (isPaid) {
        const button = document.createElement("button"); button.type = "button"; button.className = "btn outline";
        button.textContent = "Descargar PDF";
        button.addEventListener("click", () => downloadEvaluationPdf(evaluation.id));
        card.appendChild(button);
      } else if (isPending) {
        const actions = document.createElement("div");
        actions.style.display = "flex"; actions.style.alignItems = "center"; actions.style.gap = ".75rem"; actions.style.flexWrap = "wrap";
        const pendingLabel = document.createElement("span"); pendingLabel.className = "muted-text text-sm";
        pendingLabel.textContent = "Puedes retomar esta evaluación.";
        const resume = document.createElement("button"); resume.type = "button"; resume.className = "btn primary";
        resume.textContent = "Continuar al pago";
        resume.addEventListener("click", async () => {
          stopPaymentPolling();
          lastEvaluationId = evaluation.id;
          paymentReference = null;
          show("payment-view");
          await showPaymentForExistingEvaluation();
        });
        actions.append(pendingLabel, resume); card.appendChild(actions);
      }
      container.appendChild(card);
    });
  } catch (error) {
    count.textContent = "—";
    if (pendingCount) pendingCount.textContent = "—";
    if (totalCount) totalCount.textContent = "—";
    container.textContent = error.message || "No se pudo cargar tu historial de evaluaciones.";
  }
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
      const bank=currentLanguage==="en"?["CLOUD","PENCIL","RIVER","CUP","MOON","FLOWER","CLOCK","BREAD","KEY","MOUNTAIN","BOOK","WINDOW","ROAD","ORANGE","STAR","GARDEN","MUSIC","TRAIN"]:["NUBE","LÁPIZ","RÍO","TAZA","LUNA","FLOR","RELOJ","PAN","LLAVE","MONTAÑA","LIBRO","VENTANA","CAMINO","NARANJA","ESTRELLA","JARDÍN","MÚSICA","TREN"];
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
  $("reset-intro").classList.remove("hidden");
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

    // Mostrar únicamente la confirmación y el botón para volver al acceso.
    $("reset-intro").classList.add("hidden");
    $("request-code-form").classList.add("hidden");
    $("confirm-reset-form").classList.add("hidden");
    showMessage("reset-message", "Tu contraseña se actualizó correctamente.");
    // Evitar que el código y la contraseña queden visibles o reutilizables.
    $("reset-code").value = "";
    $("reset-new-password").value = "";
    $("confirm-reset-form").reset();

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

async function downloadEvaluationPdf(evaluationId) {
  if (!evaluationId) { alert("No se encontró el identificador de la evaluación."); return; }
  try {
    const response = await api("/api/my-evaluations/" + encodeURIComponent(evaluationId) + "/pdf?language=" + encodeURIComponent(currentLanguage));
    downloadBlob(await response.blob(), currentLanguage === "en" ? "NeuroEval-Pro-report.pdf" : "NeuroEval-Pro-informe.pdf");
  } catch (error) { alert(error.message); }
}

async function downloadOwnPdf() {
  return downloadEvaluationPdf(lastEvaluationId);
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
    [["Servidor",data.ok?"Operativo":"No disponible"],["Firebase",data.firebaseProject?"Configurado":"Sin configurar"],["Correo transaccional",!data.emailConfigured?"No configurado":data.emailProvider==="smtp"&&!data.emailConnectionVerified?"SMTP configurado, sin verificación":"Configurado ("+(data.emailProvider||"proveedor")+")"],["Wompi",data.wompiConfigured?"Configurado":"No configurado"],["Ambiente de pagos",data.wompiEnvironment||"No disponible"],["Precio por evaluación",formatCop(data.evaluationPriceCop)],["Pagos de demostración",data.demoPaymentEnabled?"Activos":"Desactivados"]].forEach(([label,value])=>{const line=document.createElement("div");line.className="profile-row";const left=document.createElement("span");left.textContent=label;const right=document.createElement("strong");right.textContent=value;line.append(left,right);target.appendChild(line);});
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

let worldMapGeometryPromise;
async function renderWorldMap(rows = []) {
  const host = $("admin-world-map");
  if (!host) return;
  host.replaceChildren();
  const isEnglish = currentLanguage === "en";
  const mapLabel = isEnglish
    ? "World country map with aggregated user groups highlighted"
    : "Mapa mundial con países que tienen grupos agregados de usuarios";
  host.setAttribute("aria-label", mapLabel);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 900 440");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", mapLabel);

  const project = (lon, lat) => ({
    x: (lon + 180) / 360 * 900,
    y: (90 - Math.max(-85, Math.min(85, lat))) / 180 * 440
  });

  // Natural Earth representa algunos polígonos a ambos lados del meridiano 180°.
  // Desenrollamos sus longitudes y recortamos cada anillo al marco del mapa para
  // evitar líneas que atraviesen visualmente todo el planeta.
  const clipAtLongitude = (points, boundary, keepGreater) => {
    if (!points.length) return [];
    const output = [];
    let previous = points[points.length - 1];
    let previousInside = keepGreater ? previous.lon >= boundary : previous.lon <= boundary;
    for (const current of points) {
      const currentInside = keepGreater ? current.lon >= boundary : current.lon <= boundary;
      if (currentInside !== previousInside) {
        const denominator = current.lon - previous.lon;
        if (denominator !== 0) {
          const ratio = (boundary - previous.lon) / denominator;
          output.push({
            lon: boundary,
            lat: previous.lat + (current.lat - previous.lat) * ratio
          });
        }
      }
      if (currentInside) output.push(current);
      previous = current;
      previousInside = currentInside;
    }
    return output;
  };

  const ringPaths = ring => {
    if (!Array.isArray(ring) || ring.length < 4) return [];
    const source = ring.slice(0, -1)
      .filter(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
      .map(point => ({ lon: Number(point[0]), lat: Number(point[1]) }));
    if (source.length < 3) return [];

    const unwrapped = [source[0]];
    for (let index = 1; index < source.length; index++) {
      let lon = source[index].lon;
      const previous = unwrapped[index - 1].lon;
      while (lon - previous > 180) lon -= 360;
      while (lon - previous < -180) lon += 360;
      unwrapped.push({ lon, lat: source[index].lat });
    }
    let closingLon = source[0].lon;
    const lastLon = unwrapped[unwrapped.length - 1].lon;
    while (closingLon - lastLon > 180) closingLon -= 360;
    while (closingLon - lastLon < -180) closingLon += 360;
    unwrapped.push({ lon: closingLon, lat: source[0].lat });

    const paths = [];
    for (const shift of [-360, 0, 360]) {
      let clipped = unwrapped.map(point => ({ lon: point.lon + shift, lat: point.lat }));
      clipped = clipAtLongitude(clipped, -180, true);
      clipped = clipAtLongitude(clipped, 180, false);
      if (clipped.length < 3) continue;
      const commands = clipped.map((point, index) => {
        const projected = project(point.lon, point.lat);
        return (index === 0 ? "M" : "L") + projected.x.toFixed(2) + " " + projected.y.toFixed(2);
      });
      paths.push(commands.join(" ") + " Z");
    }
    return paths;
  };

  const geometryPath = geometry => {
    if (!geometry) return "";
    const polygons = geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    return polygons.flatMap(polygon =>
      polygon.flatMap(ringPaths)
    ).join(" ");
  };

  try {
    if (!worldMapGeometryPromise) {
      worldMapGeometryPromise = fetch("/data/world-countries-110m.geojson", { cache: "force-cache" })
        .then(response => {
          if (!response.ok) throw new Error("No se pudo cargar la cartografía mundial.");
          return response.json();
        })
        .then(data => {
          if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
            throw new Error("El archivo cartográfico no es válido.");
          }
          return data;
        })
        .catch(error => {
          worldMapGeometryPromise = null;
          throw error;
        });
    }

    const world = await worldMapGeometryPromise;
    const counts = new Map((Array.isArray(rows) ? rows : [])
      .filter(row => row.code)
      .map(row => [String(row.code).toUpperCase(), Number(row.count) || 0]));

    world.features.forEach(feature => {
      const code = String(feature.properties?.iso_a2 || "").toUpperCase();
      const name = String(
        (isEnglish ? feature.properties?.name_en : feature.properties?.name_es)
        || feature.properties?.name_en || code || ""
      );
      const count = counts.get(code) || 0;
      const pathData = geometryPath(feature.geometry);
      if (!pathData) return;

      const path = document.createElementNS(NS, "path");
      path.setAttribute("data-country-code", code);
      path.setAttribute("d", pathData);
      path.setAttribute("class", "land" + (count >= 10 ? " has-users" : ""));
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("tabindex", count >= 10 ? "0" : "-1");

      if (count >= 10) {
        const formatted = count.toLocaleString(isEnglish ? "en-US" : "es-CO");
        const description = name + ": " + formatted + (isEnglish ? " users" : " usuarios");
        path.setAttribute("aria-label", description);
        path.setAttribute("role", "button");
        const title = document.createElementNS(NS, "title");
        title.textContent = description;
        path.appendChild(title);
        const announce = () => {
          const status = $("admin-global-status");
          if (status) status.textContent = description;
        };
        path.addEventListener("click", announce);
        path.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            announce();
          }
        });
      }
      svg.appendChild(path);
    });

    if (!counts.size || ![...counts.values()].some(count => count >= 10)) {
      const note = document.createElementNS(NS, "text");
      note.setAttribute("x", "450");
      note.setAttribute("y", "220");
      note.setAttribute("text-anchor", "middle");
      note.setAttribute("class", "map-point-label");
      note.textContent = isEnglish
        ? "No country groups meet the privacy threshold yet"
        : "Aún no hay grupos de países que cumplan el umbral de privacidad";
      svg.appendChild(note);
    }
    host.appendChild(svg);
  } catch (error) {
    host.textContent = isEnglish
      ? "The world map could not be loaded. Country statistics remain available below."
      : "No fue posible cargar el mapa mundial. Las estadísticas por país siguen disponibles abajo.";
    const status = $("admin-global-status");
    if (status) status.textContent = isEnglish
      ? "The map could not be loaded. Country statistics remain available below."
      : "No fue posible cargar el mapa. Las estadísticas por país siguen disponibles abajo.";
  }
}

async function loadAdminGlobalAnalytics() {
  const ids={countries:"admin-global-countries",cities:"admin-global-cities",ages:"admin-global-ages",languages:"admin-global-languages"};
  const status=$("admin-global-status"); if(!status||!hasAdminPermission("dashboard.view"))return;
  status.textContent="Calculando estadísticas agregadas…";
  Object.values(ids).forEach(id=>{const node=$(id);if(node)node.textContent="Cargando…";});
  try {
    const response=await api("/api/admin/analytics/global"); const data=await response.json();
    if(!response.ok)throw new Error(data.error||"No se pudo consultar la analítica internacional.");
    await renderWorldMap(data.countries || []);
    Object.entries(ids).forEach(([key,id])=>{
      const host=$(id);if(!host)return;host.replaceChildren();
      const rows=Array.isArray(data[key])?data[key]:[];
      if(!rows.length){host.textContent="Todavía no hay grupos con suficientes usuarios para mostrarlos.";return;}
      const max=Math.max(1,...rows.map(row=>Number(row.count||0)));
      rows.forEach(row=>{
        const item=document.createElement("div");item.className="space-y-1";
        const line=document.createElement("div");line.className="flex justify-between gap-3 text-sm";
        const label=document.createElement("span");label.textContent=currentLanguage==="en"?(row.labelEn||row.label):row.label;
        const count=document.createElement("strong");count.textContent=Number(row.count).toLocaleString((currentLanguage === "en" ? "en-US" : "es-CO"));line.append(label,count);
        const track=document.createElement("div");track.className="h-2 rounded-full bg-slate-100 overflow-hidden";
        const bar=document.createElement("div");bar.className="h-full rounded-full";bar.style.width=(Number(row.count)/max*100)+"%";bar.style.background="linear-gradient(90deg,#7467f0,#6ce4dc)";
        track.appendChild(bar);item.append(line,track);host.appendChild(item);
      });
    });
    status.textContent=(currentLanguage==="en"?"Updated: ":"Actualizado: ")+new Date(data.generatedAt).toLocaleString(currentLanguage==="en"?"en-US":(currentLanguage === "en" ? "en-US" : "es-CO"))+" · "+Number(data.users||0).toLocaleString(currentLanguage==="en"?"en-US":(currentLanguage === "en" ? "en-US" : "es-CO"))+(currentLanguage==="en"?" profiles analyzed":" perfiles analizados")+(data.truncated?(currentLanguage==="en"?" · limited to the first 50,000 profiles":" · limitado a los primeros 50.000 perfiles"):"")+(currentLanguage==="en"?". Groups under 10 are hidden.":". Se ocultan grupos menores de 10.");
  } catch(error) {status.textContent=(currentLanguage==="en"?"Could not load statistics: ":"No fue posible cargar las estadísticas: ")+error.message;}
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
    priceInput.value = 4000;
    priceInput.readOnly = true;
    priceInput.setAttribute("aria-readonly", "true");
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
  const message = $("admin-price-message");
  message.textContent = "El precio está fijado en $4.000 COP por evaluación. Puedes gestionar códigos promocionales, pero no modificar el precio base.";
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
  const languageSelect = $("global-language");
  if (languageSelect) {
    languageSelect.value = preferredLanguage();
    setLanguage(languageSelect.value);
    languageSelect.addEventListener("change", () => setLanguage(languageSelect.value, { persist: true }));
  }
  startLanguageObserver();

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

  $("profile-locale-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = $("profile-locale-message");
    status.textContent = currentLanguage === "en" ? "Saving preferences…" : "Guardando preferencias…";
    try {
      const next = { ...(profileData || {}), country: $("profile-country-input").value.trim(), city: $("profile-city-input").value.trim(), language: $("profile-language-input").value };
      const response = await api("/api/profile", { method: "POST", body: JSON.stringify(next) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudieron guardar las preferencias.");
      profileData = { ...next, ...(result.profile || {}) };
      setLanguage(next.language);
      status.textContent = currentLanguage === "en" ? "Regional preferences saved." : "Preferencias regionales guardadas.";
    } catch (error) { status.textContent = error.message; }
  });
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
  $("admin-global-refresh").addEventListener("click", loadAdminGlobalAnalytics);
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

setLanguage(preferredLanguage());
initializeFirebase();
