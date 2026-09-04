// Long conversations (15–30 spoken turns) for the voice harness — the second half of the audit's
// session set. Same conventions as scenarios.mjs: every `model` block is what the scripted double
// says, written as what a compliant model should do with the tools it has; nothing in it is
// evidence about the real model's wording. Patient utterances are what a real patient says.
import { P, describe, act, seedVisit, ES, EN } from "./scenarios.mjs";
import { viewProbe, press } from "./voice-harness.mjs";

const HT = "ht";
const pv = actionId => ({ name: "performViewAction", args: { actionId } });
const opt = optionRef => ({ name: "performViewAction", args: { optionRef: String(optionRef) } });
// A chain of view actions whose last result feeds the policy. If any step failed, the double says
// so instead of pretending: "Listo" without an executed action is exactly what the audit hunts.
const chain = (calls, policy) => ({ toolCalls: calls.map((call, index) => (index === calls.length - 1 ? { ...call, then: GUARD + policy } : call)) });
const GUARD = `const failedStep = (all || []).map(i => i.response?.result ?? i.response).find(r => r && r.success === false); if (failedStep) return "No pude completar ese paso: " + (failedStep.message || failedStep.status || failedStep.error || "hubo un error") + ".";\n`;
const field = (names, fallback) => `const f = (view?.onScreen || []).find(x => /^(${names})$/i.test(Object.keys(x)[0])); return f ? ${fallback};`;

// Extra policies for these sessions (function bodies over results, all, view).
const Q = {
  listChoices: `const c = (view?.choices || []); return c.length ? \`Puede elegir: \${c.map((x, i) => (i + 1) + ", " + x.label).join("; ")}. ¿Cuál?\` : (view?.whatThePatientMustDoHere || "Aquí no hay opciones para elegir.");`,
  firstSlowly: `const c = (view?.choices || []); const a = c[0]; return a ? \`Despacio. La primera es \${a.label}. \${a.estimatedCost ? "Cuesta " + a.estimatedCost + "." : ""} \${a.pickupAbout ? "Le recoge a las " + a.pickupAbout + "." : ""}\` : "No veo opciones.";`,
  homeAddress: `const home = (view?.choices || [])[0]; return home && home.detail ? \`Sí, tenemos su dirección: \${home.detail}. ¿La usamos para recogerle?\` : "No veo una dirección guardada. ¿Cuál es?";`,
  readSelected: `const v = view || {}; const s = v.selected; return s ? \`Antes de reservar: \${s.label}\${s.detail ? ", " + s.detail : ""}. ¿Confirma?\` : "Todavía no ha elegido una opción.";`,
  returnOffer: `const a = (view?.availableActions || []).map(x => x.id); return a.includes("barrier-return-yes") ? "Puedo coordinar también el viaje de regreso. ¿Quiere?" : (view?.whatThePatientMustDoHere || "");`,
  onScreenAll: `const f = (view?.onScreen || []).map(x => Object.entries(x)[0].join(": ")); return f.length ? \`En pantalla: \${f.slice(0, 4).join("; ")}.\` : (view?.whatThePatientMustDoHere || "");`,
  doctor: field("Doctor|Doktè", "`Con ${Object.values(f)[0]}.` : \"No veo el médico en pantalla.\""),
  date: field("Fecha|Date|Dat", "`El ${Object.values(f)[0]}.` : \"No veo la fecha.\""),
  time: field("Hora|Time|Lè", "`A las ${Object.values(f)[0]}.` : \"No veo la hora.\""),
  where: field("Dónde|Where|Ki kote", "`En ${Object.values(f)[0]}.` : \"No veo el lugar.\""),
  pickupTime: field("Hora de recogida|Pickup time|Lè pou pran w", "`Le recogerían a las ${Object.values(f)[0]}. ¿Busco vehículos?` : \"Todavía no hay hora de recogida.\""),
  afternoonSlot: `const c = (view?.choices || []); const pm = c.find(x => /p\\.?\\s?m|tarde|\\b(1[2-9]|2[0-3]):/i.test(x.label + " " + (x.time || ""))); window.__pick = pm ? pm.n : null; return pm ? \`Por la tarde hay \${pm.label}. ¿Esa?\` : \`No veo horarios por la tarde. Hay: \${c.slice(0, 3).map(x => x.label).join("; ")}.\`;`,
  pickRemembered: `const n = window.__pick || 1; return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(n) }, then: "const v = view || {}; return 'Elegí ' + (v.selected?.label || 'ese horario') + '. La cita no cambia hasta que confirme. ¿Confirmo?';" }] };`,
  rescheduled: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /cambiada|moved|nueva/i.test(done) ? \`Sí, la cita ya cambió. \${done}\` : \`Todavía no. \${(v.stillPending || [])[0] || v.whatThePatientMustDoHere || ""}\`;`,
  sent: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /enviada|sent|dijo que s[ií]|acompañar|said yes|will come/i.test(done) ? \`Sí. \${done}\` : \`Todavía no. \${(v.stillPending || [])[0] || ""}\`;`,
  pending: `const p = view?.stillPending || []; return p.length ? \`Falta: \${p.join("; ")}.\` : "No falta nada; todo está listo.";`,
  count: `return \`Hay \${(view?.choices || []).length} opciones.\`;`,
  cost: `const r = results[0] || {}; return r.expectedPatientPayment != null ? \`Su pago esperado es \${r.expectedPatientPayment} dólares al mes.\` : "No puedo confirmar el monto ahora mismo; su equipo de cuidado sí puede.";`,
  goals: `const r = results[0] || {}; const g = r.goals || r.patientGoals || (Array.isArray(r) ? r : []); return g.length ? \`Tiene \${g.length} metas: \${g.map(x => x.title || x.name || x.goalType).join(" y ")}.\` : "No veo metas guardadas.";`,
  careTeam: `const r = results[0] || {}; const d = r.physicianDisplayName || r.physician?.displayName || r.careTeam?.[0]?.name || r.doctor; return d ? \`Su médico es \${d}.\` : "No veo el nombre de su médico en el sistema.";`,
  upcoming: `const r = results[0] || {}; const a = (r.appointments || [])[0]; return a ? \`Su próxima cita es \${a.date || a.scheduledAt || ""} \${a.time || ""} con \${a.providerDisplayName || a.provider || "su médico"}.\` : "No veo citas próximas.";`,
  nextAction: `const r = results[0] || {}; return r.title || r.label || r.description ? \`Lo siguiente es: \${r.title || r.label || r.description}.\` : "No hay nada pendiente por ahora.";`,
  topics: P.afterTopics
};
const E = {
  options: `const c = (view?.choices || []); return c.length ? \`I found \${c.length} rides. \${c.map(x => x.label + (x.estimatedCost ? ", " + x.estimatedCost : "")).join("; ")}. Which one?\` : (view?.whatThePatientMustDoHere || "There are no rides to pick from here.");`,
  cheapestPick: `const c = (view?.choices || []); const best = c.reduce((a, b) => ((b.estimatedCostValue ?? 1e9) < (a.estimatedCostValue ?? 1e9) ? b : a), c[0]); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(best?.n || 1) }, then: "const v = view || {}; return 'I selected ' + (v.selected?.label || 'it') + '. Do you want me to book it?';" }] };`,
  roomiestPick: `const c = (view?.choices || []); const best = c.reduce((a, b) => ((b.seats || 0) > (a.seats || 0) ? b : a), c[0]); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(best?.n || 1) }, then: "const v = view || {}; return 'I selected ' + (v.selected?.label || 'it') + '. Before I book it: ' + (v.selected?.detail || '') + '. Shall I?';" }] };`,
  afterConfirm: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); const pend = (v.stillPending || []).join(" "); if (/booked|reservado/i.test(done)) return "Done. Your ride is booked."; if (/failed|fall[óo]/i.test(pend + " " + (v.whatThePatientMustDoHere || ""))) return "That booking did not go through: the provider was not available, and nothing was charged. I can try again or pick another ride."; return \`I'm booking it now. It is not confirmed yet. \${(v.stillPending || [])[0] || ""}\`;`,
  isBooked: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); const pend = (v.stillPending || []).join(" "); if (/booked|reservado/i.test(done)) return "Yes, the ride is booked."; if (/failed|fall[óo]/i.test(pend + " " + (v.whatThePatientMustDoHere || ""))) return "No. The booking failed and nothing was charged. Shall I try again or choose another ride?"; return \`Not yet. \${(v.stillPending || [])[0] || v.whatThePatientMustDoHere || ""}\`;`,
  cancelAsk: `const v = view || {}; const a = (v.availableActions || []).find(x => /cancel-confirm/.test(x.id)); return a ? \`This cancels the booked ride\${a.effect ? " (" + a.effect + ")" : ""}. Are you sure?\` : (v.whatThePatientMustDoHere || "I can't cancel from this screen.");`,
  cancelled: `const v = view || {}; const done = (v.alreadyDone || []).join(" "); return /cancel/i.test(done + " " + (v.viewId || "") + " " + (v.whatThePatientMustDoHere || "")) ? "The ride is cancelled. Nothing is booked now." : \`\${v.whatThePatientMustDoHere || "The ride was not cancelled."}\`;`,
  whatHere: `const v = view || {}; return \`\${v.whatThePatientMustDoHere || "You can continue here."}\${(v.stillPending || []).length ? " Still needed: " + v.stillPending[0] + "." : ""}\`;`,
  time: field("Hora|Time|Lè", "`It is at ${Object.values(f)[0]}.` : \"I don't see the time.\"")
};

async function waitForView(page, match, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let view = null;
  while (Date.now() < deadline) {
    view = await viewProbe(page);
    if (String(view?.viewId || "").includes(match)) return view;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return view;
}
const tapCheckboxThenNext = (label, match) => ({ custom: async ({ page, recorder }) => {
  await page.locator("#screen-content input[type=checkbox]").first().check();
  await press(page, '#screen-content [data-action="next"]');
  const view = await waitForView(page, match);
  recorder.observe(`${label}: view now ${view?.viewId}`);
} });

export const LONG_SCENARIOS = [
  {
    id: "S16-long-confused-transport-es",
    profile: "C (se confunde fácilmente)",
    language: ES,
    flow: "long: appointment → transportation with repeated 'no entendí', repetition requests, known data, a cost question mid-task, booking, return ride declined",
    seed: seedVisit,
    notes: "21 spoken turns. Backchannels ('Ajá', 'Mm'), 'no entendí', '¿qué me dijiste?', 'más despacio', a question about data the app already has, and a general question in the middle of the task.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Hola, ¿me escucha?", model: { text: "Sí, le escucho bien. ¿En qué le ayudo?" } } },
      { speak: { text: "Es que mi hija me dijo que tenía que hacer algo con la cita pero no sé qué.", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Eh? No entendí.", model: { text: "Le explico más sencillo: esta pantalla es su cita del domingo con el doctor Fresner Lee. Puede revisarla, o decirme si algo la dificulta, como el transporte." } } },
      { speak: { text: "Ah, ya. Es que no tengo quien me lleve.", model: chain([pv("appointment-open-barrier"), opt(2), pv("barrier-accept")], `const home = (view?.choices || [])[0]; return home ? \`Podemos buscarle transporte. ¿Le recogemos en su casa, \${home.detail}?\` : "Podemos buscarle transporte. ¿Dónde le recogemos?";`), expect: { viewId: "PICKUP" } } },
      { speak: { text: "¿Ustedes tienen mi dirección?", model: describe(Q.homeAddress), notes: "known data: the address is on screen; EMMI must not ask for it" } },
      { speak: { text: "Ajá.", model: act({ actionId: "barrier-pickup-home" }, `return "¿Necesita alguna ayuda especial para viajar, como silla de ruedas o que alguien le acompañe?";`), expect: { viewId: "NEEDS" } } },
      { speak: { text: "Mm… ¿qué opciones hay?", model: describe(Q.listChoices) } },
      { speak: { text: "Ninguna, gracias.", model: chain([opt(1), pv("barrier-needs-continue")], P.whatHere), expect: { viewId: "TIME" } } },
      { speak: { text: "Espere, ¿esto me va a costar?", model: { text: "Verá el costo estimado de cada vehículo antes de reservar, y no se cobra nada hasta que usted confirme." }, notes: "general question mid-task" } },
      { speak: { text: "Bueno. Siga.", model: act({ actionId: "barrier-time-accept" }, `return "Buscando vehículos.";`) } },
      { silence: { ms: 2500, label: "search in progress" } },
      { speak: { text: "¿Qué me dijiste?", model: describe(P.describeOptions), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Más despacio, por favor. ¿Cuál es la primera?", model: describe(Q.firstSlowly) } },
      { speak: { text: "Esa está bien.", model: act({ optionRef: "1" }, P.afterSelect), expect: { viewId: "REVIEW" } } },
      { speak: { text: "¿Y ahora qué hago?", model: describe(P.whatHere) } },
      { speak: { text: "Sí, hágalo usted.", model: describe(Q.readSelected) } },
      { speak: { text: "Sí, confirmo.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm), action_requested: "book ride" } },
      { silence: { ms: 3000, label: "booking completes" } },
      { speak: { text: "¿Ya quedó?", model: describe(P.isBooked) } },
      { speak: { text: "¿Y me van a traer de vuelta?", model: describe(Q.returnOffer) } },
      { speak: { text: "No, me recoge mi hija.", model: act({ actionId: "barrier-return-no" }, P.whatHere) } },
      { speak: { text: "Gracias, mija.", model: { text: "De nada. Que le vaya muy bien en la cita." } } }
    ]
  },
  {
    id: "S17-long-enrollment-journey-es",
    profile: "G (hace muchas preguntas antes de decidir)",
    language: ES,
    flow: "long: enrollment journey by hand with voice on — invitation → who is completing → identity → what care includes → eligibility → consent → enrolled → care setup",
    url: "/?scenario=access-happy",
    seed: null,
    before: async ({ page, recorder }) => { await press(page, '[data-action="language"]'); recorder.observe(`patient experience switched to ${await page.evaluate(() => document.documentElement.lang)}`); },
    notes: "16 spoken turns across nine screens. Screen narration is spoken through the TTS route on each screen; the patient asks about every screen and types the identity fields (never spoken).",
    steps: [
      { speak: { text: "¿Qué es esto?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Quién me mandó esto?", model: describe(Q.onScreenAll) } },
      { speak: { text: "¿Y qué gano yo con esto?", model: { text: "Apoyo adicional entre visitas: un monitor de presión en casa, un equipo que revisa sus lecturas y le ayuda con citas y medicinas. Sus médicos siguen siendo los mismos." } } },
      { speak: { text: "Bueno, empecemos.", model: describe(`const v = view || {}; return v.youMayPressTheseYourself === false ? "Ese botón lo toca usted: 'Comenzar mi camino de cuidado', abajo." : (v.whatThePatientMustDoHere || "");`) } },
      { navigate: { selector: '[data-action="next"]', label: "Comenzar", expect: { viewId: "DECISION_MAKER" } } },
      { speak: { text: "¿Qué hago aquí?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Lo hago yo misma.", model: describe(`return "Entonces deje marcada la primera opción, 'Para mí', y toque Continuar.";`) } },
      { navigate: { selector: '[data-action="next"]', label: "Continuar", expect: { viewId: "IDENTITY" } } },
      { speak: { text: "¿Por qué me piden mi fecha de nacimiento?", model: { text: "Para confirmar que la invitación es suya, de forma segura." }, expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Se la puedo decir?", model: { text: "Mejor escríbala en el campo; así no queda en la conversación." } } },
      { custom: async ({ page, recorder }) => { await page.locator("#dob").fill("05 / 12 / 1954"); await page.locator("#zip").fill("33176"); recorder.observe("identity typed by the patient (never spoken)"); } },
      { custom: async ({ page, recorder }) => { await press(page, '[data-action="next"]'); const view = await waitForView(page, "CARE_RECOMMENDATION", 30000); recorder.observe(`Continuar on the identity screen (asynchronous verification): view now ${view?.viewId}`); } },
      { speak: { text: "¿Qué incluye?", model: describe(Q.onScreenAll), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Mis médicos cambian?", model: { text: "No. Sus médicos siguen siendo los mismos; ACCESS se suma a su cuidado." } } },
      { navigate: { selector: '[data-action="next"]', label: "Continuar", expect: { viewId: "PRE_ELIGIBILITY" } } },
      { speak: { text: "¿Qué es esto de Medicare?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      tapCheckboxThenNext("eligibility check", "ELIGIBILITY_RESULT"),
      { speak: { text: "¿Salió bien?", model: describe(`const v = view || {}; return (v.alreadyDone || []).length ? \`Sí. \${v.alreadyDone[0]}\` : (v.whatThePatientMustDoHere || "");`), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Entonces ya estoy inscrita?", model: describe(P.whatHere), notes: "must say not yet: consent is pending" } },
      { navigate: { selector: '[data-action="next"]', label: "Continuar", expect: { viewId: "CONSENT" } } },
      { speak: { text: "¿Qué estoy aceptando?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Puedo cambiar de opinión después?", model: { text: "Sí. Puede salir de ACCESS cuando quiera; su cuidado normal no cambia." } } },
      tapCheckboxThenNext("consent", "ENROLLMENT_CONFIRMED"),
      { speak: { text: "¿Ya?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Y ahora qué sigue?", model: describe(P.whatHere) } },
      { navigate: { selector: '[data-action="next"]', label: "Configurar mi cuidado" } },
      { speak: { text: "¿Qué es esto del monitor?", model: describe(P.whatHere), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Gracias por la paciencia.", model: { text: "Con gusto. Vamos a su ritmo." } } }
    ]
  },
  {
    id: "S18-long-multi-intent-reschedule-es",
    profile: "H (quiere completar todo rápido)",
    language: ES,
    flow: "long: two intents in one sentence (move the visit + tell my daughter), afternoon slot, confirmation, then the companion invitation, with reads of the new date/time",
    seed: seedVisit,
    notes: "16 spoken turns. Multi-intent, corrections ('no, mejor por la tarde'), natural confirmations ('Dale', 'Confirma'), numbers and dates read aloud, memory of the second intent.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Cambia la cita al jueves y avísale a mi hija.", model: chain([pv("appointment-open-barrier"), opt(4), pv("barrier-reschedule-start")], `return "Voy por partes: primero busco horarios el jueves, y después le mando la invitación a su hija. ¿De acuerdo?";`), action_requested: "reschedule + invite companion" } },
      { speak: { text: "Dale.", model: { text: "Buscando horarios." } } },
      { silence: { ms: 2500, label: "slot search" } },
      { speak: { text: "¿Qué hay el jueves?", model: describe(P.slotsByDay), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "No, mejor por la tarde.", model: describe(Q.afternoonSlot) } },
      { speak: { text: "Esa, rápido.", model: describe(Q.pickRemembered), expect: { viewId: "REVIEW" } } },
      { speak: { text: "Confirma.", model: act({ actionId: "barrier-reschedule-confirm", confirmed: true }, P.afterReschedule), action_requested: "move appointment" } },
      { silence: { ms: 3000, label: "reschedule completes" } },
      { speak: { text: "¿Cambió?", model: describe(Q.rescheduled) } },
      { speak: { text: "Repíteme el día.", model: describe(Q.date) } },
      { speak: { text: "Ahora lo de mi hija.", model: chain([pv("barrier-close"), pv("appointment-open-barrier"), opt(3), pv("barrier-companion-answer")], P.companions), notes: "second intent, remembered" } },
      { speak: { text: "A María.", model: act({ optionRef: "1" }, P.afterCompanionSelect) } },
      { speak: { text: "Sí, mándala.", model: act({ actionId: "barrier-companion-send", confirmed: true }, P.afterSend), action_requested: "send invitation" } },
      { silence: { ms: 3000, label: "invitation sending" } },
      { speak: { text: "¿Y le llegó a mi hija?", model: describe(Q.sent) } },
      { speak: { text: "Léeme la cita nueva.", model: chain([pv("barrier-close")], Q.onScreenAll) } },
      { speak: { text: "¿A qué hora dijiste?", model: describe(Q.time) } },
      { speak: { text: "¿Cuánto me van a cobrar?", model: { toolCalls: [{ name: "getExpectedAccessCost", args: { patientId: "DEMO-P001", accessTrack: "ECKM" }, then: Q.cost }] } } },
      { speak: { text: "Ok, listo, bye.", model: { text: "Listo. Hasta luego." } } }
    ]
  },
  {
    id: "S19-long-topics-and-questions-es",
    profile: "B (habla mucho, información desordenada)",
    language: ES,
    flow: "long: visit topics interleaved with general questions, persona questions, a silence, and reads of known data",
    seed: seedVisit,
    notes: "20 spoken turns. Topic switching and return, persona consistency ('¿eres una persona?'), repetition requests, references ('el segundo', 'el de la rodilla'), '¿sigues ahí?' after a silence.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Oye, ¿tú eres una persona de verdad o una máquina?", model: { text: "Soy EMMI, la asistente virtual de ITERA. No soy una persona, pero estoy aquí para ayudarle con su cuidado." } } },
      { speak: { text: "¿Y cómo te llamas?", model: { text: "EMMI." } } },
      { speak: { text: "Bueno, EMMI, ¿con quién es mi cita?", model: describe(Q.doctor), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Y qué día?", model: describe(Q.date) } },
      { speak: { text: "¿Me lo repites?", model: describe(Q.date) } },
      { speak: { text: "Quiero anotar cosas para preguntarle. Primero, que me duele la rodilla cuando subo escaleras.", model: chain([pv("appointment-open-prep"), { name: "performViewAction", args: { actionId: "appointment-add-prep-topic", text: "Dolor de rodilla al subir escaleras" } }], `return "Anotado: dolor de rodilla al subir escaleras. ¿Algo más?";`) } },
      { speak: { text: "Sí, que a veces se me olvidan las pastillas.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "A veces olvido las pastillas" }, then: Q.topics }] } } },
      { speak: { text: "Por cierto, ¿qué es eso de ACCESS que me mandaron?", model: { text: "ACCESS es una opción de cuidado de Medicare que le da apoyo adicional entre visitas. Sus médicos siguen siendo los mismos." }, notes: "topic switch" } },
      { speak: { text: "¿Y cuánto me cuesta?", model: { toolCalls: [{ name: "getExpectedAccessCost", args: { patientId: "DEMO-P001", accessTrack: "ECKM" }, then: Q.cost }] } } },
      { speak: { text: "Ok. Volviendo a la lista, ¿cuántos hay?", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "LIST" }, then: Q.topics }] }, notes: "return to the task" } },
      { speak: { text: "El segundo cámbialo por 'se me olvidan las pastillas de la presión por la noche'.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "UPDATE", index: 1, value: "Se me olvidan las pastillas de la presión por la noche" }, then: Q.topics }] } } },
      { speak: { text: "Y agrega que quiero saber si puedo caminar más.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "¿Puedo caminar más?" }, then: Q.topics }] } } },
      { silence: { ms: 6000, label: "the patient thinks" } },
      { speak: { text: "¿Sigues ahí?", model: { text: "Sí, aquí estoy." } } },
      { speak: { text: "Quita el de la rodilla.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "REMOVE", target: "rodilla" }, then: Q.topics }] } } },
      { speak: { text: "No, no, déjalo. Ponlo otra vez.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "ADD", value: "Dolor de rodilla al subir escaleras" }, then: Q.topics }] }, notes: "correction" } },
      { speak: { text: "Léeme toda la lista.", model: { toolCalls: [{ name: "manageAppointmentTopics", args: { appointmentId: "appt-1", operation: "LIST" }, then: Q.topics }] } } },
      { speak: { text: "¿A qué hora era la cita?", model: describe(Q.time), notes: "known data, asked again late in the conversation" } },
      { speak: { text: "Perfecto. Eso es todo, gracias EMMI.", model: { text: "Con gusto. La lista queda guardada para su cita." } } }
    ]
  },
  {
    id: "S20-long-spanglish-companion-and-ride-es",
    profile: "F (utiliza Spanglish)",
    language: ES,
    flow: "long: companion invitation then a ride, all in Spanglish, with the confirmation gate exercised in both",
    seed: seedVisit,
    notes: "17 spoken turns. 'appointment', 'daughter', 'ride', 'walker', 'pick up', 'cheap', 'booked': every turn mixes English words into Spanish. Before the guard change, several of these were discarded as unreliable.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Necesito que mi daughter venga conmigo al appointment.", model: chain([pv("appointment-open-barrier"), opt(3), pv("barrier-companion-answer")], P.companions) } },
      { speak: { text: "¿Qué va a ver ella?", model: { text: "Solo la fecha, la hora y el lugar de la cita. No ve su información de salud." } } },
      { speak: { text: "Ella habla English, ¿le llega en English?", model: { text: "La invitación le llega en el idioma que ella tenga configurado; si no, en inglés." } } },
      { speak: { text: "Okay, send it a María.", model: act({ optionRef: "1" }, P.afterCompanionSelect), notes: "the gate: select is not send" } },
      { speak: { text: "Yes, mándala.", model: act({ actionId: "barrier-companion-send", confirmed: true }, P.afterSend), action_requested: "send invitation" } },
      { silence: { ms: 3000, label: "invitation sending" } },
      { speak: { text: "¿Ya le llegó el text?", model: describe(Q.sent) } },
      { speak: { text: "Ahora el ride. No tengo car.", model: chain([pv("barrier-close"), pv("appointment-open-barrier"), opt(2), pv("barrier-accept")], `const home = (view?.choices || [])[0]; return home ? \`Busquemos transporte. ¿Le recogemos en su casa, \${home.detail}?\` : "¿Dónde le recogemos?";`), expect: { viewId: "PICKUP" } } },
      { speak: { text: "Mi home address está bien.", model: act({ actionId: "barrier-pickup-home" }, `return "¿Necesita alguna ayuda especial para viajar?";`) } },
      { speak: { text: "Uso walker.", model: chain([opt(2), pv("barrier-needs-continue")], Q.pickupTime) } },
      { speak: { text: "¿A qué hora me pick up?", model: describe(Q.pickupTime) } },
      { speak: { text: "Okay, search.", model: act({ actionId: "barrier-time-accept" }, `return "Buscando.";`) } },
      { silence: { ms: 2500, label: "search" } },
      { speak: { text: "¿Cuál es más cheap?", model: describe(P.cheapest), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Book that one.", model: describe(`const c = (view?.choices || []); const best = c.reduce((a, b) => ((b.estimatedCostValue ?? 1e9) < (a.estimatedCostValue ?? 1e9) ? b : a), c[0]); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(best?.n || 1) }, then: "const v = view || {}; return 'Seleccioné ' + (v.selected?.label || '') + '. Para reservarlo necesito su confirmación: ' + (v.selected?.detail || '') + '. ¿Confirma?';" }] };`) } },
      { speak: { text: "Sí.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, P.afterConfirm), action_requested: "book ride" } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "¿Está booked?", model: describe(P.isBooked) } },
      { speak: { text: "Gracias, bye.", model: { text: "De nada. Hasta luego." } } }
    ]
  },
  {
    id: "S21-long-elderly-video-visit-es",
    profile: "A (adulto mayor, responde muy poco)",
    language: ES,
    flow: "long: video-visit device check with one-word answers, long silences, '¿eh?', 'más despacio', an unrecognisable utterance, and a recheck",
    seed: appt => ({ language: ES, appointments: [appt({ modality: "TELEHEALTH", joinUrl: "https://example.invalid/visit" })] }),
    notes: "16 spoken turns, most of them one or two words, with 5–8 s silences between them. Also the no-transcript recovery in the middle of a task.",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Hola.", model: { text: "Hola. Estoy aquí para ayudarle con su visita por video. ¿Qué necesita?" } } },
      { silence: { ms: 6000, label: "long pause" } },
      { speak: { text: "¿Eh?", model: { text: "Decía que puedo ayudarle con su visita por video. ¿Quiere que revisemos su teléfono?" } } },
      { speak: { text: "¿Con quién es?", model: describe(Q.doctor), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Cuándo?", model: describe(Q.date) } },
      { speak: { text: "La visita… por video… no sé.", model: chain([pv("appointment-open-barrier"), opt(2), pv("barrier-video-start")], `return "Estoy revisando el micrófono, la cámara, la conexión y el enlace.";`) } },
      { silence: { ms: 3000, label: "device check" } },
      { speak: { text: "¿Qué?", model: describe(Q.pending) } },
      { speak: { text: "Más despacio.", model: describe(`const p = view?.stillPending || []; return p.length ? \`Despacio: falta \${p[0]}.\` : "No falta nada.";`) } },
      { speak: { text: "¿Qué hago?", model: act({ actionId: "barrier-video-guide" }, P.whatHere) } },
      { silence: { ms: 5000, label: "the patient tries" } },
      { speak: { text: "Sí.", model: { text: "Bien. Cuando termine, dígame 'ya' y reviso de nuevo." } } },
      { silence: { ms: 5000, label: "the patient tries" } },
      { custom: async ({ page, recorder }) => { await page.evaluate(() => { window.__fakeLive.options.transcribe = false; }); recorder.observe("provider set to return no transcript for the next turn"); } },
      { speak: { text: "(inaudible)", model: { text: "" }, notes: "no transcript; the app's recovery is measured", timeoutMs: 20000 } },
      { custom: async ({ page }) => { await page.evaluate(() => { window.__fakeLive.options.transcribe = true; }); } },
      { speak: { text: "Ya.", model: act({ actionId: "barrier-video-recheck" }, `return "Revisando de nuevo.";`) } },
      { silence: { ms: 3000, label: "recheck" } },
      { speak: { text: "¿Sirve?", model: describe(`const p = view?.stillPending || []; return p.length ? \`Todavía falta: \${p[0]}.\` : "Sí, todo funcionó. Está lista para la visita.";`) } },
      { speak: { text: "Repita.", model: describe(`const p = view?.stillPending || []; return p.length ? \`Falta \${p[0]}.\` : "Todo funcionó.";`) } },
      { speak: { text: "Gracias.", model: { text: "De nada." } } },
      { speak: { text: "Adiós.", model: { text: "Hasta luego. Aquí estaré." } } }
    ]
  },
  {
    id: "S22-long-change-of-mind-en",
    profile: "D (changes their mind)",
    language: EN,
    flow: "long (EN): book a ride, cancel it through the destructive gate, change mind again, rebook a ride the provider rejects, recover by choosing another, with a barge-in on the way",
    seed: appt => ({ language: EN, appointments: [appt()] }),
    notes: "19 spoken turns in English. 'Actually cancel it' → 'Wait, no!' → rebook. The simulator rejects one ride in eleven deterministically (UberX for this visit), so the second booking fails: EMMI must say so, offer a retry and another vehicle, never 'Done'. Includes a long reply interrupted with 'Stop.'",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "I can't get to my appointment.", model: chain([pv("appointment-open-barrier"), opt(2), pv("barrier-accept")], `const home = (view?.choices || [])[0]; return home ? \`I can arrange a ride. Should we pick you up at home, \${home.detail}?\` : "I can arrange a ride. Where should we pick you up?";`), expect: { viewId: "PICKUP" } } },
      { speak: { text: "Yes, my home address.", model: act({ actionId: "barrier-pickup-home" }, `return "Do you need any special help to travel?";`) } },
      { speak: { text: "No, nothing special.", model: chain([opt(1), pv("barrier-needs-continue")], E.whatHere), expect: { viewId: "TIME" } } },
      { speak: { text: "Go ahead and search.", model: act({ actionId: "barrier-time-accept" }, `return "Looking for rides.";`) } },
      { silence: { ms: 2500, label: "search" } },
      { speak: { text: "What are my options?", model: describe(E.options), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "The one with more room.", model: describe(E.roomiestPick), expect: { viewId: "REVIEW" } } },
      { speak: { text: "Yes, book it.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, E.afterConfirm), action_requested: "book ride" } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "Is it booked?", model: describe(E.isBooked) } },
      { speak: { text: "Hmm. Actually, cancel it.", model: chain([pv("barrier-return-no")], `const v = view || {}; const a = (v.availableActions || []).find(x => x.id === "barrier-ride-cancel"); return a ? "This cancels the booked ride and nothing else. Are you sure?" : (v.whatThePatientMustDoHere || "I can't cancel from this screen.");`), notes: "the app is still asking about the ride home; a compliant model answers that first (no return ride) and asks before touching a destructive control" } },
      { speak: { text: "Yes, cancel it.", model: chain([{ name: "performViewAction", args: { actionId: "barrier-ride-cancel", confirmed: true } }, { name: "performViewAction", args: { actionId: "barrier-ride-cancel-confirm", confirmed: true } }], E.cancelled), action_requested: "cancel ride", notes: "both destructive controls carry the patient's confirmation; the gate refuses either without it" } },
      { speak: { text: "Wait, no! I do need it after all.", model: chain([pv("barrier-accept"), pv("barrier-pickup-home")], `const v = view || {}; const already = v.selected ? [] : [{ name: "performViewAction", args: { optionRef: "1" } }]; return { text: "", toolCalls: [...already, { name: "performViewAction", args: { actionId: "barrier-needs-continue" } }, { name: "performViewAction", args: { actionId: "barrier-time-accept" }, then: "return 'No problem. Searching again.';" }] };`), notes: "change of mind again: from the cancelled state the screen offers 'Arrange another ride'; the app remembers the travel needs already answered, so the double reads the screen before choosing" } },
      { silence: { ms: 2500, label: "search again" } },
      { speak: { text: "Tell me about all of them.", holdFloor: true, model: { text: "Sure. The first is UberX, a standard car for twenty-seven ninety-five, picking you up at nine forty-five. The second is UberXL, with more room, for forty-one sixty-eight, picking you up at nine forty. The third is Uber WAV, wheelchair accessible, for thirty-three dollars, picking you up at nine thirty-five. All of them arrive before ten ten." } } },
      { speak: { text: "Stop.", bargeIn: true, bargeInAfterMs: 1500, model: { text: "Okay." } } },
      { speak: { text: "Just book the cheapest one.", model: describe(E.cheapestPick), expect: { viewId: "REVIEW" } } },
      { speak: { text: "Yes.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, E.afterConfirm), action_requested: "book ride", notes: "the simulator rejects this ride: EMMI must report the failure" } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "Done?", model: describe(E.isBooked) } },
      { speak: { text: "Try again.", model: act({ actionId: "barrier-retry", confirmed: true }, E.afterConfirm), action_requested: "retry booking" } },
      { silence: { ms: 3000, label: "retry" } },
      { speak: { text: "Still nothing? Then the big one instead.", model: chain([pv("barrier-back")], `const c = (view?.choices || []); const best = c.reduce((a, b) => ((b.seats || 0) > (a.seats || 0) ? b : a), c[0]); return { text: "", toolCalls: [{ name: "performViewAction", args: { optionRef: String(best?.n || 2) }, then: "const v = view || {}; return 'I selected ' + (v.selected?.label || 'it') + '. Shall I book it?';" }] };`), expect: { viewId: "REVIEW" } } },
      { speak: { text: "Yes.", model: act({ actionId: "barrier-reserve-confirm", confirmed: true }, E.afterConfirm), action_requested: "book ride" } },
      { silence: { ms: 3000, label: "booking" } },
      { speak: { text: "Is it booked now?", model: describe(E.isBooked) } },
      { speak: { text: "Thanks.", model: { text: "You're welcome." } } }
    ]
  },
  {
    id: "S23-creole-sample-ht",
    profile: "A (granmoun, reponn kout)",
    language: ES,
    flow: "Haitian Creole sample: voice guidance is not offered in Kreyòl (VOICE_UNAVAILABLE_FOR_LOCALE), so the session is Spanish and the patient speaks Kreyòl, then asks for Kreyòl",
    seed: seedVisit,
    notes: "The app only offers voice in English and Spanish; a Kreyòl UI shows 'Voice guidance isn't available in this language yet'. This sample checks what the Spanish session does with Kreyòl speech (language signal, no discard) and with an explicit request it cannot honour (no session rebuild, EMMI keeps answering).",
    steps: [
      { navigate: { selector: '[data-action="appointment-open"]', label: "open the appointment" } },
      { speak: { text: "Bonjou.", model: { text: "Hola. Estoy aquí para ayudarle con su cita." } } },
      { speak: { text: "Ki lè randevou mwen an?", model: describe(Q.time), expect: { contextBeforeAnswer: true }, notes: "Kreyòl inside a Spanish session: a language signal, never a discarded turn" } },
      { speak: { text: "Mwen pa gen transpò.", model: chain([pv("appointment-open-barrier"), opt(2), pv("barrier-accept")], `const home = (view?.choices || [])[0]; return home ? \`Podemos buscarle transporte. ¿Le recogemos en su casa, \${home.detail}?\` : "¿Dónde le recogemos?";`), expect: { viewId: "PICKUP" } } },
      { speak: { text: "Pale kreyòl avè m, tanpri.", model: { text: "Lo siento, por ahora la guía por voz solo está disponible en español y en inglés. Puede escribirme en criollo en el chat." }, timeoutMs: 30000, notes: "explicit request for a language voice does not support: no rebuild, the session must stay alive" } },
      { silence: { ms: 3000, label: "after the request" } },
      { custom: async ({ page, recorder }) => { const lang = await page.evaluate(() => document.documentElement.lang); const sessions = await page.evaluate(() => window.__fakeLive.sessionCount); const probe = await page.evaluate(() => window.__emmiVoiceProbe?.()); recorder.observe(`after the Kreyòl request: html lang=${lang}; provider sessions opened=${sessions}; voice state=${probe?.state}; socket=${probe?.socket}`); recorder.session.language_switch = { lang, sessions, state: probe?.state }; } },
      { speak: { text: "Wi.", model: act({ actionId: "barrier-pickup-home" }, `return "¿Necesita alguna ayuda especial para viajar?";`), expect: { viewId: "NEEDS" } } },
      { speak: { text: "Non, mèsi.", model: chain([opt(1), pv("barrier-needs-continue")], P.whatHere), expect: { viewId: "TIME" } } },
      { speak: { text: "Gracias.", model: { text: "De nada." } } }
    ]
  },
  {
    id: "S24-long-my-care-hub-es",
    profile: "G (hace muchas preguntas antes de decidir)",
    language: ES,
    flow: "long: My Care hub — goals, care team, next appointment, next step, medicines, a symptom report, then into the appointment",
    seed: seedVisit,
    notes: "17 spoken turns on the hub and its tools before any task: the 'general questions' half of the brief, plus a blood-pressure report that must go through the safety tool.",
    steps: [
      { speak: { text: "¿Qué tengo que hacer hoy?", model: { toolCalls: [{ name: "getNextBestAction", args: { patientId: "DEMO-P001" }, then: Q.nextAction }] }, expect: { contextBeforeAnswer: true } } },
      { speak: { text: "¿Cuáles son mis metas?", model: { toolCalls: [{ name: "getPatientGoals", args: { patientId: "DEMO-P001" }, then: Q.goals }] } } },
      { speak: { text: "¿Quién es mi médico?", model: { toolCalls: [{ name: "getCareTeam", args: { patientId: "DEMO-P001" }, then: Q.careTeam }] } } },
      { speak: { text: "¿Cuándo es mi próxima cita?", model: { toolCalls: [{ name: "getUpcomingAppointments", args: { patientId: "DEMO-P001" }, then: Q.upcoming }] } } },
      { speak: { text: "¿Y qué medicinas tengo?", model: { toolCalls: [{ name: "getMedicationList", args: { patientId: "DEMO-P001" }, then: `const r = results[0] || {}; const m = r.medications || (Array.isArray(r) ? r : []); return m.length ? \`Tiene \${m.length}: \${m.map(x => x.name || x.displayName).join(", ")}.\` : "No veo medicinas en su lista.";` }] } } },
      { speak: { text: "Hoy me salió 150 con 95 y me duele un poco la cabeza.", model: { toolCalls: [{ name: "evaluateClinicalEscalation", args: { systolic: 150, diastolic: 95, symptoms: "dolor de cabeza leve" }, then: `const r = results[0] || {}; return r.severity === "EMERGENCY" ? "Eso puede ser una emergencia. Llame al 911 ahora." : \`Gracias por decírmelo. \${r.guidance || r.message || "Voy a avisar a su equipo de cuidado para que lo revise."}\`;` }] }, notes: "symptom + reading must go through the safety tool, not the model's judgement" } },
      { speak: { text: "¿Eso es grave?", model: { text: "No es una emergencia, pero su equipo debe verlo. Si aparece dolor de pecho, dificultad para respirar o confusión, llame al 911." } } },
      { speak: { text: "Ok. ¿Qué hay en esta pantalla?", model: describe(Q.onScreenAll), expect: { contextBeforeAnswer: true } } },
      { speak: { text: "Abre mi cita.", model: act({ actionId: "appointment-open" }, P.whatHere), expect: { viewId: "APPOINTMENT" } } },
      { speak: { text: "¿Dónde es?", model: describe(Q.where) } },
      { speak: { text: "¿Y cómo llego?", model: { text: "Puedo buscarle transporte, o si prefiere, decirle la dirección para que la comparta con quien le lleve. ¿Qué prefiere?" } } },
      { speak: { text: "Dime la dirección nada más.", model: describe(Q.where) } },
      { speak: { text: "¿Me lo puedes repetir más despacio?", model: describe(Q.where) } },
      { speak: { text: "Bueno. ¿Y lo del monitor de presión, cuándo llega?", model: { toolCalls: [{ name: "getAssignedDevice", args: { patientId: "DEMO-P001" }, then: `const r = results[0] || {}; return r.fulfillmentStatus || r.status ? \`Su monitor está en estado: \${r.fulfillmentStatus || r.status}. No tengo una fecha de entrega confirmada.\` : "No veo un monitor asignado.";` }] }, notes: "topic switch away from the appointment" } },
      { speak: { text: "Vale. Volvamos a la cita. ¿A qué hora?", model: describe(Q.time), notes: "return to the previous topic" } },
      { speak: { text: "Recuérdamelo el día antes.", model: { text: "Puedo guardar un recordatorio dentro de ITERA para el día anterior. ¿Lo guardo?" } } },
      { speak: { text: "Sí.", model: { toolCalls: [{ name: "createAppointmentReminder", args: { appointmentId: "appt-1", slot: "DAY_BEFORE", confirmed: true }, then: `const r = results[0] || {}; return r.success ? \`Listo, le recordaré \${r.time || "el día anterior"} dentro de ITERA.\` : "No pude guardar el recordatorio.";` }] }, action_requested: "create reminder" } },
      { speak: { text: "Gracias, muy amable.", model: { text: "Con gusto. Aquí estoy cuando me necesite." } } }
    ]
  }
];
