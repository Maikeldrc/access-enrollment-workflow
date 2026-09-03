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
  // These answers describe the control that is visible on the patient's current screen. They are
  // deterministic because a general knowledge answer is less useful here than naming the exact
  // next action, and because the model must not invent fulfillment details that are not recorded.
  {
    intent: "LEAVE_ACCESS",
    screens: ["INVITATION"],
    match: /can i stop participating|can i leave access|stop participating later|puedo dejar de participar|puedo salir de access|mwen ka sispann patisipe|mwen ka kite access/i,
    answer: locale => pick(locale, {
      EN: "Yes. Participation is voluntary. Beginning 90 days after enrollment, you may leave ACCESS or switch to another participating provider. Leaving does not change your Medicare benefits, coverage, or rights.",
      ES: "Sí. La participación es voluntaria. A partir de 90 días después de la inscripción, puede dejar ACCESS o cambiar a otro proveedor participante. Salir no cambia sus beneficios, cobertura ni derechos de Medicare.",
      KR: "Wi. Patisipasyon an volontè. Apati 90 jou apre enskripsyon, ou ka kite ACCESS oswa chanje pou yon lòt founisè patisipan. Lè ou kite sa pa chanje benefis, kouvèti oswa dwa Medicare ou."
    })
  },
  {
    intent: "IDENTITY_VERIFICATION_PURPOSE",
    screens: ["IDENTITY_VERIFICATION"],
    match: /(why|what for).*(date of birth|birth date|zip)|por qu[eé].*(fecha de nacimiento|c[oó]digo postal)|poukisa.*(dat nesans|k[oò]d postal)/i,
    answer: locale => pick(locale, {
      EN: "Your date of birth and ZIP code are used to match you to the correct care invitation and help protect your health information. This check does not change your Medicare benefits and does not enroll you by itself.",
      ES: "Su fecha de nacimiento y código postal se usan para asociarle con la invitación de cuidado correcta y ayudar a proteger su información de salud. Esta verificación no cambia sus beneficios de Medicare ni le inscribe por sí sola.",
      KR: "Yo sèvi ak dat nesans ou ak kòd postal ou pou jwenn bon envitasyon swen an epi ede pwoteje enfòmasyon sante ou. Verifikasyon sa a pa chanje benefis Medicare ou epi li pa enskri ou poukont li."
    })
  },
  {
    intent: "CARE_INCLUDED",
    screens: ["CARE_RECOMMENDATION"],
    match: /(what|which).*(care|support).*(receive|included|get)|what does.*care include|qu[eé].*(cuidado|apoyo).*(recibir|incluye)|kisa.*(swen|sip[oò]).*(gen ladan|resevwa)/i,
    answer: locale => pick(locale, {
      EN: "Your ACCESS care includes ongoing support between visits, a connected blood pressure monitor for home readings, a personalized care plan, and coordination with Dr. Fresner Lee and your care team.",
      ES: "Su cuidado ACCESS incluye apoyo continuo entre visitas, un monitor conectado para medir la presión en casa, un plan de cuidado personalizado y coordinación con Dr. Fresner Lee y su equipo de atención.",
      KR: "Swen ACCESS ou gen ladan sipò ant vizit yo, yon monitè tansyon konekte pou mezi lakay, yon plan swen pèsonalize, ak kowòdinasyon avèk Dr. Fresner Lee ak ekip swen ou."
    })
  },
  {
    intent: "ONE_ACCESS_PROVIDER",
    screens: ["CONSENT_REVIEW"],
    match: /(two|more than one|multiple).*(access provider|access organization)|access provider.*same time|dos.*proveedores.*access|m[aá]s de un.*proveedor.*access|de.*founis[eè].*access/i,
    answer: locale => pick(locale, {
      EN: "No. You can receive this type of ACCESS care from only one participating provider at a time. You can still see your regular doctors and other Medicare providers.",
      ES: "No. Solo puede recibir este tipo de cuidado ACCESS de un proveedor participante a la vez. Puede seguir viendo a sus médicos habituales y a otros proveedores de Medicare.",
      KR: "Non. Ou ka resevwa kalite swen ACCESS sa a nan men yon sèl founisè patisipan alafwa. Ou ka toujou wè doktè nòmal ou yo ak lòt founisè Medicare."
    })
  },
  {
    intent: "ENROLLED_NEXT_STEP",
    screens: ["ENROLLMENT_CONFIRMED"],
    match: /(what.*(next|need to do)|what happens if.*later|i('ll| will) do this later)|qu[eé].*(sigue|hacer ahora)|hacerlo m[aá]s tarde|kisa.*(apre|pou m f[eè])|f[eè] sa pita/i,
    answer: (locale, context, text) => /later|m[aá]s tarde|pita/i.test(text)
      ? pick(locale, {
          EN: "Your ACCESS enrollment is already complete. If you choose “I’ll do this later,” you will leave this setup for now; the monitor request and medication reconciliation will remain pending, and your progress will be saved.",
          ES: "Su inscripción en ACCESS ya está completa. Si elige “Lo haré más tarde”, dejará esta configuración por ahora; la solicitud del monitor y la conciliación de medicamentos quedarán pendientes y se guardará su progreso.",
          KR: "Enskripsyon ACCESS ou deja fini. Si ou chwazi “M ap fè sa pita,” ou ap kite konfigirasyon an pou kounye a; demann monitè a ak verifikasyon medikaman yo ap rete annatant epi pwogrè ou ap anrejistre."
        })
      : pick(locale, {
          EN: "Your enrollment is complete. The next steps are to request your blood pressure monitor and reconcile the medications on your record. Select “Set up my care” to continue.",
          ES: "Su inscripción está completa. Los próximos pasos son solicitar su monitor de presión arterial y conciliar los medicamentos de su registro. Seleccione “Configurar mi cuidado” para continuar.",
          KR: "Enskripsyon ou fini. Pwochen etap yo se mande monitè tansyon ou epi verifye medikaman ki nan dosye ou. Chwazi “Konfigire swen mwen” pou kontinye."
        })
  },
  {
    intent: "CUFF_SIZE_GUIDANCE",
    screens: ["ACCESS_BP_DEVICE_INFO"],
    match: /(how|which).*(choose|select|know).*(cuff|size)|correct cuff size|cuff size.*fit|c[oó]mo.*(elegir|seleccionar).*(brazalete|talla)|ki jan.*(chwazi|konnen).*(manch[eè]t|gwos[eè])/i,
    answer: locale => pick(locale, {
      EN: "Measure around your upper arm and choose the matching range: Extra Small 15–28 cm (5.9–11 in), Standard 22–42 cm (8.7–16.5 in), or Extra Large 32–52 cm (12.6–20.5 in). If none fits, contact your care team before requesting the monitor.",
      ES: "Mida alrededor de la parte superior del brazo y elija el rango correspondiente: Extra pequeño 15–28 cm (5.9–11 in), Estándar 22–42 cm (8.7–16.5 in) o Extra grande 32–52 cm (12.6–20.5 in). Si ninguno le sirve, comuníquese con su equipo antes de solicitar el monitor.",
      KR: "Mezire otou pati anwo bra ou epi chwazi mezi ki koresponn lan: Trè piti 15–28 cm (5.9–11 pous), Nòmal 22–42 cm (8.7–16.5 pous), oswa Trè gwo 32–52 cm (12.6–20.5 pous). Si okenn pa bon, kontakte ekip swen ou anvan ou mande monitè a."
    })
  },
  {
    intent: "SHIPPING_ADDRESS_GUIDANCE",
    screens: ["ACCESS_BP_SHIPPING_ADDRESS"],
    match: /(address).*(wrong|incorrect|not right)|what.*if.*address|different address|direcci[oó]n.*(incorrecta|equivocada|distinta)|adr[eè]s.*(pa bon|diferan)/i,
    answer: locale => pick(locale, {
      EN: "If the address shown is wrong or you want delivery somewhere else, choose “Use a different address” and enter the delivery address before requesting the monitor.",
      ES: "Si la dirección mostrada es incorrecta o desea recibirlo en otro lugar, elija “Usar una dirección diferente” e ingrese la dirección de entrega antes de solicitar el monitor.",
      KR: "Si adrès ki parèt la pa bon oswa ou vle resevwa li yon lòt kote, chwazi “Sèvi ak yon lòt adrès” epi antre adrès livrezon an anvan ou mande monitè a."
    })
  },
  {
    intent: "SHIPPING_STATUS_LIMIT",
    screens: ["ACCESS_BP_SHIPPING_ADDRESS", "ACCESS_BP_FULFILLMENT_CONFIRMED", "ACCESS_ONBOARDING_COMPLETE"],
    match: /(how long|when).*(ship|shipping|arrive|deliver)|tracking number|cu[aá]nto.*(env[ií]o|llegar|entrega)|n[uú]mero de seguimiento|kil[eè].*(voye|rive|livre)|nimewo swivi/i,
    answer: (locale, context) => context.deviceFulfillmentStatus === "REQUESTED"
      ? pick(locale, {
          EN: "Your monitor request is recorded, but there is no confirmed shipping date, delivery date, or tracking number in your care record yet. Your care team will keep you updated as it is prepared and sent.",
          ES: "La solicitud de su monitor está registrada, pero todavía no hay una fecha de envío, entrega ni número de seguimiento confirmados en su registro. Su equipo le mantendrá informado mientras se prepara y se envía.",
          KR: "Demann monitè ou an anrejistre, men poko gen dat yo konfime pou voye oswa livre li, ni nimewo swivi nan dosye swen ou. Ekip swen ou ap ba ou nouvèl pandan y ap prepare epi voye li."
        })
      : pick(locale, {
          EN: "The monitor has not been requested yet, so there is no confirmed shipping date, delivery date, or tracking number. Confirm the delivery address and request the monitor first.",
          ES: "El monitor todavía no se ha solicitado, por lo que no hay fecha de envío, entrega ni número de seguimiento confirmados. Primero confirme la dirección y solicite el monitor.",
          KR: "Yo poko mande monitè a, kidonk pa gen dat yo konfime pou voye oswa livre li, ni nimewo swivi. Konfime adrès livrezon an epi mande monitè a anvan."
        })
  },
  {
    intent: "FULFILLMENT_NEXT_STEP",
    screens: ["ACCESS_BP_FULFILLMENT_CONFIRMED"],
    match: /(what.*(next|need to do|while i wait)|what happens if.*later|i('ll| will) do this later)|qu[eé].*(sigue|hacer|mientras espero)|hacerlo m[aá]s tarde|kisa.*(apre|pou m f[eè]|pandan m ap tann)|f[eè] sa pita/i,
    answer: (locale, context, text) => /later|m[aá]s tarde|pita/i.test(text)
      ? pick(locale, {
          EN: "Your monitor request is already complete. If you choose “I’ll do this later,” only the medication reconciliation will remain pending, and your progress will be saved.",
          ES: "La solicitud de su monitor ya está completa. Si elige “Lo haré más tarde”, solo quedará pendiente la conciliación de medicamentos y se guardará su progreso.",
          KR: "Demann monitè ou deja fini. Si ou chwazi “M ap fè sa pita,” se verifikasyon medikaman yo sèlman k ap rete annatant epi pwogrè ou ap anrejistre."
        })
      : pick(locale, {
          EN: "Your monitor request is complete. While it is being prepared, select “Review my medications” to complete the remaining medication reconciliation.",
          ES: "La solicitud de su monitor está completa. Mientras se prepara, seleccione “Revisar mis medicamentos” para completar la conciliación pendiente.",
          KR: "Demann monitè ou fini. Pandan y ap prepare li, chwazi “Revize medikaman mwen” pou fini verifikasyon medikaman ki rete a."
        })
  },
  {
    intent: "MEDICATION_REVIEW_REPORTING",
    screens: ["MEDICATIONS_REVIEW"],
    match: /(what.*(choose|select|press|tap|mark|report).*(dose|medication)|dose changed|stopped taking|no longer take)|(qu[eé].*(elijo|selecciono|marco).*(dosis|medicamento)|cambi[oó].*dosis|dej[eé] de tomar)|(kisa.*(chwazi|make).*(d[oò]z|medikaman)|d[oò]z.*chanje|sispann pran)/i,
    answer: locale => pick(locale, {
      EN: "Choose “Something changed” for that medication, then select the option that best describes the change, such as a changed dose or no longer taking it. This records what you report for your care team to review; it does not change the prescription automatically.",
      ES: "Elija “Algo cambió” para ese medicamento y luego seleccione la opción que mejor describa el cambio, como una dosis distinta o que ya no lo toma. Esto registra lo que informa para que su equipo lo revise; no cambia automáticamente la receta.",
      KR: "Chwazi “Gen yon bagay ki chanje” pou medikaman sa a, epi chwazi opsyon ki pi byen esplike chanjman an, tankou yon lòt dòz oswa ou pa pran li ankò. Sa anrejistre sa ou rapòte pou ekip swen ou revize; li pa chanje preskripsyon an otomatikman."
    })
  },
  {
    intent: "MEDICATION_MISSING",
    screens: ["MEDICATIONS_REVIEW"],
    match: /(medication|medicine|prescription).*(missing|not listed)|missing from.*list|medicamento.*(falta|no aparece|no est[aá])|medikaman.*(manke|pa nan lis)/i,
    answer: locale => pick(locale, {
      EN: "Select “Add another medication” and enter its name and, if you know them, the dose and instructions. It will be recorded as patient-reported information for your care team to review; it does not change a prescription.",
      ES: "Seleccione “Agregar otro medicamento” e ingrese el nombre y, si los conoce, la dosis y las instrucciones. Se registrará como información informada por usted para que su equipo la revise; no cambia una receta.",
      KR: "Chwazi “Ajoute yon lòt medikaman” epi antre non li ak dòz ak enstriksyon yo si ou konnen yo. Y ap anrejistre li kòm enfòmasyon ou rapòte pou ekip swen ou revize; sa pa chanje yon preskripsyon."
    })
  },
  {
    intent: "MEDICATION_REVIEW_UNSURE",
    screens: ["MEDICATIONS_REVIEW"],
    match: /(what.*do.*if.*not sure|not sure.*anything.*missing)|qu[eé].*hago.*no.*seguro|no.*seguro.*falta|kisa.*f[eè].*pa s[eè]ten|pa s[eè]ten.*manke/i,
    answer: locale => pick(locale, {
      EN: "That’s okay. If you are unsure whether anything is missing, choose “I’m not sure if anything is missing.” For uncertainty about one listed medication, choose “Something changed” and then “I’m not sure about this medication.” Your care team can review it with you.",
      ES: "Está bien. Si no está seguro de que falte algún medicamento, elija “No estoy seguro de si falta alguno”. Si la duda es sobre un medicamento de la lista, elija “Algo cambió” y luego “No estoy seguro de este medicamento”. Su equipo puede revisarlo con usted.",
      KR: "Sa pa yon pwoblèm. Si ou pa sèten si gen yon medikaman ki manke, chwazi “Mwen pa sèten si gen yon bagay ki manke.” Si ou pa sèten sou yon medikaman nan lis la, chwazi “Gen yon bagay ki chanje” epi “Mwen pa sèten sou medikaman sa a.” Ekip swen ou ka revize li avèk ou."
    })
  },
  {
    intent: "SETUP_COMPLETE",
    screens: ["ACCESS_ONBOARDING_COMPLETE"],
    match: /(any.*steps left|what.*left|what happens.*monitor|monitor.*now|setup complete|safely close)|queda.*paso|qu[eé].*monitor.*ahora|configuraci[oó]n.*completa|cerrar.*ventana|etap.*rete|kisa.*monit[eè].*kounye a|f[eè]men fen[eè]t/i,
    answer: (locale, context, text) => /(monitor|monit[eè])/i.test(text)
      ? pick(locale, {
          EN: "Your monitor request was received and it is being prepared for shipment. There is no confirmed shipping or delivery date yet; your care team will keep you updated. There are no more steps in this setup process.",
          ES: "La solicitud de su monitor fue recibida y se está preparando para el envío. Todavía no hay una fecha de envío o entrega confirmada; su equipo le mantendrá informado. No quedan más pasos en este proceso de configuración.",
          KR: "Yo resevwa demann monitè ou epi y ap prepare li pou voye. Poko gen dat yo konfime pou voye oswa livre li; ekip swen ou ap ba ou nouvèl. Pa gen lòt etap nan pwosesis konfigirasyon sa a."
        })
      : pick(locale, {
          EN: "Your ACCESS setup is complete: the monitor request and medication reconciliation are finished. There are no more steps in this process, and you can safely close this window.",
          ES: "Su configuración de ACCESS está completa: la solicitud del monitor y la conciliación de medicamentos terminaron. No quedan más pasos en este proceso y puede cerrar esta ventana con seguridad.",
          KR: "Konfigirasyon ACCESS ou fini: demann monitè a ak verifikasyon medikaman yo fini. Pa gen lòt etap nan pwosesis sa a epi ou ka fèmen fenèt sa a san pwoblèm."
        })
  },
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
  // A patient describing who is with them on the "Who is completing this?" screen is asking which of
  // the three options in front of them to press. Their words match the Care Circle rule below —
  // "mi hija me está ayudando" — so the answer they got was about inviting a supporter, which is a
  // different feature on a different screen. Scoped here and placed first, so the screen the patient
  // is on decides which question they are asking. The labels are quoted from that screen.
  {
    intent: "COMPLETION_ROLE",
    screens: ["DECISION_MAKER"],
    ids: ["decision-daughter-help", "decision-who-completes"],
    match: /(daughter|son|wife|husband|family|someone).{0,40}(help|complet|fill)|(help|complet|fill).{0,40}(daughter|son|wife|husband|family)|which option|what should i (pick|choose|select)|(hija|hijo|esposa|esposo|familiar|alguien).{0,40}(ayud|complet|llen)|(ayud|complet|llen).{0,40}(hija|hijo|esposa|esposo|familiar)|qu[eé] opci[oó]n|cu[aá]l (opci[oó]n|elijo|escojo)|(pitit|madanm|mari|fanmi|moun).{0,40}(ede|ranpli)|ki opsyon/i,
    answer: locale => pick(locale, {
      EN: "On this screen that is “Helping the patient”. Choose it when someone else is filling this in while the patient is present and making their own decisions — the option says exactly that. Choose “For myself” only if the patient is the one working through the screens. “Personal representative” is a different thing: it is for someone legally authorized to make healthcare decisions for the patient, and it is not the right choice while the patient is deciding for themselves.",
      ES: "En esta pantalla, esa opción es “Ayudando al paciente”. Elíjala cuando otra persona completa esto mientras el paciente está presente y toma sus propias decisiones — la opción lo dice así. Elija “Para mí” solo si es el paciente quien avanza por las pantallas. “Representante personal” es otra cosa: es para alguien autorizado legalmente a tomar decisiones médicas por el paciente, y no corresponde mientras el paciente decide por sí mismo.",
      KR: "Nan ekran sa a, se “Ede pasyan an”. Chwazi li lè yon lòt moun ap ranpli sa a pandan pasyan an prezan epi l ap pran pwòp desizyon li — se egzakteman sa opsyon an di. Chwazi “Pou tèt mwen” sèlman si se pasyan an k ap pase nan ekran yo. “Reprezantan pèsonèl” se yon lòt bagay: li pou yon moun ki gen otorizasyon legal pou pran desizyon swen sante pou pasyan an, epi li pa bon chwa a pandan pasyan an ap deside pou tèt li."
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
  },

  // --- Assigned goals ------------------------------------------------------------------------
  //
  // An ACCESS goal is assigned by the pathway. It is not chosen and it is not a preference, and
  // answering otherwise invites the patient to expect control they do not have.
  {
    intent: "GOAL_ASSIGNMENT",
    ids: ["goals-did-i-choose"],
    match: /did i (choose|pick|select) (these|those|my) goals|yo eleg[i]{1,2} estas metas|eske se mwen ki chwazi objektif|èske se mwen ki chwazi objektif/i,
    answer: locale => pick(locale, {
      EN: "No. These goals come with your ACCESS care — the programme assigns them based on your conditions and your care track. What you can choose is how we help you work on them, and what to tell us is getting in the way.",
      ES: "No. Estas metas vienen con su cuidado ACCESS: el programa las asigna según sus condiciones y su vía de cuidado. Lo que usted sí elige es cómo le ayudamos a trabajarlas y qué nos cuenta que se lo dificulta.",
      KR: "Non. Objektif sa yo vini ak swen ACCESS ou — pwogram nan bay yo dapre kondisyon ou ak wout swen ou. Sa ou ka chwazi se kijan nou ede w travay sou yo, ak sa ou di nou k ap anpeche w."
    })
  },
  {
    intent: "GOAL_ASSIGNMENT",
    ids: ["goals-remove-bp"],
    match: /can i (remove|delete|drop|cancel) (the |my )?(blood pressure|bp|weight) goal|puedo (quitar|eliminar) la meta|eske mwen ka retire objektif|èske mwen ka retire objektif/i,
    answer: locale => pick(locale, {
      EN: "That goal is part of the ACCESS care you enrolled in, so it is not something to switch off here. If it does not feel right for you, tell your care team — they can review what your care includes.",
      ES: "Esa meta forma parte del cuidado ACCESS en el que se inscribió, así que no es algo que se desactive aquí. Si no le encaja, dígaselo a su equipo de cuidado: ellos pueden revisar lo que incluye su cuidado.",
      KR: "Objektif sa a fè pati swen ACCESS ou enskri a, kidonk se pa yon bagay pou etenn isit la. Si li pa santi l bon pou ou, di ekip swen ou — yo ka revize sa swen ou genyen."
    })
  },

  // --- Barriers ------------------------------------------------------------------------------
  {
    intent: "BARRIER_PURPOSE",
    ids: ["barriers-why-asking"],
    screens: ["ACCESS_SUPPORT_NEEDS"],
    match: /why are you asking|por que me pregunt|poukisa n ap mande/i,
    answer: locale => pick(locale, {
      EN: "Your care plan is already in place — you do not have to build one. I am asking whether anything could make it harder to follow, so we can add the right support. If nothing is in the way, that is a complete answer.",
      ES: "Su plan de cuidado ya está listo; usted no tiene que crearlo. Le pregunto si algo podría dificultar seguirlo, para agregar el apoyo adecuado. Si nada se lo dificulta, esa es una respuesta completa.",
      KR: "Plan swen ou deja anplas — ou pa bezwen fè youn. M ap mande si gen yon bagay ki ka fè l pi difisil pou swiv, pou nou ka ajoute bon sipò a. Si anyen pa anpeche w, sa se yon repons konplè."
    })
  },
  {
    intent: "BARRIER_SUPPORT",
    ids: ["barriers-forget-medication"],
    match: /what happens if i say i forget|que pasa si digo que olvido|kisa k ap pase si mwen di mwen bliye/i,
    answer: locale => pick(locale, {
      EN: "We add support for it — reminders, and a follow-up from your care team if that would help. Nothing about your medications changes: what you take and when stays exactly as your clinician prescribed it.",
      ES: "Agregamos apoyo para eso: recordatorios y un seguimiento de su equipo de cuidado si ayuda. Nada de su medicación cambia: qué toma y cuándo sigue exactamente como se lo indicó su profesional clínico.",
      KR: "Nou ajoute sipò pou sa — rapèl, ak yon swivi nan men ekip swen ou si sa ta ede. Anyen nan medikaman ou pa chanje: sa ou pran ak kilè rete egzakteman jan doktè ou preskri l."
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
