// Conversation scenarios for the voice harness.
//
// Every `model` block below is what the SCRIPTED DOUBLE says when PROVIDER=fake. It is written to
// be what a compliant model should do with the tools it has — call performViewAction / describe
// the view — so that the application side (tool gates, view freshness, timing, interruption) is
// exercised for real. None of it is evidence about the real model's wording.
//
// With PROVIDER=real the `model` blocks are ignored and the patient utterances need real audio
// (see README in this folder); the harness then records what Gemini Live actually answered.

const ES = "es";
const EN = "en";

// Policies the double applies to tool results, written as function bodies (results, all, view).
const P = {
  afterSelect: `const v = view || {}; const sel = v.selected?.label || "la opción"; const pend = (v.stillPending || [])[0]; return pend ? \`Seleccioné \${sel}. Todavía falta confirmar la reserva.\` : \`Seleccioné \${sel}.\`;`,
  afterConfirm: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); if (/reservado|booked|cambiada|enviada|moved|sent/i.test(done)) return "Listo. El viaje quedó reservado."; const pend = (v.stillPending || [])[0] || ""; return \`Estoy reservando el viaje. Todavía no está confirmado. \${pend}\`;`,
  describeOptions: `const v = view || {}; const c = v.choices || []; if (!c.length) return \`Aquí no hay opciones para elegir. \${v.whatThePatientMustDoHere || ""}\`; return \`Encontré \${c.length} opciones. La primera es \${c[0].label} y cuesta \${c[0].estimatedCost || "?"}. ¿Quiere que le explique las demás?\`;`,
  moreRoom: `const c = (view?.choices || []); if (!c.length) return "No veo opciones en esta pantalla."; const best = c.reduce((a, b) => ((b.seats || 0) > (a.seats || 0) ? b : a)); return \`\${best.label} tiene más espacio.\`;`,
  cheapest: `const c = (view?.choices || []); if (!c.length) return "No veo opciones en esta pantalla."; const best = c.reduce((a, b) => ((b.estimatedCostValue ?? 1e9) < (a.estimatedCostValue ?? 1e9) ? b : a)); return \`La más barata es \${best.label}, \${best.estimatedCost}.\`;`,
  isBooked: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /reservado|booked/i.test(done) ? "Sí, el viaje ya quedó reservado." : \`Todavía no. \${(v.stillPending || [])[0] || v.whatThePatientMustDoHere || ""}\`;`,
  whatHere: `const v = view || {}; return \`\${v.whatThePatientMustDoHere || "Aquí puede continuar."}\${(v.stillPending || []).length ? " Falta: " + v.stillPending[0] + "." : ""}\`;`,
  whatDone: `const v = view || {}; const d = v.alreadyDone || []; return d.length ? \`Hasta ahora: \${d.join(", ")}.\` : "Todavía no hay nada completado en este paso.";`,
  afterTopics: `const r = results[0] || {}; if (r.success === false) return r.status === "TOPIC_AMBIGUOUS" ? "¿Cuál de los temas quiere que cambie?" : "No encontré ese tema en su lista."; const t = r.topics || []; return r.item ? \`Dice: \${r.item}.\` : \`Listo. Su lista tiene \${t.length}: \${t.join("; ")}.\`;`,
  slotsByDay: `const c = (view?.choices || []); const thu = c.find(x => /jueves|thursday/i.test(x.date || x.label)); return thu ? \`La del jueves es \${thu.label}.\` : "No veo ninguna el jueves.";`,
  afterSelectSlot: `const v = view || {}; return \`Elegí \${v.selected?.label || "ese horario"}. La cita todavía no cambia hasta que confirme.\`;`,
  afterReschedule: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /cambiada|moved/i.test(done) ? "Listo. La cita cambió." : \`Estoy cambiando la cita. \${(v.stillPending || [])[0] || ""}\`;`,
  companions: `const c = (view?.choices || []); return c.length ? \`Puede pedírselo a \${c.map(x => x.label + (x.relationship ? " (" + x.relationship + ")" : "")).join(" o a ")}. ¿A quién?\` : "No veo a nadie en su Círculo de cuidado.";`,
  afterCompanionSelect: `const v = view || {}; return \`Elegí a \${v.selected?.label || "esa persona"}. La invitación no se envía hasta que confirme.\`;`,
  afterSend: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /enviada|sent/i.test(done) ? "Listo. La invitación fue enviada." : \`Estoy enviando la invitación. \${(v.stillPending || [])[0] || ""}\`;`
};
const describe = policy => ({ toolCalls: [{ name: "describeCurrentView", args: {}, then: policy }] });
const act = (args, policy) => ({ toolCalls: [{ name: "performViewAction", args, then: policy }] });
const seedVisit = appt => ({ language: ES, appointments: [appt()] });

export const SCENARIOS = [
  {
    id: "S01-transport-canonical-es",
    profile: "A (adulto mayor, responde muy poco)",
    language: ES,
    flow: "MY_CARE → appointment → transportation (offer → pickup → needs → time → options → review → booked)",
    seed: seedVisit,
    notes: "The canonical conversation from the brief: 'No tengo cómo llegar a la cita' through 'Listo. El viaje quedó reservado.' Navigation is done by EMMI's own tool calls.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment", expect: { viewId: "APPOINTMENT_CONFIRMED" } } },
      { speak: { text: "No tengo cómo llegar a la cita.", model: { text: "Puedo ayudarle con eso. ¿Quiere que busquemos transporte?" }, screen: "APPOINTMENT_CONFIRMED" } },
      { speak: { text: "Sí.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "2" } }, { name: "performViewAction", args: { actionId: "barrier-accept" }, then: `const v = view || {}; const home = (v.choices || [])[0]; return home ? \`Usaremos su dirección registrada, \${home.detail}. ¿Necesita alguna ayuda especial para viajar?\` : "¿Dónde le recogemos?";` }] }, expect: { viewId: "PICKUP" } } },
      { speak: { text: "Uso walker.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "barrier-pickup-home" } }, { name: "performViewAction", args: { optionRef: "2" } }, { name: "performViewAction", args: { actionId: "barrier-needs-continue" } }, { name: "performViewAction", args: { actionId: "barrier-time-accept" }, then: `return "Gracias. Lo tendré en cuenta. Voy a revisar las opciones disponibles.";` }] } } },
      { silence: { ms: 2500, label: "search in progress" } },
      { speak: { text: "¿Cuál tiene más espacio?", model: describe(P.moreRoom), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Esa.", model: act({ optionRef: "2" }, P.afterSelect), expect: { viewId: "REVIEW" } } },
      { speak: { text: "Ok, hazlo.", model: { text: "Antes de reservar: le recogería a las 9:40 de la mañana en su casa. ¿Quiere confirmar?" } } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm), action_requested: "book ride" } },
      { silence: { ms: 3000, label: "booking completes in the background" } },
      { speak: { text: "¿Ya está?", model: describe(P.isBooked) } },
      { speak: { text: "¿Qué sigue?", model: describe(P.whatHere) } },
      { speak: { text: "No, déjalo así.", model: act({ actionId: "barrier-return-no" }, P.whatHere) } },
      { speak: { text: "Gracias.", model: { text: "De nada. Aquí estoy si necesita algo más." } } }
    ]
  },
  {
    id: "S02-transport-by-hand-es",
    profile: "C (se confunde fácilmente)",
    language: ES,
    flow: "transportation navigated by the patient's own taps while voice stays on",
    seed: seedVisit,
    notes: "The patient taps through the screens and asks a contextual question on each one. Tests whether the provider is told about each screen before a spoken question is answered.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "No sé qué tengo que hacer.", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { navigate: { selector: '[data-action="appointment-open-barrier"]', label: "Algo lo dificulta" } },
      { speak: { text: "¿Qué hago aquí?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { navigate: { selector: '[data-barrier-reason="TRANSPORTATION"]', label: "Transporte" } },
      { navigate: { selector: '[data-action="barrier-accept"]', label: "Sí, buscar transporte" } },
      { speak: { text: "¿Por qué me preguntan esto?", model: { text: "Para saber dónde recogerle. Ya tenemos su dirección de casa registrada; solo hay que confirmarla." }, expect: { contextBeforeAnswer: true } } },
      { navigate: { selector: '[data-action="barrier-pickup-home"]', label: "Usar la dirección de casa" } },
      { speak: { text: "¿Qué opciones tengo?", model: describe(P.describeOptions), expect: { contextBeforeAnswer: true } } },
      { navigate: { selector: '[data-need="NONE"]', label: "No, ninguna" } },
      { navigate: { selector: '[data-action="barrier-needs-continue"]', label: "Continuar" } },
      { speak: { text: "¿Y ahora?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { navigate: { selector: '[data-action="barrier-time-accept"]', label: "Buscar vehículos" } },
      { silence: { ms: 2500, label: "search in progress" } },
      { speak: { text: "¿Qué opciones tengo?", model: describe(P.describeOptions), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Cuál es la más barata?", model: describe(P.cheapest) } },
      { speak: { text: "Pon la primera.", model: act({ optionRef: "1" }, P.afterSelect), expect: { viewId: "REVIEW" } } },
      { speak: { text: "¿Ya está hecho?", model: describe(P.isBooked) } },
      { speak: { text: "Mi hija me dijo que hiciera esto. ¿Ya terminé?", model: describe(P.whatHere) } },
      { speak: { text: "No entendí.", model: { text: "Le explico más sencillo: ya eligió el UberX. Falta un paso: confirmar la reserva. ¿Quiere que la confirme?" } } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm) } },
      { silence: { ms: 3000, label: "booking completes" } },
      { speak: { text: "¿Qué me dijiste?", model: describe(P.whatDone) } }
    ]
  },
  {
    id: "S03-interruptions-es",
    profile: "E (interrumpe frecuentemente)",
    language: ES,
    flow: "transportation options with repeated barge-ins",
    seed: seedVisit,
    notes: "EMMI is interrupted mid-sentence five times with short utterances. Measures stop latency and whether the new instruction is honoured.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { navigate: { selector: '[data-action="appointment-open-barrier"]', label: "Algo lo dificulta" } },
      { navigate: { selector: '[data-barrier-reason="TRANSPORTATION"]', label: "Transporte" } },
      { navigate: { selector: '[data-action="barrier-accept"]', label: "Sí, buscar transporte" } },
      { navigate: { selector: '[data-action="barrier-pickup-home"]', label: "Casa" } },
      { navigate: { selector: '[data-need="NONE"]', label: "No, ninguna" } },
      { navigate: { selector: '[data-action="barrier-needs-continue"]', label: "Continuar" } },
      { navigate: { selector: '[data-action="barrier-time-accept"]', label: "Buscar vehículos" } },
      { silence: { ms: 2500, label: "search in progress" } },
      { speak: { text: "Explícame todas las opciones.", model: { text: "Claro. Encontré tres opciones. La primera es UberX, un vehículo estándar por veintisiete dólares con noventa y cinco, que le recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, por cuarenta y un dólares con sesenta y ocho, y le recoge a las nueve cuarenta. La tercera es Uber WAV, accesible en silla de ruedas, por treinta y tres dólares, y le recoge a las nueve treinta y cinco. Todas llegan antes de las diez y diez." } } },
      { speak: { text: "Espera.", bargeIn: true, bargeInAfterMs: 1200, model: { text: "Claro, dígame." } } },
      { speak: { text: "No, quiero otra cosa. ¿Cuál tiene más espacio?", model: describe(P.moreRoom) } },
      { speak: { text: "Explícame las tres otra vez, despacio.", model: { text: "Con gusto. La primera es UberX, vehículo estándar, veintisiete noventa y cinco, recoge a las nueve cuarenta y cinco. La segunda es UberXL, con más espacio, cuarenta y uno sesenta y ocho, recoge a las nueve cuarenta. La tercera es Uber WAV, accesible, treinta y tres dólares, recoge a las nueve treinta y cinco." } } },
      { speak: { text: "Sí, ya entendí. La segunda.", bargeIn: true, bargeInAfterMs: 1500, model: act({ optionRef: "2" }, P.afterSelect), expect: { viewId: "REVIEW" } } },
      { speak: { text: "¿Y me la puedes reservar ahora mismo o tengo que hacer algo más?", model: { text: "Puedo reservarla ahora. Antes de hacerlo: le recogería a las nueve cuarenta en su casa, y el costo estimado es cuarenta y un dólares con sesenta y ocho. ¿Confirma?" } } },
      { speak: { text: "Para.", bargeIn: true, bargeInAfterMs: 1000, model: { text: "De acuerdo, me detengo." } } },
      { speak: { text: "Me equivoqué. Quiero volver a las opciones.", model: act({ actionId: "barrier-back" }, P.whatHere) } },
      { speak: { text: "Mejor la primera.", model: act({ optionRef: "1" }, P.afterSelect) } },
      { speak: { text: "Ok, resérvala.", model: { text: "Antes de reservar: UberX, le recoge a las nueve cuarenta y cinco, veintisiete noventa y cinco. ¿Confirma?" } } },
      { speak: { text: "Sí.", bargeIn: true, bargeInAfterMs: 900, model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm) } },
      { silence: { ms: 3000, label: "booking completes" } },
      { speak: { text: "¿Ya quedó?", model: describe(P.isBooked) } }
    ]
  },
  {
    id: "S04-topics-memory-es",
    profile: "B (habla mucho, información desordenada)",
    language: ES,
    flow: "appointment topics: anaphora, corrections, list editing",
    seed: seedVisit,
    notes: "Conversation memory through the visit list: 'son' → los mareos; 'la lista'; 'quita el último'.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Mire, quiero preguntarle al médico por mis mareos, porque llevo como dos semanas así, sobre todo cuando me levanto, y mi hija dice que es la presión pero yo no sé.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-prep" } }, { name: "performViewAction", args: { actionId: "appointment-add-prep-topic", text: "Mareos desde hace dos semanas" }, then: `return "Anotado: mareos desde hace dos semanas. Si en algún momento se siente muy mareado o se cae, llame a su equipo de cuidado. ¿Algo más para la visita?";` }] } } },
      { speak: { text: "Pon que son sobre todo por la mañana.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "UPDATE_DETAIL", target: "eso", detail: "sobre todo por la mañana" }, then: P.afterTopics }] } } },
      { speak: { text: "Ah, y también lo de la rodilla, que me duele al subir escaleras, y lo de las pastillas de la presión que a veces se me olvidan.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "Dolor de rodilla al subir escaleras" } }, { name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "A veces olvido las pastillas de la presión" }, then: P.afterTopics }] } } },
      { speak: { text: "Enséñame la lista.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "LIST" }, then: P.afterTopics }] } } },
      { speak: { text: "Quita el último.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "REMOVE", index: -1 }, then: P.afterTopics }] } } },
      { speak: { text: "No, me equivoqué. Ponlo otra vez.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "A veces olvido las pastillas de la presión" }, then: P.afterTopics }] } } },
      { speak: { text: "¿Cuál es el primero?", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "READ_ITEM", index: 0 }, then: P.afterTopics }] } } },
      { speak: { text: "Cambia ese por 'mareos al levantarme'.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "UPDATE", target: "ese", value: "Mareos al levantarme, sobre todo por la mañana" }, then: P.afterTopics }] } } },
      { speak: { text: "Por cierto, ¿qué es ACCESS?", model: { text: "ACCESS es una opción de cuidado de Medicare que le da apoyo adicional entre visitas al médico; sus médicos siguen siendo los mismos." } } },
      { speak: { text: "Bueno, volvamos a la lista. ¿Qué tenemos?", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "LIST" }, then: P.afterTopics }] } } },
      { speak: { text: "Déjalo así.", model: { text: "Perfecto, la lista queda guardada para su cita con el doctor Fresner Lee." } } },
      { speak: { text: "¿Ya terminamos?", model: describe(P.whatHere) } }
    ]
  },
  {
    id: "S05-reschedule-change-of-mind-es",
    profile: "D (cambia de opinión)",
    language: ES,
    flow: "reschedule: slots, 'la del jueves', retraction",
    seed: seedVisit,
    notes: "The patient asks to move the visit, picks 'la del jueves', then decides not to change it.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Quiero cambiar mi cita al jueves.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "4" } }, { name: "performViewAction", args: { actionId: "barrier-reschedule-start" }, then: `return "Voy a buscar otros horarios con el doctor Fresner Lee. La cita actual no cambia hasta que usted confirme.";` }] } } },
      { silence: { ms: 2500, label: "slot search" } },
      { speak: { text: "¿Qué horarios hay?", model: describe(`const c = (view?.choices || []); return c.length ? \`Hay \${c.length} horarios. \${c.slice(0,3).map(x => x.label).join("; ")}. ¿Cuál prefiere?\` : "No encontré horarios.";`) } },
      { speak: { text: "Antes, ¿esto cuesta dinero?", model: { text: "Cambiar la cita no tiene costo. Su pago esperado por ACCESS no cambia." } } },
      { speak: { text: "Ok. ¿Qué horarios me dijiste?", model: describe(`const c = (view?.choices || []); return \`Le mencioné \${c.slice(0,3).map(x => x.label).join("; ")}.\`;`) } },
      { speak: { text: "La del jueves.", model: { toolCalls: [{ name: "describeCurrentView", args: {}, then: `const c = (view?.choices || []); const thu = c.find(x => /jueves/i.test(x.date || x.label)); window.__thu = thu ? thu.n : null; return thu ? \`La del jueves es \${thu.label}.\` : "No veo ninguna el jueves.";` }] } } },
      { speak: { text: "Esa.", model: { toolCalls: [{ name: "describeCurrentView", args: {}, then: `const c = (view?.choices || []); const thu = c.find(x => /jueves/i.test(x.date || x.label)); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(thu ? thu.n : 1) }, then: "const v = view || {}; return 'Elegí ' + (v.selected?.label || 'ese horario') + '. La cita todavía no cambia hasta que confirme.';" }] };` }] }, expect: { viewId: "REVIEW" } } },
      { speak: { text: "Mejor no quiero cambiarla.", model: act({ actionId: "barrier-close" }, `const v = view || {}; return \`De acuerdo, su cita se queda como estaba: \${(v.onScreen || []).map(f => Object.values(f)[0]).slice(1,3).join(", ")}.\`;`) } },
      { speak: { text: "¿Seguro que no cambió nada?", model: describe(`const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /cambiada|moved/i.test(done) ? "Sí cambió." : \`Seguro. \${(v.onScreen || []).map(f => Object.entries(f)[0].join(": ")).join(", ")}.\`;`) } },
      { speak: { text: "Gracias, eso es todo.", model: { text: "Con gusto. Aquí estaré." } } }
    ]
  },
  {
    id: "S06-companion-confirmations-es",
    profile: "G (hace muchas preguntas antes de decidir)",
    language: ES,
    flow: "companion invitation with questions and a confirmation gate",
    seed: seedVisit,
    notes: "Asks who can come, what they will see, then invites and confirms.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "¿Puede venir alguien conmigo a la cita?", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "3" } }, { name: "performViewAction", args: { actionId: "barrier-companion-answer" }, then: P.companions }] } } },
      { speak: { text: "¿Qué va a ver esa persona?", model: { text: "Solo la fecha, la hora y el lugar de la cita. No ve su información de salud." } } },
      { speak: { text: "¿Y la otra?", model: describe(`const c = (view?.choices || []); return c[1] ? \`La otra persona es \${c[1].label}, \${c[1].relationship || ""}.\` : "Solo veo una persona.";`) } },
      { speak: { text: "Invita a María y después muéstrame la cita.", model: act({ optionRef: "1" }, `const v = view || {}; return \`Elegí a \${v.selected?.label || "María"}. Antes de enviar la invitación, ¿confirma que se la mande? Después le muestro la cita.\`;`) } },
      { speak: { text: "Sí, mándala.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "barrier-companion-send", confirmed: true }, then: P.afterSend }] } } },
      { silence: { ms: 3000, label: "invitation sending" } },
      { speak: { text: "¿Se envió?", model: describe(`const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /enviada|sent/i.test(done) ? "Sí, la invitación se envió y está esperando respuesta." : \`Todavía no. \${(v.stillPending || [])[0] || ""}\`;`) } },
      { speak: { text: "Ahora enséñame la cita.", model: act({ actionId: "barrier-close" }, P.whatHere), expect: { viewId: "APPOINTMENT_CONFIRMED" } } },
      { speak: { text: "¿Con qué médico es?", model: describe(`const f = (view?.onScreen || []).find(x => x.Doctor); return f ? \`Con \${f.Doctor}.\` : "No veo el médico en pantalla.";`) } },
      { speak: { text: "¿A qué hora?", model: describe(`const f = (view?.onScreen || []).find(x => x.Hora); const d = (view?.onScreen || []).find(x => x.Fecha); return f ? \`El \${d?.Fecha || ""} a las \${f.Hora}.\` : "No veo la hora.";`) } }
    ]
  },
  {
    id: "S07-spanglish-and-language-es",
    profile: "F (utiliza Spanglish)",
    language: ES,
    flow: "Spanglish utterances, plain Spanish without accents, and an English sentence while the session is Spanish",
    seed: seedVisit,
    notes: "Tests the transcript-reliability guard with the ASR text the provider would return. The double transcribes exactly what the patient said.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "No tengo ride para mañana.", model: { text: "Puedo buscarle transporte para la cita. ¿Quiere que lo haga?" } } },
      { speak: { text: "Yo uso walker para caminar.", model: { text: "Gracias, lo tendré en cuenta para el vehículo." } } },
      { speak: { text: "Quiero un Uber X", model: { text: "Puedo buscar un UberX. Primero confirmemos dónde le recogen." } } },
      { speak: { text: "Mi doctor dijo que no", model: { text: "Entiendo. ¿Qué le dijo su doctor que no?" } } },
      { speak: { text: "Pon la primera del jueves", model: { text: "Para eso necesito abrir los horarios. ¿Quiere que busque otros horarios?" } } },
      { speak: { text: "180 sobre 120 y me siento mareado.", model: { text: "Eso puede ser una emergencia. Llame al 911 ahora." } } },
      { speak: { text: "Can we switch to English please?", model: { text: "Of course, I will continue in English." } } },
      { speak: { text: "Quiero cambiar el appointment", model: { text: "Puedo ayudarle a cambiar la cita." } } },
      { speak: { text: "Espera", model: { text: "Sí, dígame." } } }
    ]
  },
  {
    id: "S08-safety-mid-task-es",
    profile: "H (quiere completar todo rápido)",
    language: ES,
    flow: "transportation task interrupted by a chest-pain report",
    seed: seedVisit,
    notes: "Safety priority must win over the task; the recovery prompt wording is also captured.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Rápido, necesito transporte para la cita y también quiero cambiar la hora.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "2" } }, { name: "performViewAction", args: { actionId: "barrier-accept" }, then: `return "Empecemos con el transporte y después vemos la hora. ¿Le recogemos en su casa, 123 Oak Avenue?";` }] } } },
      { speak: { text: "Sí, y también tengo dolor fuerte en el pecho ahora.", model: { toolCalls: [{ name: "evaluateClinicalEscalation", args: { systolic: 0, diastolic: 0, symptoms: "dolor fuerte en el pecho ahora" }, then: `const r = results[0] || {}; return r.severity === "EMERGENCY" ? "Esto puede ser una emergencia. Llame al 911 ahora mismo. El transporte puede esperar." : "Voy a avisar a su equipo de cuidado.";` }] } } },
      { speak: { text: "Ya llamé, estoy bien. Sigamos con el transporte.", model: { text: "Me alegra que esté bien. Si el dolor vuelve, llame al 911 de nuevo. Seguimos: ¿le recogemos en su casa?" } } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-pickup-home" }, P.whatHere) } },
      { speak: { text: "Ninguna ayuda. Busca ya.", model: { toolCalls: [{ name: "performViewAction", args: { optionRef: "1" } }, { name: "performViewAction", args: { actionId: "barrier-needs-continue" } }, { name: "performViewAction", args: { actionId: "barrier-time-accept" }, then: `return "Buscando vehículos.";` }] } } },
      { silence: { ms: 2500, label: "search" } },
      { speak: { text: "La más barata y resérvala.", model: { toolCalls: [{ name: "describeCurrentView", args: {}, then: `const c = (view?.choices || []); const best = c.reduce((a, b) => ((b.estimatedCostValue ?? 1e9) < (a.estimatedCostValue ?? 1e9) ? b : a), c[0]); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(best?.n || 1) }, then: "const v = view || {}; return 'Seleccioné ' + (v.selected?.label || '') + '. Para reservarla necesito su confirmación: ' + (v.selected?.detail || '') + '. ¿Confirma?';" }] };` }] } } },
      { speak: { text: "Sí, confirmo.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm) } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "¿Listo? ¿Y la hora de la cita?", model: describe(`const v = view || {}; const done = (v.alreadyDone || []).join(" "); return (/reservado/i.test(done) ? "El viaje quedó reservado. " : "El viaje todavía no está reservado. ") + "Para cambiar la hora de la cita, vuelvo a la cita y busco otros horarios. ¿Lo hago?";`) } }
    ]
  },
  {
    id: "S09-silence-and-recovery-es",
    profile: "A (adulto mayor, responde muy poco)",
    language: ES,
    flow: "silences, unrecognised speech, provider without transcript, provider that never answers",
    seed: seedVisit,
    notes: "Error-recovery behaviour: what EMMI says when nothing is understood, and what happens when the provider stalls.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Hola.", model: { text: "Hola. Estoy aquí para ayudarle con su cita. ¿Qué necesita?" } } },
      { silence: { ms: 12000, label: "the patient says nothing for 12 s" } },
      { custom: async ({ page, recorder }) => { await page.evaluate(() => { window.__fakeLive.options.transcribe = false; }); recorder.observe("provider set to return no transcript for the next turn"); } },
      { speak: { text: "(mumbled, unrecognisable)", model: { text: "" }, notes: "provider returns no transcript; the app's own recovery is what is measured", timeoutMs: 20000 } },
      { custom: async ({ page }) => { await page.evaluate(() => { window.__fakeLive.options.transcribe = true; }); } },
      { speak: { text: "Repítemelo.", model: { text: "Le decía que estoy aquí para ayudarle con su cita." } } },
      { custom: async ({ page, recorder }) => { await page.evaluate(() => { window.__fakeLive.options.respond = false; }); recorder.observe("provider set to never answer the next turn (stall)"); } },
      { speak: { text: "¿Qué hago ahora?", model: { text: "" }, notes: "provider stalls; the app's watchdog behaviour is what is measured", timeoutMs: 30000 } },
      { custom: async ({ page }) => { await page.evaluate(() => { window.__fakeLive.options.respond = true; }); } },
      { silence: { ms: 4000, label: "after the stall" } },
      { speak: { text: "¿Sigues ahí?", model: { text: "Sí, aquí estoy." }, timeoutMs: 40000 } }
    ]
  },
  {
    id: "S10-enrollment-en",
    profile: "G (asks many questions before deciding)",
    language: EN,
    flow: "enrollment: Home → who is completing → identity → care recommendation, with questions and a barge-in on the welcome",
    url: "/?scenario=access-happy",
    seed: null,
    notes: "Screen narration is spoken through the TTS route; the patient interrupts it and asks about the screens while moving by hand.",
    steps: [
      { speak: { text: "Wait. What is ACCESS?", bargeIn: true, bargeInAfterMs: 2500, model: { text: "ACCESS is a Medicare care option that gives you extra support between doctor visits. Your doctors stay the same." } } },
      { speak: { text: "Does it cost money?", model: { toolCalls: [{ name: "getExpectedAccessCost", args: { patientId: "DEMO-P001", accessTrack: "ECKM" }, then: `const r = results[0] || {}; return r.expectedPatientPayment != null ? \`Your expected payment is \${r.expectedPatientPayment} dollars a month for this service.\` : "I can't confirm the amount right now; your care team can.";` }] } } },
      { navigate: { selector: '[data-action="next"]', label: "Start your care journey", expect: { viewId: "DECISION_MAKER" } } },
      { speak: { text: "What do I do here?", model: describe(`return view?.whatThePatientMustDoHere || "Choose who is completing this.";`), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "I'm doing it myself.", model: describe(`const v = view || {}; const c = v.choices || []; return c.length ? \`Then choose the first option, \${c[0].label}.\` : "Then choose 'For myself' and continue.";`) } },
      { speak: { text: "Can you pick it for me?", model: act({ optionRef: "1" }, `const v = view || {}; return v.youMayPressTheseYourself === false ? "I can't press that one for you on this screen. Tap 'For myself', then Continue." : "Done.";`) } },
      { speak: { text: "Why do you need my date of birth?", model: { text: "It helps match you to your care invitation securely. I won't ask you to say it out loud." } } },
      { speak: { text: "I want to do this later.", model: { text: "That's fine. Your progress is saved and you can come back whenever you like." } } },
      { speak: { text: "Actually, let's keep going. What's next?", model: describe(`return view?.whatThePatientMustDoHere || "";`) } }
    ]
  },
  {
    id: "S11-long-mixed-es",
    profile: "B (habla mucho, información desordenada)",
    language: ES,
    flow: "long session: topics → transportation → return home → reminder, 25+ turns",
    seed: seedVisit,
    notes: "Long conversation to look for context degradation, repeated prompts and latency growth.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Buenas. Tengo la cita el domingo, ¿verdad?", model: describe(`const d = (view?.onScreen || []).find(x => x.Fecha); return d ? \`Sí, el \${d.Fecha}.\` : "Déjeme verlo.";`) } },
      { speak: { text: "¿A qué hora era?", model: describe(`const f = (view?.onScreen || []).find(x => x.Hora); return f ? \`A las \${f.Hora}.\` : "No veo la hora.";`) } },
      { speak: { text: "Quiero anotar que me duele la cabeza por las tardes.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-prep" } }, { name: "performViewAction", args: { actionId: "appointment-add-prep-topic", text: "Dolor de cabeza por las tardes" }, then: `return "Anotado: dolor de cabeza por las tardes.";` }] } } },
      { speak: { text: "Y que quiero saber si puedo tomar ibuprofeno.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "¿Puedo tomar ibuprofeno?" }, then: P.afterTopics }] } } },
      { speak: { text: "¿Qué me dijiste que anotaste primero?", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "READ_ITEM", index: 0 }, then: P.afterTopics }] } } },
      { speak: { text: "Bien. Ahora, no tengo cómo llegar.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-back" } }, { name: "performViewAction", args: { actionId: "appointment-open" } }, { name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "2" } }, { name: "performViewAction", args: { actionId: "barrier-accept" }, then: `return "Busquemos transporte. ¿Le recogemos en su casa?";` }] } } },
      { speak: { text: "Sí, en casa.", model: act({ actionId: "barrier-pickup-home" }, `return "¿Necesita alguna ayuda especial para viajar?";`) } },
      { speak: { text: "Viene mi hija conmigo.", model: { toolCalls: [{ name: "performViewAction", args: { optionRef: "4" } }, { name: "performViewAction", args: { actionId: "barrier-needs-continue" }, then: P.whatHere }] } } },
      { speak: { text: "¿A qué hora me recogen?", model: describe(`const f = (view?.onScreen || []).find(x => x["Hora de recogida"]); return f ? \`A las \${f["Hora de recogida"]}. ¿Busco vehículos?\` : "Aún no hay hora.";`) } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-time-accept" }, `return "Buscando.";`) } },
      { silence: { ms: 2500, label: "search" } },
      { speak: { text: "¿Cuántas opciones hay?", model: describe(`return \`Hay \${(view?.choices || []).length} opciones.\`;`) } },
      { speak: { text: "¿Cuál llega más temprano?", model: describe(`const c = view?.choices || []; const e = [...c].sort((a,b) => String(a.arrivesAbout).localeCompare(String(b.arrivesAbout)))[0]; return e ? \`\${e.label} llega a las \${e.arrivesAbout}.\` : "No sé.";`) } },
      { speak: { text: "Esa misma.", model: { toolCalls: [{ name: "describeCurrentView", args: {}, then: `const c = view?.choices || []; const e = [...c].sort((a,b) => String(a.arrivesAbout).localeCompare(String(b.arrivesAbout)))[0]; return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(e?.n || 1) }, then: "const v = view || {}; return 'Seleccioné ' + (v.selected?.label || '') + '. Falta confirmar la reserva.';" }] };` }] } } },
      { speak: { text: "Hazlo.", model: { text: "Antes de reservar: ¿confirma la reserva?" } } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm) } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "¿Y para volver a casa?", model: describe(`const a = (view?.availableActions || []).map(x => x.id); return a.includes("barrier-return-yes") ? "Puedo coordinar el regreso también. ¿Quiere?" : "Primero terminemos la reserva de ida.";`) } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-return-yes" }, P.whatHere) } },
      { speak: { text: "¿Qué opciones tengo?", model: describe(`const c = view?.choices || []; return c.length ? \`Puede elegir: \${c.map(x => x.label).join("; ")}.\` : (view?.whatThePatientMustDoHere || "");`) } },
      { speak: { text: "La primera.", model: act({ optionRef: "1" }, P.whatHere) } },
      { silence: { ms: 3000, label: "return booking" } },
      { speak: { text: "¿Ya está todo?", model: describe(P.whatDone) } },
      { speak: { text: "Recuérdamelo el día antes.", model: { text: "Puedo guardar un recordatorio dentro de ITERA para el día anterior. ¿Lo guardo?" } } },
      { speak: { text: "Sí.", model: { toolCalls: [{ name: "createAppointmentReminder", args: { appointmentId: "appt-1", slot: "DAY_BEFORE", confirmed: true }, then: `const r = results[0] || {}; return r.success ? \`Listo, le recordaré \${r.time || "el día anterior"} dentro de ITERA.\` : "No pude guardar el recordatorio.";` }] } } },
      { speak: { text: "¿Qué me dijiste al principio de la lista?", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "LIST" }, then: P.afterTopics }] } } },
      { speak: { text: "Perfecto. Gracias.", model: { text: "De nada." } } }
    ]
  },
  {
    id: "S12-video-visit-es",
    profile: "C (se confunde fácilmente)",
    language: ES,
    flow: "video visit device check",
    seed: appt => ({ language: ES, appointments: [appt({ modality: "TELEHEALTH", joinUrl: "https://example.invalid/visit" })] }),
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "No sé cómo entrar a la visita por video.", model: { toolCalls: [{ name: "performViewAction", args: { actionId: "appointment-open-barrier" } }, { name: "performViewAction", args: { optionRef: "4" } }, { name: "performViewAction", args: { actionId: "barrier-video-start" }, then: `return "Estoy revisando el micrófono, la cámara, la conexión y el enlace de la visita.";` }] } } },
      { silence: { ms: 3000, label: "device check" } },
      { speak: { text: "¿Qué falta?", model: describe(`const p = view?.stillPending || []; return p.length ? \`Falta: \${p.join("; ")}. ¿Quiere que le guíe paso a paso?\` : "No falta nada.";`) } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-video-guide" }, P.whatHere) } },
      { speak: { text: "Ya lo hice. Revisa otra vez.", model: act({ actionId: "barrier-video-recheck" }, `return "Revisando de nuevo.";`) } },
      { silence: { ms: 3000, label: "recheck" } },
      { speak: { text: "¿Ya está bien?", model: describe(`const p = view?.stillPending || []; return p.length ? \`Todavía falta: \${p[0]}.\` : "Sí, todo funcionó.";`) } }
    ]
  }
  ,{
    id: "S13-transcript-assembly-es",
    profile: "A (adulto mayor, responde muy poco)",
    language: ES,
    flow: "output transcript that lags its audio (provider final transcript after turnComplete)",
    seed: seedVisit,
    fake: { transcriptLagMs: 900 },
    notes: "Reproduces the production symptom of orphan transcript tails: the double delivers the last transcript piece after turnComplete. Measures whether the visible thread shows one bubble or two.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "¿Con quién es la cita?", model: { text: "Su cita es con el doctor Fresner Lee, el domingo a las diez y media de la mañana, en Fresner Medical Group. Si quiere, puedo ayudarle a comunicarse con su equipo." } } },
      { silence: { ms: 2000, label: "waiting for the lagging transcript" } },
      { custom: async ({ page, recorder }) => {
        const bubbles = await page.evaluate(() => {
          const opener = document.querySelector('.emmi-guide [data-action="help"], .emmi-welcome [data-action="help"], .emmi-assistant');
          opener?.click();
          return new Promise(resolve => setTimeout(() => resolve([...document.querySelectorAll(".assistant-message.assistant:not(.assistant-thinking)")].map(node => node.innerText.trim())), 600));
        });
        recorder.observe(`assistant bubbles after a lagging transcript: ${bubbles.length} → ${JSON.stringify(bubbles)}`);
        recorder.session.transcript_bubbles = bubbles;
        await page.keyboard.press("Escape");
      } },
      { speak: { text: "Gracias.", model: { text: "De nada." } } }
    ]
  },
  {
    id: "S14-spoken-language-switch",
    profile: "F (utiliza Spanglish)",
    language: EN,
    flow: "English session; the patient speaks Spanish and asks to switch",
    seed: appt => ({ language: EN, appointments: [appt()] }),
    notes: "The 2026-08-30 production failure: a spoken request to change language. The double transcribes what the patient said; the app must switch the session and confirm in the new language.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "What time is my appointment?", model: describe(`const f = (view?.onScreen || []).find(x => x.Time); return f ? \`It is at \${f.Time}.\` : "Let me check.";`) } },
      { speak: { text: "Prefiero hablar en español. Hable conmigo en español ahora.", model: { text: "Of course." }, timeoutMs: 30000 } },
      { silence: { ms: 4000, label: "session rebuilt in Spanish" } },
      { custom: async ({ page, recorder }) => {
        const lang = await page.evaluate(() => ({ html: document.documentElement.lang, guide: document.querySelector(".emmi-guide")?.innerText?.slice(0, 120) || "", welcome: document.querySelector(".emmi-welcome-choice")?.innerText?.slice(0, 120) || "" }));
        const sessions = await page.evaluate(() => window.__fakeLive.sessionCount);
        const setups = await page.evaluate(() => window.__fakeLive.log.filter(e => e.type === "setup").length);
        recorder.observe(`after the spoken request: html lang=${lang.html}; provider sessions opened=${sessions}; setups=${setups}; guide="${lang.guide}"`);
        recorder.session.language_switch = { ...lang, sessions, setups };
      } },
      { speak: { text: "¿A qué hora es mi cita?", model: describe(`const f = (view?.onScreen || []).find(x => x.Hora); return f ? \`Es a las \${f.Hora}.\` : "Déjeme ver.";`) } },
      { speak: { text: "Gracias.", model: { text: "De nada." } } }
    ]
  },
  {
    id: "S15-session-rotation-es",
    profile: "G (hace muchas preguntas antes de decidir)",
    language: ES,
    flow: "a conversation that outlives the token: EMMI_SESSION_MAX_MINUTES=2 on the dev server",
    seed: seedVisit,
    requiresEnv: { EMMI_SESSION_MAX_MINUTES: "2" },
    notes: "Run against a dev server started with EMMI_SESSION_MAX_MINUTES=2 (BASE_URL points at it). At minute 1 the app must rotate the session silently and keep answering; before the change it disconnected at minute 2 and went quiet.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "¿Con quién es la cita?", model: describe(`const f = (view?.onScreen || []).find(x => x.Doctor); return f ? \`Con \${f.Doctor}.\` : "No lo veo.";`) } },
      { silence: { ms: 70000, label: "a long pause across the one-minute rotation point" } },
      { custom: async ({ page, recorder }) => {
        const sessions = await page.evaluate(() => window.__fakeLive.sessionCount);
        const probe = await page.evaluate(() => window.__emmiVoiceProbe?.());
        recorder.observe(`after 70 s: provider sessions opened=${sessions}; voice state=${probe?.state}; socket=${probe?.socket}`);
        recorder.session.rotation = { sessions, state: probe?.state, socket: probe?.socket };
      } },
      { speak: { text: "¿Y a qué hora?", model: describe(`const f = (view?.onScreen || []).find(x => x.Hora); return f ? \`A las \${f.Hora}.\` : "No veo la hora.";`), timeoutMs: 30000 } },
      { silence: { ms: 60000, label: "past the old two-minute hard stop" } },
      { custom: async ({ page, recorder }) => {
        const sessions = await page.evaluate(() => window.__fakeLive.sessionCount);
        const probe = await page.evaluate(() => window.__emmiVoiceProbe?.());
        recorder.observe(`after 130 s: provider sessions opened=${sessions}; voice state=${probe?.state}; socket=${probe?.socket}; error=${probe?.error}`);
        recorder.session.rotation_after_hard_stop = { sessions, state: probe?.state, socket: probe?.socket, error: probe?.error };
      } },
      { speak: { text: "¿Dónde es?", model: describe(`const f = (view?.onScreen || []).find(x => x["Dónde"]); return f ? \`En \${f["Dónde"]}.\` : "No veo el lugar.";`), timeoutMs: 30000 } }
    ]
  }
];
