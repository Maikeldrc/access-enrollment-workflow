import { classifyBarrierText } from "../goalBarriers.js";
const pick = (locale, values) => values[String(locale || "EN").toUpperCase()] || values.EN;
const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const lower = value => clean(value).toLowerCase();

const SCREEN_HELP = /what (do i|should i) do|what is this screen|which (one|option) should i (choose|pick)|explain (this|the screen)|help (me )?with this|qué (debo|tengo que) hacer|qué significa esta pantalla|cuál debo escoger|qué opción debo elegir|explique (esto|esta pantalla)|kisa pou m fè|ki opsyon pou m chwazi|eksplike ekran/i;
const SAFETY = /chest pain|can'?t breathe|cannot breathe|difficulty breathing|stroke|severe bleeding|pass(?:ed)? out|faint(?:ed|ing)?|suicid|emergency|dolor (fuerte )?(en el )?pecho|no puedo respirar|derrame|sangrado grave|me desmay|emergencia|doulè nan pwatrin|pa ka respire|konjesyon serebral|senyen anpil|endispoze|pèdi konesans|ijans|swisid/i;
const BP_READING = /(\d{2,3})\s*(?:over|\/|sobre)\s*(\d{2,3})/i;
const COST = /how much|cost|pay|owe|charge|copay|coinsurance|deductible|cu[aá]nto|costo|pagar|copago|coseguro|deducible|konbyen|pri|peye/i;
const ELIGIBILITY = /am i eligible|do i qualify|my eligibility|soy elegible|califico|mi elegibilidad|mwen kalifye|kalifikasyon mwen/i;
const MEDICATION_LIST = /what (medications|medicines|pills).*(have|file|registered)|medications.*(have|file)|qu[eé] medicamentos.*(tienen|registr)|medicamentos registrados|ki medikaman.*dosye|medikaman.*genyen/i;
const DEVICE_STATUS = /what (monitor|device) do i have|which (monitor|device)|is my (monitor|device).*(connected|assigned)|qu[eé] (monitor|aparato).*(tengo|asign)|(?:est[aá].*(monitor|aparato).*(conect)|conectad[oa]?.*(monitor|aparato))|ki apar[eè]y.*genyen|(?:apar[eè]y.*konekte|konekte.*apar[eè]y)/i;
const GOAL_STATUS = /what is my goal|what are my goals|my current goal|cu[aá]l es mi meta|mis metas|ki objektif mwen/i;
const LATEST_HEALTH_READING = /latest (blood pressure )?reading|my (blood pressure|bp).*(reading|today)|what does my.*reading|lectura (m[aá]s reciente|de hoy)|mi presi[oó]n.*(lectura|hoy)|d[eè]nye lekti|tansyon mwen.*jodi/i;
const HEALTH_TREND = /how has my (blood pressure|bp)|pressure.*this week|reading trend|blood pressure trend|c[oó]mo ha estado mi presi[oó]n|tendencia.*presi[oó]n|kijan tansyon mwen|tandans.*tansyon/i;
const CLINICAL_TARGET = /my (blood pressure )?target|expected range|rango esperado|objetivo.*presi[oó]n|sib tansyon|limit.*tansyon/i;
const GOAL_PROGRESS = /goal progress|how am i doing.*goal|progreso.*meta|c[oó]mo voy.*meta|pwogr[eè].*objektif/i;
const DOCTOR_STATUS = /is my doctor|who is my doctor|keep (seeing )?my doctor|doctor stays|mi m[eé]dico|seguir viendo a mi m[eé]dico|qui[eé]n es mi m[eé]dico|dokt[eè] mwen/i;
const NEXT_STEP = /what happens next|what is next|next step|qu[eé] sigue|pr[oó]ximo paso|kisa k ap pase apre|pwochen etap/i;
const HUMAN_SUPPORT = /call me|someone call|talk (to|with) someone|human|hablar con alguien|que me llamen|ll[aá]meme|pale ak yon moun|rele m/i;
const MEDICATION_SAFETY = /(stop|quit|skip|double|increase|decrease|change).*(medication|medicine|pill|dose)|dejar de tomar|suspender.*medic|cambiar la dosis|sispann pran|chanje d[oò]z/i;
const LEAVE_PROGRAM = /can i (leave|stop|end|quit)|leave the program|stop participating|puedo (dejar|salir|terminar)|dejar el programa|salir del programa|mwen ka (kite|sispann)|kite pwogram/i;
// Running out is its own intent, not a barrier and not a medication-list question. It is matched
// before the difficulty gate so "I keep running out of my pill" reaches the refill engine.
const REFILL_NEED = /refill|run(ning)? (out|low)|almost out|need more|out of my (medication|medicine|pill)|resurtir|surtir|receta|se me (acaba|acabó|está acabando)|necesito m[aá]s|me qued[eé] sin|ranplisaj|m ap fini|mwen bezwen plis|pa gen ank[oò]/i;
const REFILL_STATUS_QUESTION = /(what|where|how).*(refill|prescription)|refill.*(status|happening|going)|status of my (refill|prescription)|qu[eé] pas[oó] con (mi )?(receta|surtida)|d[oó]nde est[aá] mi (receta|surtida)|estado de mi (receta|surtida)|ki kote ranplisaj|estati ranplisaj/i;

// "Something is getting in my way" rather than "tell me about X". Without this a question about
// medications would be filed as a difficulty with medications.
const DIFFICULTY = /\b(i (can'?t|cannot|don'?t|do not|keep|always|never|forget|struggle)|it'?s (hard|difficult)|hard (to|for me)|having (a hard time|trouble)|trouble|difficult|no puedo|no entiendo|no s[eé] c[oó]mo|se me olvida|me cuesta|se me hace dif[ií]cil|dif[ií]cil|problema|mwen pa ka|mwen pa konprann|mwen bliye|difisil|pwobl[eè]m)\b/i;

// One acknowledgement per family of difficulty: what EMMI understood, and what happens next. Never
// "problem solved", never a promise the product cannot keep.
const BARRIER_ACKNOWLEDGEMENT = {
  UNDERSTANDING: { EN: "Let me explain it in plain language, and tell me if anything is still unclear.", ES: "Permítame explicárselo con palabras sencillas, y dígame si algo sigue sin quedar claro.", KR: "Kite m eksplike w sa nan mo senp, epi di m si gen yon bagay ki poko klè." },
  FORGETFULNESS_ROUTINE: { EN: "That happens to many people. We can add a reminder to your plan for a time that suits you.", ES: "Eso le pasa a muchas personas. Podemos agregar un recordatorio a su plan a la hora que le convenga.", KR: "Sa rive anpil moun. Nou ka ajoute yon rapèl nan plan ou pou yon lè ki bon pou ou." },
  DEVICE_TECHNOLOGY: { EN: "I can walk you through your monitor step by step, and if it still won’t work our device support team can call you.", ES: "Puedo guiarle paso a paso con su monitor y, si aún no funciona, nuestro equipo de soporte puede llamarle.", KR: "Mwen ka gide w etap pa etap ak monitè ou, epi si li toujou pa mache ekip sipò nou an ka rele w." },
  MEDICATION_UNDERSTANDING: { EN: "I can share general information about your medications. Your care team decides anything about how you take them.", ES: "Puedo darle información general sobre sus medicamentos. Su equipo decide cualquier cosa sobre cómo los toma.", KR: "Mwen ka pataje enfòmasyon jeneral sou medikaman ou yo. Ekip swen ou deside tout bagay sou fason ou pran yo." },
  MEDICATION_CONCERN: { EN: "Thank you for telling me. I can’t change anything about your medicine, so I’m letting your care team know so they can review it with you.", ES: "Gracias por contármelo. No puedo cambiar nada de su medicamento, así que avisaré a su equipo para que lo revise con usted.", KR: "Mèsi paske ou di m sa. Mwen pa ka chanje anyen sou medikaman ou, kidonk m ap fè ekip swen ou konnen pou yo ka revize l avèk ou." },
  MOTIVATION: { EN: "Keeping a plan going is hard, and a smaller plan is a normal thing to ask for. We can make this easier together.", ES: "Mantener un plan cuesta, y pedir un plan más sencillo es algo normal. Podemos hacerlo más fácil juntos.", KR: "Kenbe yon plan difisil, epi mande yon plan pi senp se yon bagay nòmal. Nou ka fè sa pi fasil ansanm." },
  TIME_ROUTINE: { EN: "We can change how often these steps happen so they fit your day.", ES: "Podemos cambiar con qué frecuencia hace estos pasos para que encajen en su día.", KR: "Nou ka chanje konbyen fwa ou fè etap sa yo pou yo antre nan jounen ou." },
  PHYSICAL_LIMITATION: { EN: "Thank you for telling me. I’ll let your care team know so your plan fits what feels comfortable for you.", ES: "Gracias por contármelo. Avisaré a su equipo para que su plan se ajuste a lo que le resulte cómodo.", KR: "Mèsi paske ou di m sa. M ap fè ekip swen ou konnen pou plan ou mache ak sa ki alèz pou ou." },
  NUTRITION: { EN: "I can share approved guidance on everyday food choices, like reading labels for salt.", ES: "Puedo compartir orientación aprobada sobre las comidas de todos los días, como leer las etiquetas para ver la sal.", KR: "Mwen ka pataje konsèy apwouve sou chwa manje chak jou, tankou li etikèt pou sèl." },
  EQUIPMENT_ACCESS: { EN: "Let’s make sure you have what you need. I’ll pass this to the team that handles equipment.", ES: "Asegurémonos de que tenga lo que necesita. Pasaré esto al equipo que se encarga del equipamiento.", KR: "Ann asire w ou gen sa ou bezwen. M ap voye sa bay ekip ki okipe aparèy yo." },
  FINANCIAL: { EN: "Thank you for telling me. Your care team can look at what support may be available to you.", ES: "Gracias por contármelo. Su equipo puede revisar qué apoyo podría estar disponible para usted.", KR: "Mèsi paske ou di m sa. Ekip swen ou ka gade ki sipò ki ka disponib pou ou." },
  TRANSPORTATION: { EN: "Getting there matters as much as the visit. I’ll pass this to your care team so they can help you plan it.", ES: "Llegar importa tanto como la cita. Pasaré esto a su equipo para que le ayuden a organizarlo.", KR: "Rive a enpòtan menm jan ak vizit la. M ap voye sa bay ekip swen ou pou yo ka ede w planifye l." },
  SOCIAL_SUPPORT: { EN: "You can invite someone you trust to help you with this, and you stay in control of your care.", ES: "Puede invitar a alguien de confianza para que le ayude, y usted mantiene el control de su cuidado.", KR: "Ou ka envite yon moun ou fè konfyans pou ede w, epi se ou ki kontwole swen ou." },
  LANGUAGE_COMMUNICATION: { EN: "We can use English, Spanish or Kreyòl. Tell me which you prefer and I’ll switch.", ES: "Podemos usar inglés, español o criollo haitiano. Dígame cuál prefiere y lo cambio.", KR: "Nou ka sèvi ak anglè, panyòl oswa kreyòl. Di m kilès ou pito epi m ap chanje l." },
  ACCESS_TO_CARE: { EN: "Not being able to reach your doctor is worth solving. I’ll let your care team know.", ES: "No poder comunicarse con su médico merece solución. Avisaré a su equipo de atención.", KR: "Pa ka jwenn doktè ou se yon bagay ki merite rezoud. M ap fè ekip swen ou konnen." },
  // Appointment scheduling does not exist yet, and EMMI says so rather than implying it does.
  APPOINTMENT_NEED: { EN: "I can’t book appointments yet, so I’m passing your request to your care team with what you told me. They will arrange it with you.", ES: "Todavía no puedo agendar citas, así que envío su solicitud a su equipo con lo que me contó. Ellos lo coordinarán con usted.", KR: "Mwen poko ka pran randevou, kidonk m ap voye demann ou bay ekip swen ou ak sa ou di m. Y ap fè aranjman avèk ou." },
  CLINICAL_SYMPTOM: { EN: "Thank you for telling me. How you are feeling comes first, so I’m letting your care team know.", ES: "Gracias por contármelo. Cómo se siente es lo primero, así que avisaré a su equipo de atención.", KR: "Mèsi paske ou di m sa. Kijan ou santi w se premye bagay, kidonk m ap fè ekip swen ou konnen." },
  OTHER: { EN: "Thank you for telling me. I’ve noted it, and we can work on it together.", ES: "Gracias por contármelo. Lo anoté y podemos trabajarlo juntos.", KR: "Mèsi paske ou di m sa. Mwen note l epi nou ka travay sou li ansanm." }
};

// Refill answers. Each one says exactly what happened and what is waiting, and never that
// something was approved, sent or renewed unless a source said so.
const refillReviewAnswer = (locale, medication) => pick(locale, {
  EN: `I opened your ${medication} refill. Let’s check a couple of things first, then I can send the request.`,
  ES: `Abrí la surtida de ${medication}. Revisemos un par de cosas y luego puedo enviar la solicitud.`,
  KR: `Mwen louvri ranplisaj ${medication} ou. Ann tcheke de bagay anvan, epi m ka voye demann nan.`
});

const refillAlreadyRequestedAnswer = (locale, medication, status) => pick(locale, {
  EN: `You already have a refill request for ${medication}. Right now it is: ${status}.`,
  ES: `Ya tiene una solicitud de surtida para ${medication}. Ahora mismo está: ${status}.`,
  KR: `Ou deja gen yon demann ranplisaj pou ${medication}. Kounye a li: ${status}.`
});

const refillSelectionAnswer = (locale, medications) => {
  const names = medications.slice(0, 4).map(medication => medication.name).join(", ");
  return pick(locale, {
    EN: `Which medication do you need? I have ${names} on file.`,
    ES: `¿Qué medicamento necesita? Tengo ${names} registrados.`,
    KR: `Ki medikaman ou bezwen? Mwen gen ${names} nan dosye a.`
  });
};

const refillStatusAnswer = (locale, refills) => {
  if (!refills.length) return pick(locale, {
    EN: "You don’t have a refill request in progress right now.",
    ES: "Ahora mismo no tiene ninguna solicitud de surtida en curso.",
    KR: "Ou pa gen okenn demann ranplisaj ki ap mache kounye a."
  });
  return refills.map(refill => pick(locale, {
    EN: `${refill.medication}: ${refill.patientStatus}.`,
    ES: `${refill.medication}: ${refill.patientStatus}.`,
    KR: `${refill.medication}: ${refill.patientStatus}.`
  })).join(" ");
};

const barrierAcknowledgement = (locale, category, alreadyKnown = false) => {
  const base = pick(locale, BARRIER_ACKNOWLEDGEMENT[category] || BARRIER_ACKNOWLEDGEMENT.OTHER);
  if (!alreadyKnown) return base;
  // Mentioning it again is not a new problem: EMMI says she already has it rather than starting over.
  const prefix = pick(locale, {
    EN: "I still have this one open for you.",
    ES: "Todavía tengo esto abierto para usted.",
    KR: "Mwen toujou gen sa a ouvè pou ou."
  });
  return `${prefix} ${base}`;
};

export const expandEmmiQuery = ({ question, conversation = {}, program = "" } = {}) => {
  const raw = clean(question);
  const context = `${conversation.conversationSummary || ""} ${(conversation.recentTurns || []).map(turn => turn.text).join(" ")}`;
  const mentioned = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"].filter(item => new RegExp(`\\b${item}\\b`, "i").test(context));
  if (/(difference|different|compare|diferencia|diferente|comparar|diferans)/i.test(raw) && mentioned.length >= 2) return `${raw} ${mentioned.slice(-2).join(" ")}`;
  if (/^(and|what about|y|e)\b/i.test(raw) && mentioned.length) return `${raw} Previous topic: ${mentioned.at(-1)}`;
  if (/\b(this|that|it|esto|eso|este programa|sa a)\b/i.test(raw) && program) return `${raw} Current program: ${program}`;
  return raw;
};

const unavailable = locale => pick(locale, {
  EN: "I don’t have enough approved information to answer that safely. I can help you contact your care team.",
  ES: "No tengo suficiente información aprobada para responder eso con seguridad. Puedo ayudarle a comunicarse con su equipo de atención.",
  KR: "Mwen pa gen ase enfòmasyon apwouve pou reponn sa san danje. Mwen ka ede w kontakte ekip swen ou."
});
const retrievalUnavailable = locale => pick(locale, {
  EN: "I can’t look up that information right now. You can try again, or I can help you contact your care team.",
  ES: "Ahora mismo no puedo consultar esa información. Puede intentar de nuevo o puedo ayudarle a comunicarse con su equipo de atención.",
  KR: "Mwen pa ka chèche enfòmasyon sa a kounye a. Ou ka eseye ankò, oswa mwen ka ede w kontakte ekip swen ou."
});

const programAnswers = Object.freeze({
  ACCESS: {
    EN: "ACCESS is a Medicare care option that provides extra support between doctor visits. Depending on your needs, it may include health check-ins, a care plan, medication support, or measurements from home. Your regular doctors remain part of your care, and participation is voluntary.",
    ES: "ACCESS es una opción de cuidado de Medicare que brinda apoyo adicional entre sus visitas médicas. Según sus necesidades, puede incluir seguimiento de su salud, un plan de cuidado, apoyo con sus medicamentos o mediciones desde casa. Sus médicos habituales continúan formando parte de su cuidado y participar es voluntario.",
    KR: "ACCESS se yon opsyon swen Medicare ki bay plis sipò ant vizit kay doktè. Selon bezwen ou, li ka gen ladan suivi sante, yon plan swen, sipò pou medikaman, oswa mezi lakay. Doktè ou deja wè yo rete nan swen ou, epi patisipasyon an volontè."
  },
  CCM: {
    EN: "CCM, or Chronic Care Management, is a Medicare service for people managing multiple chronic conditions who need ongoing support between visits. A care team can help coordinate care, review medications, work on goals, and stay connected with the patient’s doctors. Participation is voluntary, and Medicare cost sharing may apply.",
    ES: "CCM significa Chronic Care Management, o manejo de cuidado crónico. Es un servicio de Medicare para personas con varias condiciones crónicas que necesitan apoyo continuo entre visitas. El equipo puede coordinar el cuidado, revisar medicamentos, trabajar en metas y mantenerse en comunicación con los médicos. La participación es voluntaria y pueden aplicar costos de Medicare.",
    KR: "CCM vle di Chronic Care Management, oswa jesyon swen kwonik. Se yon sèvis Medicare pou moun k ap jere plizyè maladi kwonik epi ki bezwen sipò regilye ant vizit. Ekip swen an ka ede kowòdone swen, revize medikaman, travay sou objektif, epi rete konekte ak doktè yo."
  },
  RPM: {
    EN: "RPM, or Remote Patient Monitoring, uses a connected medical device to share health measurements, such as blood pressure, with the care team. It supports care between visits, but it is not an emergency service. A monitor is considered connected only after ITERA verifies the device and its transmissions.",
    ES: "RPM significa Remote Patient Monitoring, o monitoreo remoto del paciente. Utiliza un dispositivo médico conectado para compartir mediciones, como la presión arterial, con el equipo de atención. Apoya el cuidado entre visitas, pero no es un servicio de emergencia. ITERA debe verificar el dispositivo y sus transmisiones antes de considerarlo conectado.",
    KR: "RPM vle di Remote Patient Monitoring, oswa siveyans pasyan a distans. Li sèvi ak yon aparèy medikal konekte pou pataje mezi sante, tankou tansyon, ak ekip swen an. Li sipòte swen ant vizit, men li pa yon sèvis ijans."
  },
  PCM: {
    EN: "PCM, or Principal Care Management, provides focused ongoing support for one serious chronic condition. The care team can help coordinate the plan, medications, goals, and needs related to that condition between visits.",
    ES: "PCM significa Principal Care Management. Brinda apoyo continuo y enfocado para una condición crónica seria. El equipo puede ayudar a coordinar el plan, los medicamentos, las metas y las necesidades relacionadas con esa condición entre visitas.",
    KR: "PCM vle di Principal Care Management. Li bay sipò regilye ki konsantre sou yon maladi kwonik grav. Ekip la ka ede kowòdone plan, medikaman, objektif ak bezwen ki gen rapò ak maladi sa a."
  },
  APCM: {
    EN: "APCM, or Advanced Primary Care Management, supports ongoing coordination through a primary care team. The exact services and any patient cost depend on the approved care configuration and current coverage.",
    ES: "APCM significa Advanced Primary Care Management. Apoya la coordinación continua mediante un equipo de atención primaria. Los servicios exactos y cualquier costo dependen de la configuración aprobada y de la cobertura vigente.",
    KR: "APCM vle di Advanced Primary Care Management. Li sipòte kowòdinasyon regilye atravè yon ekip swen prensipal. Sèvis egzak yo ak nenpòt depans depann de konfigirasyon apwouve a ak kouvèti aktyèl la."
  },
  ASM: {
    EN: "ASM is an ITERA-supported care configuration whose exact services must come from the approved program setup. I can explain the specific support shown in your care information, but I won’t invent services that are not configured.",
    ES: "ASM es una configuración de cuidado apoyada por ITERA cuyos servicios exactos deben provenir de la configuración aprobada. Puedo explicar el apoyo que aparece en su información de cuidado, pero no inventaré servicios que no estén configurados.",
    KR: "ASM se yon konfigirasyon swen ITERA sipòte. Sèvis egzak yo dwe soti nan konfigirasyon apwouve a. Mwen ka esplike sipò ki parèt nan enfòmasyon swen ou, men mwen p ap envante sèvis."
  },
  "CCM + RPM": {
    EN: "CCM + RPM combines ongoing chronic care coordination with connected health monitoring when it is appropriate for the patient. The care team can support the care plan, medications, and goals while also reviewing verified measurements sent by the connected device. It is not an emergency service, and Medicare cost sharing may apply.",
    ES: "CCM + RPM combina la coordinación continua del cuidado crónico con el monitoreo de salud mediante un dispositivo conectado cuando sea apropiado. El equipo puede apoyar el plan, los medicamentos y las metas, además de revisar mediciones verificadas enviadas por el dispositivo. No es un servicio de emergencia y pueden aplicar costos de Medicare.",
    KR: "CCM + RPM konbine kowòdinasyon swen kwonik regilye ak siveyans sante atravè yon aparèy konekte lè sa apwopriye. Ekip la ka ede ak plan swen, medikaman ak objektif, epi revize mezi verifye aparèy la voye. Li pa yon sèvis ijans."
  },
  "PCM + RPM": {
    EN: "PCM + RPM combines focused support for one serious chronic condition with connected health monitoring when appropriate. The care team coordinates needs related to that condition and reviews verified measurements sent by the connected device. It is not an emergency service, and Medicare cost sharing may apply.",
    ES: "PCM + RPM combina apoyo enfocado para una condición crónica seria con monitoreo de salud mediante un dispositivo conectado cuando sea apropiado. El equipo coordina las necesidades relacionadas con esa condición y revisa las mediciones verificadas enviadas por el dispositivo. No es un servicio de emergencia y pueden aplicar costos de Medicare.",
    KR: "PCM + RPM konbine sipò ki konsantre sou yon maladi kwonik grav ak siveyans sante atravè yon aparèy konekte lè sa apwopriye. Ekip la kowòdone bezwen maladi a epi revize mezi verifye aparèy la voye. Li pa yon sèvis ijans."
  }
});

const fallbackKnowledgeAnswer = ({ question, retrieval, locale, program }) => {
  const sources = retrieval.passages || [];
  const sourcePaths = sources.map(item => item.sourcePath).join(" ");
  const asksForCcmRpm = /CCM\s*(?:\+|and|y|ak)\s*RPM/i.test(question) || program === "CCM + RPM";
  const asksForPcmRpm = /PCM\s*(?:\+|and|y|ak)\s*RPM/i.test(question) || program === "PCM + RPM";
  const combinedProgram = asksForCcmRpm && /programs\/ccm-rpm\.md/i.test(sourcePaths) ? "CCM + RPM"
    : asksForPcmRpm && /programs\/pcm-rpm\.md/i.test(sourcePaths) ? "PCM + RPM" : "";
  const programNames = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"];
  const explicitPrograms = programNames.filter(name => new RegExp(`\\b${name}\\b`, "i").test(question));
  const programs = programNames.filter(name => new RegExp(`\\b${name}\\b`, "i").test(`${question} ${sources.map(item => item.sourcePath).join(" ")}`));
  if (/(difference|diferencia|diferans|compare)/i.test(question) && programs.includes("ACCESS") && programs.includes("CCM")) return pick(locale, {
    EN: `${programAnswers.ACCESS.EN} CCM is different: it is Medicare chronic care management for people with multiple chronic conditions and focuses on ongoing coordination between visits.`,
    ES: "ACCESS es un modelo de Medicare enfocado en apoyo adicional y resultados de salud, mientras que CCM es un servicio de manejo de cuidado crónico para personas con varias condiciones crónicas. Ambos pueden apoyar entre visitas, pero siguen reglas y configuraciones diferentes.",
    KR: "ACCESS se yon modèl Medicare ki konsantre sou plis sipò ak rezilta sante. CCM se yon sèvis jesyon swen kwonik pou moun ki gen plizyè maladi kwonik. Toude ka ede ant vizit, men yo gen règ diferan."
  });
  if (combinedProgram) return pick(locale, programAnswers[combinedProgram]);
  if (LEAVE_PROGRAM.test(question)) return pick(locale, {
    EN: "Participation is voluntary. You can choose whether to enroll, and you can ask to end your participation later. The current program information explains any timing or switching rules that apply, and the ITERA care team can help you review them.",
    ES: "La participación es voluntaria. Usted decide si desea inscribirse y puede solicitar terminar su participación después. La información vigente del programa explica cualquier regla de tiempo o cambio que aplique, y el equipo de ITERA puede ayudarle a revisarla.",
    KR: "Patisipasyon an volontè. Se ou ki chwazi si w vle enskri, epi ou ka mande pou fini patisipasyon ou pita. Enfòmasyon aktyèl pwogram nan esplike nenpòt règ sou delè oswa chanjman, epi ekip ITERA a ka ede w revize yo."
  });
  const named = explicitPrograms.find(name => programAnswers[name]) || programs.find(name => programAnswers[name]);
  if (named) return pick(locale, programAnswers[named]);
  if (sources.some(item => /medications/.test(item.sourcePath))) return pick(locale, {
    EN: "Reviewing your medications helps the care team understand what you are taking now, what changed, and where you may need help. It does not change a prescription automatically, and EMMI will never tell you to start, stop, or change a medicine.",
    ES: "Revisar sus medicamentos ayuda al equipo a entender qué toma actualmente, qué cambió y dónde puede necesitar ayuda. Esta revisión no cambia una receta automáticamente, y EMMI nunca le indicará iniciar, suspender o cambiar un medicamento.",
    KR: "Revize medikaman ou ede ekip la konprann sa w ap pran kounye a, sa ki chanje, ak kote ou bezwen èd. Revizyon an pa chanje yon preskripsyon otomatikman, epi EMMI p ap di w kòmanse, sispann oswa chanje yon medikaman."
  });
  if (sources.some(item => /original-medicare/.test(item.sourcePath))) return pick(locale, {
    EN: "Original Medicare generally includes Part A and Part B. Whether a specific care program is available to you, and what you may pay, must be confirmed from your current coverage and program information.",
    ES: "Medicare Original generalmente incluye la Parte A y la Parte B. La disponibilidad de un programa específico y lo que podría pagar deben confirmarse con su cobertura y la información vigente del programa.",
    KR: "Medicare Orijinal anjeneral gen Pati A ak Pati B. Nou dwe verifye kouvèti aktyèl ou ak enfòmasyon pwogram nan pou konnen si yon sèvis disponib pou ou ak sa ou ka peye."
  });
  if (program && programAnswers[program] && /program|care|support|voluntar|obligat/i.test(question)) return pick(locale, programAnswers[program]);
  return unavailable(locale);
};

// Every cost sentence is chosen by the engine's explanation code, never by the assistant reading
// an amount and drawing its own conclusion. An unknown amount is answered as unknown.
const accessCostAnswer = (result, locale) => {
  const gross = `$${result.grossBeneficiaryResponsibility}`;
  const byCode = {
    SUPPLEMENTAL_COVERS_COST_SHARE: {
      EN: `Based on the coverage we verified, your expected payment for ACCESS is $0. Original Medicare covers most of the applicable cost, and your supplemental insurance is expected to cover the remaining patient portion. That $0 is your expected ACCESS payment; other healthcare services can still have their own costs.`,
      ES: `Según la cobertura que verificamos, su pago esperado por ACCESS es $0. Medicare Original cubre la mayor parte del costo aplicable y se espera que su seguro suplementario cubra la parte que le corresponde. Ese $0 es su pago esperado por ACCESS; otros servicios de salud pueden tener sus propios costos.`,
      KR: `Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se $0. Medicare Orijinal kouvri pifò nan depans ki aplikab la, epi nou prevwa asirans siplemantè ou ap kouvri rès pati pa ou a. $0 sa a se peman ACCESS ou prevwa a; lòt sèvis sante ka gen pwòp depans pa yo.`
    },
    NO_SUPPLEMENTAL_COVERAGE: {
      EN: `Based on the coverage we verified, your expected payment for ACCESS is ${gross} per month for your current track. Medicare covers most of the applicable cost and this is the remaining patient portion.`,
      ES: `Según la cobertura que verificamos, su pago esperado por ACCESS es de ${gross} al mes para su vía actual. Medicare cubre la mayor parte del costo aplicable y esta es la parte que le corresponde.`,
      KR: `Dapre kouvèti nou verifye a, peman ou prevwa pou ACCESS se ${gross} pa mwa pou wout ou kounye a. Medicare kouvri pifò nan depans ki aplikab la epi sa a se rès pati pa ou a.`
    },
    SUPPLEMENTAL_COVERAGE_UNKNOWN: {
      EN: `I could not confirm whether your supplemental coverage pays the ACCESS patient portion, so I do not have a final expected payment for you yet. Before that is confirmed, the patient portion for your current track is ${gross} per month. Your care team can check your coverage.`,
      ES: `No pude confirmar si su cobertura suplementaria paga la parte del paciente de ACCESS, así que todavía no tengo un pago esperado definitivo. Antes de confirmarlo, la parte del paciente para su vía actual es de ${gross} al mes. Su equipo de atención puede verificar su cobertura.`,
      KR: `Mwen pa t ka konfime si kouvèti siplemantè ou peye pati pasyan an pou ACCESS, kidonk mwen poko gen yon peman final ou prevwa. Anvan sa konfime, pati pasyan an pou wout ou kounye a se ${gross} pa mwa. Ekip swen ou ka verifye kouvèti ou.`
    },
    COVERAGE_VERIFICATION_STALE: {
      EN: `Your coverage was last verified a while ago, so I do not want to give you an amount that may be out of date. Your care team can re-check your coverage and then I can tell you your expected payment.`,
      ES: `Su cobertura se verificó hace tiempo, así que prefiero no darle una cantidad que podría estar desactualizada. Su equipo de atención puede verificarla de nuevo y luego podré decirle su pago esperado.`,
      KR: `Se gen yon bon tan depi nou te verifye kouvèti ou, kidonk mwen pa vle ba w yon montan ki ka pa ajou. Ekip swen ou ka reverifye kouvèti a epi apre sa mwen ka di w peman ou prevwa a.`
    },
    COVERAGE_NOT_VERIFIED: {
      EN: `I could not verify your coverage from the information currently available, so I do not have an expected payment to give you yet. Your care team can check this with you.`,
      ES: `No pude verificar su cobertura con la información disponible, así que todavía no tengo un pago esperado para darle. Su equipo de atención puede revisarlo con usted.`,
      KR: `Mwen pa t ka verifye kouvèti ou ak enfòmasyon ki disponib kounye a, kidonk mwen poko gen yon peman ou prevwa pou m ba w. Ekip swen ou ka tcheke sa avèk ou.`
    },
    QMB_COST_SHARE_RULES: {
      EN: `Your coverage includes a Qualified Medicare Beneficiary designation, which has its own cost-sharing rules. I do not want to state an amount for you without your care team confirming how those rules apply.`,
      ES: `Su cobertura incluye la designación de Beneficiario Calificado de Medicare, que tiene sus propias reglas de costos. Prefiero no indicarle una cantidad sin que su equipo confirme cómo se aplican esas reglas.`,
      KR: `Kouvèti ou gen yon deziyasyon Benefisyè Medicare Kalifye, ki gen pwòp règ pa l sou depans. Mwen pa vle bay yon montan san ekip swen ou konfime kijan règ sa yo aplike.`
    },
    MEDICARE_ADVANTAGE_NOT_ELIGIBLE: {
      EN: `Your coverage shows a Medicare Advantage plan rather than Original Medicare. That affects whether ACCESS is available to you, not just the amount, so your care team needs to review your eligibility before I can talk about a payment.`,
      ES: `Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original. Eso afecta si ACCESS está disponible para usted, no solo la cantidad, así que su equipo debe revisar su elegibilidad antes de que pueda hablar de un pago.`,
      KR: `Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal. Sa afekte si ACCESS disponib pou ou, se pa sèlman montan an, kidonk ekip swen ou dwe revize kalifikasyon ou anvan mwen ka pale sou yon peman.`
    }
  }[result.explanationCode];
  return byCode ? pick(locale, byCode) : pick(locale, byCode || {
    EN: "I do not have a confirmed expected payment for you right now. Your care team can check your coverage.",
    ES: "Ahora mismo no tengo un pago esperado confirmado. Su equipo de atención puede verificar su cobertura.",
    KR: "Mwen pa gen yon peman konfime ou prevwa kounye a. Ekip swen ou ka verifye kouvèti ou."
  });
};

const runtimeAnswer = ({ tool, result, locale, context }) => {
  if (tool === "getExpectedAccessCost") return accessCostAnswer(result, locale);
  if (tool === "getPatientCoverage") {
    if (!result.found) return pick(locale, {
      EN: "I could not verify supplemental coverage from the information currently available. Your care team can check this with you.",
      ES: "No pude verificar cobertura suplementaria con la información disponible. Su equipo de atención puede revisarlo con usted.",
      KR: "Mwen pa t ka verifye kouvèti siplemantè ak enfòmasyon ki disponib kounye a. Ekip swen ou ka tcheke sa avèk ou."
    });
    const medicare = result.medicare?.isOriginalMedicare
      ? pick(locale, { EN: "Your coverage shows active Original Medicare, including Part A and Part B.", ES: "Su cobertura muestra Medicare Original activo, con Parte A y Parte B.", KR: "Kouvèti ou montre Medicare Orijinal aktif, ak Pati A ak Pati B." })
      : result.medicare?.isMedicareAdvantage
        ? pick(locale, { EN: "Your coverage shows a Medicare Advantage plan rather than Original Medicare.", ES: "Su cobertura muestra un plan Medicare Advantage en lugar de Medicare Original.", KR: "Kouvèti ou montre yon plan Medicare Advantage olye Medicare Orijinal." })
        : pick(locale, { EN: "I could not confirm which kind of Medicare coverage you have.", ES: "No pude confirmar qué tipo de cobertura de Medicare tiene.", KR: "Mwen pa t ka konfime ki kalite kouvèti Medicare ou genyen." });
    // Only a payer actually classified as a Medicare Supplement is described as supplemental.
    const supplement = result.supplemental
      ? (result.supplemental.carrierName
        ? pick(locale, { EN: ` We also verified active supplemental coverage: ${result.supplemental.carrierName}.`, ES: ` También verificamos cobertura suplementaria activa: ${result.supplemental.carrierName}.`, KR: ` Nou verifye tou yon kouvèti siplemantè aktif: ${result.supplemental.carrierName}.` })
        : pick(locale, { EN: " We also verified active supplemental coverage, but I do not have the plan name available.", ES: " También verificamos cobertura suplementaria activa, pero no tengo el nombre del plan disponible.", KR: " Nou verifye tou yon kouvèti siplemantè aktif, men mwen pa gen non plan an." }))
      : pick(locale, { EN: " I could not verify supplemental coverage from the information currently available.", ES: " No pude verificar cobertura suplementaria con la información disponible.", KR: " Mwen pa t ka verifye kouvèti siplemantè ak enfòmasyon ki disponib kounye a." });
    return `${medicare}${supplement}`;
  }
  if (tool === "getEnrollmentContext") {
    const eligible = result.eligibilityStatus === "ELIGIBLE";
    return eligible ? pick(locale, { EN: "Your current ACCESS eligibility result shows that you can continue. You are not enrolled until you review the information and agree.", ES: "Su resultado actual de elegibilidad para ACCESS indica que puede continuar. No estará inscrito hasta que revise la información y acepte.", KR: "Rezilta kalifikasyon ACCESS ou montre ou ka kontinye. Ou poko enskri jiskaske ou revize enfòmasyon yo epi dakò." })
      : pick(locale, { EN: "I can’t confirm that you are eligible right now. Your Medicare benefits and regular care do not change because of this check.", ES: "Ahora mismo no puedo confirmar que sea elegible. Sus beneficios de Medicare y su cuidado habitual no cambian por esta verificación.", KR: "Mwen pa ka konfime ou kalifye kounye a. Benefis Medicare ou ak swen nòmal ou pa chanje akoz verifikasyon sa a." });
  }
  if (tool === "getAssignedDevice") {
    if (result.found) return pick(locale, { EN: `The monitor assigned to your care is the ${result.displayName || result.model || result.vendor} and its device number ends in ${String(result.deviceId || "").slice(-4)}. Its current ITERA connection status is ${result.integrationStatus === "CONNECTED" ? "connected" : "not connected"}.`, ES: `El monitor asignado a su cuidado es ${result.displayName || result.model || result.vendor} y su número termina en ${String(result.deviceId || "").slice(-4)}. Su estado actual con ITERA es ${result.integrationStatus === "CONNECTED" ? "conectado" : "no conectado"}.`, KR: `Aparèy ki asiyen pou swen ou se ${result.displayName || result.model || result.vendor}, epi nimewo li fini ak ${String(result.deviceId || "").slice(-4)}. Eta koneksyon li ak ITERA se ${result.integrationStatus === "CONNECTED" ? "konekte" : "pa konekte"}.` });
    return result.patientOwnsMonitor ? pick(locale, { EN: "Your information shows that you have your own monitor, but it is not connected to ITERA.", ES: "Su información indica que tiene su propio monitor, pero no está conectado a ITERA.", KR: "Enfòmasyon ou montre ou gen pwòp aparèy ou, men li pa konekte ak ITERA." }) : pick(locale, { EN: "I don’t see a monitor assigned to your care yet.", ES: "Todavía no veo un monitor asignado a su cuidado.", KR: "Mwen poko wè yon aparèy ki asiyen pou swen ou." });
  }
  if (tool === "getMedicationList") {
    const names = (result.medications || []).filter(item => item.active).map(item => item.details ? `${item.name} (${item.details})` : item.name);
    return names.length ? pick(locale, { EN: `The medications currently on file are ${names.join(" and ")}. Please review them on the medication screen; this does not change a prescription.`, ES: `Los medicamentos registrados actualmente son ${names.join(" y ")}. Revíselos en la pantalla de medicamentos; esta revisión no cambia una receta.`, KR: `Medikaman ki nan dosye a kounye a se ${names.join(" ak ")}. Tanpri revize yo sou ekran medikaman an; sa pa chanje yon preskripsyon.` }) : pick(locale, { EN: "I don’t see any medications on file in this prototype.", ES: "No veo medicamentos registrados en este prototipo.", KR: "Mwen pa wè okenn medikaman nan dosye pwototip sa a." });
  }
  if (tool === "getPatientGoals") {
    const goals = result.goals || [];
    return goals.length ? pick(locale, { EN: `Your current goal${goals.length > 1 ? "s are" : " is"}: ${goals.map(item => item.title).join("; ")}. You can change personal goals later.`, ES: `Su${goals.length > 1 ? "s metas actuales son" : " meta actual es"}: ${goals.map(item => item.title).join("; ")}. Puede cambiar sus metas personales después.`, KR: `Objektif ou${goals.length > 1 ? " yo se" : " se"}: ${goals.map(item => item.title).join("; ")}. Ou ka chanje objektif pèsonèl yo pita.` }) : pick(locale, { EN: "You have not saved a personal goal yet.", ES: "Todavía no ha guardado una meta personal.", KR: "Ou poko sove yon objektif pèsonèl." });
  }
  if (tool === "getLatestReading") {
    const reading = result.reading;
    if (!reading) return pick(locale, { EN: "I can’t confirm a recent blood pressure reading right now.", ES: "Ahora mismo no puedo confirmar una lectura reciente de presión arterial.", KR: "Mwen pa ka konfime yon dènye lekti tansyon kounye a." });
    const status = reading.classification === "WITHIN_EXPECTED_RANGE"
      ? pick(locale, { EN: "It is within the range your care team is following.", ES: "Está dentro del rango que sigue su equipo de atención.", KR: "Li nan limit ekip swen ou ap suiv la." })
      : pick(locale, { EN: "Use the status and next step shown by your care team in the app.", ES: "Use el estado y el próximo paso indicado por su equipo en la aplicación.", KR: "Swiv eta ak pwochen etap ekip swen ou montre nan aplikasyon an." });
    return pick(locale, { EN: `Your latest reading was ${reading.systolic}/${reading.diastolic} mmHg. ${status} The top number is the pressure when the heart pumps, and the bottom number is the pressure between beats.`, ES: `Su lectura más reciente fue ${reading.systolic}/${reading.diastolic} mmHg. ${status} El número superior es la presión cuando el corazón bombea y el inferior es la presión entre latidos.`, KR: `Dènye lekti ou te ${reading.systolic}/${reading.diastolic} mmHg. ${status} Chif anlè a se presyon lè kè a ponpe; chif anba a se presyon ant batman yo.` });
  }
  if (tool === "getReadingTrend") {
    const trend = result.trend;
    if (!trend || trend.direction === "INSUFFICIENT_DATA") return pick(locale, { EN: "There are not enough verified readings to describe a trend yet.", ES: "Aún no hay suficientes lecturas verificadas para describir una tendencia.", KR: "Poko gen ase lekti verifye pou dekri yon tandans." });
    const direction = trend.direction === "STABLE" ? pick(locale, { EN: "fairly stable", ES: "bastante estables", KR: "prèske estab" }) : trend.direction === "TRENDING_UP" ? pick(locale, { EN: "trending higher", ES: "con tendencia más alta", KR: "gen tandans monte" }) : pick(locale, { EN: "trending lower", ES: "con tendencia más baja", KR: "gen tandans desann" });
    return pick(locale, { EN: `Your ${trend.periodDays}-day average is ${trend.averageSystolic}/${trend.averageDiastolic} mmHg from ${trend.count} readings. The calculated trend is ${direction}. Readings can vary for different reasons, so I won’t guess at a cause.`, ES: `Su promedio de ${trend.periodDays} días es ${trend.averageSystolic}/${trend.averageDiastolic} mmHg, calculado con ${trend.count} lecturas. La tendencia calculada se mantiene ${direction}. Las lecturas pueden variar por distintas razones, así que no atribuiré una causa.`, KR: `Mwayèn ${trend.periodDays} jou ou se ${trend.averageSystolic}/${trend.averageDiastolic} mmHg nan ${trend.count} lekti. Tandans kalkile a ${direction}. Lekti yo ka varye pou plizyè rezon, kidonk mwen p ap devine kòz la.` });
  }
  if (tool === "getClinicalTarget") return result.target ? pick(locale, { EN: `Your care-team-defined target is less than ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Your care team owns this clinical target.`, ES: `El objetivo definido por su equipo es menos de ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Este objetivo clínico pertenece a su equipo de atención.`, KR: `Sib ekip swen ou fikse a se mwens pase ${result.target.systolicMaximum + 1}/${result.target.diastolicMaximum + 1} mmHg. Ekip swen ou responsab sib klinik sa a.` }) : unavailable(locale);
  if (tool === "getGoalProgress") return result.progress ? pick(locale, { EN: `${result.progress.readingCountThisWeek || 0} connected readings were received this week. Other steps are counted only when you report them or complete the related EMMI lesson.`, ES: `Esta semana se recibieron ${result.progress.readingCountThisWeek || 0} lecturas conectadas. Los demás pasos solo se cuentan cuando usted los registra o completa la lección correspondiente con EMMI.`, KR: `Nou resevwa ${result.progress.readingCountThisWeek || 0} lekti konekte semèn sa a. Lòt etap yo konte sèlman lè ou rapòte yo oswa fini leson EMMI ki mache avè l.` }) : unavailable(locale);
  if (tool === "getCareTeam") return result.physicianDisplayName ? pick(locale, { EN: `${result.physicianDisplayName} remains part of your care. ITERA provides additional support and does not replace your doctor.`, ES: `${result.physicianDisplayName} continúa siendo parte de su cuidado. ITERA brinda apoyo adicional y no reemplaza a su médico.`, KR: `${result.physicianDisplayName} rete yon pati nan swen ou. ITERA bay sipò anplis epi li pa ranplase doktè ou.` }) : pick(locale, { EN: "Your regular doctors remain part of your care. ITERA provides additional support and does not replace them.", ES: "Sus médicos habituales continúan formando parte de su cuidado. ITERA brinda apoyo adicional y no los reemplaza.", KR: "Doktè ou deja genyen yo rete nan swen ou. ITERA bay sipò anplis epi li pa ranplase yo." });
  if (tool === "getNextBestAction") return pick(locale, { EN: `Your next step is “${result.label}.”`, ES: `Su próximo paso es “${result.label}”.`, KR: `Pwochen etap ou se “${result.label}”.` });
  return unavailable(locale);
};

export class EmmiTextOrchestrator {
  constructor({ getContext, getConversation, executeTool, screenExplanation, fetchImpl = globalThis.fetch, onEvent = () => {} }) {
    this.getContext = getContext;
    this.getConversation = getConversation;
    this.executeTool = executeTool;
    this.screenExplanation = screenExplanation;
    this.fetch = fetchImpl;
    this.onEvent = onEvent;
  }

  async answer(question) {
    const context = this.getContext();
    const locale = context.locale || "EN";
    const conversation = this.getConversation?.() || {};
    const retrievalQuery = expandEmmiQuery({ question, conversation, program: context.program });
    const trace = { turnId: `emmi_turn_${Date.now().toString(36)}`, conversationSessionId: conversation.conversationSessionId || "", screenId: context.currentScreen, retrievalQuery, intent: "UNKNOWN", knowledgeChunkIds: [], toolCalls: [], runtimeFactsUsed: [], responseMode: "UNKNOWN" };
    const emit = (type, details = {}) => this.onEvent(type, { ...trace, ...details });

    const bp = question.match(BP_READING);
    if (SAFETY.test(question) || bp) {
      trace.intent = "CLINICAL_SAFETY"; trace.toolCalls.push("evaluateClinicalEscalation");
      try {
        const result = await this.executeTool("evaluateClinicalEscalation", { systolic: Number(bp?.[1] || 0), diastolic: Number(bp?.[2] || 0), symptoms: question });
        trace.responseMode = "SAFETY_ENGINE"; trace.runtimeFactsUsed.push("clinicalEscalation.instruction"); emit("EMMI_ANSWER_ROUTED");
        if (result.instruction === "CALL_911") return { text: pick(locale, { EN: "This may require urgent medical attention. Please call 911 or seek emergency care now.", ES: "Esto puede requerir atención médica urgente. Llame al 911 o busque atención de emergencia ahora.", KR: "Sa ka mande swen medikal ijan. Tanpri rele 911 oswa chèche swen ijans kounye a." }), emergency: true, trace };
        if (result.instruction === "CREATE_HIGH_PRIORITY_TASK") return { text: pick(locale, { EN: "This needs review by your care team. Would you like me to create a high-priority care-team task?", ES: "Esto necesita revisión de su equipo de atención. ¿Desea que cree una tarea de alta prioridad para el equipo?", KR: "Ekip swen ou bezwen revize sa. Èske ou vle m kreye yon travay priyorite wo pou ekip la?" }), pendingAction: "clinical-task", trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "evaluateClinicalEscalation", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    if (MEDICATION_SAFETY.test(question)) {
      trace.intent = "MEDICATION_SAFETY"; trace.responseMode = "DETERMINISTIC_SAFETY"; emit("EMMI_ANSWER_ROUTED");
      return { text: pick(locale, { EN: "I can’t recommend starting, stopping, or changing a medication or dose. Please contact your clinician or care team for treatment advice.", ES: "No puedo recomendar iniciar, suspender ni cambiar un medicamento o una dosis. Consulte a su profesional clínico o equipo de atención.", KR: "Mwen pa ka rekòmande kòmanse, sispann oswa chanje yon medikaman oswa dòz. Tanpri kontakte klinisyen oswa ekip swen ou." }), trace };
    }
    if (SCREEN_HELP.test(question)) {
      trace.intent = "CURRENT_SCREEN_HELP"; trace.responseMode = "SCREEN_CONTEXT"; emit("EMMI_ANSWER_ROUTED");
      return { text: this.screenExplanation(context.currentScreen), trace };
    }
    if (HUMAN_SUPPORT.test(question)) {
      trace.intent = "HUMAN_SUPPORT"; trace.responseMode = "CONFIRMATION_REQUIRED"; emit("EMMI_ANSWER_ROUTED");
      return { text: pick(locale, { EN: "Would you like me to ask the ITERA care team to call you?", ES: "¿Desea que solicite al equipo de atención de ITERA que le llame?", KR: "Èske ou vle m mande ekip swen ITERA a rele ou?" }), pendingAction: "callback", trace };
    }
    // Where a refill stands is a runtime fact, never a guess: EMMI reads the episodes and says what
    // each one is actually waiting on.
    if (REFILL_STATUS_QUESTION.test(question)) {
      trace.intent = "REFILL_STATUS"; trace.responseMode = "RUNTIME_GROUNDED"; trace.toolCalls.push("getActiveRefills");
      try {
        const active = await this.executeTool("getActiveRefills", { patientId: context.patientId });
        trace.runtimeFactsUsed.push("getActiveRefills"); emit("EMMI_ANSWER_ROUTED");
        return { text: refillStatusAnswer(locale, active?.refills || []), trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "getActiveRefills", error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }
    // Running out of a medication opens the review that confirms it, rather than an answer about
    // medications in general.
    if (REFILL_NEED.test(question) && !MEDICATION_SAFETY.test(question)) {
      trace.intent = "MEDICATION_REFILL"; trace.responseMode = "REFILL_ENGINE"; trace.toolCalls.push("getMedicationSupply");
      try {
        const supply = await this.executeTool("getMedicationSupply", { patientId: context.patientId });
        const medications = supply?.medications || [];
        const named = medications.filter(medication => new RegExp(medication.name.split(" ")[0], "i").test(question));
        const lowFirst = [...medications].sort((a, b) => (a.estimatedDaysRemaining ?? 999) - (b.estimatedDaysRemaining ?? 999));
        const candidates = named.length ? named : lowFirst.filter(medication => medication.canEstimate && medication.estimatedDaysRemaining !== null && medication.estimatedDaysRemaining <= 14);
        // Ambiguity is answered with a question, never with a guess about which medication.
        if (candidates.length !== 1) {
          emit("EMMI_ANSWER_ROUTED", { medicationCandidates: candidates.length });
          return { text: refillSelectionAnswer(locale, medications), quickAction: "medication-refill", trace };
        }
        const opened = await this.executeTool("startRefillReview", { patientId: context.patientId, medicationId: candidates[0].medicationId });
        trace.toolCalls.push("startRefillReview"); emit("EMMI_ANSWER_ROUTED");
        if (opened?.alreadyRequested) return { text: refillAlreadyRequestedAnswer(locale, candidates[0].name, opened.patientStatus), quickAction: "medication-refill", medicationId: candidates[0].medicationId, trace };
        if (opened?.success) return { text: refillReviewAnswer(locale, candidates[0].name), quickAction: "medication-refill", medicationId: candidates[0].medicationId, trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool: "startRefillReview", error: error?.message || "unknown" }); }
      // Nothing was opened, so nothing is promised.
      return { text: pick(locale, {
        EN: "I couldn’t open your refill just now. You can open My Medications, or I can help you reach your care team.",
        ES: "No pude abrir su surtida ahora. Puede abrir Mis medicamentos o puedo ayudarle a comunicarse con su equipo.",
        KR: "Mwen pa t ka louvri ranplisaj ou kounye a. Ou ka louvri Medikaman mwen yo oswa mwen ka ede w jwenn ekip swen ou."
      }), trace };
    }
    // A patient describing something that is getting in their way is not asking a question. It is
    // told after the safety and medication checks above, so a symptom is never filed as a
    // difficulty, and it produces the same record the goal screen writes.
    if (DIFFICULTY.test(question)) {
      const classified = classifyBarrierText(question);
      if (classified.matched) {
        trace.intent = "GOAL_BARRIER"; trace.responseMode = "BARRIER_ENGINE"; trace.toolCalls.push("recordGoalBarrier");
        try {
          const recorded = await this.executeTool("recordGoalBarrier", { patientId: context.patientId, category: classified.category, patientDescription: clean(question) });
          emit("EMMI_ANSWER_ROUTED", { barrierCategory: classified.category });
          if (recorded?.success) return { text: barrierAcknowledgement(locale, classified.category, recorded.alreadyKnown), quickAction: "goal-barrier", barrierId: recorded.barrierId, barrierCategory: classified.category, trace };
        } catch (error) {
          emit("EMMI_TOOL_FAILED", { tool: "recordGoalBarrier", error: error?.message || "unknown" });
        }
        // Nothing was recorded, so nothing is claimed. The patient still gets a way forward.
        return { text: pick(locale, {
          EN: "Thank you for telling me. I couldn’t save that just now, but you can tell your care team, and I can help you reach them.",
          ES: "Gracias por contármelo. No pude guardarlo ahora, pero puede decírselo a su equipo de atención y puedo ayudarle a comunicarse con ellos.",
          KR: "Mèsi paske ou di m sa. Mwen pa t ka anrejistre l kounye a, men ou ka di ekip swen ou, epi mwen ka ede w jwenn yo."
        }), trace };
      }
    }

    let tool = "";
    if (COST.test(question)) tool = "getExpectedAccessCost";
    else if (ELIGIBILITY.test(question)) tool = "getEnrollmentContext";
    else if (MEDICATION_LIST.test(question)) tool = "getMedicationList";
    else if (DEVICE_STATUS.test(question)) tool = "getAssignedDevice";
    else if (LATEST_HEALTH_READING.test(question)) tool = "getLatestReading";
    else if (HEALTH_TREND.test(question)) tool = "getReadingTrend";
    else if (CLINICAL_TARGET.test(question)) tool = "getClinicalTarget";
    else if (GOAL_PROGRESS.test(question)) tool = "getGoalProgress";
    else if (GOAL_STATUS.test(question)) tool = "getPatientGoals";
    else if (DOCTOR_STATUS.test(question)) tool = "getCareTeam";
    else if (NEXT_STEP.test(question)) tool = "getNextBestAction";
    if (tool) {
      trace.intent = ({ getExpectedAccessCost: "COST_QUESTION", getEnrollmentContext: "ELIGIBILITY_QUESTION", getMedicationList: "MEDICATION_QUESTION", getAssignedDevice: "DEVICE_QUESTION", getLatestReading: "LATEST_READING", getReadingTrend: "READING_TREND", getClinicalTarget: "CLINICAL_TARGET", getGoalProgress: "GOAL_PROGRESS", getPatientGoals: "GOAL_QUESTION", getCareTeam: "CARE_TEAM_QUESTION", getNextBestAction: "NEXT_STEP" })[tool];
      trace.toolCalls.push(tool);
      try {
        const args = tool === "getExpectedAccessCost" ? { patientId: context.patientId, accessTrack: context.accessTrack }
          : ["getLatestReading", "getReadingTrend", "getClinicalTarget"].includes(tool) ? { patientId: context.patientId, metricType: "BLOOD_PRESSURE", ...(tool === "getReadingTrend" ? { periodDays: 7 } : {}) }
            : tool === "getGoalProgress" ? { patientId: context.patientId, goalId: context.activeGoal?.id || "" }
              : ["getEnrollmentContext", "getMedicationList", "getAssignedDevice", "getPatientGoals", "getCareTeam", "getNextBestAction"].includes(tool) ? { patientId: context.patientId } : {};
        const result = await this.executeTool(tool, args);
        trace.responseMode = "RUNTIME_GROUNDED"; trace.runtimeFactsUsed.push(tool); emit("EMMI_ANSWER_ROUTED");
        return { text: runtimeAnswer({ tool, result, locale, context }), trace };
      } catch (error) { emit("EMMI_TOOL_FAILED", { tool, error: error?.message || "unknown" }); return { text: retrievalUnavailable(locale), trace }; }
    }

    let retrieval;
    try {
      retrieval = await this.executeTool("searchKnowledge", { query: retrievalQuery });
      trace.intent = retrieval.intent || "UNKNOWN";
      trace.knowledgeChunkIds = (retrieval.passages || []).map(item => `${item.sourceId}#${item.heading}`);
    } catch (error) {
      emit("EMMI_RETRIEVAL_FAILED", { error: error?.message || "unknown" });
      return { text: retrievalUnavailable(locale), trace };
    }
    if (!(retrieval.passages || []).length) {
      emit("EMMI_EMPTY_GROUNDED_CONTEXT");
      return { text: unavailable(locale), trace };
    }
    try {
      const response = await this.fetch("/api/emmi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, retrievalQuery, locale, program: context.program || null, currentScreen: context.currentScreen || null, conversationSummary: conversation.conversationSummary || "" })
      });
      if (response.ok) {
        const generated = await response.json();
        if (clean(generated.text)) {
          Object.assign(trace, { intent: generated.intent || trace.intent, knowledgeChunkIds: generated.knowledgeChunkIds || trace.knowledgeChunkIds, responseMode: generated.responseMode || "KNOWLEDGE_GROUNDED", modelVersion: generated.modelVersion || "" });
          emit("EMMI_ANSWER_ROUTED");
          return { text: clean(generated.text), trace };
        }
      }
      emit("EMMI_RESPONSE_GENERATION_FAILED", { status: response.status });
    } catch (error) { emit("EMMI_RESPONSE_GENERATION_FAILED", { error: error?.message || "unknown" }); }
    trace.responseMode = "DETERMINISTIC_GROUNDED_FALLBACK";
    trace.modelVersion = "deterministic-grounded-v1";
    const text = fallbackKnowledgeAnswer({ question: retrievalQuery, retrieval, locale, program: context.program });
    emit("EMMI_ANSWER_ROUTED");
    return { text, trace };
  }
}
