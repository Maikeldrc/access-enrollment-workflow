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
    supportingCopy: T("You’re now enrolled in ACCESS. Let’s get your care set up around your health and goals.", "Ya está inscrito en ACCESS. Vamos a configurar su cuidado en torno a su salud y sus metas.", "Kounye a ou enskri nan ACCESS. Ann mete swen ou an plas selon sante ou ak objektif ou."),
    supportHighlights: Object.freeze([highlights.emmiAlongside, highlights.connectedDoctors]),
    // Care activation, not a waiting list. The three steps are what the patient is about to do,
    // in the order they will do it: get the monitor ready, choose goals, build the plan. A call
    // from the care team still exists for exceptions and support, but it is not what happens next.
    nextSteps: Object.freeze([
      Object.freeze({ icon: "device", title: T("Your blood pressure monitor", "Su monitor de presión arterial", "Aparèy tansyon ou"), description: T("We’ll get your connected monitor ready so you can track your blood pressure from home.", "Prepararemos su monitor conectado para que pueda controlar su presión arterial desde casa.", "N ap prepare aparèy konekte ou a pou ou ka swiv tansyon ou lakay ou.") }),
      Object.freeze({ icon: "goals", title: T("Your health goals", "Sus metas de salud", "Objektif sante ou"), description: T("You’ll choose what matters most to you and what you want to work toward.", "Usted elegirá lo que más le importa y hacia qué quiere trabajar.", "Se ou k ap chwazi sa ki pi enpòtan pou ou ak sa ou vle travay pou li.") }),
      Object.freeze({ icon: "plan", title: T("Your personalized care plan", "Su plan de cuidado personalizado", "Plan swen pèsonalize ou"), description: T("Your health information, goals, and next steps will come together in your ACCESS care plan.", "Su información de salud, sus metas y sus próximos pasos se reúnen en su plan de cuidado ACCESS.", "Enfòmasyon sante ou, objektif ou, ak pwochen etap ou yo ap vin ansanm nan plan swen ACCESS ou.") })
    ]),
    emmiWelcome: T("Welcome. Your ACCESS enrollment is complete. Next we’ll set up your care: your monitor, your goals, and your care plan. I’ll be with you for all of it.", "Bienvenido. Su inscripción en ACCESS está completa. Ahora configuraremos su cuidado: su monitor, sus metas y su plan de cuidado. Estaré con usted en todo momento.", "Byenveni. Enskripsyon ACCESS ou fini. Kounye a n ap mete swen ou an plas: aparèy ou, objektif ou, ak plan swen ou. M ap la avè w pou tout sa.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. Your care team can now support you between doctor visits, and I’ll be here if you need help.", "Bienvenido. Su inscripción está completa. Su equipo ahora puede apoyarle entre visitas al médico, y estaré aquí si necesita ayuda.", "Byenveni. Enskripsyon ou fini. Ekip swen ou kapab sipòte w ant vizit kay doktè, epi m ap la si ou bezwen èd.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. I can help you get your monitoring set up and answer questions along the way.", "Bienvenido. Su inscripción está completa. Puedo ayudarle a configurar su monitoreo y responder sus preguntas durante el proceso.", "Byenveni. Enskripsyon ou fini. Mwen ka ede w mete siveyans ou an plas epi reponn kesyon ou pandan pwosesis la.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. I can help you get your monitoring started while your care team supports you between visits.", "Bienvenido. Su inscripción está completa. Puedo ayudarle a comenzar el monitoreo mientras su equipo le apoya entre visitas.", "Byenveni. Enskripsyon ou fini. Mwen ka ede w kòmanse siveyans lan pandan ekip swen ou sipòte w ant vizit yo.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. Your care team can now provide focused support, and I’ll be here if you need help.", "Bienvenido. Su inscripción está completa. Su equipo ahora puede brindarle apoyo enfocado, y estaré aquí si necesita ayuda.", "Byenveni. Enskripsyon ou fini. Ekip swen ou kapab ba w sipò ki konsantre, epi m ap la si ou bezwen èd.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. I can help you begin monitoring while your care team supports your main health condition.", "Bienvenido. Su inscripción está completa. Puedo ayudarle a comenzar el monitoreo mientras su equipo apoya su condición principal.", "Byenveni. Enskripsyon ou fini. Mwen ka ede w kòmanse siveyans pandan ekip swen ou sipòte pwoblèm sante prensipal ou.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. Your specialty care support is ready, and I’ll be here if you need help.", "Bienvenido. Su inscripción está completa. Su apoyo de cuidado especializado está listo, y estaré aquí si necesita ayuda.", "Byenveni. Enskripsyon ou fini. Sipò swen espesyalize ou pare, epi m ap la si ou bezwen èd.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. Your care team is ready to support your ongoing healthcare needs, and I’ll be here if you need help.", "Bienvenido. Su inscripción está completa. Su equipo está listo para apoyar sus necesidades continuas de salud, y estaré aquí si necesita ayuda.", "Byenveni. Enskripsyon ou fini. Ekip swen ou pare pou sipòte bezwen swen sante ou, epi m ap la si ou bezwen èd.")
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
    emmiWelcome: T("Welcome. Your enrollment is complete. I’ll be here as you get started with your care.", "Bienvenido. Su inscripción está completa. Estaré aquí mientras comienza su cuidado.", "Byenveni. Enskripsyon ou fini. M ap la pandan w ap kòmanse swen ou.")
  });
}

export { common as enrollmentWelcomeCommon };
