import { describe, expect, it, vi } from "vitest";
import { EmmiTextOrchestrator, expandEmmiQuery } from "../src/emmi/textOrchestrator.js";
import { EMMI_TOOL_DECLARATIONS, EmmiToolOrchestrator } from "../src/emmi/tools.js";

const passage = (program, text = "Approved patient-facing concepts") => ({ sourceId: `program-${program.toLowerCase()}`, sourcePath: `programs/${program.toLowerCase()}.md`, heading: program, text });

// One confirmed-looking appointment the way the runtime hands it to EMMI: a patient-facing status
// string, never an internal one, and only the fields the tool contract promises.
const upcoming = (overrides = {}) => ({ id: "APPT-1", patientStatus: "Cita confirmada", providerDisplayName: "Dr. Martinez", specialty: "Cardiology", scheduledAt: "2026-09-08T14:00:00.000Z", modality: "IN_PERSON", ...overrides });

function harness({ locale = "ES", program = "ACCESS", conversation = {}, retrievalFailure = false, knowledgePassages = null, appointments = [], appointmentLookupFails = false, appointmentRequestFails = false } = {}) {
  const calls = [];
  const events = [];
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
    if (name === "getCareTeam") return { physicianDisplayName: "Dr. Fresner" };
    if (name === "getNextBestAction") return { label: "Continuar" };
    if (name === "evaluateClinicalEscalation") return { instruction: "CALL_911" };
    throw new Error(`unexpected ${name}`);
  });
  const orchestrator = new EmmiTextOrchestrator({
    getContext: () => ({ locale, program, currentScreen: "CARE_RECOMMENDATION", patientId: "DEMO-P001", accessTrack: "eCKM", activeGoal: { id: "goal-bp" } }),
    getConversation: () => ({ conversationSessionId: "conv-1", conversationSummary: conversation.summary || "", recentTurns: conversation.turns || [] }),
    executeTool,
    screenExplanation: () => locale === "ES" ? "Esta pantalla explica el cuidado disponible." : "This screen explains the available care.",
    fetchImpl: vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ error: "gemini_not_configured" }) })),
    onEvent: (type, detail) => events.push({ type, detail })
  });
  return { orchestrator, calls, events, executeTool };
}

describe("Ask EMMI answer-first orchestration", () => {
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

  it("uses screen context only for an actual screen-help question", async () => {
    const { orchestrator, executeTool } = harness();
    const answer = await orchestrator.answer("¿Qué tengo que hacer en esta pantalla?");
    expect(answer.text).toBe("Esta pantalla explica el cuidado disponible.");
    expect(answer.trace.intent).toBe("CURRENT_SCREEN_HELP");
    expect(executeTool).not.toHaveBeenCalledWith("searchKnowledge", expect.anything());
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

  it("carries the part of the day the patient asked for into the opener", async () => {
    const { orchestrator } = harness({ locale: "EN" });
    const answer = await orchestrator.answer("I need an appointment in the morning");
    expect(answer.text).toMatch(/mornings/i);
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
});

// The runtime tool layer that the appointment intents above call into. Its whole job is to refuse
// to do anything destructive or irreversible without the patient's confirmation, and to never
// describe a failure as a success.
const appointmentTools = (hooks = {}) => new EmmiToolOrchestrator({
  getContext: () => ({ patientId: "DEMO-P001", currentScreen: "MY_APPOINTMENTS", locale: "EN" }),
  onUpcomingAppointments: () => ({ appointments: [upcoming()], requests: [] }),
  onAppointment: ({ appointmentId }) => (appointmentId === "APPT-1" ? { appointment: upcoming() } : { success: false, status: "NOT_FOUND" }),
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
  it("declares the twelve appointment tools the runtime contract names", () => {
    const names = EMMI_TOOL_DECLARATIONS[0].functionDeclarations.map(item => item.name);
    expect(names).toEqual(expect.arrayContaining([
      "getUpcomingAppointments", "getAppointment", "getSchedulingCapability", "getProviderAvailability",
      "startAppointmentRequest", "createAppointmentRequest", "bookAppointment", "rescheduleAppointment",
      "cancelAppointment", "createAppointmentReminder", "getCareCircle", "shareAppointment"
    ]));
    expect(new Set(names).size).toBe(names.length);
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
    expect(await appointmentTools({ onProviderAvailability: () => null }).execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: false, error: "AVAILABILITY_UNAVAILABLE" });
    expect(await appointmentTools({ onProviderAvailability: () => ({ ok: false, error: "NO_AVAILABILITY_SOURCE" }) }).execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: false, error: "NO_AVAILABILITY_SOURCE" });
    expect(await appointmentTools().execute("getProviderAvailability", { providerId: "prov-1" })).toMatchObject({ ok: true, slots: [{ slotId: "SLOT-1" }] });
  });

  it("reports an unknown scheduling capability rather than assuming a channel", async () => {
    expect(await appointmentTools({ onSchedulingCapability: () => null }).execute("getSchedulingCapability", { providerId: "prov-1" })).toMatchObject({ success: false, status: "CAPABILITY_UNKNOWN" });
    expect(await appointmentTools().execute("getSchedulingCapability", { providerId: "prov-1" })).toMatchObject({ capability: "DIRECT_BOOKING", supportedModalities: ["IN_PERSON"] });
  });

  it("reports an appointment it cannot find rather than describing one", async () => {
    expect(await appointmentTools().execute("getAppointment", { appointmentId: "APPT-9" })).toMatchObject({ success: false, status: "NOT_FOUND" });
    expect(await appointmentTools().execute("getAppointment", { appointmentId: "APPT-1" })).toMatchObject({ appointment: { id: "APPT-1" } });
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
