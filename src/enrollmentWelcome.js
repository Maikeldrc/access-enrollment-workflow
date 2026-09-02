const T = (en, es, ht) => Object.freeze({ en, es, ht });

const common = Object.freeze({
  reassurance: T(
    "We’ll guide you step by step and help you get started.",
    "Le guiaremos paso a paso y le ayudaremos a comenzar.",
    "N ap gide w etap pa etap epi ede w kòmanse."
  ),
  footer: T(
    "Your care team is ready to support you",
    "Su equipo de cuidado está listo para apoyarle",
    "Ekip swen ou pare pou sipòte w"
  )
});

const highlights = Object.freeze({
  stepByStep: Object.freeze({ icon: "check", title: T("Step-by-step support", "Apoyo paso a paso", "Sipò etap pa etap"), description: T("We’ll guide you as you get started.", "Le guiaremos mientras comienza.", "N ap gide w pandan w ap kòmanse.") }),
  emmiAlongside: Object.freeze({ icon: "chat", title: T("EMMI is here along the way", "EMMI está aquí en todo el camino", "EMMI la avè w pandan tout wout la"), description: T("Ask questions, get guidance, and know what to do next whenever you need help.", "Haga preguntas, reciba orientación y sepa qué hacer después cuando necesite ayuda.", "Poze kesyon, jwenn gid, epi konnen kisa pou w fè apre lè ou bezwen èd.") }),
  connectedDoctors: Object.freeze({ icon: "people", title: T("Connected with your doctors", "Conectado con sus médicos", "Konekte ak doktè ou yo"), description: T("ITERA HEALTH helps keep your care coordinated with the doctors you already see.", "ITERA HEALTH ayuda a mantener su cuidado coordinado con los médicos que ya consulta.", "ITERA HEALTH ede kenbe swen ou kowòdone avèk doktè ou deja wè yo.") }),
  monitoringStart: Object.freeze({ icon: "device", title: T("Help getting started", "Ayuda para comenzar", "Èd pou kòmanse"), description: T("We’ll guide you through setting up your monitoring.", "Le guiaremos durante la configuración de su monitoreo.", "N ap gide w pandan w ap mete siveyans ou an plas.") }),
  monitoringSupport: Object.freeze({ icon: "chart", title: T("Connected monitoring support", "Apoyo de monitoreo conectado", "Sipò siveyans konekte"), description: T("Your care team can securely review readings from home.", "Su equipo de cuidado puede revisar de forma segura sus mediciones desde casa.", "Ekip swen ou ka revize mezi ou pran lakay an sekirite.") }),
  focusedSupport: Object.freeze({ icon: "target", title: T("Focused support", "Apoyo enfocado", "Sipò ki konsantre"), description: T("We’ll help you get started with support for your main health needs.", "Le ayudaremos a comenzar con apoyo para sus principales necesidades de salud.", "N ap ede w kòmanse ak sipò pou bezwen sante prensipal ou yo.") }),
  connectedCareTeam: Object.freeze({ icon: "people", title: T("Connected with your care team", "Conectado con su equipo de cuidado", "Konekte ak ekip swen ou"), description: T("ITERA HEALTH helps keep your care team connected around your needs.", "ITERA HEALTH ayuda a mantener a su equipo coordinado en torno a sus necesidades.", "ITERA HEALTH ede kenbe ekip swen ou konekte selon bezwen ou yo.") })
});

export const enrollmentWelcomeConfig = Object.freeze({
  ACCESS: Object.freeze({
    title: T("Welcome to your ACCESS care", "Bienvenido a su cuidado ACCESS", "Byenveni nan swen ACCESS ou"),
    supportingCopy: T("You’re now enrolled in ACCESS. Let’s request your monitor and confirm your medications.", "Ya está inscrito en ACCESS. Solicitemos su monitor y confirmemos sus medicamentos.", "Kounye a ou enskri nan ACCESS. Ann mande aparèy ou epi konfime medikaman ou yo."),
    supportHighlights: Object.freeze([highlights.emmiAlongside, highlights.connectedDoctors]),
    // These are the only two tasks in the ACCESS post-enrollment flow.
    nextSteps: Object.freeze([
      Object.freeze({ icon: "device", title: T("Request your blood pressure monitor", "Solicitar su monitor de presión arterial", "Mande aparèy tansyon ou"), description: T("We’ll collect the information needed to prepare and send your connected monitor.", "Recopilaremos la información necesaria para preparar y enviar su monitor conectado.", "N ap pran enfòmasyon ki nesesè pou prepare epi voye aparèy konekte ou a.") }),
      Object.freeze({ icon: "pill", title: T("Reconcile your medications", "Conciliar sus medicamentos", "Verifye medikaman ou yo"), description: T("You’ll confirm what you take and tell us if anything changed or is missing.", "Confirmará lo que toma y nos indicará si algo cambió o falta.", "W ap konfime sa ou pran epi di nou si gen yon chanjman oswa yon medikaman ki manke.") })
    ]),
    emmiWelcome: T("Congratulations, and welcome to your ACCESS care! Your enrollment is complete. I’ll help you request your monitor and reconcile your medications.", "¡Felicidades y bienvenido a su cuidado ACCESS! Su inscripción está completa. Le ayudaré a solicitar su monitor y conciliar sus medicamentos.", "Felisitasyon, epi byenveni nan swen ACCESS ou! Enskripsyon ou fini. M ap ede w mande aparèy ou epi verifye medikaman ou yo.")
  }),
  CCM: Object.freeze({
    title: T("Welcome to your Chronic Care Management experience", "Bienvenido a su experiencia de Manejo de Cuidados Crónicos", "Byenveni nan eksperyans Jesyon Swen Kwonik ou"),
    supportingCopy: T("You now have ongoing support to help manage your health between doctor visits.", "Ahora cuenta con apoyo continuo para ayudarle a manejar su salud entre visitas al médico.", "Kounye a ou gen sipò kontinyèl pou ede w jere sante ou ant vizit kay doktè."),
    supportHighlights: Object.freeze([highlights.stepByStep, highlights.connectedDoctors]),
    nextSteps: Object.freeze([
      T("Your care team will review your care plan", "Su equipo de cuidado revisará su plan de cuidado", "Ekip swen ou pral revize plan swen ou"),
      T("We’ll stay in touch between doctor visits", "Nos mantendremos en contacto entre visitas al médico", "N ap rete an kontak ant vizit kay doktè"),
      T("You’ll continue seeing your regular doctors", "Continuará viendo a sus médicos habituales", "W ap kontinye wè doktè ou konn wè yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! You did it — your enrollment is complete. Your care team and I are glad to support you between doctor visits and help you every step of the way.", "¡Felicidades y bienvenido! Lo logró: su inscripción está completa. Su equipo de cuidado y yo nos alegra acompañarle entre visitas médicas y ayudarle en cada paso.", "Felisitasyon, epi byenveni! Ou fè l — enskripsyon ou fini. Ekip swen ou ak mwen kontan sipòte w ant vizit kay doktè epi ede w nan chak etap.")
  }),
  RPM: Object.freeze({
    title: T("Welcome to your Remote Patient Monitoring experience", "Bienvenido a su experiencia de Monitoreo Remoto del Paciente", "Byenveni nan eksperyans Siveyans Pasyan a Distans ou"),
    supportingCopy: T("Your care team can now support you using health readings from home.", "Su equipo ahora puede apoyarle mediante mediciones de salud desde su hogar.", "Ekip swen ou kapab sipòte w kounye a avèk mezi sante ou pran lakay."),
    supportHighlights: Object.freeze([highlights.monitoringStart, highlights.monitoringSupport]),
    nextSteps: Object.freeze([
      T("We’ll help you get your monitoring started", "Le ayudaremos a comenzar su monitoreo", "N ap ede w kòmanse siveyans ou"),
      T("Your readings will be sent securely to your care team", "Sus mediciones se enviarán de forma segura a su equipo de cuidado", "Y ap voye mezi ou yo bay ekip swen ou an sekirite"),
      T("Your care team will follow up when needed", "Su equipo de cuidado dará seguimiento cuando sea necesario", "Ekip swen ou pral fè suivi lè sa nesesè")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. I’m excited to help you set up your monitoring and answer your questions along the way.", "¡Felicidades y bienvenido! Su inscripción está completa. Me alegra ayudarle a configurar su monitoreo y responder sus preguntas durante el proceso.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Mwen kontan ede w mete siveyans ou an plas epi reponn kesyon ou pandan pwosesis la.")
  }),
  CCM_RPM: Object.freeze({
    title: T("Welcome to your connected care experience", "Bienvenido a su experiencia de cuidado conectado", "Byenveni nan eksperyans swen konekte ou"),
    supportingCopy: T("You’ll receive ongoing care support and remote health monitoring between doctor visits.", "Recibirá apoyo continuo y monitoreo remoto de salud entre visitas al médico.", "W ap resevwa sipò swen kontinyèl ak siveyans sante a distans ant vizit kay doktè."),
    supportHighlights: Object.freeze([highlights.stepByStep, highlights.monitoringSupport]),
    nextSteps: Object.freeze([
      T("We’ll review your care plan", "Revisaremos su plan de cuidado", "N ap revize plan swen ou"),
      T("We’ll help set up your monitoring", "Le ayudaremos a configurar su monitoreo", "N ap ede w mete siveyans ou an plas"),
      T("Your care team will stay connected between visits", "Su equipo de cuidado se mantendrá conectado entre visitas", "Ekip swen ou ap rete konekte ant vizit yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. Your care team and I are glad to be with you as you begin monitoring and receive support between visits.", "¡Felicidades y bienvenido! Su inscripción está completa. Su equipo de cuidado y yo nos alegra acompañarle mientras inicia el monitoreo y recibe apoyo entre visitas.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Ekip swen ou ak mwen kontan la avè w pandan w ap kòmanse siveyans epi resevwa sipò ant vizit yo.")
  }),
  PCM: Object.freeze({
    title: T("Welcome to your Principal Care Management experience", "Bienvenido a su experiencia de Manejo de Cuidado Principal", "Byenveni nan eksperyans Jesyon Swen Prensipal ou"),
    supportingCopy: T("Your care team will help you stay focused on managing your primary health condition.", "Su equipo le ayudará a mantenerse enfocado en el manejo de su condición de salud principal.", "Ekip swen ou ap ede w rete konsantre sou jere pwoblèm sante prensipal ou."),
    supportHighlights: Object.freeze([highlights.focusedSupport, highlights.connectedCareTeam]),
    nextSteps: Object.freeze([
      T("We’ll review your condition-focused care plan", "Revisaremos su plan de cuidado enfocado en su condición", "N ap revize plan swen ki konsantre sou pwoblèm sante ou"),
      T("Your care team will stay in touch", "Su equipo de cuidado se mantendrá en contacto", "Ekip swen ou ap rete an kontak"),
      T("You’ll continue seeing your regular doctors", "Continuará viendo a sus médicos habituales", "W ap kontinye wè doktè ou konn wè yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. Your care team and I are happy to support what matters most for your health, one step at a time.", "¡Felicidades y bienvenido! Su inscripción está completa. Su equipo de cuidado y yo estamos felices de apoyar lo que más importa para su salud, paso a paso.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Ekip swen ou ak mwen kontan sipòte sa ki pi enpòtan pou sante ou, etap pa etap.")
  }),
  PCM_RPM: Object.freeze({
    title: T("Welcome to your connected condition care experience", "Bienvenido a su experiencia de cuidado conectado para su condición", "Byenveni nan eksperyans swen konekte pou pwoblèm sante ou"),
    supportingCopy: T("You’ll receive focused care support together with remote monitoring from home.", "Recibirá apoyo de cuidado enfocado junto con monitoreo remoto desde su hogar.", "W ap resevwa sipò swen ki konsantre ansanm ak siveyans a distans lakay."),
    supportHighlights: Object.freeze([highlights.focusedSupport, highlights.monitoringSupport]),
    nextSteps: Object.freeze([
      T("We’ll review your condition-focused care plan", "Revisaremos su plan de cuidado enfocado en su condición", "N ap revize plan swen ki konsantre sou pwoblèm sante ou"),
      T("We’ll help set up your monitoring", "Le ayudaremos a configurar su monitoreo", "N ap ede w mete siveyans ou an plas"),
      T("Your care team will follow your progress between visits", "Su equipo seguirá su progreso entre visitas", "Ekip swen ou ap suiv pwogrè ou ant vizit yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. Your care team and I are glad to support your main health needs as you begin monitoring.", "¡Felicidades y bienvenido! Su inscripción está completa. Su equipo de cuidado y yo nos alegra apoyar sus principales necesidades de salud mientras comienza el monitoreo.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Ekip swen ou ak mwen kontan sipòte bezwen sante prensipal ou pandan w ap kòmanse siveyans.")
  }),
  ASM: Object.freeze({
    useProgramDisplayName: true,
    supportingCopy: T("You now have ongoing specialty care support between doctor visits.", "Ahora cuenta con apoyo especializado continuo entre visitas al médico.", "Kounye a ou gen sipò swen espesyalize kontinyèl ant vizit kay doktè."),
    supportHighlights: Object.freeze([highlights.focusedSupport, highlights.connectedCareTeam]),
    nextSteps: Object.freeze([
      T("We’ll review your specialty care plan", "Revisaremos su plan de cuidado especializado", "N ap revize plan swen espesyalize ou"),
      T("Your care team will stay in touch between visits", "Su equipo se mantendrá en contacto entre visitas", "Ekip swen ou ap rete an kontak ant vizit yo"),
      T("Important updates will stay connected with your doctors", "Las actualizaciones importantes se coordinarán con sus médicos", "Mizajou enpòtan yo ap rete konekte ak doktè ou yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. Your specialty care support is ready, and I’m happy to be here with you whenever you need guidance.", "¡Felicidades y bienvenido! Su inscripción está completa. Su apoyo de cuidado especializado está listo y me alegra acompañarle cuando necesite orientación.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Sipò swen espesyalize ou pare, epi mwen kontan la avè w chak fwa ou bezwen gid.")
  }),
  APCM: Object.freeze({
    title: T("Welcome to your Advanced Primary Care experience", "Bienvenido a su experiencia de Atención Primaria Avanzada", "Byenveni nan eksperyans Swen Prensipal Avanse ou"),
    supportingCopy: T("Your care team will help coordinate and support your ongoing healthcare needs.", "Su equipo ayudará a coordinar y apoyar sus necesidades continuas de salud.", "Ekip swen ou ap ede kowòdone epi sipòte bezwen swen sante ou genyen sou yon baz kontinyèl."),
    supportHighlights: Object.freeze([highlights.stepByStep, highlights.connectedCareTeam]),
    nextSteps: Object.freeze([
      T("We’ll review your ongoing care needs", "Revisaremos sus necesidades continuas de cuidado", "N ap revize bezwen swen kontinyèl ou"),
      T("Your care team will help coordinate next steps", "Su equipo ayudará a coordinar los próximos pasos", "Ekip swen ou ap ede kowòdone pwochen etap yo"),
      T("You’ll continue seeing your regular doctors", "Continuará viendo a sus médicos habituales", "W ap kontinye wè doktè ou konn wè yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. Your care team and I are ready and happy to support your ongoing health needs every step of the way.", "¡Felicidades y bienvenido! Su inscripción está completa. Su equipo de cuidado y yo estamos listos y felices de apoyar sus necesidades continuas de salud en cada paso.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Ekip swen ou ak mwen pare epi kontan sipòte bezwen sante ou nan chak etap.")
  })
});

export function enrollmentWelcomeFor(pathway) {
  return enrollmentWelcomeConfig[pathway] || Object.freeze({
    useProgramDisplayName: true,
    supportingCopy: T("Your care experience with ITERA HEALTH is ready to begin.", "Su experiencia de cuidado con ITERA HEALTH está lista para comenzar.", "Eksperyans swen ou avèk ITERA HEALTH pare pou kòmanse."),
    supportHighlights: Object.freeze([highlights.stepByStep, highlights.connectedCareTeam]),
    nextSteps: Object.freeze([
      T("Your care team will review your next steps", "Su equipo revisará sus próximos pasos", "Ekip swen ou pral revize pwochen etap ou yo"),
      T("We’ll guide you as your care begins", "Le guiaremos mientras comienza su cuidado", "N ap gide w pandan swen ou ap kòmanse"),
      T("You’ll continue seeing your regular doctors", "Continuará viendo a sus médicos habituales", "W ap kontinye wè doktè ou konn wè yo")
    ]),
    emmiWelcome: T("Congratulations, and welcome! Your enrollment is complete. I’m happy to be here with you as you begin your care.", "¡Felicidades y bienvenido! Su inscripción está completa. Me alegra acompañarle mientras comienza su cuidado.", "Felisitasyon, epi byenveni! Enskripsyon ou fini. Mwen kontan la avè w pandan w ap kòmanse swen ou.")
  });
}

export { common as enrollmentWelcomeCommon };
