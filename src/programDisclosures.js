// Single source of truth for the patient-facing "Important information" screen and the
// disclosure summary reused by "Review and agree". ACCESS keeps its own CMS-specific
// disclosure logic in app.js; every other program renders from this configuration.
//
// Each disclosure carries a semantic `id` so combined programs (CCM + RPM, PCM + RPM)
// can merge two services without repeating voluntary participation, cost-sharing,
// privacy, or Medicare-benefit statements.

const T = (en, es, ht) => ({ en, es, ht });

const TITLES = {
  voluntary: T("Participation is voluntary", "La participación es voluntaria", "Patisipasyon an volontè"),
  cost: T("Your cost", "Su costo", "Pri w"),
  benefits: T("Your regular Medicare benefits stay the same", "Sus beneficios habituales de Medicare permanecen iguales", "Benefis Medicare ou nòmalman genyen yo rete menm jan an")
};

const BODIES = {
  voluntaryCombined: T("You choose whether to receive these services.", "Usted decide si desea recibir estos servicios.", "Se ou ki chwazi si w ap resevwa sèvis sa yo."),
  costCombined: T("Medicare covers these services when requirements are met, but your usual deductible or coinsurance may apply.", "Medicare cubre estos servicios cuando se cumplen los requisitos, pero puede aplicarse su deducible o coseguro habitual.", "Medicare kouvri sèvis sa yo lè kondisyon yo ranpli, men dediktib oswa koasirans abityèl ou ka aplike."),
  emergency: T("Contact 911 or seek emergency care for a medical emergency.", "Llame al 911 o busque atención de emergencia si tiene una emergencia médica.", "Rele 911 oswa chèche swen ijans si ou gen yon ijans medikal."),
  connectedMonitoring: T("Your readings are sent automatically from your connected device to support your care.", "Sus mediciones se envían automáticamente desde su dispositivo conectado para apoyar su cuidado.", "Yo voye mezi ou yo otomatikman soti nan aparèy konekte ou pou sipòte swen ou."),
  connectedMonitoringShort: T("Your readings are sent automatically from your connected device.", "Sus mediciones se envían automáticamente desde su dispositivo conectado.", "Yo voye mezi ou yo otomatikman soti nan aparèy konekte ou.")
};

const DISCLOSURES = {
  voluntary: body => ({ id: "voluntary", icon: "people", title: TITLES.voluntary, body }),
  cost: body => ({ id: "cost", icon: "info", title: TITLES.cost, body }),
  stopping: (title, body) => ({ id: "stopping", icon: "clock", title, body }),
  benefits: body => ({ id: "benefits", icon: "shield", title: TITLES.benefits, body }),
  billing: () => ({
    id: "billing",
    icon: "doctor",
    title: T("Only one practitioner can bill for CCM each month", "Solo un profesional puede facturar CCM cada mes", "Se yon sèl pwofesyonèl ki ka faktire CCM chak mwa"),
    body: T("Only one practitioner can provide and bill Medicare for CCM during the same calendar month.", "Solo un profesional puede brindar y facturar CCM a Medicare durante el mismo mes calendario.", "Se yon sèl pwofesyonèl ki ka bay epi faktire Medicare pou CCM pandan menm mwa kalandriye a.")
  }),
  emergency: title => ({ id: "emergency", icon: "phone", title, body: BODIES.emergency }),
  connectedMonitoring: body => ({
    id: "connectedMonitoring",
    icon: "device",
    title: T("Connected monitoring", "Monitoreo conectado", "Siveyans konekte"),
    body
  })
};

const SECTIONS = {
  privacy: {
    id: "privacy",
    title: T("Privacy and your information", "Privacidad y su información", "Vi prive ak enfòmasyon ou"),
    body: T(
      "Your information is used to coordinate your care and is protected under applicable privacy rules. It is shared with the clinicians involved in your care and is not sold.",
      "Su información se usa para coordinar su cuidado y está protegida por las reglas de privacidad aplicables. Se comparte con los profesionales que participan en su cuidado y no se vende.",
      "Yo itilize enfòmasyon ou pou kowòdone swen ou epi li pwoteje anba règleman sou vi prive ki aplikab yo. Yo pataje li ak pwofesyonèl k ap patisipe nan swen ou epi yo pa vann li."
    )
  },
  help: {
    id: "help",
    title: T("Questions and help", "Preguntas y ayuda", "Kesyon ak èd"),
    body: T(
      "You can contact the ITERA HEALTH care team at (305) 394-8070 before you decide. Nothing is final until you review and agree on the next screen.",
      "Puede comunicarse con el equipo de cuidado de ITERA HEALTH al (305) 394-8070 antes de decidir. Nada es definitivo hasta que revise y acepte en la siguiente pantalla.",
      "Ou ka kontakte ekip swen ITERA HEALTH nan (305) 394-8070 anvan ou deside. Anyen pa final jiskaske ou revize epi dakò nan pwochen ekran an."
    )
  },
  device: {
    id: "device",
    title: T("Your device and how readings are sent", "Su dispositivo y cómo se envían las mediciones", "Aparèy ou ak kijan yo voye mezi yo"),
    body: T(
      "Your connected monitor sends each reading automatically to your care team. The device is used only to support your care, and your care team can help with setup.",
      "Su monitor conectado envía cada medición automáticamente a su equipo de cuidado. El dispositivo se usa solo para apoyar su cuidado, y su equipo puede ayudarle con la configuración.",
      "Monitè konekte ou voye chak mezi otomatikman bay ekip swen ou. Yo itilize aparèy la sèlman pou sipòte swen ou, epi ekip swen ou ka ede w ak konfigirasyon an."
    )
  },
  emergencyLimits: {
    id: "emergencyLimits",
    title: T("Emergency limitations", "Limitaciones en emergencias", "Limit nan ka ijans"),
    body: T(
      "Remote monitoring is not an emergency service and your readings are not watched at all times. Contact 911 or seek emergency care for a medical emergency.",
      "El monitoreo remoto no es un servicio de emergencia y sus mediciones no se vigilan en todo momento. Llame al 911 o busque atención de emergencia si tiene una emergencia médica.",
      "Siveyans a distans pa yon sèvis ijans epi yo pa gade mezi ou yo tout tan. Rele 911 oswa chèche swen ijans si ou gen yon ijans medikal."
    )
  }
};

const section = (title, body) => ({ title, body });

export const PROGRAM_DISCLOSURE_CONFIG = {
  CCM: {
    displayName: T("Chronic Care Management (CCM)", "Manejo de Cuidados Crónicos (CCM)", "Jesyon Swen Kwonik (CCM)"),
    fullInformationLabel: T("View full CCM information", "Ver información completa de CCM", "Gade tout enfòmasyon CCM"),
    disclosures: [
      DISCLOSURES.voluntary(T("You choose whether to receive CCM services.", "Usted decide si desea recibir los servicios de CCM.", "Se ou ki chwazi si w ap resevwa sèvis CCM yo.")),
      DISCLOSURES.cost(T("Medicare covers CCM, but your usual deductible or coinsurance may apply.", "Medicare cubre CCM, pero puede aplicarse su deducible o coseguro habitual.", "Medicare kouvri CCM, men dediktib oswa koasirans abityèl ou ka aplike.")),
      DISCLOSURES.stopping(
        T("You may stop CCM at any time", "Puede detener CCM en cualquier momento", "Ou ka sispann CCM nenpòt lè"),
        T("Your request takes effect at the end of the calendar month.", "Su solicitud entra en vigor al final del mes calendario.", "Demann ou an ap antre an vigè nan fen mwa kalandriye a.")
      ),
      DISCLOSURES.billing()
    ],
    fullInformation: [
      section(
        T("What Chronic Care Management includes", "Qué incluye el Manejo de Cuidados Crónicos", "Sa Jesyon Swen Kwonik gen ladan"),
        T("CCM gives you ongoing support between office visits: a personalized care plan, help keeping medications on track, and coordination between ITERA HEALTH and the doctors you already see.", "CCM le brinda apoyo continuo entre visitas al consultorio: un plan de cuidado personalizado, ayuda para mantener sus medicamentos al día y coordinación entre ITERA HEALTH y los médicos que ya consulta.", "CCM ba ou sipò kontinyèl ant vizit nan biwo doktè: yon plan swen pèsonalize, èd pou kontinye suiv medikaman ou, ak kowòdinasyon ant ITERA HEALTH ak doktè ou deja wè yo.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive CCM services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir los servicios de CCM. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis CCM yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare covers CCM. Your usual Medicare deductible or coinsurance may apply. Your care team can help you understand your coverage before you decide.", "Medicare cubre CCM. Puede aplicarse su deducible o coseguro habitual de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Medicare kouvri CCM. Dediktib oswa koasirans Medicare abityèl ou ka aplike. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping CCM", "Detener CCM", "Sispann CCM"),
        T("You may stop CCM at any time. Tell your care team, and your request takes effect at the end of the calendar month.", "Puede detener CCM en cualquier momento. Avise a su equipo de cuidado; su solicitud entra en vigor al final del mes calendario.", "Ou ka sispann CCM nenpòt lè. Di ekip swen ou, epi demann ou an ap antre an vigè nan fen mwa kalandriye a.")
      ),
      section(
        T("Billing and provider limits", "Facturación y límites del proveedor", "Faktirasyon ak limit founisè"),
        T("Only one practitioner can provide and bill Medicare for CCM during the same calendar month. If another practitioner already bills CCM for you, ITERA HEALTH will not bill for the same month.", "Solo un profesional puede brindar y facturar CCM a Medicare durante el mismo mes calendario. Si otro profesional ya factura CCM por usted, ITERA HEALTH no facturará ese mismo mes.", "Se yon sèl pwofesyonèl ki ka bay epi faktire Medicare pou CCM pandan menm mwa kalandriye a. Si yon lòt pwofesyonèl deja faktire CCM pou ou, ITERA HEALTH p ap faktire pou menm mwa a.")
      ),
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  RPM: {
    displayName: T("Remote Patient Monitoring (RPM)", "Monitoreo Remoto del Paciente (RPM)", "Siveyans Pasyan a Distans (RPM)"),
    fullInformationLabel: T("View full RPM information", "Ver información completa de RPM", "Gade tout enfòmasyon RPM"),
    disclosures: [
      DISCLOSURES.voluntary(T("You choose whether to receive RPM services.", "Usted decide si desea recibir los servicios de RPM.", "Se ou ki chwazi si w ap resevwa sèvis RPM yo.")),
      DISCLOSURES.cost(T("Medicare covers RPM when requirements are met, but your usual deductible or coinsurance may apply.", "Medicare cubre RPM cuando se cumplen los requisitos, pero puede aplicarse su deducible o coseguro habitual.", "Medicare kouvri RPM lè kondisyon yo ranpli, men dediktib oswa koasirans abityèl ou ka aplike.")),
      DISCLOSURES.stopping(
        T("You may stop monitoring", "Puede detener el monitoreo", "Ou ka sispann siveyans lan"),
        T("You can choose to stop RPM services.", "Usted puede decidir detener los servicios de RPM.", "Ou ka chwazi sispann sèvis RPM yo.")
      ),
      DISCLOSURES.emergency(T("This service is not for emergencies", "Este servicio no es para emergencias", "Sèvis sa a pa pou ijans")),
      DISCLOSURES.connectedMonitoring(BODIES.connectedMonitoring)
    ],
    fullInformation: [
      section(
        T("What Remote Patient Monitoring includes", "Qué incluye el Monitoreo Remoto del Paciente", "Sa Siveyans Pasyan a Distans gen ladan"),
        T("RPM uses a connected monitor at home. Your readings are sent to your care team, who review them for important changes and follow up when a reading needs attention.", "RPM usa un monitor conectado en su hogar. Sus mediciones se envían a su equipo de cuidado, que revisa los cambios importantes y da seguimiento cuando una medición necesita atención.", "RPM itilize yon monitè konekte lakay ou. Yo voye mezi ou yo bay ekip swen ou, ki revize yo pou chanjman enpòtan epi ki fè suivi lè yon mezi bezwen atansyon.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive RPM services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir los servicios de RPM. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis RPM yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare covers RPM when program requirements are met. Your usual Medicare deductible or coinsurance may apply. Your care team can help you understand your coverage before you decide.", "Medicare cubre RPM cuando se cumplen los requisitos del programa. Puede aplicarse su deducible o coseguro habitual de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Medicare kouvri RPM lè kondisyon pwogram nan ranpli. Dediktib oswa koasirans Medicare abityèl ou ka aplike. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping RPM", "Detener RPM", "Sispann RPM"),
        T("You can choose to stop RPM services. Tell your care team and they will confirm the next steps with you.", "Usted puede decidir detener los servicios de RPM. Avise a su equipo de cuidado y le confirmarán los próximos pasos.", "Ou ka chwazi sispann sèvis RPM yo. Di ekip swen ou epi y ap konfime pwochen etap yo avèk ou.")
      ),
      SECTIONS.device,
      SECTIONS.emergencyLimits,
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  CCM_RPM: {
    displayName: T("Chronic Care Management + Remote Patient Monitoring", "Manejo de Cuidados Crónicos + Monitoreo Remoto del Paciente", "Jesyon Swen Kwonik + Siveyans Pasyan a Distans"),
    fullInformationLabel: T("View full CCM + RPM information", "Ver información completa de CCM + RPM", "Gade tout enfòmasyon CCM + RPM"),
    disclosures: [
      DISCLOSURES.voluntary(BODIES.voluntaryCombined),
      DISCLOSURES.cost(BODIES.costCombined),
      DISCLOSURES.stopping(
        T("Stopping these services", "Detener estos servicios", "Sispann sèvis sa yo"),
        T("You can choose to stop these services. A request to stop CCM takes effect at the end of the calendar month.", "Usted puede decidir detener estos servicios. Una solicitud para detener CCM entra en vigor al final del mes calendario.", "Ou ka chwazi sispann sèvis sa yo. Yon demann pou sispann CCM ap antre an vigè nan fen mwa kalandriye a.")
      ),
      DISCLOSURES.billing(),
      DISCLOSURES.emergency(T("Remote monitoring is not for emergencies", "El monitoreo remoto no es para emergencias", "Siveyans a distans pa pou ijans")),
      DISCLOSURES.connectedMonitoring(BODIES.connectedMonitoringShort)
    ],
    fullInformation: [
      section(
        T("What these services include", "Qué incluyen estos servicios", "Sa sèvis sa yo gen ladan"),
        T("Chronic Care Management gives you ongoing support between office visits, including a personalized care plan and medication support. Remote Patient Monitoring adds a connected monitor at home so your care team can follow important changes between visits.", "El Manejo de Cuidados Crónicos le brinda apoyo continuo entre visitas, con un plan de cuidado personalizado y apoyo con los medicamentos. El Monitoreo Remoto del Paciente agrega un monitor conectado en su hogar para que su equipo siga los cambios importantes entre visitas.", "Jesyon Swen Kwonik ba ou sipò kontinyèl ant vizit yo, ak yon plan swen pèsonalize epi sipò pou medikaman. Siveyans Pasyan a Distans ajoute yon monitè konekte lakay ou pou ekip swen ou ka suiv chanjman enpòtan ant vizit yo.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive these services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir estos servicios. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis sa yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare covers these services when program requirements are met. Your usual Medicare deductible or coinsurance may apply. Your care team can help you understand your coverage before you decide.", "Medicare cubre estos servicios cuando se cumplen los requisitos del programa. Puede aplicarse su deducible o coseguro habitual de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Medicare kouvri sèvis sa yo lè kondisyon pwogram nan ranpli. Dediktib oswa koasirans Medicare abityèl ou ka aplike. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping these services", "Detener estos servicios", "Sispann sèvis sa yo"),
        T("You can stop either service, or both, at any time. A request to stop CCM takes effect at the end of the calendar month. Your care team will confirm the next steps for monitoring.", "Puede detener cualquiera de los servicios, o ambos, en cualquier momento. Una solicitud para detener CCM entra en vigor al final del mes calendario. Su equipo confirmará los próximos pasos del monitoreo.", "Ou ka sispann nenpòt nan sèvis yo, oswa toulède, nenpòt lè. Yon demann pou sispann CCM ap antre an vigè nan fen mwa kalandriye a. Ekip swen ou ap konfime pwochen etap yo pou siveyans lan.")
      ),
      section(
        T("Billing and provider limits", "Facturación y límites del proveedor", "Faktirasyon ak limit founisè"),
        T("Only one practitioner can provide and bill Medicare for CCM during the same calendar month. If another practitioner already bills CCM for you, ITERA HEALTH will not bill for the same month.", "Solo un profesional puede brindar y facturar CCM a Medicare durante el mismo mes calendario. Si otro profesional ya factura CCM por usted, ITERA HEALTH no facturará ese mismo mes.", "Se yon sèl pwofesyonèl ki ka bay epi faktire Medicare pou CCM pandan menm mwa kalandriye a. Si yon lòt pwofesyonèl deja faktire CCM pou ou, ITERA HEALTH p ap faktire pou menm mwa a.")
      ),
      SECTIONS.device,
      SECTIONS.emergencyLimits,
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  PCM: {
    displayName: T("Principal Care Management (PCM)", "Manejo de Cuidado Principal (PCM)", "Jesyon Swen Prensipal (PCM)"),
    fullInformationLabel: T("View full PCM information", "Ver información completa de PCM", "Gade tout enfòmasyon PCM"),
    disclosures: [
      DISCLOSURES.voluntary(T("You choose whether to receive PCM services.", "Usted decide si desea recibir los servicios de PCM.", "Se ou ki chwazi si w ap resevwa sèvis PCM yo.")),
      DISCLOSURES.cost(T("Medicare covers PCM when requirements are met, but your usual deductible or coinsurance may apply.", "Medicare cubre PCM cuando se cumplen los requisitos, pero puede aplicarse su deducible o coseguro habitual.", "Medicare kouvri PCM lè kondisyon yo ranpli, men dediktib oswa koasirans abityèl ou ka aplike.")),
      DISCLOSURES.stopping(
        T("Stopping PCM", "Detener PCM", "Sispann PCM"),
        T("You may stop PCM at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener PCM en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann PCM nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      DISCLOSURES.benefits(T("Choosing whether to receive PCM does not change your regular Medicare benefits.", "Decidir si recibe PCM no cambia sus beneficios habituales de Medicare.", "Chwazi si w ap resevwa PCM pa chanje benefis Medicare ou nòmalman genyen yo."))
    ],
    fullInformation: [
      section(
        T("What Principal Care Management includes", "Qué incluye el Manejo de Cuidado Principal", "Sa Jesyon Swen Prensipal gen ladan"),
        T("PCM gives you focused support for the one condition that needs the most attention right now: a care plan for that condition, medication support, and coordination between ITERA HEALTH and the doctors you already see.", "PCM le brinda apoyo enfocado en la condición que más atención necesita ahora: un plan de cuidado para esa condición, apoyo con los medicamentos y coordinación entre ITERA HEALTH y los médicos que ya consulta.", "PCM ba ou sipò ki konsantre sou kondisyon ki bezwen plis atansyon kounye a: yon plan swen pou kondisyon sa a, sipò pou medikaman, ak kowòdinasyon ant ITERA HEALTH ak doktè ou deja wè yo.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive PCM services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir los servicios de PCM. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis PCM yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare covers PCM when program requirements are met. Your usual Medicare deductible or coinsurance may apply. Your care team can help you understand your coverage before you decide.", "Medicare cubre PCM cuando se cumplen los requisitos del programa. Puede aplicarse su deducible o coseguro habitual de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Medicare kouvri PCM lè kondisyon pwogram nan ranpli. Dediktib oswa koasirans Medicare abityèl ou ka aplike. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping PCM", "Detener PCM", "Sispann PCM"),
        T("You may stop PCM at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener PCM en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann PCM nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      section(
        TITLES.benefits,
        T("Choosing whether to receive PCM does not change your regular Medicare benefits, coverage, or rights, and you can continue seeing your regular doctors.", "Decidir si recibe PCM no cambia sus beneficios, cobertura ni derechos habituales de Medicare, y puede continuar viendo a sus médicos de siempre.", "Chwazi si w ap resevwa PCM pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo, epi ou ka kontinye wè doktè ou konn wè yo.")
      ),
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  PCM_RPM: {
    displayName: T("Principal Care Management + Remote Patient Monitoring", "Manejo de Cuidado Principal + Monitoreo Remoto del Paciente", "Jesyon Swen Prensipal + Siveyans Pasyan a Distans"),
    fullInformationLabel: T("View full PCM + RPM information", "Ver información completa de PCM + RPM", "Gade tout enfòmasyon PCM + RPM"),
    disclosures: [
      DISCLOSURES.voluntary(BODIES.voluntaryCombined),
      DISCLOSURES.cost(BODIES.costCombined),
      DISCLOSURES.stopping(
        T("Stopping these services", "Detener estos servicios", "Sispann sèvis sa yo"),
        T("You can choose to stop these services. Tell your care team and they will confirm when the change takes effect.", "Usted puede decidir detener estos servicios. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka chwazi sispann sèvis sa yo. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      DISCLOSURES.benefits(T("Choosing whether to receive these services does not change your regular Medicare benefits.", "Decidir si recibe estos servicios no cambia sus beneficios habituales de Medicare.", "Chwazi si w ap resevwa sèvis sa yo pa chanje benefis Medicare ou nòmalman genyen yo.")),
      DISCLOSURES.emergency(T("Remote monitoring is not for emergencies", "El monitoreo remoto no es para emergencias", "Siveyans a distans pa pou ijans")),
      DISCLOSURES.connectedMonitoring(BODIES.connectedMonitoringShort)
    ],
    fullInformation: [
      section(
        T("What these services include", "Qué incluyen estos servicios", "Sa sèvis sa yo gen ladan"),
        T("Principal Care Management gives you focused support for the condition that needs the most attention right now. Remote Patient Monitoring adds a connected monitor at home so your care team can follow important changes between visits.", "El Manejo de Cuidado Principal le brinda apoyo enfocado en la condición que más atención necesita ahora. El Monitoreo Remoto del Paciente agrega un monitor conectado en su hogar para que su equipo siga los cambios importantes entre visitas.", "Jesyon Swen Prensipal ba ou sipò ki konsantre sou kondisyon ki bezwen plis atansyon kounye a. Siveyans Pasyan a Distans ajoute yon monitè konekte lakay ou pou ekip swen ou ka suiv chanjman enpòtan ant vizit yo.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive these services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir estos servicios. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis sa yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare covers these services when program requirements are met. Your usual Medicare deductible or coinsurance may apply. Your care team can help you understand your coverage before you decide.", "Medicare cubre estos servicios cuando se cumplen los requisitos del programa. Puede aplicarse su deducible o coseguro habitual de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Medicare kouvri sèvis sa yo lè kondisyon pwogram nan ranpli. Dediktib oswa koasirans Medicare abityèl ou ka aplike. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping these services", "Detener estos servicios", "Sispann sèvis sa yo"),
        T("You can stop either service, or both, at any time. Tell your care team and they will confirm when the change takes effect and the next steps for monitoring.", "Puede detener cualquiera de los servicios, o ambos, en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio y los próximos pasos del monitoreo.", "Ou ka sispann nenpòt nan sèvis yo, oswa toulède, nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè ak pwochen etap yo pou siveyans lan.")
      ),
      section(
        TITLES.benefits,
        T("Choosing whether to receive these services does not change your regular Medicare benefits, coverage, or rights, and you can continue seeing your regular doctors.", "Decidir si recibe estos servicios no cambia sus beneficios, cobertura ni derechos habituales de Medicare, y puede continuar viendo a sus médicos de siempre.", "Chwazi si w ap resevwa sèvis sa yo pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo, epi ou ka kontinye wè doktè ou konn wè yo.")
      ),
      SECTIONS.device,
      SECTIONS.emergencyLimits,
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  // ASM has no confirmed patient-friendly brand name beyond the configured service label,
  // so the configured label is reused here rather than inventing a new one.
  ASM: {
    displayName: T("Advanced Specialty Management (ASM)", "Manejo Especializado Avanzado (ASM)", "Jesyon Espesyalize Avanse (ASM)"),
    fullInformationLabel: T("View full ASM information", "Ver información completa de ASM", "Gade tout enfòmasyon ASM"),
    disclosures: [
      DISCLOSURES.voluntary(T("You choose whether to receive ASM services.", "Usted decide si desea recibir los servicios de ASM.", "Se ou ki chwazi si w ap resevwa sèvis ASM yo.")),
      DISCLOSURES.cost(T("Medicare cost-sharing may apply. Your care team can help you understand your coverage.", "Puede aplicarse el costo compartido de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura.", "Pataj depans Medicare ka aplike. Ekip swen ou ka ede w konprann kouvèti ou.")),
      DISCLOSURES.stopping(
        T("Stopping the service", "Detener el servicio", "Sispann sèvis la"),
        T("You may stop this service at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener este servicio en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann sèvis sa a nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      DISCLOSURES.benefits(T("Choosing whether to receive this service does not change your regular Medicare benefits.", "Decidir si recibe este servicio no cambia sus beneficios habituales de Medicare.", "Chwazi si w ap resevwa sèvis sa a pa chanje benefis Medicare ou nòmalman genyen yo."))
    ],
    fullInformation: [
      section(
        T("What this service includes", "Qué incluye este servicio", "Sa sèvis sa a gen ladan"),
        T("Support aligned with your specialist’s treatment plan, regular follow-up between visits, help staying on track with medications and next steps, and important updates shared with your doctors.", "Apoyo alineado con el plan de tratamiento de su especialista, seguimiento regular entre visitas, ayuda para seguir sus medicamentos y próximos pasos, y actualizaciones importantes compartidas con sus médicos.", "Sipò ki mache ak plan tretman espesyalis ou, suivi regilye ant vizit yo, èd pou suiv medikaman ou ak pwochen etap yo, ak mizajou enpòtan yo pataje ak doktè ou yo.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive this service. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir este servicio. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis sa a. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare cost-sharing may apply to this service. Your care team can help you understand your coverage before you decide.", "Puede aplicarse el costo compartido de Medicare a este servicio. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Pataj depans Medicare ka aplike pou sèvis sa a. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping the service", "Detener el servicio", "Sispann sèvis la"),
        T("You may stop this service at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener este servicio en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann sèvis sa a nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      section(
        TITLES.benefits,
        T("Choosing whether to receive this service does not change your regular Medicare benefits, coverage, or rights, and you can continue seeing your regular doctors.", "Decidir si recibe este servicio no cambia sus beneficios, cobertura ni derechos habituales de Medicare, y puede continuar viendo a sus médicos de siempre.", "Chwazi si w ap resevwa sèvis sa a pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo, epi ou ka kontinye wè doktè ou konn wè yo.")
      ),
      SECTIONS.privacy,
      SECTIONS.help
    ]
  },

  APCM: {
    displayName: T("Advanced Primary Care Management (APCM)", "Manejo Avanzado de Atención Primaria (APCM)", "Jesyon Swen Prensipal Avanse (APCM)"),
    fullInformationLabel: T("View full APCM information", "Ver información completa de APCM", "Gade tout enfòmasyon APCM"),
    disclosures: [
      DISCLOSURES.voluntary(T("You choose whether to receive APCM services.", "Usted decide si desea recibir los servicios de APCM.", "Se ou ki chwazi si w ap resevwa sèvis APCM yo.")),
      DISCLOSURES.cost(T("Medicare cost-sharing may apply. Your care team can help you understand your coverage.", "Puede aplicarse el costo compartido de Medicare. Su equipo de cuidado puede ayudarle a entender su cobertura.", "Pataj depans Medicare ka aplike. Ekip swen ou ka ede w konprann kouvèti ou.")),
      DISCLOSURES.stopping(
        T("Stopping the service", "Detener el servicio", "Sispann sèvis la"),
        T("You may stop this service at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener este servicio en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann sèvis sa a nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      DISCLOSURES.benefits(T("Choosing whether to receive APCM does not change your regular Medicare benefits.", "Decidir si recibe APCM no cambia sus beneficios habituales de Medicare.", "Chwazi si w ap resevwa APCM pa chanje benefis Medicare ou nòmalman genyen yo."))
    ],
    fullInformation: [
      section(
        T("What Advanced Primary Care Management includes", "Qué incluye el Manejo Avanzado de Atención Primaria", "Sa Jesyon Swen Prensipal Avanse gen ladan"),
        T("Comprehensive coordination of your primary care needs, regular check-ins between office visits, help staying on track with medications and goals, and updates coordinated with your physician.", "Coordinación integral de sus necesidades de atención primaria, controles periódicos entre visitas al consultorio, ayuda para seguir sus medicamentos y objetivos, y actualizaciones coordinadas con su médico.", "Kowòdinasyon konplè bezwen swen prensipal ou, tcheke regilyèman ant vizit nan biwo doktè, èd pou suiv medikaman ou ak objektif ou, ak mizajou ki kowòdone ak doktè ou.")
      ),
      section(
        TITLES.voluntary,
        T("You choose whether to receive APCM services. Your decision does not change your regular Medicare benefits, coverage, or rights.", "Usted decide si desea recibir los servicios de APCM. Su decisión no cambia sus beneficios, cobertura ni derechos habituales de Medicare.", "Se ou ki chwazi si w ap resevwa sèvis APCM yo. Desizyon ou pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo.")
      ),
      section(
        T("Medicare coverage and your cost", "Cobertura de Medicare y su costo", "Kouvèti Medicare ak pri w"),
        T("Medicare cost-sharing may apply to APCM. Your care team can help you understand your coverage before you decide.", "Puede aplicarse el costo compartido de Medicare a APCM. Su equipo de cuidado puede ayudarle a entender su cobertura antes de decidir.", "Pataj depans Medicare ka aplike pou APCM. Ekip swen ou ka ede w konprann kouvèti ou anvan ou deside.")
      ),
      section(
        T("Stopping APCM", "Detener APCM", "Sispann APCM"),
        T("You may stop this service at any time. Tell your care team and they will confirm when the change takes effect.", "Puede detener este servicio en cualquier momento. Avise a su equipo de cuidado y le confirmarán cuándo entra en vigor el cambio.", "Ou ka sispann sèvis sa a nenpòt lè. Di ekip swen ou epi y ap konfime kilè chanjman an ap antre an vigè.")
      ),
      section(
        TITLES.benefits,
        T("Choosing whether to receive APCM does not change your regular Medicare benefits, coverage, or rights, and you can continue seeing your regular doctors.", "Decidir si recibe APCM no cambia sus beneficios, cobertura ni derechos habituales de Medicare, y puede continuar viendo a sus médicos de siempre.", "Chwazi si w ap resevwa APCM pa chanje benefis, kouvèti oswa dwa Medicare ou nòmalman genyen yo, epi ou ka kontinye wè doktè ou konn wè yo.")
      ),
      SECTIONS.privacy,
      SECTIONS.help
    ]
  }
};

export const IMPORTANT_INFORMATION_COPY = Object.freeze({
  title: T("About your care", "Acerca de su cuidado", "Konsènan swen ou"),
  lead: T("Please review these important details before continuing.", "Revise estos detalles importantes antes de continuar.", "Tanpri revize detay enpòtan sa yo anvan ou kontinye."),
  privacyNote: T(
    "Your information is used to coordinate your care and is protected under applicable privacy rules. You can contact the care team before deciding.",
    "Su información se usa para coordinar su cuidado y está protegida por las reglas de privacidad aplicables. Puede comunicarse con el equipo de cuidado antes de decidir.",
    "Yo itilize enfòmasyon ou pou kowòdone swen ou epi li pwoteje anba règleman sou vi prive ki aplikab yo. Ou ka kontakte ekip swen an anvan ou deside."
  ),
  acknowledgement: T("I have reviewed this information.", "He revisado esta información.", "Mwen te revize enfòmasyon sa a."),
  continue: T("Continue", "Continuar", "Kontinye"),
  fullInformationFallback: T("View full information", "Ver información completa", "Gade enfòmasyon konplè")
});

export const programDisclosureConfig = pathway => PROGRAM_DISCLOSURE_CONFIG[pathway] || null;
