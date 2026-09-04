import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator, appointmentPrepConversationResponse, expandEmmiQuery, resolveAppointmentPrepTopic } from "../src/emmi/textOrchestrator.js";
import { EMMI_TOOL_DECLARATIONS, EmmiToolOrchestrator } from "../src/emmi/tools.js";
import { DEMO_BASELINE_OBSERVATIONS } from "../src/config.js";
import { accessProgressMeasure, patientStartingPoint } from "../src/accessCareActivation.js";

// The demo patient's baselines, resolved by the same functions the goals screen uses. Built rather
// than typed out, so a test that says EMMI answers "152 over 88" is asserting that EMMI and the
// card are reading one record — not that two literals happen to agree today.
const demoAccessBaselines = ["BLOOD_PRESSURE_CONTROL", "WEIGHT_MANAGEMENT"].map(goalType => {
  const startingPoint = patientStartingPoint(goalType, { BLOOD_PRESSURE_CONTROL: DEMO_BASELINE_OBSERVATIONS.bloodPressure, WEIGHT_MANAGEMENT: DEMO_BASELINE_OBSERVATIONS.weight });
  return { goalType, startingPoint, measure: accessProgressMeasure(goalType, startingPoint) };
});

const passage = (program, text = "Approved patient-facing concepts") => ({ sourceId: `program-${program.toLowerCase()}`, sourcePath: `programs/${program.toLowerCase()}.md`, heading: program, text });

// One confirmed-looking appointment the way the runtime hands it to EMMI: a patient-facing status
// string, never an internal one, and only the fields the tool contract promises.
const upcoming = (overrides = {}) => ({ id: "APPT-1", patientStatus: "Cita confirmada", providerDisplayName: "Dr. Martinez", specialty: "Cardiology", scheduledAt: "2026-09-08T14:00:00.000Z", modality: "IN_PERSON", ...overrides });

function harness({ locale = "ES", program = "ACCESS", conversation = {}, appointmentPrep = null, appointmentSupport = null, transportation = null, retrievalFailure = false, knowledgePassages = null, appointments = [], appointmentLookupFails = false, appointmentRequestFails = false, accessBaselines = demoAccessBaselines } = {}) {
  const calls = [];
  const events = [];
  let appointmentTopics = [...(appointmentPrep?.topics || [])];
  const executeTool = vi.fn(async (name, args) => {
    calls.push({ name, args });
    // The twelve appointment tools of the EMMI runtime contract. The mutating ones mirror the real
    // confirmation gate, so a test that sees one succeed proves the patient confirmed it.
    if (name === "getUpcomingAppointments") {
      if (appointmentLookupFails) throw new Error("appointments_unavailable");
      return { appointments };
    }
    if (name === "getAppointment") {
      const found = appointments.find(item => item.id === args.appointmentId);
      return found ? { appointment: found } : { success: false, status: "NOT_FOUND" };
    }
    if (name === "getAppointmentTransportation") return transportation || { success: false, status: "TRANSPORTATION_NOT_FOUND", reservations: [] };
    if (name === "manageAppointmentTopics") {
      if (args.operation === "OPEN" || args.operation === "LIST") return { success: true, status: args.operation === "OPEN" ? "OPENED" : "SAVED", topics: appointmentTopics };
      if (args.operation === "ADD") appointmentTopics.push(args.value);
      if (args.operation === "MOVE") {
        const match = appointmentTopics.findIndex(topic => /presi[oó]n/i.test(topic));
        if (match >= 0) appointmentTopics.unshift(...appointmentTopics.splice(match, 1));
      }
      return { success: true, status: "SAVED", topics: appointmentTopics };
    }
    if (name === "getSchedulingCapability") return { capability: "DIRECT_BOOKING", supportedModalities: ["IN_PERSON", "TELEHEALTH"] };
    if (name === "getProviderAvailability") return { ok: true, slots: [{ slotId: "SLOT-1", startAt: "2026-09-08T14:00:00.000Z", endAt: "2026-09-08T14:20:00.000Z", modality: "IN_PERSON", providerId: "prov-1" }] };
    if (name === "startAppointmentRequest") return appointmentRequestFails ? { success: false, status: "APPOINTMENT_FLOW_NOT_OPENED" } : { success: true, status: "FLOW_OPENED", needId: "NEED-1" };
    if (name === "createAppointmentRequest") return args.confirmed === true ? { success: true, status: "REQUEST_SENT", needId: args.needId } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "bookAppointment") return args.confirmed === true ? { success: true, status: "CONFIRMED", confirmationNumber: "CONF-1" } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "rescheduleAppointment") return args.confirmed === true ? { success: true, status: "RESCHEDULE_REQUESTED" } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "cancelAppointment") return args.confirmed === true ? { success: true, status: "CANCELED" } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "createAppointmentReminder") return args.confirmed === true ? { success: true, slot: args.slot, time: "8:00 AM", channel: "IN_APP", note: "Reminders appear inside ITERA. No phone notification is scheduled." } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "getCareCircle") return { members: [{ inviteId: "INV-1", firstName: "Ana", relationship: "daughter", status: "ACCEPTED" }] };
    if (name === "shareAppointment") return args.confirmed === true ? { success: true, status: "SHARED", scope: { appointmentTimeAndPlace: true } } : { success: false, status: "CONFIRMATION_REQUIRED" };
    if (name === "recordGoalBarrier") return { success: true, barrierId: "BAR-1", category: args.category, status: "OPEN", owner: "EMMI", resolutionPath: "EMMI_ASSISTED", alreadyKnown: false };
    if (name === "searchKnowledge") {
      if (retrievalFailure) throw new Error("knowledge_unavailable");
      const programs = ["ACCESS", "CCM", "RPM", "PCM", "APCM", "ASM"].filter(item => new RegExp(item, "i").test(args.query));
      return { intent: "PROGRAM_EXPLANATION", passages: knowledgePassages || (programs.length ? programs : [program]).map(item => passage(item)) };
    }
    if (name === "getExpectedAccessCost") return { grossBeneficiaryResponsibility: 6, expectedPatientPayment: 0, currency: "USD", responsibilityType: "EXPECTED", explanationCode: "SUPPLEMENTAL_COVERS_COST_SHARE" };
    if (name === "getEnrollmentContext") return { eligibilityStatus: "ELIGIBLE" };
    if (name === "getAssignedDevice") return { found: true, displayName: "Tenovi Connected Blood Pressure Monitor", deviceId: "TEN-8842", integrationStatus: "CONNECTED", fulfillmentStatus: "NOT_REQUESTED", shipmentStatus: null };
    if (name === "getMedicationList") return { medications: [{ name: "Lisinopril", details: "10 mg", active: true }] };
    if (name === "getPatientGoals") return { goals: [{ title: "Mantener mi presión arterial bajo control" }] };
    if (name === "getLatestReading") return { reading: { systolic: 120, diastolic: 80, classification: "WITHIN_EXPECTED_RANGE" } };
    if (name === "getReadingTrend") return { trend: { periodDays: 7, count: 5, averageSystolic: 124, averageDiastolic: 81, direction: "STABLE" } };
    if (name === "getClinicalTarget") return { target: { systolicMaximum: 139, diastolicMaximum: 89 } };
    if (name === "getGoalProgress") return { progress: { readingCountThisWeek: 5 } };
    if (name === "getAccessBaseline") {
      const baselines = accessBaselines === null ? [] : args.goalType ? accessBaselines.filter(item => item.goalType === args.goalType) : accessBaselines;
      return { baselines, source: baselines.length ? "PATIENT_RUNTIME" : "UNAVAILABLE" };
    }
    if (name === "getCareTeam") return { physicianDisplayName: "Dr. Fresner" };
    if (name === "getNextBestAction") return { label: "Continuar" };
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911" };
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program, currentScreen: "CARE_RECOMMENDATION", patientId: "DEMO-P001", accessTrack: "eCKM", activeGoal: { id: "goal-bp" }, appointmentPrep, appointmentSupport }),
    getConversation: () => ({ conversationSessionId: "conv-1", conversationSummary: conversation.summary || "", recentTurns: conversation.turns || [] }),
    executeTool,
    screenExplanation: () => locale === "ES" ? "Esta pantalla explica el cuidado disponible." : "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "gemini_not_configured" }) })),
    onEvent: (type, detail) => events.push({ type, detail })
  });
  return { orchestrator, calls, events, executeTool };
}

describe("Ask EMMI answer-first orchestration", () => {
  it("shows the persisted appointment list instead of the approved-knowledge fallback", async () => {
    const appointmentPrep = { appointmentId: "APPT-1", topics: ["Mareos", "Presión arterial"] };
    const { orchestrator, executeTool } = harness({ appointmentPrep });
    const answer = await orchestrator.answer("muéstrame la lista");
    expect(answer.text).toMatch(/1\. Mareos.*2\. Presión arterial/i);
    expect(executeTool).toHaveBeenCalledWith("manageAppointmentTopics", expect.objectContaining({ appointmentId: "APPT-1", operation: "OPEN" }));
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("executes list multi-intents in order", async () => {
    const appointmentPrep = { appointmentId: "APPT-1", topics: ["Mareos", "Presión arterial"] };
    const { orchestrator, calls } = harness({ appointmentPrep });
    const answer = await orchestrator.answer("muéstrame la lista y después pon lo de la presión primero");
    expect(calls.filter(call => call.name === "manageAppointmentTopics").map(call => call.args.operation)).toEqual(["OPEN", "MOVE"]);
    expect(answer.text).toMatch(/1\. Presión arterial.*2\. Mareos/i);
  });

  it("runs clinical safety before a topic-list command", async () => {
    const appointmentPrep = { appointmentId: "APPT-1", topics: ["Mareos"] };
    const { orchestrator, executeTool } = harness({ appointmentPrep });
    const answer = await orchestrator.answer("Agrega dolor de pecho a la lista");
    expect(answer.emergency).toBe(true);
    expect(executeTool).toHaveBeenCalledWith("evaluateClinicalEscalation", expect.any(Object));
    expect(executeTool).not.toHaveBeenCalledWith("manageAppointmentTopics", expect.anything());
  });

  it("asks which appointment instead of guessing or using knowledge when context is ambiguous", async () => {
    const appointmentPrep = { appointmentId: "", ambiguous: true, appointmentCandidates: [{ appointmentId: "APPT-1" }, { appointmentId: "APPT-2" }] };
    const { orchestrator, executeTool } = harness({ appointmentPrep });
    const answer = await orchestrator.answer("muéstrame la lista");
    expect(answer.text).toMatch(/cu[aá]l cita/i);
    expect(executeTool).not.toHaveBeenCalledWith("manageAppointmentTopics", expect.anything());
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });
  it("answers ACCESS and CCM from different relevant knowledge instead of the same generic fallback", async () => {
    const { orchestrator } = harness();
    const access = await orchestrator.answer("¿Qué es ACCESS?");
    const ccm = await orchestrator.answer("¿Qué es CCM?");
    expect(access.text).toMatch(/opción de cuidado de Medicare/i);
    expect(ccm.text).toMatch(/Chronic Care Management/i);
    expect(access.text).not.toBe(ccm.text);
    expect(access.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
    expect(access.text).not.toMatch(/Puedo explicar esta pantalla/i);
  });

  it("does not answer CCM + RPM when the patient asked only about CCM", async () => {
    const { orchestrator } = harness({
      locale: "EN",
      knowledgePassages: [passage("ACCESS"), passage("ccm-rpm"), passage("CCM")]
    });
    const answer = await orchestrator.answer("What is CCM?");
    expect(answer.text).toMatch(/Chronic Care Management/i);
    expect(answer.text).not.toMatch(/CCM \+ RPM combines/i);
  });

  it("resolves a comparison follow-up from recent ACCESS and CCM context", async () => {
    const { orchestrator } = harness({ conversation: { summary: "user: qué es ACCESS | assistant: ACCESS... | user: y CCM | assistant: CCM..." } });
    const answer = await orchestrator.answer("¿Y cuál es la diferencia?");
    expect(answer.trace.retrievalQuery).toMatch(/ACCESS CCM/i);
    expect(answer.text).toMatch(/ACCESS.*CCM|CCM.*ACCESS/i);
  });

  it.each([
    ["¿Cuánto voy a pagar?", "getExpectedAccessCost", /\$0/],
    ["¿Soy elegible?", "getEnrollmentContext", /puede continuar/],
    ["¿Qué monitor tengo?", "getAssignedDevice", /Tenovi/],
    ["¿Está conectado mi monitor?", "getAssignedDevice", /conectado/],
    ["¿Qué medicamentos tienen registrados?", "getMedicationList", /Lisinopril/],
    ["¿Qué significa mi lectura más reciente de presión arterial?", "getLatestReading", /120\/80/],
    ["¿Cómo ha estado mi presión esta semana?", "getReadingTrend", /124\/81/],
    ["¿Cuál es mi objetivo de presión?", "getClinicalTarget", /140\/90/],
    ["¿Cómo voy con mi meta?", "getGoalProgress", /5 lecturas/],
    ["¿Cuál es mi meta?", "getPatientGoals", /presión arterial/],
    ["¿Mi médico sigue siendo mi médico?", "getCareTeam", /Dr\. Fresner/],
    ["¿Qué sigue?", "getNextBestAction", /Continuar/]
  ])("routes patient-specific question %s through %s", async (question, expectedTool, relevance) => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer(question);
    expect(executeTool).toHaveBeenCalledWith(expectedTool, expect.any(Object));
    expect(answer.text).toMatch(relevance);
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
  });

  it.each([
    ["ES", "BP Readings", /Su lectura más reciente fue 120\/80/],
    ["ES", "Mis lecturas de presión arterial", /Su lectura más reciente fue 120\/80/],
    ["EN", "Blood pressure readings", /Your latest reading was 120\/80/],
    ["KR", "Mezi tansyon mwen yo", /Dènye lekti ou te 120\/80/]
  ])("keeps the appointment-prep topic %s/%s on blood pressure despite stale chat context", async (locale, question, relevance) => {
    const { orchestrator, executeTool } = harness({
      locale,
      conversation: {
        summary: "user: What does an A1c result mean? | assistant: A1c is a blood test used in ACCESS. | assistant: Let’s prepare for your appointment and discuss BP Readings."
      },
      knowledgePassages: [{
        sourceId: "access-a1c",
        sourcePath: "care/access-a1c.md",
        heading: "Why A1c is asked for",
        text: "Being asked for an A1c does not mean the patient has diabetes."
      }]
    });

    const answer = await orchestrator.answer(question);

    expect(executeTool).toHaveBeenCalledWith("getLatestReading", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE" });
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
    expect(answer.text).toMatch(relevance);
    expect(answer.text).not.toMatch(/A1c|diabetes/i);
    expect(answer.trace.intent).toBe("LATEST_READING");
  });

  it("uses the structured appointment topic for a short conversational follow-up", async () => {
    const conversation = {
      summary: "user: What does an A1c result mean? | assistant: A1c is a blood test. | user: BP Readings | assistant: Su lectura más reciente fue 120/80.",
      turns: [
        { role: "user", text: "What does an A1c result mean?" },
        { role: "assistant", text: "A1c is a blood test." },
        { role: "user", text: "BP Readings" },
        { role: "assistant", text: "Su lectura más reciente fue 120/80." }
      ]
    };
    const appointmentPrep = { appointmentId: "APPT-1", providerDisplayName: "Dr. Fresner", topics: ["BP Readings", "medicamentos"] };
    const { orchestrator, executeTool } = harness({ locale: "ES", conversation, appointmentPrep });

    const answer = await orchestrator.answer("¿Qué significa eso?");

    expect(resolveAppointmentPrepTopic({ question: "¿Qué significa eso?", conversation: { recentTurns: conversation.turns }, appointmentPrep })).toBe("BP Readings");
    expect(executeTool).toHaveBeenCalledWith("getLatestReading", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE" });
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
    expect(answer.text).toMatch(/120\/80/);
    expect(answer.text).not.toMatch(/A1c|diabetes/i);
  });

  it("uses the selected prep topic to understand a trend follow-up", async () => {
    const conversation = { turns: [{ role: "user", text: "BP Readings" }] };
    const appointmentPrep = { topics: ["BP Readings", "medicamentos"] };
    const { orchestrator, executeTool } = harness({ locale: "ES", conversation, appointmentPrep });

    const answer = await orchestrator.answer("¿Cómo han cambiado esta semana?");

    expect(executeTool).toHaveBeenCalledWith("getReadingTrend", { patientId: "DEMO-P001", metricType: "BLOOD_PRESSURE", periodDays: 7 });
    expect(answer.text).toMatch(/124\/81/);
  });

  it("does not guess between multiple prep topics before the patient selects one", () => {
    const appointmentPrep = { topics: ["BP Readings", "medicamentos"] };
    expect(resolveAppointmentPrepTopic({ question: "¿Qué significa eso?", conversation: {}, appointmentPrep })).toBe("");
  });

  it("closes a Spanish appointment agenda instead of falling into stale QMB context", async () => {
    const appointmentPrep = {
      appointmentId: "APPT-1",
      providerDisplayName: "Dr. Fresner Lee",
      topics: ["Mis Medicamentos", "Presión alta", "fatiga"],
      medications: [{ medicationId: "med-1", name: "Lisinopril 10 mg" }, { medicationId: "med-2", name: "Atorvastatin 20 mg" }]
    };
    const { orchestrator, executeTool } = harness({
      locale: "ES",
      appointmentPrep,
      conversation: { summary: "user: ¿Qué es QMB? | assistant: QMB es un programa de ahorro de Medicare." }
    });

    const answer = await orchestrator.answer("solo eso");

    expect(answer.text).toMatch(/agenda.*lista/i);
    expect(answer.text).toContain("Presión alta");
    expect(answer.text).toContain("Lisinopril 10 mg");
    expect(answer.text).not.toMatch(/QMB|Medicare|programa de ahorro/i);
    expect(answer.appointmentPrepUpdate.status).toBe("COMPLETED");
    expect(answer.trace.intent).toBe("APPOINTMENT_PREPARATION");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it.each(["es todo", "eso es todo", "esto es todo", "sí, es todo", "por ahora es todo", "con eso sería todo", "listo", "ya terminé", "done", "mwen fini"])("recognizes %s as a natural completion of appointment preparation", phrase => {
    const response = appointmentPrepConversationResponse({
      question: phrase,
      locale: phrase === "mwen fini" ? "KR" : phrase === "done" ? "EN" : "ES",
      appointmentPrep: {
        providerDisplayName: "Dr. Fresner Lee",
        topics: ["Mis Medicamentos"],
        medications: [{ medicationId: "med-1", name: "Lisinopril 10 mg" }]
      }
    });
    expect(response.update.status).toBe("COMPLETED");
    expect(response.text).toMatch(/agenda|ajanda/i);
  });

  it("answers a general question about a scheduled visit with its recorded purpose and asks for the patient's concern", async () => {
    const appointmentPrep = {
      appointmentId: "APPT-1",
      providerDisplayName: "Dr. Fresner Lee",
      status: "CONFIRMED",
      reasonCategory: "ROUTINE_FOLLOW_UP",
      reasonSummary: "",
      topics: [],
      medications: []
    };
    const { orchestrator, executeTool } = harness({ locale: "ES", appointmentPrep });

    const answer = await orchestrator.answer("Tengo una pregunta sobre mi cita con Dr. Fresner Lee.");

    expect(answer.text).toMatch(/seguimiento de rutina/i);
    expect(answer.text).toMatch(/principal duda o preocupación/i);
    expect(answer.text).not.toMatch(/No tengo suficiente información aprobada/i);
    expect(answer.trace.intent).toBe("APPOINTMENT_PREPARATION");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("explains only the appointment purpose on file and does not invent one when it is absent", () => {
    const grounded = appointmentPrepConversationResponse({
      question: "¿Cuál es el objetivo de mi cita?",
      locale: "ES",
      appointmentPrep: { providerDisplayName: "Dr. Fresner Lee", reasonCategory: "BLOOD_PRESSURE_FOLLOW_UP", topics: [] }
    });
    expect(grounded.text).toMatch(/seguimiento a la presión arterial/i);
    expect(grounded.text).toMatch(/duda o preocupación/i);

    const unspecified = appointmentPrepConversationResponse({
      question: "¿Para qué es mi cita?",
      locale: "ES",
      appointmentPrep: { providerDisplayName: "Dr. Fresner Lee", reasonCategory: "OTHER", reasonSummary: "", topics: [] }
    });
    expect(unspecified.text).toMatch(/no indica un objetivo más específico/i);
    expect(unspecified.text).not.toMatch(/rutina|presión arterial|medicamento/i);
  });

  it("continues a saved appointment topic and turns the patient's detail into an agenda note", () => {
    const appointmentPrep = { providerDisplayName: "Dr. Fresner Lee", topics: ["Presión alta", "fatiga"], medications: [] };
    const selected = appointmentPrepConversationResponse({ question: "fatiga", locale: "ES", appointmentPrep });
    expect(selected.text).toMatch(/cuándo comenzó|detalle principal/i);
    expect(selected.update.currentTopic).toBe("fatiga");

    const noted = appointmentPrepConversationResponse({
      question: "Me pasa principalmente por las tardes",
      locale: "ES",
      appointmentPrep: { ...appointmentPrep, emmiPreparation: selected.update }
    });
    expect(noted.update.notesByTopic.fatiga).toEqual(["Me pasa principalmente por las tardes"]);
    expect(noted.update.reviewedTopics).toContain("fatiga");
    expect(noted.text).toContain("Presión alta");
  });

  it("closes the exact headache conversation when the patient answers es todo", async () => {
    const appointmentPrep = {
      appointmentId: "APPT-1",
      providerDisplayName: "Dr. Fresner Lee",
      topics: ["Dolor de cabeza"],
      medications: []
    };
    const selected = appointmentPrepConversationResponse({ question: "Dolor de cabeza", locale: "ES", appointmentPrep });
    const noted = appointmentPrepConversationResponse({
      question: "hace una semana, dolor intenso, luego se alivia",
      locale: "ES",
      appointmentPrep: { ...appointmentPrep, emmiPreparation: selected.update }
    });
    const { orchestrator, executeTool } = harness({
      locale: "ES",
      appointmentPrep: { ...appointmentPrep, emmiPreparation: noted.update },
      conversation: { turns: [{ role: "assistant", text: noted.text }] }
    });

    const answer = await orchestrator.answer("es todo");

    expect(answer.text).toMatch(/agenda.*lista/i);
    expect(answer.text).toContain("Dolor de cabeza");
    expect(answer.appointmentPrepUpdate.status).toBe("COMPLETED");
    expect(answer.appointmentPrepUpdate.notesByTopic["Dolor de cabeza"]).toEqual(["hace una semana, dolor intenso, luego se alivia"]);
    expect(answer.trace.intent).toBe("APPOINTMENT_PREPARATION");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("answers a generic appointment-prep continuation from the saved agenda", async () => {
    const appointmentPrep = { appointmentId: "APPT-1", providerDisplayName: "Dr. Fresner Lee", topics: ["Presión alta", "fatiga"], medications: [{ medicationId: "med-1", name: "Lisinopril 10 mg" }] };
    const { orchestrator, executeTool } = harness({ locale: "ES", appointmentPrep });
    const answer = await orchestrator.answer("Tengo una pregunta sobre mi cita con Dr. Fresner Lee");
    expect(answer.text).toMatch(/lista para la cita|qué punto/i);
    expect(answer.text).toContain("fatiga");
    expect(answer.text).toContain("Lisinopril 10 mg");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("uses screen context only for an actual screen-help question", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("¿Qué tengo que hacer en esta pantalla?");
    expect(answer.text).toBe("Esta pantalla explica el cuidado disponible.");
    expect(answer.trace.intent).toBe("CURRENT_SCREEN_HELP");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("routes the words patients actually use for screen help, in Spanish and English", async () => {
    for (const question of ["¿Qué hago aquí?", "¿Qué hago ahora?", "¿Y ahora?"]) {
      const { orchestrator, executeTool } = harness();
      const answer = await orchestrator.answer(question);
      expect(answer.text, question).toBe("Esta pantalla explica el cuidado disponible.");
      expect(answer.trace.intent, question).toBe("CURRENT_SCREEN_HELP");
      expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
    }
    for (const question of ["What now?", "What do I do here?"]) {
      const { orchestrator } = harness({ locale: "EN" });
      const answer = await orchestrator.answer(question);
      expect(answer.trace.intent, question).toBe("CURRENT_SCREEN_HELP");
    }
  });

  it("uses the immediate assistant turn for repeat and simplify follow-ups", async () => {
    const conversation = { turns: [{ role: "assistant", text: "Your next step is ‘Start your care journey.’" }] };
    const repeat = await harness({ locale: "EN", conversation }).orchestrator.answer("Can you repeat that?");
    expect(repeat.text).toMatch(/Your next step/);
    expect(repeat.trace.intent).toBe("REPEAT_PRIOR_ANSWER");
    const simpler = await harness({ locale: "EN", conversation }).orchestrator.answer("Can you explain that more simply?");
    expect(simpler.text).toMatch(/tap.*Start your care journey/i);
    expect(simpler.trace.responseMode).toBe("DETERMINISTIC_CONVERSATION_CONTEXT");
  });

  it("routes a Spanish monitor-shipping question to runtime without inventing a date", async () => {
    const { orchestrator, executeTool } = harness({ locale: "ES" });
    const answer = await orchestrator.answer("¿Cuándo me van a enviar el monitor?");
    expect(executeTool).toHaveBeenCalledWith("getAssignedDevice", expect.any(Object));
    expect(answer.text).toMatch(/no veo una solicitud de envío/i);
    expect(answer.text).not.toMatch(/mañana|días|septiembre|tracking/i);
  });

  it("answers a named referring-doctor follow-up from the care-team runtime", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("Will I still see Dr. Fresner?");
    expect(executeTool).toHaveBeenCalledWith("getCareTeam", expect.any(Object));
    expect(answer.text).toMatch(/Dr\. Fresner remains part of your care/i);
  });

  it("routes chest pain to deterministic safety before retrieval", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("Tengo dolor fuerte en el pecho.");
    expect(executeTool).toHaveBeenCalledWith("evaluateClinicalEscalation", expect.any(Object));
    expect(answer.emergency).toBe(true);
    expect(answer.text).toMatch(/911/);
  });

  it("reports retrieval failure transparently instead of masking it as screen help", async () => {
    const { orchestrator, events } = harness({ retrievalFailure: true });
    const answer = await orchestrator.answer("¿Qué es CCM?");
    expect(answer.text).toMatch(/no puedo consultar esa información/i);
    expect(events.some(event => event.type === "EMMI_RETRIEVAL_FAILED")).toBe(true);
    expect(answer.text).not.toMatch(/Puedo explicar esta pantalla/i);
  });

  it("keeps Kreyòl as the active output language", async () => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer("Kisa RPM ye?");
    expect(answer.text).toMatch(/RPM vle di/);
    expect(answer.text).not.toMatch(/[가-힣]/);
  });

  it.each([
    ["Kisa ACCESS ye?", /ACCESS se yon opsyon swen Medicare/i],
    ["Kisa CCM ye?", /CCM vle di Chronic Care Management/i]
  ])("answers the Kreyòl knowledge question %s in Kreyòl", async (question, expected) => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer(question);
    expect(answer.text).toMatch(expected);
    expect(answer.text).not.toMatch(/[가-힣]/);
  });

  it.each([
    ["que es access", /opción de cuidado de Medicare/i],
    ["¿Qué es ACCESS?", /opción de cuidado de Medicare/i],
    ["que es ccm", /Chronic Care Management/i],
    ["¿Qué es RPM?", /monitoreo remoto/i],
    ["¿Cuál es la diferencia entre ACCESS y CCM?", /ACCESS.*CCM|CCM.*ACCESS/i],
    ["¿Esto es obligatorio?", /voluntari/i],
    ["¿Puedo dejar el programa?", /voluntaria.*terminar su participación/i]
  ])("answers required knowledge QA query %s", async (question, relevance) => {
    const { orchestrator } = harness();
    const answer = await orchestrator.answer(question);
    expect(answer.text).toMatch(relevance);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
  });

  it("answers why medication review is needed from approved medication knowledge", async () => {
    const { orchestrator } = harness({
      knowledgePassages: [{ sourceId: "care-medications", sourcePath: "care/medications.md", heading: "Medication review", text: "Approved medication reconciliation guidance" }]
    });
    const answer = await orchestrator.answer("¿Por qué necesitan mis medicamentos?");
    expect(answer.text).toMatch(/ayuda al equipo a entender qué toma/i);
    expect(answer.trace.responseMode).toBe("DETERMINISTIC_GROUNDED_FALLBACK");
  });

  it("answers every part of a combined cost and leaving question", async () => {
    const answer = await harness().orchestrator.answer("¿Cuánto voy a pagar y puedo salir del programa si cambio de opinión?");
    expect(answer.text).toMatch(/pago esperado.*\$0/i);
    expect(answer.text).toMatch(/participación es voluntaria.*terminar su participación/i);
    expect(answer.trace.toolCalls).toContain("getExpectedAccessCost");
  });

  it("answers both doctor continuity and cost in one compound question", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("¿Esto reemplaza a mi médico y cuánto me costará?");
    expect(answer.text).toMatch(/Dr\. Fresner/i);
    expect(answer.text).toMatch(/no reemplaza|sigue formando parte|continúa/i);
    expect(answer.text).toMatch(/pago esperado.*\$0/i);
    expect(executeTool).toHaveBeenCalledWith("getCareTeam", expect.any(Object));
    expect(executeTool).toHaveBeenCalledWith("getExpectedAccessCost", expect.any(Object));
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });

  it("treats an interrupted mandatory-enrollment question as patient choice, not legal authority", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("Perdón que te interrumpa: ¿es obligatorio o puedo decidir que no?");
    expect(answer.text).toMatch(/participación es voluntaria/i);
    expect(answer.text).not.toMatch(/representante|autoridad legal/i);
    expect(answer.trace.intent).toBe("VOLUNTARY_PARTICIPATION");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });
});

describe("Ask EMMI appointment coordination", () => {
  it("answers when an appointment is from the runtime tool rather than the knowledge base", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming({ patientStatus: "Appointment confirmed" })] });
    const answer = await orchestrator.answer("When is my appointment?");
    expect(executeTool).toHaveBeenCalledWith("getUpcomingAppointments", expect.any(Object));
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
    expect(answer.trace.intent).toBe("APPOINTMENT_STATUS");
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
    expect(answer.text).toMatch(/Dr\. Martinez/);
    expect(answer.text).toMatch(/Appointment confirmed/);
    expect(answer.appointmentId).toBe("APPT-1");
  });

  it("says there is no appointment on file instead of inventing one", async () => {
    const { orchestrator } = harness({ locale: "EN", appointments: [] });
    const answer = await orchestrator.answer("Do I have an appointment?");
    expect(answer.text).toMatch(/don’t see an appointment on file/i);
    expect(answer.text).not.toMatch(/confirmed/i);
    expect(answer.quickAction).toBe("appointment-request");
  });

  it("reports an appointment lookup failure instead of guessing at a date", async () => {
    const { orchestrator, events } = harness({ locale: "EN", appointmentLookupFails: true });
    const answer = await orchestrator.answer("When is my appointment?");
    expect(answer.text).toMatch(/can’t check your appointments/i);
    expect(answer.text).not.toMatch(/confirmed|Dr\. Martinez/i);
    expect(events.some(event => event.type === "EMMI_TOOL_FAILED")).toBe(true);
  });

  it("opens an appointment request without requesting, booking or confirming anything", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("I need to see my cardiologist");
    expect(executeTool).toHaveBeenCalledWith("startAppointmentRequest", expect.objectContaining({ reasonSummary: "I need to see my cardiologist" }));
    expect(executeTool).not.toHaveBeenCalledWith("createAppointmentRequest", expect.anything());
    expect(executeTool).not.toHaveBeenCalledWith("bookAppointment", expect.anything());
    expect(answer.trace.intent).toBe("APPOINTMENT_NEED");
    expect(answer.needId).toBe("NEED-1");
    expect(answer.text).toMatch(/Nothing is sent until you confirm/i);
    expect(answer.text).not.toMatch(/\bconfirmed\b|\bbooked\b|\brequest has been sent\b/i);
  });

  it("keeps an explicit Spanish ACCESS definition on topic when retrieval ranks an unrelated page first", async () => {
    const { orchestrator } = harness({
      locale: "ES",
      knowledgePassages: [{
        sourceId: "emergency",
        sourcePath: "safety/emergencies.md",
        heading: "Emergencies",
        text: "EMMI is not an emergency service.",
        localizedAnswers: { ES: "EMMI no es un servicio de emergencias." }
      }]
    });
    const answer = await orchestrator.answer("¿Qué es ACCESS y cómo me ayuda?");
    expect(answer.text).toMatch(/ACCESS es una opción de cuidado de Medicare/i);
    expect(answer.text).not.toMatch(/emergencia/i);
  });

  it("routes a bilingual Spanish appointment request instead of returning generic knowledge", async () => {
    const { orchestrator, executeTool } = harness({ locale: "ES" });
    const answer = await orchestrator.answer("necesito un appointment");
    expect(executeTool).toHaveBeenCalledWith("startAppointmentRequest", expect.objectContaining({ reasonSummary: "necesito un appointment" }));
    expect(answer.trace.intent).toBe("APPOINTMENT_NEED");
    expect(answer.text).toMatch(/solicitud de cita/i);
    expect(answer.text).not.toMatch(/_Sources_|Q:|A:/i);
  });

  it("carries the part of the day the patient asked for into the opener", async () => {
    const { orchestrator } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("I need an appointment in the morning");
    expect(answer.text).toMatch(/mornings/i);
  });

  it("acknowledges transport and a family companion in a compound appointment request", async () => {
    const { orchestrator } = harness({ locale: "ES" });
    const answer = await orchestrator.answer("Necesito una cita por la mañana, también un Uber y quiero que mi hija me acompañe.");
    expect(answer.text).toMatch(/mañanas/i);
    expect(answer.text).toMatch(/transporte/i);
    expect(answer.text).toMatch(/hija.*acompañe/i);
    expect(answer.text).toMatch(/después de confirmar el horario/i);
    expect(answer.quickAction).toBe("appointment-request");
  });

  it("classifies an obvious reason rather than sending a blank one", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    await orchestrator.answer("I need an appointment about my blood pressure");
    expect(executeTool).toHaveBeenCalledWith("startAppointmentRequest", expect.objectContaining({ reasonCategory: "BLOOD_PRESSURE_FOLLOW_UP" }));
  });

  it("reports the appointment the patient already has instead of duplicating it", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming({ patientStatus: "Appointment confirmed" })] });
    const answer = await orchestrator.answer("I need to see Dr. Martinez");
    expect(executeTool).not.toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
    expect(answer.text).toMatch(/already have an appointment with Dr\. Martinez/i);
    expect(answer.appointmentId).toBe("APPT-1");
  });

  it("never claims a request was opened when the tool did not open one", async () => {
    const { orchestrator } = harness({ locale: "EN", appointmentRequestFails: true });
    const answer = await orchestrator.answer("I need an appointment");
    expect(answer.text).toMatch(/couldn’t open the appointment request/i);
    expect(answer.text).toMatch(/nothing has been requested/i);
    expect(answer.needId).toBeUndefined();
  });

  it("never cancels from chat text and asks for explicit confirmation first", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming()] });
    const answer = await orchestrator.answer("I want to cancel my appointment");
    expect(executeTool).not.toHaveBeenCalledWith("cancelAppointment", expect.anything());
    expect(answer.pendingAction).toBe("appointment-cancel");
    expect(answer.appointmentId).toBe("APPT-1");
    expect(answer.text).toMatch(/Nothing is cancelled until you confirm/i);
  });

  it("never reschedules from chat text either", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming()] });
    const answer = await orchestrator.answer("Can I reschedule my appointment?");
    expect(executeTool).not.toHaveBeenCalledWith("rescheduleAppointment", expect.anything());
    expect(answer.quickAction).toBe("appointment-reschedule");
    expect(answer.text).toMatch(/nothing changes until you pick one and confirm/i);
  });

  it("asks which appointment the patient means rather than acting on a guess", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming(), upcoming({ id: "APPT-2", providerDisplayName: "Dr. Fresner", specialty: "Primary Care" })] });
    const answer = await orchestrator.answer("I need to cancel my appointment");
    expect(executeTool).not.toHaveBeenCalledWith("cancelAppointment", expect.anything());
    expect(answer.text).toMatch(/Which one do you mean/i);
    expect(answer.appointmentId).toBeUndefined();
  });

  it("says there is nothing to change when no appointment is on file", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [] });
    const answer = await orchestrator.answer("I want to cancel my appointment");
    expect(executeTool).not.toHaveBeenCalledWith("cancelAppointment", expect.anything());
    expect(answer.text).toMatch(/don’t see an appointment on file to change/i);
  });

  it("lets clinical safety take an appointment request that carries a symptom", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("I need a cardiology appointment because I have severe chest pain");
    expect(executeTool).toHaveBeenCalledWith("evaluateClinicalEscalation", expect.any(Object));
    expect(executeTool).not.toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
    expect(executeTool).not.toHaveBeenCalledWith("getUpcomingAppointments", expect.anything());
    expect(answer.emergency).toBe(true);
    expect(answer.text).toMatch(/911/);
  });

  it("keeps the same safety priority in Spanish", async () => {
    const { orchestrator, executeTool } = harness({ locale: "ES" });
    const answer = await orchestrator.answer("Necesito una cita porque tengo un dolor fuerte en el pecho");
    expect(executeTool).not.toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
    expect(answer.emergency).toBe(true);
  });

  it("treats needing to see a doctor as a request, not as a difficulty to file", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    await orchestrator.answer("I need to see my doctor");
    expect(executeTool).not.toHaveBeenCalledWith("recordGoalBarrier", expect.anything());
    expect(executeTool).toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
  });

  it("files getting there as a difficulty rather than as a request for a visit", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("I can't get there because I don't have a ride");
    expect(executeTool).not.toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
    expect(executeTool).toHaveBeenCalledWith("recordGoalBarrier", expect.objectContaining({ category: "TRANSPORTATION" }));
    expect(answer.text).not.toMatch(/cancel/i);
  });

  // §135: a patient saying they cannot get to a visit is telling us about a barrier. It must never
  // become a request for another visit, and it must never become a cancellation.
  it("never turns a problem getting to an appointment into a request or a cancellation", async () => {
    const { orchestrator, executeTool } = harness({ locale: "EN", appointments: [upcoming()] });
    const answer = await orchestrator.answer("I can't go to my appointment because I don't have a ride");
    expect(executeTool).not.toHaveBeenCalledWith("startAppointmentRequest", expect.anything());
    expect(executeTool).not.toHaveBeenCalledWith("cancelAppointment", expect.anything());
    expect(answer.text).not.toMatch(/cancel/i);
    expect(answer.trace.intent).not.toMatch(/^APPOINTMENT_(NEED|CHANGE)$/);
  });

  it("answers an appointment request in Kreyòl and never in Korean", async () => {
    const { orchestrator } = harness({ locale: "KR" });
    const answer = await orchestrator.answer("Mwen bezwen yon randevou");
    expect(answer.trace.intent).toBe("APPOINTMENT_NEED");
    expect(answer.text).toMatch(/demann randevou/i);
    expect(answer.text).not.toMatch(/[가-힣]/);
  });

  it("answers an appointment status question in Spanish", async () => {
    const { orchestrator } = harness({ locale: "ES", appointments: [upcoming()] });
    const answer = await orchestrator.answer("¿Cuándo es mi cita?");
    expect(answer.text).toMatch(/Esto es lo que tengo registrado/i);
    expect(answer.text).toMatch(/Cita confirmada/);
  });

  it("answers appointment and confirmed ride details together without opening another flow", async () => {
    const appointment = upcoming({
      providerDisplayName: "Dr. Fresner Lee",
      scheduledLabel: "mié, 2 sep · 11:45 a. m.",
      locationName: "Fresner Medical Group"
    });
    const transportation = {
      success: true,
      status: "CONFIRMED",
      reservations: [{ status: "CONFIRMED", tripType: "OUTBOUND", serviceName: "UberX", pickupLabel: "11:00 a. m.", estimatedArrivalLabel: "11:21 a. m.", reservationId: "UB-15582" }]
    };
    const { orchestrator, executeTool } = harness({ locale: "ES", appointments: [appointment], appointmentPrep: { appointmentId: "APPT-1" }, transportation });
    const answer = await orchestrator.answer("Confírmame qué cita y qué transporte quedaron reservados, incluida la recogida y la reserva.");
    expect(executeTool).toHaveBeenCalledWith("getAppointmentTransportation", expect.objectContaining({ appointmentId: "APPT-1" }));
    expect(answer.text).toMatch(/Dr\. Fresner Lee/);
    expect(answer.text).toMatch(/11:45 a\. m\./);
    expect(answer.text).toMatch(/UberX/);
    expect(answer.text).toMatch(/11:00 a\. m\./);
    expect(answer.text).toMatch(/UB-15582/);
    expect(answer.text).not.toMatch(/\.\.$/);
    expect(answer.trace.responseMode).toBe("RUNTIME_GROUNDED");
  });

  it("answers every part of a combined Uber and family-companion request", async () => {
    const appointment = upcoming({ providerDisplayName: "Dr. Fresner Lee", scheduledLabel: "mié, 2 sep · 11:45 a. m.", locationName: "Fresner Medical Group" });
    const transportation = { success: true, status: "CONFIRMED", reservations: [{ status: "CONFIRMED", tripType: "OUTBOUND", serviceName: "UberX", pickupLabel: "11:00 a. m.", reservationId: "UB-15582" }] };
    const { orchestrator } = harness({ locale: "ES", appointments: [appointment], appointmentPrep: { appointmentId: "APPT-1" }, transportation });
    const answer = await orchestrator.answer("Ya tengo el Uber, pero me preocupa ir solo. ¿Puede acompañarme un familiar y cómo lo coordinamos?");
    expect(answer.text).toMatch(/UberX/);
    expect(answer.text).toMatch(/familiar|persona de confianza/i);
    expect(answer.text).toMatch(/antes de enviar nada/i);
    expect(answer.quickAction).toBe("appointment-companion");
    expect(answer.appointmentId).toBe("APPT-1");
  });

  it("answers companion-invitation privacy from the visible structured flow", async () => {
    const appointmentSupport = { appointmentId: "APPT-1", barrierType: "companion", step: "REVIEW", contactName: "Maria", invitationScope: { appointmentDate: true, appointmentTime: true, appointmentLocation: true, healthInformation: false } };
    const { orchestrator, executeTool } = harness({ locale: "ES", appointmentPrep: { appointmentId: "APPT-1" }, appointmentSupport });
    const answer = await orchestrator.answer("¿María solo verá la fecha y el lugar? No quiero compartir información de salud.");
    expect(answer.text).toMatch(/fecha, la hora y el lugar/i);
    expect(answer.text).toMatch(/no incluye.*salud/i);
    expect(answer.text).toMatch(/No se envía nada/i);
    expect(answer.trace.intent).toBe("APPOINTMENT_COMPANION_PRIVACY");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
  });
});

// The runtime tool layer that the appointment intents above call into. Its whole job is to refuse
// to do anything destructive or irreversible without the patient's confirmation, and to never
// describe a failure as a success.
const appointmentTools = (hooks = {}) => new EmmiToolOrchestrator({
  getContext: () => ({ patientId: "DEMO-P001", currentScreen: "MY_APPOINTMENTS", locale: "EN" }),
  onUpcomingAppointments: () => ({ appointments: [upcoming()], requests: [] }),
  onAppointment: ({ appointmentId }) => (appointmentId === "APPT-1" ? { appointment: upcoming() } : { success: false, status: "NOT_FOUND" }),
  onAppointmentTransportation: () => ({ success: true, status: "CONFIRMED", reservations: [{ reservationId: "UB-15582", status: "CONFIRMED", tripType: "OUTBOUND", serviceName: "UberX", pickupLabel: "11:00 AM" }] }),
  onSchedulingCapability: () => ({ capability: "DIRECT_BOOKING", supportedModalities: ["IN_PERSON"] }),
  onProviderAvailability: () => ({ ok: true, slots: [{ slotId: "SLOT-1", startAt: "2026-09-08T14:00:00.000Z" }] }),
  onStartAppointmentRequest: () => ({ needId: "NEED-1" }),
  onCreateAppointmentRequest: () => ({ success: true, status: "REQUEST_SENT", needId: "NEED-1" }),
  onBookAppointment: () => ({ success: true, status: "CONFIRMED", confirmationNumber: "CONF-1" }),
  onRescheduleAppointment: () => ({ success: true, status: "RESCHEDULE_REQUESTED" }),
  onCancelAppointment: () => ({ success: true, status: "CANCELED" }),
  onAppointmentReminder: () => ({ slot: "DAY_BEFORE", time: "8:00 AM", channel: "IN_APP" }),
  onCareCircle: () => ({ allowed: true, reason: "SHARING_AVAILABLE", members: [{ inviteId: "INV-1", firstName: "Ana", relationship: "daughter", status: "ACCEPTED" }] }),
  onShareAppointment: () => ({ success: true, status: "SHARED", scope: { appointmentTimeAndPlace: true } }),
  ...hooks
});

describe("EMMI appointment runtime tool contract", () => {
  it("declares the appointment and transportation tools the runtime contract names", () => {
    const names = EMMI_TOOL_DECLARATIONS[0].functionDeclarations.map(item => item.name);
    expect(names).toEqual(expect.arrayContaining([
      "getUpcomingAppointments", "getAppointment", "getSchedulingCapability", "getProviderAvailability",
      "startAppointmentRequest", "createAppointmentRequest", "bookAppointment", "rescheduleAppointment",
      "cancelAppointment", "createAppointmentReminder", "getCareCircle", "shareAppointment"
    ]));
    expect(names).toContain("getAppointmentTransportation");
    expect(names).toContain("manageAppointmentTopics");
    expect(new Set(names).size).toBe(names.length);
  });

  it("reports topic writes only from the application callback", async () => {
    const onAppointmentTopics = vi.fn(() => ({ success: true, status: "SAVED", topics: ["Mareos"] }));
    const tools = appointmentTools({ onAppointmentTopics });
    expect(await tools.execute("manageAppointmentTopics", { appointmentId: "APPT-1", operation: "ADD", value: "Mareos" })).toMatchObject({ success: true, topics: ["Mareos"] });
    expect(onAppointmentTopics).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: "APPT-1", operation: "ADD", value: "Mareos" }));
    expect(await appointmentTools().execute("manageAppointmentTopics", { appointmentId: "APPT-1", operation: "ADD", value: "Mareos" })).toMatchObject({ success: false, status: "APPOINTMENT_TOPICS_UNAVAILABLE" });
  });

  it.each([
    ["createAppointmentRequest", { needId: "NEED-1" }],
    ["bookAppointment", { needId: "NEED-1", slotId: "SLOT-1" }],
    ["rescheduleAppointment", { appointmentId: "APPT-1" }],
    ["cancelAppointment", { appointmentId: "APPT-1" }],
    ["createAppointmentReminder", { appointmentId: "APPT-1", slot: "DAY_BEFORE" }],
    ["shareAppointment", { appointmentId: "APPT-1", inviteId: "INV-1" }]
  ])("refuses %s without explicit confirmation", async (tool, args) => {
    const tools = appointmentTools();
    expect(await tools.execute(tool, args)).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
    expect(await tools.execute(tool, { ...args, confirmed: false })).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
    expect(await tools.execute(tool, { ...args, confirmed: "true" })).toMatchObject({ success: false, status: "CONFIRMATION_REQUIRED" });
  });

  it("never cancels an appointment without confirmation, whatever the conversation said", async () => {
    const onCancelAppointment = vi.fn(() => ({ success: true, status: "CANCELED" }));
    const tools = appointmentTools({ onCancelAppointment });
    await tools.execute("cancelAppointment", { appointmentId: "APPT-1" });
    expect(onCancelAppointment).not.toHaveBeenCalled();
    expect(await tools.execute("cancelAppointment", { appointmentId: "APPT-1", confirmed: true })).toMatchObject({ success: true, status: "CANCELED" });
    expect(onCancelAppointment).toHaveBeenCalledTimes(1);
  });

  it("opens a request flow without requesting anything", async () => {
    const tools = appointmentTools();
    expect(await tools.execute("startAppointmentRequest", { reasonCategory: "OTHER", reasonSummary: "I need to see my cardiologist" })).toMatchObject({ success: true, status: "FLOW_OPENED", needId: "NEED-1" });
    expect(await tools.execute("startAppointmentRequest", { reasonCategory: "OTHER" }).then(result => result.status)).not.toBe("REQUEST_SENT");
  });

  it("bounds the reason summary the way the barrier record does", async () => {
    const onStartAppointmentRequest = vi.fn(() => ({ needId: "NEED-1" }));
    const tools = appointmentTools({ onStartAppointmentRequest });
    await tools.execute("startAppointmentRequest", { reasonCategory: "OTHER", reasonSummary: "x".repeat(900) });
    expect(onStartAppointmentRequest.mock.calls[0][0].reasonSummary).toHaveLength(400);
  });

  it("reports a booking failure as a failure and a vanished slot as unavailable", async () => {
    expect(await appointmentTools({ onBookAppointment: () => ({ success: false }) }).execute("bookAppointment", { needId: "NEED-1", slotId: "SLOT-1", confirmed: true })).toMatchObject({ success: false, status: "BOOKING_FAILED" });
    expect(await appointmentTools({ onBookAppointment: () => ({ success: false, slotGone: true }) }).execute("bookAppointment", { needId: "NEED-1", slotId: "SLOT-1", confirmed: true })).toMatchObject({ success: false, status: "SLOT_UNAVAILABLE" });
  });

  it("never turns a failed request into a sent one", async () => {
    expect(await appointmentTools({ onCreateAppointmentRequest: () => null }).execute("createAppointmentRequest", { needId: "NEED-1", confirmed: true })).toMatchObject({ success: false, status: "REQUEST_NOT_SENT" });
    expect(await appointmentTools({ onRescheduleAppointment: () => null }).execute("rescheduleAppointment", { appointmentId: "APPT-1", confirmed: true })).toMatchObject({ success: false, status: "RESCHEDULE_NOT_REQUESTED" });
    expect(await appointmentTools({ onCancelAppointment: () => null }).execute("cancelAppointment", { appointmentId: "APPT-1", confirmed: true })).toMatchObject({ success: false, status: "CANCEL_NOT_COMPLETED" });
  });

  it("reports missing availability rather than an empty calendar", async () => {
    expect(await appointmentTools().execute("getProviderAvailability", {})).toMatchObject({ ok: false, error: "PROVIDER_REQUIRED", availabilityChecked: false });
    expect(await appointmentTools({ onProviderAvailability: () => null }).execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: false, error: "AVAILABILITY_UNAVAILABLE" });
    expect(await appointmentTools({ onProviderAvailability: () => ({ ok: false, error: "NO_AVAILABILITY_SOURCE" }) }).execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: false, error: "NO_AVAILABILITY_SOURCE" });
    expect(await appointmentTools().execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: true, slots: [{ slotId: "SLOT-1" }] });
  });

  it("reports an unknown scheduling capability rather than assuming a channel", async () => {
    expect(await appointmentTools().execute("getSchedulingCapability", {})).toMatchObject({ success: false, status: "PROVIDER_REQUIRED", availabilityChecked: false });
    expect(await appointmentTools({ onSchedulingCapability: () => null }).execute("getSchedulingCapability", { providerId: "prov-1" })).toMatchObject({ success: false, status: "CAPABILITY_UNKNOWN" });
    expect(await appointmentTools().execute("getSchedulingCapability", { providerId: "prov-1" })).toMatchObject({ capability: "DIRECT_BOOKING", supportedModalities: ["IN_PERSON"] });
  });

  it("reports an appointment it cannot find rather than describing one", async () => {
    expect(await appointmentTools().execute("getAppointment", { appointmentId: "APPT-9" })).toMatchObject({ success: false, status: "NOT_FOUND" });
    expect(await appointmentTools().execute("getAppointment", { appointmentId: "APPT-1" })).toMatchObject({ appointment: { id: "APPT-1" } });
  });

  it("reads confirmed appointment transportation only from the application callback", async () => {
    const onAppointmentTransportation = vi.fn(() => ({ success: true, status: "CONFIRMED", reservations: [{ reservationId: "UB-15582", status: "CONFIRMED" }] }));
    const tools = appointmentTools({ onAppointmentTransportation });
    expect(await tools.execute("getAppointmentTransportation", { appointmentId: "APPT-1" })).toMatchObject({ success: true, reservations: [{ reservationId: "UB-15582" }] });
    expect(onAppointmentTransportation).toHaveBeenCalledWith({ appointmentId: "APPT-1" });
    expect(await appointmentTools({ onAppointmentTransportation: () => null }).execute("getAppointmentTransportation", { appointmentId: "APPT-1" })).toMatchObject({ success: false, status: "TRANSPORTATION_NOT_FOUND", reservations: [] });
  });

  it("saves an appointment reminder as in-app only and never as a phone notification", async () => {
    const saved = await appointmentTools().execute("createAppointmentReminder", { appointmentId: "APPT-1", slot: "day_before", confirmed: true });
    expect(saved).toMatchObject({ success: true, channel: "IN_APP" });
    expect(saved.note).toMatch(/No phone notification is scheduled/i);
    expect(await appointmentTools({ onAppointmentReminder: () => null }).execute("createAppointmentReminder", { appointmentId: "APPT-1", slot: "DAY_BEFORE", confirmed: true })).toMatchObject({ success: false, status: "REMINDER_NOT_SAVED" });
  });
});

describe("typographic apostrophes reach the same gates as straight ones", () => {
  // Phones and speech transcription substitute ’ for '. Every gate in the orchestrator was
  // written with a straight apostrophe, so this input used to bypass the safety engine entirely
  // and land on the knowledge base.
  it("routes a curly-apostrophe emergency to the clinical safety engine", async () => {
    const { orchestrator, calls } = harness({ locale: "EN" });
    const response = await orchestrator.answer("I can’t breathe and I need to see my doctor");
    expect(calls.map(call => call.name)).toContain("evaluateClinicalEscalation");
    expect(response.emergency).toBe(true);
    expect(calls.some(call => call.name === "startAppointmentRequest")).toBe(false);
  });

  it("treats a curly-apostrophe difficulty as a difficulty, not a knowledge question", async () => {
    const { orchestrator, calls } = harness({ locale: "EN" });
    await orchestrator.answer("I can’t get to my appointment on my own");
    expect(calls.some(call => call.name === "searchKnowledge")).toBe(false);
  });

  it("answers the straight and curly forms of the same question identically", async () => {
    const straight = harness({ locale: "EN" });
    const curly = harness({ locale: "EN" });
    const a = await straight.orchestrator.answer("I can't breathe");
    const b = await curly.orchestrator.answer("I can’t breathe");
    expect(b.text).toBe(a.text);
    expect(b.emergency).toBe(a.emergency);
  });
});

describe("follow-up query expansion", () => {
  it("adds the two recent programs to a pronoun-like comparison", () => {
    expect(expandEmmiQuery({ question: "y cual es la diferencia", conversation: { conversationSummary: "ACCESS then CCM" }, program: "ACCESS" })).toMatch(/ACCESS CCM/);
  });
});

// When the model cannot be reached, the answer still has to be the answer.
//
// Production QA called this "generic ACCESS fallback ignores focused knowledge". The fallback
// collected programme names from the retrieved file PATHS, and every ACCESS page has "access" in
// its path, so any question that retrieved one returned the general ACCESS paragraph and threw away
// everything that had just been retrieved. eCKM, the outcome targets and A1c all came back as the
// same three sentences about extra support between doctor visits.
describe("the answer when the model is unreachable", () => {
  const focusedPassage = {
    sourceId: "access-tracks",
    sourcePath: "programs/access-tracks.md",
    heading: "ACCESS tracks: eCKM, CKM, MSK and BH",
    text: "**eCKM stands for Early Cardio-Kidney-Metabolic.** It is the ACCESS track for early heart, kidney and metabolic conditions.\n\nIt is one of four tracks CMS launched:\n\n- **eCKM — Early Cardio-Kidney-Metabolic.** Hypertension and prediabetes.\n- **CKM — Cardio-Kidney-Metabolic.** Diabetes and chronic kidney disease.\n\n## EMMI response rule\n\nNever quote a monthly amount from this page."
  };

  it("answers from the page that was retrieved rather than from a canned programme description", async () => {
    const { orchestrator } = harness({ locale: "EN", knowledgePassages: [focusedPassage] });
    const answer = await orchestrator.answer("What does eCKM mean?");
    expect(answer.text).toMatch(/Early Cardio-Kidney-Metabolic/);
    expect(answer.text).not.toMatch(/extra support between doctor visits/i);
  });

  it("keeps the list items, because that is where the facts are", async () => {
    const { orchestrator } = harness({ locale: "EN", knowledgePassages: [focusedPassage] });
    const answer = await orchestrator.answer("What does eCKM mean?");
    // A promise of four tracks followed by nothing is worse than no answer at all.
    expect(answer.text).toMatch(/Hypertension and prediabetes/);
    expect(answer.text).not.toMatch(/launched:\s*\./);
  });

  it("never reads the page's own instructions out to the patient", async () => {
    const { orchestrator } = harness({ locale: "EN", knowledgePassages: [focusedPassage] });
    const answer = await orchestrator.answer("What does eCKM mean?");
    expect(answer.text).not.toMatch(/EMMI response rule|Never quote a monthly amount/i);
  });

  it("leaves no markdown in what the patient reads", async () => {
    const { orchestrator } = harness({ locale: "EN", knowledgePassages: [focusedPassage] });
    const answer = await orchestrator.answer("What does eCKM mean?");
    expect(answer.text).not.toMatch(/\*\*|^#|^- /m);
  });

  // The corpus is English and the canned answers are trilingual. With no model there is nothing to
  // translate with, so a Spanish patient keeps a Spanish answer rather than English prose.
  it("keeps a Spanish patient in Spanish rather than handing them the English page", async () => {
    const { orchestrator } = harness({ locale: "ES", knowledgePassages: [focusedPassage] });
    const answer = await orchestrator.answer("¿Qué significa eCKM?");
    expect(answer.text).not.toMatch(/Early Cardio-Kidney-Metabolic/);
  });

  it("still gives the canned programme answer when the general programme page is what matched", async () => {
    const { orchestrator } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("What is ACCESS?");
    expect(answer.text).toMatch(/extra support between doctor visits/i);
  });
});

// The answer a patient reads when the model is unreachable, in their own language.
describe("the fallback answers in the patient's language", () => {
  const withLocalized = {
    sourceId: "leaving-access",
    sourcePath: "enrollment/leaving-access.md",
    heading: "Leaving ACCESS: the 90 day term",
    text: "Beginning 90 days after enrollment, the patient may end their ACCESS participation.",
    localizedAnswers: {
      ES: "A partir de 90 días después de la inscripción, puede terminar su participación en ACCESS.",
      KR: "Apati 90 jou apre enskripsyon an, ou ka mete fen nan patisipasyon ACCESS ou."
    }
  };

  it("reads the Spanish answer the page carries rather than a general paragraph", async () => {
    const { orchestrator } = harness({ locale: "ES", knowledgePassages: [withLocalized] });
    const answer = await orchestrator.answer("¿Desde cuándo puedo dejar ACCESS?");
    expect(answer.text).toMatch(/90 días después de la inscripción/);
  });

  it("reads the Creole one for a Creole patient", async () => {
    const { orchestrator } = harness({ locale: "KR", knowledgePassages: [withLocalized] });
    const answer = await orchestrator.answer("Kilè mwen ka kite ACCESS?");
    expect(answer.text).toMatch(/90 jou apre enskripsyon/);
  });

  it("still reads the page itself for an English patient", async () => {
    const { orchestrator } = harness({ locale: "EN", knowledgePassages: [withLocalized] });
    const answer = await orchestrator.answer("When can I leave ACCESS?");
    expect(answer.text).toMatch(/Beginning 90 days after enrollment/);
  });

  // A page written for the question outranks the canned answers that exist for questions no page
  // covers. Left behind them, this never ran for "when can I leave?" — the one question a page had
  // just been written to answer with the ninety days in it.
  it("prefers the page over the canned leave-the-programme answer", async () => {
    const { orchestrator } = harness({ locale: "ES", knowledgePassages: [withLocalized] });
    const answer = await orchestrator.answer("¿Cómo dejo el programa?");
    expect(answer.text).toMatch(/90 días/);
  });

  it("falls back to the trilingual canned answer when a page carries no translation", async () => {
    const untranslated = { ...withLocalized, localizedAnswers: {} };
    const { orchestrator } = harness({ locale: "ES", knowledgePassages: [untranslated] });
    const answer = await orchestrator.answer("¿Desde cuándo puedo dejar ACCESS?");
    expect(answer.text).not.toMatch(/Beginning 90 days/);
    expect(answer.text).toMatch(/[áéíóúñ¿]/);
  });
});

// Where this patient started, and what ACCESS will recognise as improvement for them. Every number
// in these answers is a fact about one person, so the knowledge base is the wrong place for all of
// them: it can say what a baseline is and never that this patient's is 152 over 88.
describe("ACCESS starting points and improvement milestones", () => {
  const answerIn = async (question, options = {}) => {
    const { orchestrator, calls } = harness({ locale: "EN", ...options });
    const response = await orchestrator.answer(question);
    return { text: response.text, intent: response.trace.intent, mode: response.trace.responseMode, tools: calls.map(call => call.name) };
  };

  it("says the starting blood pressure the record holds, and does not go to the knowledge base for it", async () => {
    const asked = await answerIn("What was my starting blood pressure?");
    expect(asked.text).toContain("Your starting blood pressure is 152 over 88.");
    expect(asked.tools).toContain("getAccessBaseline");
    expect(asked.tools).not.toContain("searchKnowledge");
    expect(asked.mode).toBe("RUNTIME_GROUNDED");
  });

  it("says the starting weight and the BMI recorded with it", async () => {
    const asked = await answerIn("What was my starting weight?");
    expect(asked.text).toContain("Your starting weight is 204 pounds.");
    expect(asked.text).toContain("31.0");
    expect(asked.tools).not.toContain("searchKnowledge");
  });

  // "137" on its own tells a patient who started at 152 that 137 is where they are trying to land.
  // The baseline it came from and the separate control target both have to be in the sentence.
  it("derives the blood pressure milestone from this patient's baseline and keeps the control target distinct", async () => {
    const asked = await answerIn("What does 15 points lower mean for me?");
    expect(asked.text).toContain("Based on your starting systolic blood pressure of 152");
    expect(asked.text).toContain("137 mmHg or lower");
    expect(asked.text).toMatch(/below 130 mmHg systolic/i);
    expect(asked.intent).toBe("ACCESS_IMPROVEMENT_MILESTONE");
  });

  // "How much" is the cost engine's word. A percentage asked about a weight goal is not a question
  // about what the patient pays, and answering it with an amount of money would be absurd.
  it("answers what five percent is in pounds instead of routing the word 'how much' to cost", async () => {
    const asked = await answerIn("How much is 5% for me?");
    expect(asked.text).toContain("Based on your starting weight of 204 pounds");
    expect(asked.text).toContain("10.2 pounds");
    expect(asked.text).toContain("193.8 pounds or lower");
    expect(asked.tools).not.toContain("getExpectedAccessCost");
  });

  it("answers in the patient's own language from the same runtime numbers", async () => {
    const spanish = harness({ locale: "ES" });
    const asked = await spanish.orchestrator.answer("¿Cuál fue mi presión arterial inicial?");
    expect(asked.text).toContain("152 sobre 88");

    const creole = harness({ locale: "KR" });
    const weight = await creole.orchestrator.answer("Ki pwa mwen te genyen nan konmansman?");
    expect(weight.text).toContain("204 liv");
  });

  // A pending baseline is a real state. Inventing one would silently become the number every
  // milestone below it is derived from.
  it("refuses to state a milestone when no baseline is confirmed", async () => {
    const pending = [{ goalType: "BLOOD_PRESSURE_CONTROL", startingPoint: { goalType: "BLOOD_PRESSURE_CONTROL", status: "PENDING" }, measure: { goalType: "BLOOD_PRESSURE_CONTROL", status: "PENDING_BASELINE", control: { value: 130 }, improvementMilestone: null } }];
    const asked = await answerIn("What does 15 points lower mean for me?", { accessBaselines: pending });
    expect(asked.text).toMatch(/don’t have a confirmed starting blood pressure/i);
    expect(asked.text).not.toMatch(/\b137\b/);
  });

  // A patient with no ACCESS baselines at all is not answered about somebody else's: the block
  // claims nothing and lets the normal routing take the turn.
  it("falls through to normal routing when this patient has no ACCESS baselines", async () => {
    const asked = await answerIn("What was my starting blood pressure?", { accessBaselines: null, program: "CCM" });
    expect(asked.tools).toContain("getAccessBaseline");
    expect(asked.tools).toContain("searchKnowledge");
  });
});
