// EMMI's guardrail answers are the sentences that must not drift: what EMMI cannot do about legal
// authority, prescriptions and the clinical record, plus the screen-scoped statements that keep a
// patient's own words from being read as a clinical or legal action. Retrieval and generation both
// paraphrase, and a paraphrase of a limit is not the limit, so these are answered from approved
// copy before either one runs.
//
// A rule fires on the id of the quick question the patient tapped, or on the words they typed. The
// id is checked first across every rule, so a Spanish or Kreyol quick question reaches its
// guardrail through its catalog id instead of through a translated regex.

const pick = (locale, values) => values[String(locale || "EN").toUpperCase()] || values.EN;

const CARE_CIRCLE_SCREENS = ["CARE_CIRCLE_INVITE", "MY_CARE_CIRCLE", "CARE_CIRCLE_PERMISSIONS"];
const GOAL_SCREENS = ["GOALS", "MY_GOALS"];

// The one prescription limit, shared by every route that reaches it, so there is never a second
// wording of it to keep in sync.
const medicationSafety = locale => pick(locale, {
  EN: "I can’t recommend starting, stopping, or changing a medication or dose. Please contact your clinician or care team for treatment advice.",
  ES: "No puedo recomendar iniciar, suspender ni cambiar un medicamento o una dosis. Consulte a su profesional clínico o equipo de atención.",
  KR: "Mwen pa ka rekòmande kòmanse, sispann oswa chanje yon medikaman oswa dòz. Tanpri kontakte klinisyen oswa ekip swen ou."
});

// Approved, non-prescriptive education for the medications this prototype puts on file. A
// medication that is not listed gets the general answer rather than an invented one.
const MEDICATION_EDUCATION = {
  lisinopril: {
    EN: "Lisinopril is commonly used to help manage blood pressure and certain heart conditions. I can provide general information, but I can’t tell you to start, stop, or change it.",
    ES: "Lisinopril se usa comúnmente para ayudar a controlar la presión arterial y ciertas afecciones del corazón. Puedo ofrecer información general, pero no indicarle que lo inicie, suspenda o cambie.",
    KR: "Yo itilize Lisinopril souvan pou ede kontwole tansyon ak kèk pwoblèm kè. Mwen ka bay enfòmasyon jeneral, men mwen pa ka di w kòmanse, sispann, oswa chanje li."
  },
  atorvastatin: {
    EN: "Atorvastatin is commonly used to help manage cholesterol. I can provide general information, but I can’t tell you to start, stop, or change it.",
    ES: "Atorvastatin se usa comúnmente para ayudar a controlar el colesterol. Puedo ofrecer información general, pero no indicarle que lo inicie, suspenda o cambie.",
    KR: "Yo itilize Atorvastatin souvan pou ede kontwole kolestewòl. Mwen ka bay enfòmasyon jeneral, men mwen pa ka di w kòmanse, sispann, oswa chanje li."
  }
};

const medicationEducation = (text, locale) => {
  const known = Object.keys(MEDICATION_EDUCATION).find(name => new RegExp(`\\b${name}\\b`, "i").test(text));
  return known ? pick(locale, MEDICATION_EDUCATION[known]) : pick(locale, {
    EN: "I can explain what a medication on your list is generally used for, but I don’t have approved information about that one. I also can’t tell you to start, stop, or change any medication — your care team can review it with you.",
    ES: "Puedo explicar para qué se usa generalmente un medicamento de su lista, pero no tengo información aprobada sobre ese. Tampoco puedo indicarle que inicie, suspenda o cambie un medicamento; su equipo de atención puede revisarlo con usted.",
    KR: "Mwen ka esplike pou kisa yo itilize yon medikaman ki nan lis ou an jeneral, men mwen pa gen enfòmasyon apwouve sou sa a. Mwen pa ka di w kòmanse, sispann oswa chanje okenn medikaman non plis — ekip swen ou ka revize li avèk ou."
  });
};

// Order matters only for the typed path: the first rule whose words match wins, so the narrower
// limits are listed before the broader ones. The orchestrator runs its own prescription check
// before this layer, so the only medication rule here is the phrasing that check does not catch.
const RULES = [
  {
    intent: "MEDICATION_SAFETY",
    screens: ["MEDICATIONS_REVIEW"],
    match: /(should i|can i)[^?.]*(stop|change|take)|debo[^?.]*(dejar|suspender|cambiar|tomar)|èske mwen dwe[^?.]*(sispann|chanje|pran)/i,
    answer: locale => medicationSafety(locale)
  },
  {
    intent: "MEDICATION_EDUCATION",
    screens: ["MEDICATIONS_REVIEW"],
    ids: ["medication-what-is"],
    match: /(what is|what does|qué es|kisa)[^?]*(lisinopril|atorvastatin)/i,
    answer: (locale, context, text) => medicationEducation(text, locale)
  },
  {
    intent: "MEDICATION_RECORD",
    screens: ["MEDICATIONS_REVIEW"],
    ids: ["medication-unknown-dose"],
    match: /(don'?t know|not sure|no sé|no estoy seguro|pa konnen|pa sèten)[^?]*(dose|dosis|dòz)/i,
    answer: locale => pick(locale, {
      EN: "That’s okay. You can leave the dose blank when adding a medication, or mark an on-file medication as not sure. Your care team can review it with you.",
      ES: "Está bien. Puede dejar la dosis en blanco al agregar un medicamento o marcar que no está seguro sobre uno registrado. Su equipo de atención puede revisarlo con usted.",
      KR: "Sa pa yon pwoblèm. Ou ka kite dòz la vid lè w ap ajoute yon medikaman, oswa make ou pa sèten sou yon medikaman nan dosye a. Ekip swen ou ka revize li avèk ou."
    })
  },
  {
    intent: "MEDICATION_RECORD",
    screens: ["MEDICATIONS_REVIEW"],
    ids: ["medication-not-sure-taking"],
    match: /(not sure|don'?t know|no estoy seguro|no sé si|pa sèten|pa konnen si)[^?]*(take|tom|pran)/i,
    answer: locale => pick(locale, {
      EN: "That’s okay. Choose ‘Something changed,’ then ‘I’m not sure about this medication.’ Your care team can review it with you.",
      ES: "Está bien. Elija “Algo cambió” y luego “No estoy seguro de este medicamento”. Su equipo de atención puede revisarlo con usted.",
      KR: "Sa pa yon pwoblèm. Chwazi “Gen yon bagay ki chanje,” epi “Mwen pa sèten sou medikaman sa a.” Ekip swen ou ka revize li avèk ou."
    })
  },
  {
    intent: "CLINICAL_EDUCATION",
    screens: ["HEALTH_INFORMATION_REVIEW"],
    ids: ["health-high-bp-meaning"],
    match: /(high blood pressure|hypertension|presión arterial alta|hipertensión|tansyon wo)/i,
    answer: locale => pick(locale, {
      EN: "High blood pressure means the force of blood against your blood vessels is often higher than recommended. I can explain the term, but I can’t diagnose you or confirm that the clinical record is correct.",
      ES: "La presión arterial alta significa que la fuerza de la sangre contra los vasos sanguíneos suele ser mayor de lo recomendado. Puedo explicar el término, pero no diagnosticarle ni confirmar que el registro clínico sea correcto.",
      KR: "Tansyon wo vle di fòs san an sou veso sangen yo souvan pi wo pase sa yo rekòmande. Mwen ka eksplike tèm nan, men mwen pa ka fè dyagnostik ni konfime dosye klinik la kòrèk."
    })
  },
  {
    intent: "SCOPE_LIMIT",
    screens: ["HEALTH_INFORMATION_REVIEW"],
    ids: ["health-emmi-confirm"],
    match: /(confirm|correct|diagnos|confirmar|diagnóst|konfime|kòrèk|dyagnost)/i,
    answer: locale => pick(locale, {
      EN: "I can help explain what the information means, but I can’t confirm a diagnosis or change your clinical record. If you’re unsure, choose ‘I need help reviewing it’ so your care team can review it with you.",
      ES: "Puedo ayudarle a entender la información, pero no confirmar un diagnóstico ni cambiar su registro clínico. Si tiene dudas, elija “Necesito ayuda para revisarla” para que su equipo lo revise con usted.",
      KR: "Mwen ka ede eksplike enfòmasyon an, men mwen pa ka konfime yon dyagnostik ni chanje dosye klinik ou. Si ou pa sèten, chwazi “Mwen bezwen èd pou revize li” pou ekip swen ou ka revize li avèk ou."
    })
  },
  {
    intent: "DATA_CORRECTION",
    screens: ["HEALTH_INFORMATION_REVIEW"],
    ids: ["health-not-correct", "human-care-team-help"],
    // Asking what the care team can do about this information, not asking to be put in touch with
    // them: a bare "care team" here would swallow "Talk with my care team", which is a request to
    // reach a person and belongs to the care-team contact route.
    match: /(not sure|no estoy seguro|pa sèten)|((how|what) can my care team|c[oó]mo puede.*equipo|kijan ekip swen)/i,
    answer: locale => pick(locale, {
      EN: "That’s okay. Your care team can review the information with you. EMMI will not mark it as confirmed or change it automatically.",
      ES: "Está bien. Su equipo de atención puede revisar la información con usted. EMMI no la marcará como confirmada ni la cambiará automáticamente.",
      KR: "Sa pa yon pwoblèm. Ekip swen ou ka revize enfòmasyon an avèk ou. EMMI p ap make li kòm konfime ni chanje li otomatikman."
    })
  },
  {
    intent: "CARE_CIRCLE",
    screens: CARE_CIRCLE_SCREENS,
    ids: ["circle-decisions-for-me"],
    match: /(consent|sign|make decisions|decision for me|consentimiento|firmar|decisiones por mí|konsantman|siyen|desizyon pou mwen)/i,
    answer: locale => pick(locale, {
      EN: "No. A Care Circle member can provide only the basic support you choose. They cannot consent, sign, or make healthcare decisions for you, and they are not a Personal Representative.",
      ES: "No. Un miembro del Círculo de cuidado solo puede brindar el apoyo básico que usted elija. No puede dar consentimiento, firmar ni tomar decisiones médicas por usted y no es un Representante personal.",
      KR: "Non. Yon manm Sèk swen ka bay sèlman sipò debaz ou chwazi. Li pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou ou, epi li pa yon Reprezantan pèsonèl."
    })
  },
  {
    intent: "CARE_CIRCLE",
    ids: ["access-someone-help", "decision-daughter-help", "confirmed-invite-someone"],
    match: /(someone help|invite someone|someone i trust|daughter help|son help|family.*help|caregiver|care circle|alguien.*ayud|invitar a alguien|alguien de confianza|hija.*ayud|hijo.*ayud|familiar.*ayud|cuidador|círculo de cuidado|yon moun.*ede|envite yon moun|moun mwen fè konfyans|pitit.*ede|fanmi.*ede|moun k ap bay swen|sèk swen)/i,
    answer: locale => ({
      text: pick(locale, {
        EN: "Yes. You can choose her from your contacts when that option is available, or enter her name and mobile number yourself. Nothing is sent until you review the details and tap Send invitation. She can provide basic support, but cannot consent, sign, or make healthcare decisions for you.",
        ES: "Sí. Puede elegirla de sus contactos cuando esa opción esté disponible o ingresar su nombre y número celular. No se envía nada hasta que revise los datos y toque Enviar invitación. Puede brindar apoyo básico, pero no dar consentimiento, firmar ni tomar decisiones médicas por usted.",
        KR: "Wi. Ou ka chwazi li nan kontak ou lè opsyon sa a disponib, oswa antre non li ak nimewo mobil li. Anyen p ap voye jiskaske ou revize detay yo epi peze Voye envitasyon. Li ka bay sipò debaz, men li pa ka bay konsantman, siyen, oswa pran desizyon swen sante pou ou."
      }),
      quickAction: "care-circle"
    })
  },
  {
    intent: "SHARE",
    ids: ["confirmed-share-access"],
    match: /(share access|send this|send.*brother|send.*sister|share.*brother|share.*family|compartir access|enviar.*hermano|compartir.*famil|pataje access|voye.*frè|pataje.*fanmi)/i,
    // Sharing before enrollment is complete would carry the patient's own enrollment along with the
    // public information, so the offer appears only once nothing is in flight to leak.
    answer: (locale, context) => context.enrollmentStatus === "COMPLETED"
      ? {
        text: pick(locale, {
          EN: "Yes. I can help you share public information about ACCESS. They will still need to check whether ACCESS is available to them.",
          ES: "Sí. Puedo ayudarle a compartir información pública sobre ACCESS. La otra persona deberá verificar si ACCESS está disponible para ella.",
          KR: "Wi. Mwen ka ede w pataje enfòmasyon piblik sou ACCESS. Lòt moun nan ap toujou bezwen verifye si ACCESS disponib pou li."
        }),
        quickAction: "share-access"
      }
      : pick(locale, {
        EN: "After your enrollment is complete, I can help you share public information about ACCESS without sharing your enrollment information.",
        ES: "Cuando complete su inscripción, puedo ayudarle a compartir información pública sobre ACCESS sin compartir los datos de su inscripción.",
        KR: "Apre enskripsyon ou fini, mwen ka ede w pataje enfòmasyon piblik sou ACCESS san pataje enfòmasyon enskripsyon ou."
      })
  },
  {
    intent: "CONSENT_AUTHORITY",
    // Asking EMMI to do the enrolling, not asking whether enrolling is required: "¿Tengo que
    // inscribirme?" is a question about voluntariness and belongs with the program knowledge.
    match: /can you enroll|enroll me|inscríbeme|(puede|puedes|pueden).*inscribirme|ou ka enskri m|enskri m pou mwen/i,
    answer: locale => pick(locale, {
      EN: "I can explain the information and guide you, but you need to review and agree to enrollment yourself. I cannot consent for you.",
      ES: "Puedo explicarle la información y orientarle, pero usted debe revisar y aceptar la inscripción. No puedo dar consentimiento por usted.",
      KR: "Mwen ka esplike enfòmasyon an epi gide ou, men se ou menm ki dwe revize epi dakò ak enskripsyon an. Mwen pa ka bay konsantman pou ou."
    })
  },
  {
    intent: "REPRESENTATIVE_AUTHORITY",
    match: /(check|select|mark).*(authorized|authority)|marcar.*autoriz|seleccionar.*autoriz|tcheke.*otorize/i,
    answer: locale => pick(locale, {
      EN: "I can explain the statement, but I can’t confirm your authority for you. Select the checkbox yourself only if it is true.",
      ES: "Puedo explicarle la declaración, pero no puedo confirmar su autoridad. Marque la casilla usted mismo solo si es verdadera.",
      KR: "Mwen ka esplike deklarasyon an, men mwen pa ka konfime otorite ou pou ou. Chwazi kaz la poukont ou sèlman si li vre."
    })
  },
  {
    intent: "REPRESENTATIVE_ROLE",
    ids: ["rep-why-phone", "rep-why-verify"],
    match: /(why|verify|verificar|por qué|poukisa|verifye).*(phone|teléfono|telefòn)/i,
    answer: locale => pick(locale, {
      EN: "We verify the representative’s phone to confirm how to reach the person completing enrollment for the patient. The verification does not confirm legal authority.",
      ES: "Verificamos el teléfono del representante para confirmar cómo contactar a quien completa la inscripción. La verificación no confirma autoridad legal.",
      KR: "Nou verifye telefòn reprezantan an pou konnen kijan pou kontakte moun k ap ranpli enskripsyon an. Verifikasyon an pa konfime otorite legal."
    })
  },
  {
    intent: "REPRESENTATIVE_ROLE",
    ids: ["decision-what-is-representative", "rep-what-means", "consent-representative-signature"],
    match: /(personal representative|representante personal|reprezantan pèsonèl)/i,
    answer: locale => pick(locale, {
      EN: "A personal representative is someone authorized to make healthcare decisions for the patient. The representative signs on the patient’s behalf, not as the patient.",
      ES: "Un representante personal es una persona autorizada para tomar decisiones médicas por el paciente. Firma en nombre del paciente, no como si fuera el paciente.",
      KR: "Yon reprezantan pèsonèl se yon moun ki otorize pou pran desizyon swen sante pou pasyan an. Reprezantan an siyen nan non pasyan an, li pa siyen kòm pasyan an."
    })
  },
  {
    intent: "CONSENT",
    screens: ["CONSENT_REVIEW"],
    ids: ["consent-what-agreeing"],
    match: /(what am i agreeing|qué estoy aceptando|kisa mwen.*dakò)/i,
    // A patient and a representative are agreeing to different things, so the sentence names which
    // one is signing rather than leaving it to be inferred.
    answer: (locale, context) => context.completedByRepresentative
      ? pick(locale, {
        EN: "You are agreeing, on behalf of the patient, to enroll the patient in ACCESS with ITERA HEALTH. CMS Alignment still must be completed before enrollment is confirmed.",
        ES: "Está aceptando, en nombre del paciente, inscribir al paciente en ACCESS con ITERA HEALTH. La alineación de CMS aún debe completarse antes de confirmar la inscripción.",
        KR: "Ou dakò, nan non pasyan an, pou enskri pasyan an nan ACCESS avèk ITERA HEALTH. Aliyman CMS dwe fini toujou anvan enskripsyon an konfime."
      })
      : pick(locale, {
        EN: "You are agreeing to enroll in ACCESS with ITERA HEALTH. CMS Alignment still must be completed before enrollment is confirmed.",
        ES: "Está aceptando inscribirse en ACCESS con ITERA HEALTH. La alineación de CMS aún debe completarse antes de confirmar la inscripción.",
        KR: "Ou dakò pou enskri nan ACCESS avèk ITERA HEALTH. Aliyman CMS dwe fini toujou anvan enskripsyon an konfime."
      })
  },
  {
    intent: "ELIGIBILITY",
    when: context => context.eligibilityStatus === "NOT_ELIGIBLE",
    ids: ["eligibility-why-blocked"],
    match: /(why can'?t i continue|why can i not continue|por qué no puedo continuar|poukisa mwen pa ka kontinye)/i,
    answer: locale => pick(locale, {
      EN: "ACCESS enrollment cannot continue in this demo because Medicare placed the patient in a comparison group. Medicare benefits, coverage, and regular care remain unchanged.",
      ES: "La inscripción en ACCESS no puede continuar en esta demostración porque Medicare asignó al paciente a un grupo de comparación. Sus beneficios, cobertura y cuidado habitual no cambian.",
      KR: "Enskripsyon ACCESS pa ka kontinye nan demonstrasyon sa a paske Medicare mete pasyan an nan yon gwoup konparezon. Benefis, kouvèti ak swen nòmal Medicare pa chanje."
    })
  },
  {
    intent: "SCREEN_PURPOSE",
    screens: GOAL_SCREENS,
    ids: ["goals-why-asking"],
    match: /(why.*goal|por qué.*meta|poukisa.*objektif)/i,
    answer: locale => pick(locale, {
      EN: "Your goals help your care team understand what matters to you and how you would like support. They are your personal goals, not medical orders or clinical targets.",
      ES: "Sus metas ayudan a su equipo a comprender qué le importa y cómo desea recibir apoyo. Son metas personales, no indicaciones médicas ni objetivos clínicos.",
      KR: "Objektif ou ede ekip swen ou konprann sa ki enpòtan pou ou ak fason ou ta renmen jwenn sipò. Se objektif pèsonèl ou, yo pa lòd medikal ni sib klinik."
    })
  },
  {
    intent: "GOAL_SUPPORT",
    screens: GOAL_SCREENS,
    ids: ["goals-change-later"],
    match: /(change.*goal|cambiar.*meta|chanje.*objektif)/i,
    answer: locale => pick(locale, {
      EN: "Yes. You can adjust, pause, restart, or mark a personal goal achieved later from My Goals.",
      ES: "Sí. Puede ajustar, pausar, reanudar o marcar una meta personal como lograda más adelante desde Mis metas.",
      KR: "Wi. Ou ka ajiste, mete an poz, rekòmanse, oswa make yon objektif pèsonèl kòm reyalize pita nan Objektif mwen."
    })
  },
  {
    intent: "GOAL_SUPPORT",
    screens: GOAL_SCREENS,
    ids: ["goals-personalize"],
    match: /(make.*plan|personalize.*plan|crear.*plan|personalizar.*plan|fè.*plan|pèsonalize.*plan)/i,
    answer: locale => pick(locale, {
      EN: "I can help you personalize small optional steps, but you choose what feels realistic. These steps are not medical orders, and your care team remains responsible for clinical decisions.",
      ES: "Puedo ayudarle a personalizar pasos pequeños y opcionales, pero usted elige lo que le parezca realista. Estos pasos no son indicaciones médicas y su equipo de atención sigue siendo responsable de las decisiones clínicas.",
      KR: "Mwen ka ede w pèsonalize ti etap opsyonèl, men se ou ki chwazi sa ki reyalis. Etap sa yo pa lòd medikal, epi ekip swen ou rete responsab desizyon klinik yo."
    })
  },
  {
    intent: "GOAL_SUPPORT",
    screens: GOAL_SCREENS,
    ids: ["goals-trouble"],
    match: /(trouble|difficult|problema|dificultad|pwoblèm|difisil)/i,
    answer: locale => pick(locale, {
      EN: "That’s okay. Open the goal check-in and choose that you’re having difficulty. We’ll help you name the barrier and, if you choose, send a support request to your care team.",
      ES: "Está bien. Abra el seguimiento de la meta e indique que tiene dificultades. Le ayudaremos a identificar la barrera y, si lo desea, enviar una solicitud de apoyo a su equipo.",
      KR: "Sa pa yon pwoblèm. Louvri tcheke objektif la epi chwazi ou gen difikilte. N ap ede w idantifye baryè a epi, si ou vle, voye yon demann sipò bay ekip swen ou."
    })
  }
];

export function emmiGuardrailAnswer({ question = "", questionId = "", locale = "EN", context = {} } = {}) {
  const text = String(question).replace(/[’‘]/g, "'");
  const screen = context.currentScreen || "";
  const applies = rule => (!rule.screens || rule.screens.includes(screen)) && (!rule.when || rule.when(context));
  const rule = (questionId && RULES.find(item => applies(item) && item.ids?.includes(questionId)))
    || RULES.find(item => applies(item) && item.match.test(text));
  if (!rule) return null;
  const answer = rule.answer(locale, context, text);
  return { intent: rule.intent, ...(typeof answer === "string" ? { text: answer } : answer) };
}
