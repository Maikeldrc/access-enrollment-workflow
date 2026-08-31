import { describe, expect, it } from "vitest";
import { APPOINTMENT_INTENTS, APPOINTMENT_INTENT_ACTIONS, classifyAppointmentIntent, normalizeIntentLocale } from "../src/emmi/appointmentIntents.js";

const intentOf = (text, locale = "en") => classifyAppointmentIntent(text, locale)?.intent || null;
const actionOf = (text, locale = "en") => classifyAppointmentIntent(text, locale)?.action || null;

describe("appointment intent classification", () => {
  it("returns null for text with nothing to classify", () => {
    expect(classifyAppointmentIntent("")).toBe(null);
    expect(classifyAppointmentIntent("   ")).toBe(null);
    expect(classifyAppointmentIntent("What is CCM?")).toBe(null);
  });

  it("returns exactly the four contract fields", () => {
    const classified = classifyAppointmentIntent("I need an appointment", "en");
    expect(Object.keys(classified).sort()).toEqual(["action", "intent", "providerHint", "timeHint"]);
  });

  it.each([
    ["When is my appointment?", "en"],
    ["What time is my next visit?", "en"],
    ["Do I have an appointment?", "en"],
    ["Where is my appointment?", "en"],
    ["Is my appointment confirmed?", "en"],
    ["¿Cuándo es mi cita?", "es"],
    ["¿A qué hora es mi cita?", "es"],
    ["¿Tengo alguna cita?", "es"],
    ["Mi próxima cita", "es"],
    ["Kilè randevou mwen an?", "ht"],
    ["Èske mwen gen yon randevou?", "ht"],
    ["Pwochen randevou mwen", "ht"]
  ])("reads %s as a question about an appointment already on file", (text, locale) => {
    expect(intentOf(text, locale)).toBe(APPOINTMENT_INTENTS.APPOINTMENT_STATUS);
    expect(actionOf(text, locale)).toBe(APPOINTMENT_INTENT_ACTIONS.VIEW);
  });

  it.each([
    ["I need an appointment", "en"],
    ["Can I make an appointment?", "en"],
    ["I want to schedule an appointment", "en"],
    ["I'd like to book a visit", "en"],
    ["I need a doctor's appointment", "en"],
    ["I need to see my cardiologist", "en"],
    ["I have to see my doctor", "en"],
    ["Can I see my cardiologist?", "en"],
    ["When can I get an appointment?", "en"],
    ["Necesito una cita", "es"],
    ["necesito un appointment", "es"],
    ["Quiero hacer una cita", "es"],
    ["¿Puedo agendar una cita?", "es"],
    ["Necesito ver a mi cardiólogo", "es"],
    ["Mwen bezwen yon randevou", "ht"],
    ["Mwen vle pran yon randevou", "ht"],
    ["Mwen bezwen wè doktè mwen", "ht"]
  ])("reads %s as a request for a visit", (text, locale) => {
    expect(intentOf(text, locale)).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
    expect(actionOf(text, locale)).toBe(APPOINTMENT_INTENT_ACTIONS.REQUEST);
  });

  it.each([
    ["Can I reschedule my appointment?", "en"],
    ["I need to move my appointment to another day", "en"],
    ["Can I change my visit?", "en"],
    ["Quiero cambiar mi cita", "es"],
    ["Necesito reprogramar", "es"],
    ["Mwen vle chanje randevou mwen", "ht"]
  ])("reads %s as a reschedule", (text, locale) => {
    expect(intentOf(text, locale)).toBe(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE);
    expect(actionOf(text, locale)).toBe(APPOINTMENT_INTENT_ACTIONS.RESCHEDULE);
  });

  it.each([
    ["I want to cancel my appointment", "en"],
    ["Please cancel the visit", "en"],
    ["Quiero cancelar mi cita", "es"],
    ["Necesito anular la consulta", "es"],
    ["Mwen vle anile randevou a", "ht"]
  ])("reads %s as a cancellation", (text, locale) => {
    expect(intentOf(text, locale)).toBe(APPOINTMENT_INTENTS.APPOINTMENT_CHANGE);
    expect(actionOf(text, locale)).toBe(APPOINTMENT_INTENT_ACTIONS.CANCEL);
  });

  it("prefers the reschedule when the patient asks for both, because it keeps the appointment", () => {
    expect(actionOf("I need to cancel Tuesday and reschedule my appointment", "en")).toBe(APPOINTMENT_INTENT_ACTIONS.RESCHEDULE);
  });

  it("folds curly apostrophes the way the barrier classifier does", () => {
    expect(actionOf("I can’t make it, I want to cancel my appointment", "en")).toBe(APPOINTMENT_INTENT_ACTIONS.CANCEL);
  });
});

describe("appointment intent hazards", () => {
  // A symptom outranks scheduling everywhere, including inside the classifier itself, so no caller
  // can reach a scheduling flow through a sentence that is really about how the patient feels.
  it.each([
    ["I need a cardiology appointment because I have severe chest pain", "en"],
    ["Necesito una cita porque tengo un dolor fuerte en el pecho", "es"],
    ["Mwen bezwen yon randevou paske mwen gen doulè nan pwatrin", "ht"],
    ["I want to cancel my appointment, I can't breathe", "en"],
    ["I need an appointment, I have been dizzy all week", "en"]
  ])("refuses to classify %s as an appointment intent", (text, locale) => {
    expect(classifyAppointmentIntent(text, locale)).toBe(null);
  });

  // "10/30" is 10 over 30, not the thirtieth of October. There is no numeric date parsing in the
  // module at all, so a reading can never become a preferred time.
  it.each([
    "My reading was 10/30 today, do I need an appointment?",
    "I got 120/80 this morning, should I make an appointment?",
    "Mi presión fue 150 sobre 95, ¿necesito una cita?"
  ])("never reads a blood-pressure reading as a date in %s", text => {
    expect(classifyAppointmentIntent(text, "en")).toBe(null);
  });

  it("never returns a time hint from a slashed number", () => {
    expect(classifyAppointmentIntent("I need an appointment on 10/30", "en")).toBe(null);
    expect(classifyAppointmentIntent("I need an appointment", "en").timeHint).toBe("");
  });

  // "need to see" is an appointment request. The difficulty classifier must never be the first
  // thing that gets to interpret it.
  it("keeps need to see as a request rather than a difficulty", () => {
    expect(intentOf("I need to see my doctor", "en")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
    expect(intentOf("I need to see my cardiologist about my blood pressure", "en")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
  });

  // "schedule" belongs to the reminder vocabulary too. It only counts here with an appointment noun.
  it.each([
    "My schedule is too busy for all of this",
    "Can you set a reminder for my medication schedule?",
    "Remind me to take my pill in the morning"
  ])("does not treat %s as scheduling a visit", text => {
    expect(classifyAppointmentIntent(text, "en")).toBe(null);
  });

  it("still schedules a visit when schedule is followed by an appointment", () => {
    expect(intentOf("I want to schedule an appointment with my doctor", "en")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
  });

  // Cancelling the program is not cancelling a visit.
  it.each([
    ["Can I cancel my enrollment?", "en"],
    ["I want to cancel the program", "en"],
    ["¿Puedo cancelar mi inscripción?", "es"],
    ["Quiero cancelar el programa", "es"]
  ])("does not read %s as an appointment cancellation", (text, locale) => {
    expect(classifyAppointmentIntent(text, locale)).toBe(null);
  });

  // Kreyòl "machin" is a car. It is word-boundaried so it can never collide with "machine", and a
  // sentence about getting there is a transportation barrier, not a request for a visit (§8, §135).
  it("keeps Kreyòl machin away from the English machine", () => {
    expect(classifyAppointmentIntent("Mwen pa gen machin pou m ale nan randevou a", "ht")).toBe(null);
    expect(intentOf("I need an appointment because my machine is broken", "en")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
  });

  it.each([
    ["I need a ride to my appointment", "en"],
    ["Necesito transporte para mi cita", "es"],
    ["I need someone to help me get to my visit", "en"]
  ])("treats %s as a barrier rather than a request for a visit", (text, locale) => {
    expect(classifyAppointmentIntent(text, locale)).toBe(null);
  });
});

describe("appointment intent hints", () => {
  it("reads a named professional as a hint the directory can resolve", () => {
    expect(classifyAppointmentIntent("I need an appointment with Dr. Martinez", "en").providerHint).toBe("Martinez");
    expect(classifyAppointmentIntent("Necesito una cita con la Dra. Gomez", "es").providerHint).toBe("Gomez");
  });

  it("falls back to a role when no name was given, and never to a filler word", () => {
    expect(classifyAppointmentIntent("I need to see my cardiologist", "en").providerHint).toBe("cardiologist");
    expect(classifyAppointmentIntent("Necesito ver a mi cardiólogo", "es").providerHint).toBe("cardiólogo");
    expect(classifyAppointmentIntent("Mwen bezwen wè doktè mwen", "ht").providerHint).toBe("doktè");
  });

  it("leaves the provider hint empty when the patient named nobody", () => {
    expect(classifyAppointmentIntent("I need an appointment", "en").providerHint).toBe("");
  });

  it.each([
    ["I need an appointment in the morning", "en", "MORNING"],
    ["Can I get an appointment in the afternoon?", "en", "AFTERNOON"],
    ["I need an appointment in the evening", "en", "EVENING"],
    ["Necesito una cita por la mañana", "es", "MORNING"],
    ["Necesito una cita por la tarde", "es", "AFTERNOON"],
    ["Mwen bezwen yon randevou nan maten", "ht", "MORNING"],
    ["Mwen bezwen yon randevou nan aswè", "ht", "EVENING"]
  ])("reads the part of the day in %s as %s", (text, locale, expected) => {
    expect(classifyAppointmentIntent(text, locale).timeHint).toBe(expected);
  });

  it("does not read Spanish mañana as a morning preference when it means tomorrow", () => {
    expect(classifyAppointmentIntent("Necesito una cita mañana", "es").timeHint).toBe("");
  });
});

describe("appointment intent locale handling", () => {
  it("maps the EMMI runtime KR locale onto Kreyòl rather than English", () => {
    expect(normalizeIntentLocale("KR")).toBe("ht");
    expect(normalizeIntentLocale("ht")).toBe("ht");
    expect(normalizeIntentLocale("ES")).toBe("es");
    expect(normalizeIntentLocale("")).toBe("en");
  });

  it("classifies a patient's words whatever locale the runtime reports", () => {
    expect(intentOf("Mwen bezwen yon randevou", "KR")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
    expect(intentOf("Necesito una cita", "EN")).toBe(APPOINTMENT_INTENTS.APPOINTMENT_NEED);
  });
});
