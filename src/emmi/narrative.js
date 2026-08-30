import { semanticSpeechSegments } from "./transitionManager.js";

// EMMI Narrative Engine.
//
// EMMI does not read the screen — it gives meaning to the screen. Every narration is built
// from an objective (purpose / benefit / reassurance / action) rather than from the visible
// copy, so the patient hears what this step is, why it matters, how it can help, what to do,
// and that they stay in control.
//
// Voice and text render the same objective: there is no separate voice script. Dynamic facts
// (medication counts, device vendor, physician, cost) are only spoken when runtime supplies
// them — never invented.
//
// Each language is authored natively rather than translated mechanically, so the Spanish and
// Kreyòl narrations read naturally for an older adult instead of sounding converted.

const T = (en, es, ht) => Object.freeze({ en, es, ht });

// Narration length is matched to the weight of the screen, not to one global limit.
export const NARRATION_SECONDS = Object.freeze({
  PROGRAM_INTRODUCTION: [12, 22],
  CONCEPTUAL: [15, 25],
  SIMPLE_TASK: [7, 15],
  TRANSITION: [15, 20]
});

const objective = ({ summary, purpose, benefit, reassurance, action, tone = "reassuring", risk = "low", length = "CONCEPTUAL", dynamic = [] }) =>
  Object.freeze({ summary, purpose, benefit, reassurance, action, tone, risk, length, dynamic });

// One narration per screen, authored as a whole so each language flows naturally.
// `dynamic` lists the runtime fields the narration may reference when they are available.
export const NARRATIVE_OBJECTIVES = Object.freeze({
  DECISION_MAKER: objective({
    summary: T(
      "We’ll help you choose who should complete this process.",
      "Le ayudaremos a elegir quién debe completar este proceso.",
      "N ap ede w chwazi ki moun ki dwe ranpli pwosesis sa a."
    ),
    length: "CONCEPTUAL",
    purpose: T(
      "Before we continue, we just need to know who is filling this out today.",
      "Antes de continuar, solo necesitamos saber quién está completando esto hoy.",
      "Anvan nou kontinye, nou jis bezwen konnen ki moun k ap ranpli sa a jodi a."
    ),
    benefit: T(
      "Knowing this lets us set up the rest of the experience correctly for you.",
      "Saberlo nos permite preparar correctamente el resto de la experiencia para usted.",
      "Lè nou konnen sa, nou ka prepare rès eksperyans lan kòrèkteman pou ou."
    ),
    reassurance: T(
      "If someone is simply helping you, you still make the decisions about your care.",
      "Si alguien solo le está ayudando, usted sigue tomando las decisiones sobre su cuidado.",
      "Si yon moun ap senpleman ede w, se ou menm ki toujou pran desizyon sou swen ou."
    ),
    action: T(
      "Choose the option that describes you: for yourself, someone helping you, or a personal representative authorized to make healthcare decisions.",
      "Elija la opción que le describe: para usted mismo, alguien que le ayuda, o un representante personal autorizado para tomar decisiones médicas.",
      "Chwazi opsyon ki dekri ou: pou tèt ou, yon moun k ap ede w, oswa yon reprezantan pèsonèl ki otorize pou pran desizyon swen sante."
    )
  }),

  PERSONAL_REPRESENTATIVE_DETAILS: objective({
    summary: T(
      "This is for someone authorized to decide for the patient.",
      "Esto es para alguien autorizado a decidir por el paciente.",
      "Sa a se pou yon moun ki otorize pou deside pou pasyan an."
    ),
    risk: "medium",
    purpose: T(
      "A personal representative is different from someone who is simply helping today.",
      "Un representante personal es diferente de alguien que solo está ayudando hoy.",
      "Yon reprezantan pèsonèl diferan de yon moun k ap senpleman ede jodi a."
    ),
    benefit: T(
      "This option is for someone authorized to make healthcare decisions for the patient, so we ask for a few details about that person.",
      "Esta opción es para alguien autorizado a tomar decisiones médicas por el paciente, por eso pedimos algunos datos sobre esa persona.",
      "Opsyon sa a se pou yon moun ki otorize pou pran desizyon swen sante pou pasyan an, se sa k fè nou mande kèk detay sou moun sa a."
    ),
    reassurance: T(
      "We will explain each step, and you can ask me anything before continuing.",
      "Le explicaremos cada paso y puede preguntarme lo que necesite antes de continuar.",
      "N ap eksplike chak etap, epi ou ka mande m nenpòt bagay anvan ou kontinye."
    ),
    action: T(
      "Enter the representative's information to continue.",
      "Ingrese la información del representante para continuar.",
      "Antre enfòmasyon reprezantan an pou kontinye."
    )
  }),

  IDENTITY_VERIFICATION: objective({
    summary: T(
      "This verification helps protect your information.",
      "Esta verificación ayuda a proteger su información.",
      "Verifikasyon sa a ede pwoteje enfòmasyon ou."
    ),
    length: "SIMPLE_TASK",
    purpose: T(
      "This is a quick identity check so we know we are working with the right record.",
      "Esta es una verificación rápida de identidad para asegurarnos de trabajar con el registro correcto.",
      "Sa a se yon ti verifikasyon idantite pou nou konnen n ap travay ak bon dosye a."
    ),
    benefit: T(
      "It helps protect your health information.",
      "Ayuda a proteger su información de salud.",
      "Li ede pwoteje enfòmasyon sante ou."
    ),
    reassurance: T(
      "This check does not change your Medicare benefits and does not enroll you in anything by itself.",
      "Esta verificación no cambia sus beneficios de Medicare ni le inscribe en nada por sí sola.",
      "Verifikasyon sa a pa chanje benefis Medicare ou epi li pa enskri w nan anyen poukont li."
    ),
    action: T(
      "Enter your date of birth and ZIP code.",
      "Ingrese su fecha de nacimiento y su código postal.",
      "Antre dat nesans ou ak kòd postal ou."
    )
  }),

  CARE_RECOMMENDATION: objective({
    summary: T(
      "Here is the support available between doctor visits.",
      "Este es el apoyo disponible entre visitas al médico.",
      "Men sipò ki disponib ant vizit kay doktè."
    ),
    purpose: T(
      "Here you can see the kind of support your care team can provide between doctor visits.",
      "Aquí puede ver el tipo de apoyo que su equipo de cuidado puede brindarle entre visitas al médico.",
      "Isit la ou ka wè kalite sipò ekip swen ou ka ba ou ant vizit kay doktè."
    ),
    benefit: T(
      "Your care team can check in with you, help you stay on track with your plan, and keep important information connected with the doctors you already see.",
      "Su equipo puede comunicarse con usted, ayudarle a seguir su plan y mantener la información importante conectada con los médicos que ya consulta.",
      "Ekip swen ou ka pran nouvèl ou, ede w suiv plan ou, epi kenbe enfòmasyon enpòtan konekte ak doktè ou deja wè yo."
    ),
    reassurance: T(
      "Nothing is decided yet, and you can ask me about anything here.",
      "Todavía no se ha decidido nada y puede preguntarme sobre cualquier cosa aquí.",
      "Anyen poko deside, epi ou ka mande m sou nenpòt bagay isit la."
    ),
    action: T(
      "Take a look, and continue when you are ready.",
      "Échele un vistazo y continúe cuando esté listo.",
      "Gade yon ti kras, epi kontinye lè ou pare."
    )
  }),

  ACCESS_PRE_ELIGIBILITY_NOTICE: objective({
    summary: T(
      "This check does not change your Medicare benefits.",
      "Esta verificación no cambia sus beneficios de Medicare.",
      "Verifikasyon sa a pa chanje benefis Medicare ou."
    ),
    risk: "medium",
    purpose: T(
      "This quick Medicare check tells us whether this care option is available to you.",
      "Esta breve verificación de Medicare nos indica si esta opción de cuidado está disponible para usted.",
      "Ti verifikasyon Medicare sa a di nou si opsyon swen sa a disponib pou ou."
    ),
    benefit: T(
      "It saves you from going through steps that may not apply to you.",
      "Le evita seguir pasos que quizá no le corresponden.",
      "Li anpeche w fè etap ki ka pa aplike pou ou."
    ),
    reassurance: T(
      "It does not change your Medicare benefits or coverage, and being eligible does not mean you are enrolled — you will still review the important details before deciding.",
      "No cambia sus beneficios ni su cobertura de Medicare, y ser elegible no significa estar inscrito: usted revisará los detalles importantes antes de decidir.",
      "Li pa chanje benefis ni kouvèti Medicare ou, epi si ou kalifye sa pa vle di ou enskri — w ap toujou revize detay enpòtan yo anvan ou deside."
    ),
    action: T(
      "Review the notice and confirm when you are ready for us to check.",
      "Revise el aviso y confirme cuando esté listo para que verifiquemos.",
      "Revize avi a epi konfime lè ou pare pou nou verifye."
    )
  }),

  ACCESS_ELIGIBILITY_RESULT: objective({
    summary: T(
      "Being eligible does not mean you are enrolled yet.",
      "Ser elegible no significa que ya esté inscrito.",
      "Si ou kalifye sa pa vle di ou deja enskri."
    ),
    risk: "high",
    purpose: T(
      "This is the result of the Medicare check.",
      "Este es el resultado de la verificación de Medicare.",
      "Sa a se rezilta verifikasyon Medicare a."
    ),
    benefit: T(
      "It tells you whether this care option is available to you right now.",
      "Le indica si esta opción de cuidado está disponible para usted en este momento.",
      "Li di w si opsyon swen sa a disponib pou ou kounye a."
    ),
    reassurance: T(
      "Your enrollment is not complete yet, and your Medicare benefits are unchanged either way.",
      "Su inscripción aún no está completa y sus beneficios de Medicare no cambian en ningún caso.",
      "Enskripsyon ou poko fini, epi benefis Medicare ou pa chanje nan tou de ka yo."
    ),
    action: T(
      "I will guide you through the steps that come next.",
      "Le guiaré por los pasos que siguen.",
      "M ap gide w nan etap ki vin apre yo."
    )
  }),

  DISCLOSURE: objective({
    summary: T(
      "The key details to know before you decide.",
      "Los detalles clave que debe conocer antes de decidir.",
      "Detay kle pou konnen anvan ou deside."
    ),
    risk: "medium",
    purpose: T(
      "This page highlights the most important things to know before you decide.",
      "Esta página resume lo más importante que debe saber antes de decidir.",
      "Paj sa a make bagay ki pi enpòtan pou w konnen anvan ou deside."
    ),
    benefit: T(
      "It covers your choice to participate, any expected cost, and how the program works.",
      "Cubre su decisión de participar, el costo esperado y cómo funciona el programa.",
      "Li kouvri chwa ou pou patisipe, nenpòt depans ou prevwa, ak kijan pwogram nan mache."
    ),
    reassurance: T(
      "Take your time. If anything is unclear, you can ask me before continuing.",
      "Tómese su tiempo. Si algo no está claro, puede preguntarme antes de continuar.",
      "Pran tan ou. Si yon bagay pa klè, ou ka mande m anvan ou kontinye."
    ),
    action: T(
      "Read through each point and confirm that you have reviewed it.",
      "Lea cada punto y confirme que lo ha revisado.",
      "Li chak pwen epi konfime ou revize yo."
    )
  }),

  CONSENT_REVIEW: objective({
    summary: T(
      "Enrolling is your choice. Take your time here.",
      "Inscribirse es su decisión. Tómese su tiempo aquí.",
      "Enskri se chwa ou. Pran tan ou isit la."
    ),
    risk: "high",
    purpose: T(
      "You are at the final decision step.",
      "Está en el paso final de la decisión.",
      "Ou nan dènye etap desizyon an."
    ),
    benefit: T(
      "Everything that matters for your decision is gathered here, including the expected cost and your rights.",
      "Todo lo importante para su decisión está reunido aquí, incluido el costo esperado y sus derechos.",
      "Tout sa ki enpòtan pou desizyon ou rasanble isit la, ansanm ak depans ou prevwa a ak dwa ou yo."
    ),
    reassurance: T(
      "Enrolling is your choice, and you can ask me questions before you decide.",
      "Inscribirse es su decisión, y puede hacerme preguntas antes de decidir.",
      "Enskri se chwa ou, epi ou ka poze m kesyon anvan ou deside."
    ),
    action: T(
      "Review the information, and if you decide to go ahead, use the checkboxes and continue.",
      "Revise la información y, si decide continuar, marque las casillas y siga adelante.",
      "Revize enfòmasyon an, epi si ou deside kontinye, tcheke kaz yo epi ale pi devan."
    )
  }),

  ENROLLMENT_CONFIRMED: objective({
    summary: T(
      "Your enrollment is complete. Here is what comes next.",
      "Su inscripción está completa. Esto es lo que sigue.",
      "Enskripsyon ou fini. Men sa k ap vini apre."
    ),
    tone: "celebratory",
    length: "TRANSITION",
    dynamic: ["nextStepLabel", "estimatedDuration"],
    purpose: T(
      "You did it — your enrollment is complete.",
      "Lo logró: su inscripción está completa.",
      "Ou fè l — enskripsyon ou fini."
    ),
    benefit: T(
      "You now have ongoing support from your ITERA care team.",
      "Ahora cuenta con el apoyo continuo de su equipo de cuidado de ITERA.",
      "Kounye a ou gen sipò kontinyèl ekip swen ITERA ou."
    ),
    reassurance: T(
      "You can continue now or come back when you are ready.",
      "Puede continuar ahora o volver cuando esté listo.",
      "Ou ka kontinye kounye a oswa retounen lè ou pare."
    ),
    action: T(
      "The next step helps us understand your health a little better so we can personalize your care.",
      "El siguiente paso nos ayuda a conocer mejor su salud para poder personalizar su cuidado.",
      "Pwochen etap la ede nou konprann sante ou yon ti kras pi byen pou nou ka pèsonalize swen ou."
    )
  }),

  CLINICAL_VERIFICATION: objective({
    summary: T(
      "Check the health information we have on file.",
      "Revise la información de salud que tenemos registrada.",
      "Tcheke enfòmasyon sante nou genyen nan dosye a."
    ),
    purpose: T(
      "Here we are checking the health information we already have on file for you.",
      "Aquí estamos revisando la información de salud que ya tenemos registrada.",
      "Isit la n ap tcheke enfòmasyon sante nou deja genyen nan dosye ou."
    ),
    benefit: T(
      "Your answers help your care team keep your information accurate.",
      "Sus respuestas ayudan a su equipo a mantener su información correcta.",
      "Repons ou yo ede ekip swen ou kenbe enfòmasyon ou kòrèk."
    ),
    reassurance: T(
      "If you are not sure about something, that is okay — you can ask for help.",
      "Si no está seguro de algo, está bien: puede pedir ayuda.",
      "Si ou pa sèten sou yon bagay, sa pa grav — ou ka mande èd."
    ),
    action: T(
      "Confirm if everything looks right, or tell us what changed.",
      "Confirme si todo está correcto, o díganos qué cambió.",
      "Konfime si tout bagay sanble kòrèk, oswa di nou kisa ki chanje."
    )
  }),

  MEDICATIONS_REVIEW: objective({
    summary: T(
      "Review what you’re currently taking.",
      "Revise los medicamentos que está tomando actualmente.",
      "Revize medikaman w ap pran kounye a."
    ),
    risk: "high",
    dynamic: ["medicationCount"],
    purpose: T(
      "Keeping your medication list up to date helps your care team understand what you are actually taking today.",
      "Mantener su lista de medicamentos al día ayuda a su equipo a saber qué está tomando realmente hoy.",
      "Kenbe lis medikaman ou ajou ede ekip swen ou konprann kisa ou reyèlman ap pran jodi a."
    ),
    benefit: T(
      "An accurate list helps your care team coordinate your care more safely.",
      "Una lista precisa ayuda a su equipo a coordinar su cuidado con más seguridad.",
      "Yon lis egzak ede ekip swen ou kowòdone swen ou pi an sekirite."
    ),
    reassurance: T(
      "You do not need to remember everything perfectly, and nothing here is telling you to start or stop a medicine.",
      "No necesita recordarlo todo a la perfección, y nada aquí le indica empezar o dejar un medicamento.",
      "Ou pa bezwen sonje tout bagay pafètman, epi anyen isit la pa di w kòmanse oswa sispann yon medikaman."
    ),
    action: T(
      "Review each medicine and tell us whether you still take it, whether something changed, or if you are not sure.",
      "Revise cada medicamento y díganos si aún lo toma, si algo cambió, o si no está seguro.",
      "Revize chak medikaman epi di nou si w ap toujou pran l, si yon bagay chanje, oswa si ou pa sèten."
    )
  }),

  CARE_PREFERENCES: objective({
    summary: T(
      "Tell us how you prefer to be contacted.",
      "Díganos cómo prefiere que le contactemos.",
      "Di nou kijan ou prefere nou kontakte w."
    ),
    length: "SIMPLE_TASK",
    purpose: T(
      "These questions help us understand how you prefer to be contacted and supported.",
      "Estas preguntas nos ayudan a saber cómo prefiere que le contactemos y le apoyemos.",
      "Kesyon sa yo ede nou konprann kijan ou prefere nou kontakte w epi sipòte w."
    ),
    benefit: T(
      "Choosing what works best for you makes it easier for your care team to reach you in a way that fits your routine.",
      "Elegir lo que mejor le funcione facilita que su equipo le contacte de una forma que se ajuste a su rutina.",
      "Chwazi sa ki pi bon pou ou fè li pi fasil pou ekip swen ou jwenn ou yon fason ki adapte ak woutin ou."
    ),
    reassurance: T(
      "You can change these later.",
      "Puede cambiarlas más adelante.",
      "Ou ka chanje yo pita."
    ),
    action: T(
      "Choose the options that fit you best.",
      "Elija las opciones que mejor se ajusten a usted.",
      "Chwazi opsyon ki pi bon pou ou."
    )
  }),

  GOALS: objective({
    summary: T(
      "Choose what matters most to you.",
      "Elija las metas que más le importan.",
      "Chwazi sa ki pi enpòtan pou ou."
    ),
    tone: "encouraging",
    purpose: T(
      "Your care team has identified goals that may support your care. This part helps you choose what matters to you.",
      "Su equipo de atención identificó metas que pueden apoyar su cuidado. Esta parte le ayuda a elegir lo que es importante para usted.",
      "Ekip swen ou idantifye objektif ki ka sipòte swen ou. Pati sa a ede w chwazi sa ki enpòtan pou ou."
    ),
    benefit: T(
      "Your care is not only about medical numbers — it should also support the things you want to keep doing in your life, like staying active, keeping your blood pressure under control, or remaining independent.",
      "Su cuidado no se trata solo de cifras médicas: también debe apoyar lo que usted quiere seguir haciendo en su vida, como mantenerse activo, controlar su presión arterial o seguir siendo independiente.",
      "Swen ou pa sèlman sou chif medikal — li ta dwe sipòte tou bagay ou vle kontinye fè nan lavi ou, tankou rete aktif, kontwole tansyon ou, oswa rete endepandan."
    ),
    reassurance: T(
      "You can change them later and personalize how you work toward them. Your care team remains responsible for clinical targets and treatment decisions.",
      "Puede cambiarlas después y personalizar cómo trabajar en ellas. Su equipo de atención sigue siendo responsable de los objetivos clínicos y las decisiones de tratamiento.",
      "Ou ka chanje yo pita epi pèsonalize kijan ou travay sou yo. Ekip swen ou rete responsab sib klinik yo ak desizyon tretman yo."
    ),
    action: T(
      "Choose the goals that matter most to you.",
      "Elija los objetivos que más le importan.",
      "Chwazi objektif ki pi enpòtan pou ou."
    )
  }),

  MY_GOALS: objective({
    summary: T("Your goals and progress are here in one place.", "Sus metas y su progreso están aquí en un solo lugar.", "Objektif ou ak pwogrè ou la nan yon sèl kote."),
    tone: "encouraging",
    purpose: T("This area helps you keep working toward the personal goals you chose.", "Esta sección le ayuda a seguir avanzando hacia las metas personales que eligió.", "Zòn sa a ede w kontinye travay sou objektif pèsonèl ou chwazi yo."),
    benefit: T("You can review your plan, record progress, and ask your care team for support when something gets in the way.", "Puede revisar su plan, registrar su progreso y pedir apoyo a su equipo cuando algo se lo dificulte.", "Ou ka revize plan ou, anrejistre pwogrè ou, epi mande ekip swen ou sipò lè yon bagay anpeche w."),
    reassurance: T("These are your personal goals. They do not change clinical targets or medical orders, and you can adjust them later.", "Estas son sus metas personales. No cambian objetivos clínicos ni indicaciones médicas y puede ajustarlas después.", "Sa yo se objektif pèsonèl ou. Yo pa chanje sib klinik ni lòd medikal, epi ou ka ajiste yo pita."),
    action: T("Choose a goal to view it or add another goal when you are ready.", "Elija una meta para verla o agregue otra cuando esté listo.", "Chwazi yon objektif pou gade li oswa ajoute yon lòt lè ou pare.")
  }),

  ACCESS_GOALS: objective({
    summary: T("These goals are already part of your ACCESS care.", "Estas metas ya forman parte de su cuidado ACCESS.", "Objektif sa yo deja fè pati swen ACCESS ou."),
    tone: "reassuring",
    purpose: T(
      "These are the health goals your ACCESS care already includes. You are not choosing them here — this screen explains what they are.",
      "Estas son las metas de salud que su cuidado ACCESS ya incluye. Aquí no las elige: esta pantalla le explica cuáles son.",
      "Sa yo se objektif sante swen ACCESS ou deja genyen. Ou pa chwazi yo isit la — ekran sa a eksplike kisa yo ye."
    ),
    benefit: T(
      "Each one shows where you are starting and how ACCESS measures progress, so you can see what your care is working toward.",
      "Cada una muestra su punto de partida y cómo ACCESS mide el progreso, para que vea hacia dónde va su cuidado.",
      "Chak youn montre kote ou kòmanse ak kijan ACCESS mezire pwogrè, pou ou wè sa swen ou ap chèche."
    ),
    reassurance: T(
      "ACCESS assigns these goals as part of your care. Your care team stays responsible for clinical targets and treatment decisions.",
      "ACCESS asigna estas metas como parte de su cuidado. Su equipo sigue siendo responsable de los objetivos clínicos y las decisiones de tratamiento.",
      "ACCESS bay objektif sa yo kòm pati nan swen ou. Ekip swen ou rete responsab sib klinik yo ak desizyon tretman yo."
    ),
    action: T("Open a goal to see how progress is measured, then continue.", "Abra una meta para ver cómo se mide el progreso y continúe.", "Louvri yon objektif pou wè kijan yo mezire pwogrè, epi kontinye.")
  }),

  ACCESS_BP_DEVICE_INFO: objective({
    summary: T("We are arranging your connected blood pressure monitor.", "Estamos gestionando su monitor de presión conectado.", "N ap fè aranjman pou aparèy tansyon konekte ou."),
    tone: "reassuring",
    purpose: T(
      "This step arranges the connected monitor your ACCESS care uses. You only need to choose the cuff size that fits you.",
      "Este paso gestiona el monitor conectado que usa su cuidado ACCESS. Solo necesita elegir la talla de brazalete que le queda.",
      "Etap sa a fè aranjman pou aparèy konekte swen ACCESS ou itilize a. Ou sèlman bezwen chwazi gwosè manchèt ki bon pou ou."
    ),
    benefit: T(
      "Your readings reach your care team on their own, so they can see how you are doing between visits without you sending anything.",
      "Sus mediciones llegan solas a su equipo, así ven cómo está entre visitas sin que usted envíe nada.",
      "Mezi ou yo rive nan men ekip swen ou poukont yo, konsa yo wè kijan w ap ale ant vizit yo san ou pa voye anyen."
    ),
    reassurance: T(
      "Nothing is ordered until you confirm the address on the next step, and we will not say it has shipped until it has.",
      "No se solicita nada hasta que confirme la dirección en el paso siguiente, y no diremos que fue enviado hasta que lo esté.",
      "Anyen pa kòmande jiskaske ou konfime adrès la nan pwochen etap la, epi nou p ap di li voye jiskaske li voye."
    ),
    action: T("Measure around your upper arm and choose the size that matches.", "Mida alrededor de la parte superior de su brazo y elija la talla que corresponda.", "Mezire otou pati anwo bra ou epi chwazi gwosè ki koresponn.")
  }),

  // Two screens of the care activation flow had no objective at all, so buildNarration returned null
  // and EMMI simply went quiet between the monitor and the goals — the middle of a flow she narrates
  // on both sides. A patient with voice guidance on heard nothing while confirming where their
  // monitor is delivered, which is the step that actually commits the request.
  ACCESS_BP_SHIPPING_ADDRESS: objective({
    summary: T("This is where your monitor will be delivered.", "Aquí es donde se entregará su monitor.", "Se la y ap livre aparèy ou a."),
    tone: "reassuring",
    purpose: T(
      "This step confirms where your monitor should be delivered. It is the step that actually places the request.",
      "Este paso confirma dónde debe entregarse su monitor. Es el paso que realmente hace la solicitud.",
      "Etap sa a konfime kote pou yo livre aparèy ou a. Se etap ki fè demann nan tout bon."
    ),
    benefit: T(
      "Getting the address right is what makes sure the monitor reaches you rather than an old address on file.",
      "Acertar la dirección es lo que asegura que el monitor le llegue a usted y no a una dirección antigua en el registro.",
      "Bay bon adrès la se sa ki fè aparèy la rive jwenn ou olye yon ansyen adrès nan dosye a."
    ),
    reassurance: T(
      "You can send it somewhere else if the address shown is not where you want it. Nothing is requested until you confirm.",
      "Puede enviarlo a otro lugar si la dirección que aparece no es donde lo quiere. No se solicita nada hasta que usted confirme.",
      "Ou ka voye l yon lòt kote si adrès ki parèt la se pa kote ou vle l. Anyen pa mande jiskaske ou konfime."
    ),
    action: T("Check the address, then request your monitor.", "Revise la dirección y luego solicite su monitor.", "Tcheke adrès la, apre sa mande aparèy ou a.")
  }),

  ACCESS_BP_FULFILLMENT_CONFIRMED: objective({
    summary: T("Your monitor has been requested.", "Su monitor ha sido solicitado.", "Yo mande aparèy ou a."),
    tone: "reassuring",
    purpose: T(
      "Your request is in. This screen shows what was recorded: the request itself, the cuff size and the address you confirmed.",
      "Su solicitud está hecha. Esta pantalla muestra lo que quedó registrado: la solicitud, la talla de brazalete y la dirección que confirmó.",
      "Demann ou an fèt. Ekran sa a montre sa yo anrejistre: demann nan, gwosè manchèt la ak adrès ou konfime a."
    ),
    benefit: T(
      "You do not have to wait here. Your care continues while the monitor is prepared.",
      "No tiene que esperar aquí. Su cuidado continúa mientras se prepara el monitor.",
      "Ou pa bezwen tann isit la. Swen ou kontinye pandan y ap prepare aparèy la."
    ),
    reassurance: T(
      "We will not tell you it has shipped until it has. If anything about the request needs checking, your care team can help.",
      "No le diremos que fue enviado hasta que lo esté. Si algo de la solicitud necesita revisarse, su equipo de cuidado puede ayudarle.",
      "Nou p ap di ou li voye jiskaske li voye. Si gen yon bagay nan demann nan ki bezwen tcheke, ekip swen ou ka ede ou."
    ),
    action: T("Continue to see the health goals your ACCESS care assigned you.", "Continúe para ver los objetivos de salud que le asignó su cuidado ACCESS.", "Kontinye pou wè objektif sante swen ACCESS ou ba ou yo.")
  }),

  ACCESS_SUPPORT_NEEDS: objective({
    summary: T("Your care plan is already in place. We are checking what might make it harder.", "Su plan de cuidado ya está activo. Estamos viendo qué podría dificultarlo.", "Plan swen ou deja anplas. N ap gade sa ki ka fè l pi difisil."),
    tone: "reassuring",
    purpose: T(
      "Your ACCESS care plan already exists. This asks whether anything could make it harder to follow, so we can add the right support.",
      "Su plan de cuidado ACCESS ya existe. Esto pregunta si algo podría dificultar seguirlo, para agregar el apoyo adecuado.",
      "Plan swen ACCESS ou deja egziste. Sa a mande si gen yon bagay ki ka fè l pi difisil pou swiv, pou nou ka ajoute bon sipò a."
    ),
    benefit: T(
      "What you tell us here changes the support you get — reminders, help with your monitor, or a follow-up from your care team.",
      "Lo que nos diga aquí cambia el apoyo que recibe: recordatorios, ayuda con su monitor o un seguimiento de su equipo.",
      "Sa ou di nou isit la chanje sipò ou resevwa — rapèl, èd ak aparèy ou, oswa yon swivi nan men ekip swen ou."
    ),
    reassurance: T(
      "Nothing here changes your goals or your medical instructions, and saying nothing is in the way is a complete answer.",
      "Nada de esto cambia sus metas ni sus indicaciones médicas, y decir que nada le dificulta es una respuesta completa.",
      "Anyen isit la pa chanje objektif ou oswa enstriksyon medikal ou, epi di anyen pa anpeche w se yon repons konplè."
    ),
    action: T("Choose anything that applies, or say nothing is in the way right now.", "Elija lo que corresponda, o diga que nada le dificulta ahora.", "Chwazi sa ki aplike, oswa di anyen pa anpeche w kounye a.")
  }),

  ACCESS_ONBOARDING_COMPLETE: objective({
    summary: T("Your ACCESS care is active.", "Su cuidado ACCESS está activo.", "Swen ACCESS ou aktif."),
    tone: "encouraging",
    purpose: T(
      "Everything is in place: your goals, your care plan, the monitor being arranged, and any support we added.",
      "Todo está listo: sus metas, su plan de cuidado, el monitor que se está gestionando y el apoyo que agregamos.",
      "Tout bagay anplas: objektif ou yo, plan swen ou, aparèy k ap prepare a, ak sipò nou ajoute."
    ),
    benefit: T(
      "My Care is where you manage all of it from now on, and I stay available there whenever you have a question.",
      "Mi cuidado es donde gestiona todo a partir de ahora, y yo sigo disponible allí cuando tenga una pregunta.",
      "Swen mwen se kote ou jere tout bagay depi kounye a, epi mwen rete disponib la lè ou gen yon kesyon."
    ),
    reassurance: T(
      "Your care plan was already active before this step. Nothing you did here created it.",
      "Su plan de cuidado ya estaba activo antes de este paso. Nada de lo que hizo aquí lo creó.",
      "Plan swen ou te deja aktif anvan etap sa a. Anyen ou fè isit la pa t kreye l."
    ),
    action: T("Go to My Care when you are ready.", "Vaya a Mi cuidado cuando esté listo.", "Ale nan Swen mwen lè ou pare.")
  }),

  RPM_DEVICE_PATH: objective({
    summary: T(
      "We’ll help you get your monitor ready.",
      "Le ayudaremos a preparar su monitor.",
      "N ap ede w prepare monitè ou."
    ),
    dynamic: ["deviceVendor"],
    purpose: T(
      "A connected monitor lets your care team receive readings from home between visits.",
      "Un monitor conectado permite que su equipo reciba mediciones desde su casa entre visitas.",
      "Yon monitè konekte pèmèt ekip swen ou resevwa mezi lakay ou ant vizit yo."
    ),
    benefit: T(
      "Instead of waiting until your next office visit, your care team can see how things are going and respond earlier when something needs attention.",
      "En lugar de esperar a su próxima consulta, su equipo puede ver cómo va todo y responder antes si algo necesita atención.",
      "Olye pou n tann pwochen vizit ou, ekip swen ou ka wè kijan bagay yo ap mache epi reyaji pi bonè lè yon bagay bezwen atansyon."
    ),
    reassurance: T(
      "We will help you get the right monitor connected and show you what to do — you do not need to figure out the technology on your own.",
      "Le ayudaremos a conectar el monitor adecuado y le mostraremos qué hacer: no tiene que resolver la tecnología por su cuenta.",
      "N ap ede w konekte bon monitè a epi montre w kisa pou fè — ou pa bezwen konprann teknoloji a poukont ou."
    ),
    action: T(
      "Let us know whether you already have a monitor or need one from ITERA.",
      "Díganos si ya tiene un monitor o si necesita uno de ITERA.",
      "Fè nou konnen si ou deja gen yon monitè oswa si ou bezwen youn nan men ITERA."
    )
  }),

  ACCESS_BP_DEVICE_RESULT: objective({
    summary: T(
      "Confirm this is the monitor you have with you.",
      "Confirme que este es el monitor que tiene con usted.",
      "Konfime se monitè sa a ou genyen avèk ou."
    ),
    dynamic: ["deviceVendor"],
    purpose: T(
      "We found the monitor assigned to your care.",
      "Encontramos el monitor asignado a su cuidado.",
      "Nou jwenn monitè ki asiyen pou swen ou."
    ),
    benefit: T(
      "Confirming it now means your readings will reach your care team correctly.",
      "Confirmarlo ahora asegura que sus mediciones lleguen correctamente a su equipo.",
      "Konfime l kounye a vle di mezi ou yo ap rive kòrèkteman jwenn ekip swen ou."
    ),
    reassurance: T(
      "If it is not the monitor you have with you, tell us and we will help sort it out.",
      "Si no es el monitor que tiene con usted, díganos y le ayudaremos a resolverlo.",
      "Si se pa monitè ou genyen avèk ou a, di nou epi n ap ede w rezoud sa."
    ),
    action: T(
      "Confirm whether this is the monitor you have.",
      "Confirme si este es el monitor que tiene.",
      "Konfime si se monitè sa a ou genyen."
    )
  }),

  ACCESS_BP_GUIDED_SETUP: objective({
    summary: T(
      "We’ll get your monitor ready, one step at a time.",
      "Prepararemos su monitor, un paso a la vez.",
      "N ap prepare monitè ou, yon etap alafwa."
    ),
    length: "SIMPLE_TASK",
    purpose: T(
      "Let us get your monitor ready to take a reading.",
      "Vamos a preparar su monitor para tomar una medición.",
      "Ann pare monitè ou pou pran yon mezi."
    ),
    benefit: T(
      "A good setup is what makes the reading accurate and lets it reach your care team.",
      "Una buena preparación es lo que hace que la medición sea precisa y llegue a su equipo.",
      "Yon bon preparasyon se sa ki fè mezi a egzak epi ki pèmèt li rive jwenn ekip swen ou."
    ),
    reassurance: T(
      "Take your time — I will go one step at a time and you can ask me to repeat anything.",
      "Tómese su tiempo: iré paso a paso y puede pedirme que repita lo que necesite.",
      "Pran tan ou — m ap ale yon etap alafwa epi ou ka mande m repete nenpòt bagay."
    ),
    action: T(
      "Sit comfortably with your arm supported, and place the cuff on your bare upper arm.",
      "Siéntese cómodamente con el brazo apoyado y coloque el brazalete en la parte superior del brazo descubierto.",
      "Chita alèz ak bra ou apiye, epi mete manchèt la sou pati anwo bra ou san rad."
    )
  }),

  ACCESS_BP_MEASUREMENT: objective({
    summary: T(
      "This first reading confirms your monitor is connected.",
      "Esta primera medición confirma que su monitor está conectado.",
      "Premye mezi sa a konfime monitè ou konekte."
    ),
    risk: "medium",
    purpose: T(
      "This first reading confirms that your monitor can send information to ITERA.",
      "Esta primera medición confirma que su monitor puede enviar información a ITERA.",
      "Premye mezi sa a konfime ke monitè ou ka voye enfòmasyon bay ITERA."
    ),
    benefit: T(
      "It also begins building your starting blood pressure picture, which your care team uses to personalize your support.",
      "También comienza a formar su panorama inicial de presión arterial, que su equipo usa para personalizar su apoyo.",
      "Li kòmanse tou bati premye pòtrè tansyon ou, ke ekip swen ou itilize pou pèsonalize sipò ou."
    ),
    reassurance: T(
      "You do not need to take all of your starting readings at once — we keep track as more come in.",
      "No necesita tomar todas sus mediciones iniciales de una vez: llevamos el registro a medida que llegan.",
      "Ou pa bezwen pran tout premye mezi ou yo yon sèl kou — n ap swiv yo pandan lòt yo ap rive."
    ),
    action: T(
      "Start the reading when you are ready and stay still while it works.",
      "Inicie la medición cuando esté listo y quédese quieto mientras funciona.",
      "Kòmanse mezi a lè ou pare epi rete trankil pandan l ap travay."
    )
  }),

  CARE_CIRCLE_INVITE: objective({
    summary: T(
      "You stay in control of your care.",
      "Usted mantiene el control de su cuidado.",
      "Se ou ki gen kontwòl swen ou."
    ),
    risk: "medium",
    purpose: T(
      "You can invite someone you trust to help with things like reminders, setup, or next steps.",
      "Puede invitar a alguien de confianza para ayudarle con recordatorios, la configuración o los próximos pasos.",
      "Ou ka envite yon moun ou fè konfyans pou ede w ak bagay tankou rapèl, konfigirasyon, oswa pwochen etap yo."
    ),
    benefit: T(
      "Having someone alongside you can make the process easier to manage.",
      "Tener a alguien a su lado puede hacer que el proceso sea más fácil de manejar.",
      "Gen yon moun bò kote w ka fè pwosesis la pi fasil pou jere."
    ),
    reassurance: T(
      "You remain in control of your care. This invitation does not let that person consent, sign, or make healthcare decisions for you.",
      "Usted mantiene el control de su cuidado. Esta invitación no permite que esa persona consienta, firme ni tome decisiones médicas por usted.",
      "Se ou ki gen kontwòl swen ou. Envitasyon sa a pa pèmèt moun sa a bay konsantman, siyen, oswa pran desizyon swen sante pou ou."
    ),
    action: T(
      "Share their name and mobile number if you would like to invite them.",
      "Comparta su nombre y número de celular si desea invitarle.",
      "Pataje non li ak nimewo telefòn li si ou ta renmen envite l."
    )
  }),

  ONBOARDING_COMPLETE: objective({
    summary: T(
      "This part is finished. Here is what happens next.",
      "Esta parte está completa. Esto es lo que sigue.",
      "Pati sa a fini. Men sa k ap pase apre."
    ),
    tone: "celebratory",
    length: "TRANSITION",
    purpose: T(
      "That is this part finished — nicely done.",
      "Con esto termina esta parte: bien hecho.",
      "Sa fini pati sa a — byen fèt."
    ),
    benefit: T(
      "What you shared helps your ITERA care team personalize the support they give you.",
      "Lo que compartió ayuda a su equipo de ITERA a personalizar el apoyo que le brindan.",
      "Sa ou pataje a ede ekip swen ITERA ou pèsonalize sipò yo ba ou."
    ),
    reassurance: T(
      "Your care team will review it and reach out if they have any follow-up questions.",
      "Su equipo lo revisará y se comunicará si tiene alguna pregunta de seguimiento.",
      "Ekip swen ou ap revize l epi kontakte w si yo gen kesyon."
    ),
    action: T(
      "You can keep going or come back whenever it suits you.",
      "Puede continuar o volver cuando le convenga.",
      "Ou ka kontinye oswa retounen lè sa convenab pou ou."
    )
  })
});

// Home narration is the fullest of the journey: it introduces the actual program the patient
// was invited to, never a generic script, and never another program's terminology.
const PROGRAM_INTRODUCTION = {
  ACCESS: T(
    "You have been invited to learn about a Medicare care option called ACCESS. ACCESS is designed to give you more support with your health between regular doctor visits — not to replace your doctors. Depending on your needs, that can mean regular check-ins, help following your care plan, support with medications or health goals, and, when appropriate, monitoring from home. The idea is to make it easier for you and your doctors to stay connected and address health needs earlier.",
    "Le han invitado a conocer una opción de cuidado de Medicare llamada ACCESS. ACCESS está pensada para darle más apoyo con su salud entre las visitas habituales al médico, no para reemplazar a sus médicos. Según lo que necesite, puede incluir comunicación periódica, ayuda para seguir su plan de cuidado, apoyo con los medicamentos o sus objetivos de salud y, cuando corresponda, monitoreo desde casa. La idea es que a usted y a sus médicos les resulte más fácil mantenerse conectados y atender antes lo que sea importante.",
    "Yo envite w aprann sou yon opsyon swen Medicare yo rele ACCESS. ACCESS fèt pou ba ou plis sipò ak sante ou ant vizit regilye kay doktè — li pa la pou ranplase doktè ou yo. Selon bezwen ou, sa ka vle di pran nouvèl ou regilyèman, èd pou suiv plan swen ou, sipò ak medikaman oswa objektif sante ou, epi, lè sa apwopriye, siveyans lakay ou. Lide a se fè li pi fasil pou ou menm ak doktè ou yo rete konekte epi okipe bezwen sante pi bonè."
  ),
  CCM: T(
    "Chronic Care Management is designed for people managing ongoing health conditions who may benefit from support between regular doctor visits. Your ITERA care team can help keep your care organized, review your health needs and medications, work with you on goals that matter to you, and keep your care connected with your doctors. Think of it as added support between visits.",
    "El Manejo de Cuidados Crónicos está pensado para personas que viven con condiciones de salud continuas y que pueden beneficiarse de apoyo entre las visitas al médico. Su equipo de ITERA puede ayudarle a mantener su cuidado organizado, revisar sus necesidades de salud y sus medicamentos, trabajar con usted en los objetivos que le importan y mantener su cuidado conectado con sus médicos. Piénselo como un apoyo adicional entre visitas.",
    "Jesyon Swen Kwonik fèt pou moun k ap jere pwoblèm sante kontinyèl ki ka benefisye de sipò ant vizit regilye kay doktè. Ekip swen ITERA ou ka ede kenbe swen ou òganize, revize bezwen sante ou ak medikaman ou, travay avè w sou objektif ki enpòtan pou ou, epi kenbe swen ou konekte ak doktè ou yo. Panse a li kòm sipò anplis ant vizit yo."
  ),
  RPM: T(
    "Remote Patient Monitoring lets your care team receive important health readings from home, such as your blood pressure, using a connected monitor. Instead of waiting until your next office visit to see how things are going, your care team can use those readings to support your ongoing care. We will help you with the monitor, show you how to use it, and explain what happens with your readings.",
    "El Monitoreo Remoto del Paciente permite que su equipo reciba mediciones importantes desde su casa, como su presión arterial, mediante un monitor conectado. En lugar de esperar a su próxima consulta para ver cómo va todo, su equipo puede usar esas mediciones para apoyar su cuidado continuo. Le ayudaremos con el monitor, le enseñaremos a usarlo y le explicaremos qué sucede con sus mediciones.",
    "Siveyans Pasyan a Distans pèmèt ekip swen ou resevwa mezi sante enpòtan lakay ou, tankou tansyon ou, ak yon monitè konekte. Olye pou n tann pwochen vizit ou pou wè kijan bagay yo ap mache, ekip swen ou ka itilize mezi sa yo pou sipòte swen ou. N ap ede w ak monitè a, montre w kijan pou itilize l, epi eksplike sa k ap pase ak mezi ou yo."
  ),
  PCM: T(
    "Principal Care Management is focused support for the one health condition that needs the most attention right now. Your ITERA care team can help you stay on top of that condition between doctor visits, review your medications, and keep your care connected with the doctors you already see.",
    "El Manejo de Cuidado Principal es un apoyo enfocado en la condición de salud que más atención necesita en este momento. Su equipo de ITERA puede ayudarle a mantenerse al día con esa condición entre visitas, revisar sus medicamentos y mantener su cuidado conectado con los médicos que ya consulta.",
    "Jesyon Swen Prensipal se sipò ki konsantre sou yon sèl pwoblèm sante ki bezwen plis atansyon kounye a. Ekip swen ITERA ou ka ede w rete anfòm ak pwoblèm sa a ant vizit kay doktè, revize medikaman ou, epi kenbe swen ou konekte ak doktè ou deja wè yo."
  ),
  // Combined programs are told as one story, never as two products.
  CCM_RPM: T(
    "Your care brings together two kinds of support that work as one. Your ITERA care team can stay connected with you between doctor visits, and a connected monitor can share important health readings from home. Together, that gives your care team a fuller picture of how you are doing between visits and helps keep your care organized.",
    "Su cuidado reúne dos tipos de apoyo que funcionan como uno solo. Su equipo de ITERA puede mantenerse en contacto con usted entre visitas al médico, y un monitor conectado puede compartir mediciones importantes desde su casa. Juntos, le dan a su equipo una imagen más completa de cómo está entre visitas y ayudan a mantener su cuidado organizado.",
    "Swen ou mete ansanm de kalite sipò ki travay kòm yon sèl. Ekip swen ITERA ou ka rete konekte avè w ant vizit kay doktè, epi yon monitè konekte ka pataje mezi sante enpòtan lakay ou. Ansanm, sa bay ekip swen ou yon pòtrè pi konplè sou kijan w ap fè ant vizit yo epi ede kenbe swen ou òganize."
  ),
  PCM_RPM: T(
    "Your care brings together two kinds of support that work as one. Your ITERA care team focuses on the health condition that needs the most attention right now, and a connected monitor can share important readings from home. Together, that helps your care team follow how you are doing between visits.",
    "Su cuidado reúne dos tipos de apoyo que funcionan como uno solo. Su equipo de ITERA se enfoca en la condición de salud que más atención necesita ahora, y un monitor conectado puede compartir mediciones importantes desde su casa. Juntos, ayudan a su equipo a seguir cómo está usted entre visitas.",
    "Swen ou mete ansanm de kalite sipò ki travay kòm yon sèl. Ekip swen ITERA ou konsantre sou pwoblèm sante ki bezwen plis atansyon kounye a, epi yon monitè konekte ka pataje mezi enpòtan lakay ou. Ansanm, sa ede ekip swen ou suiv kijan w ap fè ant vizit yo."
  )
};

// Programs without approved bespoke copy fall back to their configured display name rather
// than inventing a description or borrowing another program's terminology.
const PROGRAM_INTRODUCTION_FALLBACK = displayName => T(
  `You have been invited to learn about ${displayName}, ongoing care support from ITERA HEALTH between your regular doctor visits. Your care team can help keep your care organized and connected with the doctors you already see.`,
  `Le han invitado a conocer ${displayName}, un apoyo continuo de cuidado de ITERA HEALTH entre sus visitas habituales al médico. Su equipo puede ayudar a mantener su cuidado organizado y conectado con los médicos que ya consulta.`,
  `Yo envite w aprann sou ${displayName}, yon sipò swen kontinyèl nan men ITERA HEALTH ant vizit regilye ou kay doktè. Ekip swen ou ka ede kenbe swen ou òganize epi konekte ak doktè ou deja wè yo.`
);

const HOME_OPENING = T("Hi, I'm EMMI, your ITERA Care Assistant.", "Hola, soy EMMI, su Asistente de cuidado de ITERA.", "Bonjou, mwen se EMMI, Asistan swen ITERA ou.");

const HOME_PROGRAM_SUMMARY = {
  ACCESS: T("ACCESS is a Medicare care option that gives you extra support between doctor visits, not to replace your doctors.", "ACCESS es una opción de cuidado de Medicare que le brinda apoyo adicional entre sus visitas, no para reemplazar a sus médicos.", "ACCESS se yon opsyon swen Medicare ki ba ou plis sipò ant vizit, li pa la pou ranplase doktè ou."),
  CCM: T("This care gives people with ongoing health conditions extra support between visits.", "Este cuidado brinda apoyo adicional entre visitas a personas con condiciones de salud continuas.", "Swen sa a bay moun ki gen pwoblèm sante kontinyèl plis sipò ant vizit yo."),
  RPM: T("Remote Patient Monitoring uses a connected monitor to share health readings with your care team between visits.", "El monitoreo remoto utiliza un monitor conectado para compartir mediciones con su equipo entre visitas.", "Siveyans a distans sèvi ak yon aparèy konekte pou pataje mezi ak ekip swen ou ant vizit yo."),
  PCM: T("Principal Care Management gives focused support between visits for the health condition needing the most attention.", "El manejo de cuidado principal brinda apoyo enfocado entre visitas para la condición que requiere más atención.", "Jesyon swen prensipal bay sipò espesyal ant vizit pou pwoblèm sante ki bezwen plis atansyon a."),
  CCM_RPM: T("This care brings together two kinds of support that work as one: ongoing care and readings from a connected monitor.", "Este cuidado reúne dos tipos de apoyo que funcionan como uno: cuidado continuo y mediciones de un monitor conectado.", "Swen sa a mete ansanm de kalite sipò ki travay kòm youn: swen regilye ak mezi yon aparèy konekte."),
  PCM_RPM: T("This care brings together two kinds of support that work as one: focused care for one condition and readings from a connected monitor.", "Este cuidado reúne dos tipos de apoyo que funcionan como uno: apoyo enfocado para una condición y mediciones de un monitor conectado.", "Swen sa a mete ansanm de kalite sipò ki travay kòm youn: sipò pou yon pwoblèm ak mezi yon aparèy konekte.")
};

const HOME_PHYSICIAN = physician => T(
  `${physician}'s care team invited you to learn about additional support available through Medicare. Your doctor remains part of your care, while ITERA can support you between visits.`,
  `El equipo de ${physician} le invitó a conocer un apoyo adicional disponible a través de Medicare. Su médico sigue siendo parte de su cuidado, mientras ITERA puede apoyarle entre visitas.`,
  `Ekip swen ${physician} envite w aprann sou sipò anplis ki disponib atravè Medicare. Doktè ou rete yon pati nan swen ou, pandan ITERA ka sipòte w ant vizit yo.`
);

const HOME_CLOSING = T(
  "Taking part is your choice, and I will explain each step in simple terms before you decide. When you're ready, choose 'Start your care journey.'",
  "Participar es su decisión, y le explicaré cada paso en palabras sencillas antes de que decida. Cuando esté listo, elija 'Comience su recorrido de cuidado'.",
  "Patisipe se chwa ou, epi m ap eksplike chak etap an mo senp anvan ou deside. Lè ou pare, chwazi 'Kòmanse pwosesis swen ou'."
);

const pick = (entry, locale) => {
  const key = { EN: "en", ES: "es", KR: "ht" }[String(locale || "EN").toUpperCase()] || "en";
  return entry?.[key] || entry?.en || "";
};

const sentences = parts => parts.filter(Boolean).map(part => part.trim()).filter(Boolean).join(" ");
const spokenSegments = parts => parts.filter(Boolean).flatMap(part => semanticSpeechSegments(part));

export function buildHomeNarration({ locale = "EN", program, programDisplayName = "", providerReferral = false, physicianDisplayName = "", allowGreeting = true } = {}) {
  const introduction = HOME_PROGRAM_SUMMARY[program] || PROGRAM_INTRODUCTION_FALLBACK(programDisplayName || program || "this care");
  // A physician is only mentioned when the referral source and a real name both support it.
  const referral = providerReferral && physicianDisplayName ? pick(HOME_PHYSICIAN(physicianDisplayName), locale) : "";
  const narrationText = sentences([allowGreeting ? pick(HOME_OPENING, locale) : "", referral, pick(introduction, locale), pick(HOME_CLOSING, locale)]);
  // Home is deliberately one bounded provider turn. Sending each sentence as a separate
  // generative turn caused the live model to elaborate and ask a new question after every clause.
  const segments = narrationText ? [narrationText] : [];
  return {
    narrationText,
    segments,
    narrationPurpose: "PROGRAM_INTRODUCTION",
    estimatedSeconds: NARRATION_SECONDS.PROGRAM_INTRODUCTION
  };
}

// Runtime facts are appended only when supplied. Nothing here invents a count, a vendor or a
// duration: an absent value simply produces a narration without that sentence.
function dynamicSentences(fields, runtime, locale) {
  const lines = [];
  if (fields.includes("medicationCount") && Number.isFinite(runtime.medicationCount) && runtime.medicationCount > 0) {
    const count = runtime.medicationCount;
    lines.push(pick(T(
      `We have ${count} on file for you to look at.`,
      `Tenemos ${count} registrados para que los revise.`,
      `Nou gen ${count} nan dosye a pou w gade.`
    ), locale));
  }
  if (fields.includes("deviceVendor") && runtime.deviceVendor) {
    lines.push(pick(T(
      `Your care setup shows a ${runtime.deviceVendor} monitor.`,
      `Su configuración de cuidado muestra un monitor ${runtime.deviceVendor}.`,
      `Konfigirasyon swen ou montre yon monitè ${runtime.deviceVendor}.`
    ), locale));
  }
  if (fields.includes("estimatedDuration") && runtime.estimatedDuration) {
    lines.push(pick(T(
      `It should take about ${runtime.estimatedDuration}.`,
      `Debería tomar unos ${runtime.estimatedDuration}.`,
      `Li ta dwe pran anviwon ${runtime.estimatedDuration}.`
    ), locale));
  }
  if (fields.includes("nextStepLabel") && runtime.nextStepLabel) {
    lines.push(pick(T(
      `When you're ready, choose "${runtime.nextStepLabel}".`,
      `Cuando esté listo, elija "${runtime.nextStepLabel}".`,
      `Lè ou pare, chwazi "${runtime.nextStepLabel}".`
    ), locale));
  }
  return lines;
}

export function buildNarration({ screen, locale = "EN", runtime = {} } = {}) {
  if (screen === "INVITATION") return buildHomeNarration({ locale, ...runtime });
  // Some screens are shared but not the same experience. GOALS is a chooser for CCM and an
  // explanation of assigned goals for ACCESS, and EMMI describing the wrong one is worse than
  // saying nothing. An ACCESS_-prefixed objective wins on that pathway.
  const spec = (runtime?.program === "ACCESS" && NARRATIVE_OBJECTIVES[`ACCESS_${screen}`]) || NARRATIVE_OBJECTIVES[screen];
  if (!spec) return null;
  // ORIENT -> EXPLAIN/BENEFIT -> REASSURE -> ACTION, then any runtime detail worth saying.
  const segments = spokenSegments([
    pick(spec.purpose, locale),
    pick(spec.benefit, locale),
    pick(spec.reassurance, locale),
    pick(spec.action, locale),
    ...dynamicSentences(spec.dynamic, runtime, locale)
  ]);
  const narrationText = sentences(segments);
  return {
    narrationText,
    segments,
    // One short line for the UI. The full narration stays audio, reachable via "Read message".
    shortSummary: pick(spec.summary, locale),
    narrationPurpose: screen,
    tone: spec.tone,
    riskLevel: spec.risk,
    estimatedSeconds: NARRATION_SECONDS[spec.length],
    // Development-only trace of what the narration was trying to achieve (§55).
    objective: { purpose: pick(spec.purpose, locale), benefit: pick(spec.benefit, locale), reassurance: pick(spec.reassurance, locale), action: pick(spec.action, locale), dynamicUsed: spec.dynamic.filter(field => runtime[field] != null) }
  };
}

const TRANSITIONS = Object.freeze({
  "DECISION_MAKER>PERSONAL_REPRESENTATIVE_DETAILS": T(
    "Understood. Since you are completing this as a personal representative, we first need a few details about you before confirming the patient's identity.",
    "Entendido. Como está completando este proceso como representante personal, primero necesitamos algunos datos sobre usted antes de confirmar la identidad del paciente.",
    "Nou konprann. Paske w ap ranpli sa kòm reprezantan pèsonèl, nou bezwen kèk detay sou ou anvan nou konfime idantite pasyan an."
  ),
  "DECISION_MAKER>IDENTITY_VERIFICATION": T(
    "Perfect. Now we will confirm the patient's identity. This only takes a moment and helps protect their information.",
    "Perfecto. Ahora vamos a confirmar la identidad del paciente. Esto solo toma un momento y ayuda a proteger su información.",
    "Trè byen. Kounye a nou pral konfime idantite pasyan an. Sa pran yon ti moman epi li ede pwoteje enfòmasyon li."
  ),
  "IDENTITY_VERIFICATION>CARE_RECOMMENDATION": T(
    "All set. Now we will show you the support available between doctor visits and how it may help.",
    "Listo. Ahora vamos a mostrarle el apoyo disponible entre visitas médicas y cómo puede ayudarle.",
    "Nou fini. Kounye a nou pral montre w sipò ki disponib ant vizit kay doktè ak kijan li ka ede w."
  ),
  "ACCESS_ELIGIBILITY_PROCESSING>ACCESS_ELIGIBILITY_RESULT": T(
    "The eligibility check is complete. Let us review the confirmed result together.",
    "La verificación de elegibilidad terminó. Revisemos juntos el resultado confirmado.",
    "Verifikasyon kalifikasyon an fini. Ann revize rezilta ki konfime a ansanm."
  ),
  "DISCLOSURE>CONSENT_REVIEW": T(
    "You have reviewed the main points. Now you can see everything together, including any expected cost, before deciding whether to enroll.",
    "Ya revisó los puntos principales. Ahora puede ver todo junto, incluido cualquier costo esperado, antes de decidir si desea inscribirse.",
    "Ou revize pwen prensipal yo. Kounye a ou ka wè tout bagay ansanm, ansanm ak nenpòt depans yo prevwa, anvan ou deside si w vle enskri."
  ),
  "ENROLLMENT_PROCESSING>ENROLLMENT_CONFIRMED": T(
    "Your enrollment is complete. You now have access to support from your ITERA care team, and you may start the next step now or later.",
    "Listo, su inscripción está completa. Ahora tiene acceso al apoyo de su equipo de ITERA y puede comenzar el siguiente paso ahora o más tarde.",
    "Enskripsyon ou fini. Kounye a ou gen sipò ekip swen ITERA ou, epi ou ka kòmanse pwochen etap la kounye a oswa pita."
  ),
  "ENROLLMENT_CONFIRMED>ONBOARDING": T(
    "Perfect. Your enrollment is already complete. Now we will learn a little more about your health so your care can be personalized.",
    "Perfecto. Su inscripción ya está completa. Ahora vamos a conocer un poco más sobre su salud para personalizar su cuidado.",
    "Trè byen. Enskripsyon ou deja fini. Kounye a nou pral aprann yon ti kras plis sou sante ou pou pèsonalize swen ou."
  ),
  "ENROLLMENT_CONFIRMED>FLOW_DEFERRED": T(
    "No problem. Your enrollment is complete, and you can continue setting up your care whenever you are ready.",
    "No hay problema. Su inscripción está completa y podrá continuar con la configuración de su cuidado cuando esté listo.",
    "Pa gen pwoblèm. Enskripsyon ou fini, epi ou ka kontinye mete swen ou an plas lè ou pare."
  ),
  "MEDICATIONS_REVIEW>ONBOARDING": T(
    "Thank you. Your medication review is saved, and you are back at your care setup.",
    "Gracias. La revisión de sus medicamentos quedó guardada y ha vuelto a la configuración de su cuidado.",
    "Mèsi. Revizyon medikaman ou anrejistre, epi ou retounen nan konfigirasyon swen ou."
  ),
  "ACCESS_BP_DEVICE_RESULT>ACCESS_BP_GUIDED_SETUP": T(
    "Your monitor is confirmed. Next, we will prepare it for your first measurement.",
    "Su monitor está confirmado. Ahora vamos a prepararlo para su primera medición.",
    "Nou konfime monitè ou. Kounye a nou pral prepare l pou premye mezi ou."
  ),
  "ACCESS_BP_GUIDED_SETUP>ACCESS_BP_MEASUREMENT": T(
    "Your monitor is ready. Now we will take the first measurement and confirm that the information reaches ITERA correctly.",
    "Su monitor está listo. Ahora haremos la primera medición y confirmaremos que la información llegue correctamente a ITERA.",
    "Monitè ou pare. Kounye a nou pral pran premye mezi a epi konfime enfòmasyon an rive jwenn ITERA kòrèkteman."
  )
});

const BACK_BRIDGE = T(
  "Of course. We went back so you can review or change this step.",
  "Claro. Volvimos para que pueda revisar o cambiar este paso.",
  "Dakò. Nou retounen pou w ka revize oswa chanje etap sa a."
);

export function buildTransitionNarration({ previousScreen, currentScreen, locale = "EN", navigationDirection = "FORWARD", runtime = {} } = {}) {
  if (!previousScreen || !currentScreen || previousScreen === currentScreen) return null;
  let entry = navigationDirection === "BACK" ? BACK_BRIDGE : TRANSITIONS[`${previousScreen}>${currentScreen}`];
  if (previousScreen === "DECISION_MAKER" && currentScreen === "IDENTITY_VERIFICATION" && runtime.completionRole === "patient") {
    entry = T(
      "Perfect. Now we will confirm your identity. This only takes a moment and helps protect your information.",
      "Perfecto. Ahora vamos a confirmar su identidad. Esto solo toma un momento y nos ayuda a proteger su información.",
      "Trè byen. Kounye a nou pral konfime idantite ou. Sa pran yon ti moman epi li ede pwoteje enfòmasyon ou."
    );
  }
  if (previousScreen === "ENROLLMENT_PROCESSING" && currentScreen === "ENROLLMENT_CONFIRMED" && runtime.enrollmentStatus !== "COMPLETED") entry = null;
  if (previousScreen === "ACCESS_BP_DEVICE_RESULT" && currentScreen === "ACCESS_BP_GUIDED_SETUP" && !runtime.deviceConfirmed) entry = null;
  if (previousScreen === "ACCESS_ELIGIBILITY_PROCESSING" && currentScreen === "ACCESS_ELIGIBILITY_RESULT" && runtime.eligibilityStatus === "ELIGIBLE") {
    entry = T(
      "Good news, you can continue. This does not complete your enrollment. Next, you will review the important information before deciding whether to take part.",
      "Buenas noticias, puede continuar. Esto todavía no completa su inscripción. Ahora revisará la información importante antes de decidir si desea participar.",
      "Bon nouvèl, ou ka kontinye. Sa poko fini enskripsyon ou. Kounye a ou pral revize enfòmasyon enpòtan yo anvan ou deside si w vle patisipe."
    );
  }
  if (!entry) {
    const destination = NARRATIVE_OBJECTIVES[currentScreen];
    entry = destination?.purpose || null;
  }
  if (!entry) return null;
  const narrationText = pick(entry, locale);
  return { narrationText, segments: spokenSegments([narrationText]), narrationPurpose: "TRANSITION" };
}

export const narratedScreens = () => Object.keys(NARRATIVE_OBJECTIVES);
