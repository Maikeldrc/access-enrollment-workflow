// Everything that happens around an appointment rather than to it: the reminder a patient asked
// for, the difficulty that could stop them getting there, the person they chose to tell, and the
// question afterwards. Nothing in this file books, moves or cancels anything.
//
// Three honesty rules run through all of it:
//   - a reminder is a note inside ITERA, because this product has no way to reach a device;
//   - a difficulty maps onto a barrier category that already exists, never onto a new one;
//   - sharing an appointment is a scoped disclosure, not access to the patient's care.
//
// Pure module: no DOM, no storage, no app state. The only import is the frozen barrier taxonomy,
// which this file reads and never extends.

import { BARRIER_CATEGORIES } from "./goalBarriers.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });

export const localAppointmentSupportText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

const L = localAppointmentSupportText;

// The status literal the appointment record uses for a real, confirmed visit (APPOINTMENT_STATUS
// key === value). It is written out rather than imported so this module stays independent of the
// entity module's load order.
const CONFIRMED = "CONFIRMED";

// ---------------------------------------------------------------------------
// §48-50 — Reminders
// ---------------------------------------------------------------------------

// Appointment reminders are relative to the visit, not to a fixed clock slot. "The day before"
// is something the goal module's Morning/Afternoon/Evening cannot say.
export const APPOINTMENT_REMINDER_SLOTS = Object.freeze([
  Object.freeze({ id: "DAY_BEFORE", offsetMinutes: 24 * 60, dayOfHour: null, label: T("The day before", "El día anterior", "Jou anvan an") }),
  Object.freeze({ id: "MORNING_OF", offsetMinutes: null, dayOfHour: 8, label: T("The morning of the visit", "La mañana de la cita", "Maten vizit la") }),
  Object.freeze({ id: "TWO_HOURS_BEFORE", offsetMinutes: 120, dayOfHour: null, label: T("Two hours before", "Dos horas antes", "De èdtan anvan") })
]);

export const appointmentReminderSlot = slotId => APPOINTMENT_REMINDER_SLOTS.find(slot => slot.id === slotId) || null;

export const appointmentReminderSlotOptions = (locale = "en") =>
  APPOINTMENT_REMINDER_SLOTS.map(slot => ({ id: slot.id, label: L(slot.label, locale) }));

// The one sentence this product is allowed to say about reminders. There is no scheduler and no
// channel to a device anywhere in it, so the patient is told exactly what a reminder is: something
// that appears here, when they open the app.
const REMINDER_NOTE = T(
  "Reminders appear in ITERA when you open it. We will not send anything to your phone.",
  "Los recordatorios aparecen en ITERA cuando la abre. No enviaremos nada a su teléfono.",
  "Rapèl yo parèt nan ITERA lè ou louvri l. Nou p ap voye anyen sou telefòn ou."
);

// §50. The capability is resolved before anything is promised, and the answer never varies: one
// channel, and it is this screen.
export function appointmentReminderCapability(locale = "en") {
  return Object.freeze({
    channels: Object.freeze(["IN_APP"]),
    canNotifyDevice: false,
    reason: "NO_DEVICE_CHANNEL",
    note: L(REMINDER_NOTE, locale)
  });
}

export const REMINDER_STATUS = Object.freeze({
  CREATED: "CREATED",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  UNKNOWN_SLOT: "UNKNOWN_SLOT",
  APPOINTMENT_NOT_CONFIRMED: "APPOINTMENT_NOT_CONFIRMED",
  NO_SCHEDULED_TIME: "NO_SCHEDULED_TIME",
  SLOT_AFTER_APPOINTMENT: "SLOT_AFTER_APPOINTMENT",
  REMINDER_TIME_PASSED: "REMINDER_TIME_PASSED"
});

// The visit's own timezone decides what "the morning of" means. setHours() uses the device clock,
// so a patient travelling west of their clinic got a reminder computed for the wrong day — often
// landing after the appointment, which the engine then correctly refused to save.
const wallClockOffsetMs = (instant, timeZone) => {
  if (!timeZone) return 0;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(instant).reduce((all, part) => (part.type === "literal" ? all : { ...all, [part.type]: Number(part.value) }), {});
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour % 24, parts.minute, parts.second);
    return asUtc - instant.getTime();
  } catch { return 0; }
};

const reminderTimeFor = (slot, scheduledAt, timeZone = "") => {
  const start = new Date(scheduledAt || "");
  if (Number.isNaN(start.getTime())) return null;
  if (slot.offsetMinutes != null) return new Date(start.getTime() - slot.offsetMinutes * 60000);
  const offset = wallClockOffsetMs(start, timeZone);
  const local = new Date(start.getTime() + offset);
  local.setUTCHours(slot.dayOfHour, 0, 0, 0);
  return new Date(local.getTime() - offset);
};

// §49. A reminder is never a side effect of talking about one. It exists because the patient said
// yes to this slot, for an appointment that is actually confirmed, at a moment that has not already
// gone by — otherwise the product would be describing a reminder that can never appear.
export function createAppointmentReminder(appointment, slotId, { now = new Date(), confirmed = false, locale = "en" } = {}) {
  const note = L(REMINDER_NOTE, locale);
  if (confirmed !== true) return { ok: false, status: REMINDER_STATUS.CONFIRMATION_REQUIRED, note };
  const slot = appointmentReminderSlot(slotId);
  if (!slot) return { ok: false, status: REMINDER_STATUS.UNKNOWN_SLOT, note };
  // §48 opens with "once confirmed". A request, a proposed time or a canceled visit has no time to
  // count back from, and saying otherwise would make a request look like an appointment.
  if (appointment?.status !== CONFIRMED) return { ok: false, status: REMINDER_STATUS.APPOINTMENT_NOT_CONFIRMED, note };
  const time = reminderTimeFor(slot, appointment?.scheduledAt, appointment?.timezone || "");
  if (!time) return { ok: false, status: REMINDER_STATUS.NO_SCHEDULED_TIME, note };
  const start = new Date(appointment.scheduledAt);
  const at = new Date(now);
  if (time.getTime() >= start.getTime()) return { ok: false, status: REMINDER_STATUS.SLOT_AFTER_APPOINTMENT, note };
  if (time.getTime() <= at.getTime()) return { ok: false, status: REMINDER_STATUS.REMINDER_TIME_PASSED, note };
  return {
    ok: true,
    status: REMINDER_STATUS.CREATED,
    reminder: Object.freeze({ slot: slot.id, time: time.toISOString(), channel: "IN_APP", createdAt: at.toISOString() }),
    note
  };
}

// ---------------------------------------------------------------------------
// §51-53 — Pre-visit difficulties, routed into the barrier engine
// ---------------------------------------------------------------------------

// §52 names five difficulties the barrier taxonomy does not have, and src/goalBarriers.js:5-7
// forbids growing it: "Categories exist to decide who can help and what may safely be offered —
// never to become a second clinical vocabulary." So each name maps onto the existing category whose
// owner and interventions already fit it, and this module adds nothing to the taxonomy.
//
//   spec §52 name          → BARRIER_CATEGORIES key   why this one
//   TRANSPORTATION         → TRANSPORTATION           the same difficulty, already owned by CARE_COORDINATION
//   CAREGIVER_AVAILABILITY → SOCIAL_SUPPORT           "I need someone to help me"; CARE_CIRCLE is its first intervention
//   LOCATION_UNCLEAR       → OTHER                    not knowing where to go is not a care concept; it is a question for the office
//   TECHNOLOGY_TELEHEALTH  → DEVICE_TECHNOLOGY        guidance first, then a person who can fix it — exactly this difficulty
//   MOBILITY               → PHYSICAL_LIMITATION      care-team owned and safety-evaluated, which getting there on foot needs to be
//   TIME_CONFLICT          → TIME_ROUTINE             "some steps don't fit my day"
//   LANGUAGE               → LANGUAGE_COMMUNICATION   §52 also names LANGUAGE; the taxonomy already carries it
//   FINANCIAL              → FINANCIAL                the same difficulty
//   CANNOT_REACH_OFFICE    → ACCESS_TO_CARE           §53's fallback when the office cannot be reached at all
//   MISSED_VISIT           → APPOINTMENT_NEED         §67: a visit that did not happen is still a needed visit
//   OTHER                  → OTHER                    §113's "Something else"
export const APPOINTMENT_BARRIER_REASONS = Object.freeze({
  ALL_SET: "ALL_SET",
  TRANSPORTATION: "TRANSPORTATION",
  CAREGIVER_AVAILABILITY: "CAREGIVER_AVAILABILITY",
  LOCATION_UNCLEAR: "LOCATION_UNCLEAR",
  TECHNOLOGY_TELEHEALTH: "TECHNOLOGY_TELEHEALTH",
  MOBILITY: "MOBILITY",
  TIME_CONFLICT: "TIME_CONFLICT",
  LANGUAGE: "LANGUAGE",
  FINANCIAL: "FINANCIAL",
  CANNOT_REACH_OFFICE: "CANNOT_REACH_OFFICE",
  MISSED_VISIT: "MISSED_VISIT",
  OTHER: "OTHER"
});

const BARRIER_CATEGORY_BY_REASON = Object.freeze({
  TRANSPORTATION: "TRANSPORTATION",
  CAREGIVER_AVAILABILITY: "SOCIAL_SUPPORT",
  LOCATION_UNCLEAR: "OTHER",
  TECHNOLOGY_TELEHEALTH: "DEVICE_TECHNOLOGY",
  MOBILITY: "PHYSICAL_LIMITATION",
  TIME_CONFLICT: "TIME_ROUTINE",
  LANGUAGE: "LANGUAGE_COMMUNICATION",
  FINANCIAL: "FINANCIAL",
  CANNOT_REACH_OFFICE: "ACCESS_TO_CARE",
  MISSED_VISIT: "APPOINTMENT_NEED",
  OTHER: "OTHER"
});

// The patient tapped a button, so there are no patient words to record. The key names what they
// chose and the text below says it back in their own voice — never as a category name.
const APPOINTMENT_BARRIER_DESCRIPTIONS = Object.freeze({
  APPOINTMENT_BARRIER_TRANSPORTATION: T("Getting to this appointment is hard.", "Me cuesta llegar a esta cita.", "Li difisil pou m rive nan randevou sa a."),
  APPOINTMENT_BARRIER_CAREGIVER_AVAILABILITY: T("I need someone to come with me.", "Necesito que alguien me acompañe.", "Mwen bezwen yon moun vin avè m."),
  APPOINTMENT_BARRIER_LOCATION_UNCLEAR: T("I’m not sure where to go.", "No sé bien a dónde ir.", "Mwen pa fin konnen ki kote pou m ale."),
  APPOINTMENT_BARRIER_TECHNOLOGY_TELEHEALTH: T("I need help with the video visit.", "Necesito ayuda con la visita por video.", "Mwen bezwen èd ak vizit videyo a."),
  APPOINTMENT_BARRIER_MOBILITY: T("Getting there is physically hard for me.", "Llegar me resulta difícil físicamente.", "Rive la difisil fizikman pou mwen."),
  APPOINTMENT_BARRIER_TIME_CONFLICT: T("This time does not work for me.", "Esta hora no me funciona.", "Lè sa a pa bon pou mwen."),
  APPOINTMENT_BARRIER_LANGUAGE: T("I’d like this visit in my language.", "Quisiera esta visita en mi idioma.", "Mwen ta renmen vizit sa a nan lang mwen."),
  APPOINTMENT_BARRIER_FINANCIAL: T("I’m worried about what this visit will cost.", "Me preocupa cuánto costará esta visita.", "Mwen enkyete sou konbyen vizit sa a ap koute."),
  APPOINTMENT_BARRIER_CANNOT_REACH_OFFICE: T("I can’t reach the office about this appointment.", "No consigo comunicarme con el consultorio sobre esta cita.", "Mwen pa ka jwenn biwo a sou randevou sa a."),
  APPOINTMENT_BARRIER_MISSED_VISIT: T("I wasn’t able to get to this appointment.", "No pude llegar a esta cita.", "Mwen pa t ka rive nan randevou sa a."),
  APPOINTMENT_BARRIER_OTHER: T("Something else is making this hard.", "Hay otra cosa que lo dificulta.", "Gen yon lòt bagay ki fè sa difisil.")
});

export const appointmentBarrierDescription = (patientDescriptionKey, locale = "en") =>
  L(APPOINTMENT_BARRIER_DESCRIPTIONS[patientDescriptionKey] || "", locale);

// §52. Given what the patient said made the visit hard, which existing barrier this is. The
// category is checked against the live taxonomy on the way out: if a mapping ever pointed at a
// category that does not exist, it lands on OTHER rather than creating one.
export function appointmentBarrierPlan(reasonKey) {
  const key = String(reasonKey || "").trim().toUpperCase();
  // "I'm all set" is an answer, not a difficulty. Recording a barrier for it would invent a problem
  // the patient just said they do not have.
  if (!key || key === APPOINTMENT_BARRIER_REASONS.ALL_SET) return null;
  const mapped = BARRIER_CATEGORY_BY_REASON[key] || "OTHER";
  const category = BARRIER_CATEGORIES[mapped] ? mapped : "OTHER";
  const known = Boolean(BARRIER_CATEGORY_BY_REASON[key]);
  return Object.freeze({
    reasonKey: key,
    category,
    patientDescriptionKey: known ? `APPOINTMENT_BARRIER_${key}` : "APPOINTMENT_BARRIER_OTHER",
    owner: BARRIER_CATEGORIES[category].owner,
    scope: BARRIER_CATEGORIES[category].scope
  });
}

const PRE_VISIT_LABELS = Object.freeze({
  ALL_SET: T("I’m all set", "Todo listo", "Mwen pare"),
  TRANSPORTATION: T("Transportation", "Transporte", "Transpò"),
  TECHNOLOGY_TELEHEALTH: T("Help with the video visit", "Ayuda con la visita por video", "Èd ak vizit videyo a"),
  CAREGIVER_AVAILABILITY: T("I need someone to come with me", "Necesito que alguien me acompañe", "Mwen bezwen yon moun vin avè m"),
  TIME_CONFLICT: T("I need to change the time", "Necesito cambiar la hora", "Mwen bezwen chanje lè a"),
  OTHER: T("Something else", "Otra cosa", "Yon lòt bagay")
});

const PRE_VISIT_QUESTION = T(
  "Is there anything that could make it hard to get to this visit?",
  "¿Hay algo que pueda dificultar llegar a esta visita?",
  "Èske gen yon bagay ki ka fè li difisil pou w rive nan vizit sa a?"
);

// §51/§113. The pre-visit check, as five choices rather than a questionnaire. A video visit has no
// journey to make and an in-person visit has no video to set up, so the second option follows the
// modality instead of asking both.
export function preVisitCheckOptions({ appointment = null, locale = "en" } = {}) {
  const travelReason = appointment?.modality === "TELEHEALTH"
    ? APPOINTMENT_BARRIER_REASONS.TECHNOLOGY_TELEHEALTH
    : APPOINTMENT_BARRIER_REASONS.TRANSPORTATION;
  return {
    question: L(PRE_VISIT_QUESTION, locale),
    options: [
      APPOINTMENT_BARRIER_REASONS.ALL_SET,
      travelReason,
      APPOINTMENT_BARRIER_REASONS.CAREGIVER_AVAILABILITY,
      APPOINTMENT_BARRIER_REASONS.TIME_CONFLICT,
      APPOINTMENT_BARRIER_REASONS.OTHER
    ].map(reasonKey => ({ reasonKey, label: L(PRE_VISIT_LABELS[reasonKey], locale) }))
  };
}

// ---------------------------------------------------------------------------
// §65-69 — After the visit
// ---------------------------------------------------------------------------

export const ATTENDANCE_OUTCOMES = Object.freeze({
  ATTENDED: "ATTENDED",
  MISSED: "MISSED",
  RESCHEDULED: "RESCHEDULED",
  UNKNOWN: "UNKNOWN"
});

export const FOLLOW_UP_ACTIONS = Object.freeze({
  ASK_ATTENDANCE: "ASK_ATTENDANCE",
  OFFER_VISIT_SUPPORT: "OFFER_VISIT_SUPPORT",
  OFFER_RESCHEDULE: "OFFER_RESCHEDULE",
  CONFIRM_NEW_TIME: "CONFIRM_NEW_TIME"
});

// Whether there is anything to ask about. Every clause is a fact on the record: a confirmed visit,
// a time that has actually gone by, no answer yet, and the question not already asked. Elapsed time
// alone is never enough — a canceled visit and a request that never became an appointment both have
// dates in the past and neither has an attendance to report.
export function appointmentFollowUpDue(appointment, now = new Date()) {
  if (!appointment) return false;
  if (appointment.status !== CONFIRMED) return false;
  if (appointment.attendanceOutcome) return false;
  if (appointment.followUpAskedAt) return false;
  const ended = new Date(appointment.scheduledEndAt || appointment.scheduledAt || "");
  if (Number.isNaN(ended.getTime())) return false;
  const at = new Date(now);
  if (Number.isNaN(at.getTime())) return false;
  return ended.getTime() < at.getTime();
}

// §68. The question is always "were you able to", never "you missed it". Each answer opens at most
// three doors, because a follow-up with a menu is an interrogation.
const FOLLOW_UP_PLANS = Object.freeze({
  UNKNOWN: {
    question: T("Were you able to get to your appointment?", "¿Pudo asistir a su cita?", "Èske ou te ka ale nan randevou ou a?"),
    nextAction: FOLLOW_UP_ACTIONS.ASK_ATTENDANCE,
    options: [
      ["ATTENDED", T("Yes", "Sí", "Wi")],
      ["MISSED", T("No", "No", "Non")],
      ["RESCHEDULED", T("It was rescheduled", "Se cambió de fecha", "Yo te chanje dat la")]
    ]
  },
  // §66 offers five follow-ups; three fit a 384px screen. Next steps and a follow-up visit are the
  // two this product can actually act on, and the third is the patient's way out.
  ATTENDED: {
    question: T("Is there anything from the visit you need help with?", "¿Hay algo de la visita con lo que necesite ayuda?", "Èske gen yon bagay nan vizit la ou bezwen èd avè l?"),
    nextAction: FOLLOW_UP_ACTIONS.OFFER_VISIT_SUPPORT,
    options: [
      ["UNDERSTAND_NEXT_STEPS", T("Understand next steps", "Entender los próximos pasos", "Konprann pwochen etap yo")],
      ["SCHEDULE_FOLLOW_UP", T("Schedule a follow-up", "Programar un seguimiento", "Pwograme yon swivi")],
      ["NOTHING_RIGHT_NOW", T("Nothing right now", "Nada por ahora", "Anyen pou kounye a")]
    ]
  },
  // §67. The offer comes first and the reason is optional: a patient who says "not now" is not
  // asked to explain themselves.
  MISSED: {
    question: T("Would you like help rescheduling it?", "¿Quiere ayuda para reprogramarla?", "Èske ou vle èd pou chanje dat la?"),
    nextAction: FOLLOW_UP_ACTIONS.OFFER_RESCHEDULE,
    options: [
      ["RESCHEDULE", T("Yes, help me reschedule", "Sí, ayúdeme a reprogramar", "Wi, ede m chanje dat la")],
      ["SOMETHING_GOT_IN_THE_WAY", T("Something got in the way", "Algo se interpuso", "Yon bagay te anpeche m")],
      ["NOT_NOW", T("Not now", "Ahora no", "Pa kounye a")]
    ]
  },
  // The office moved it and this product was not told when. It asks rather than inventing a date.
  RESCHEDULED: {
    question: T("Do you have the new date and time?", "¿Tiene la nueva fecha y hora?", "Èske ou gen nouvo dat ak lè a?"),
    nextAction: FOLLOW_UP_ACTIONS.CONFIRM_NEW_TIME,
    options: [
      ["HAVE_NEW_TIME", T("Yes, I have it", "Sí, la tengo", "Wi, mwen genyen l")],
      ["WAITING_FOR_OFFICE", T("The office is still arranging it", "El consultorio aún la está coordinando", "Biwo a ap toujou òganize l")],
      ["NEED_HELP_SCHEDULING", T("I need help scheduling it", "Necesito ayuda para programarla", "Mwen bezwen èd pou pwograme l")]
    ]
  }
});

// §65-68. What EMMI asks after the visit and what the answer opens. A missed visit hands straight
// to the barrier engine — the same move the refill flow makes when a patient could not collect a
// prescription: the difficulty is recorded as a barrier that already has an owner, not as a second
// vocabulary living inside the appointment.
export function attendanceFollowUpPlan(outcome, locale = "en") {
  const key = ATTENDANCE_OUTCOMES[String(outcome || "").toUpperCase()] || ATTENDANCE_OUTCOMES.UNKNOWN;
  const plan = FOLLOW_UP_PLANS[key];
  const barrierPlan = key === ATTENDANCE_OUTCOMES.MISSED
    ? appointmentBarrierPlan(APPOINTMENT_BARRIER_REASONS.MISSED_VISIT)
    : null;
  return {
    outcome: key,
    question: L(plan.question, locale),
    options: plan.options.map(([id, label]) => ({ id, label: L(label, locale) })),
    nextAction: plan.nextAction,
    barrierCategory: barrierPlan?.category || null,
    barrierPlan
  };
}

// ---------------------------------------------------------------------------
// §54-56 — Care Circle
// ---------------------------------------------------------------------------

export const CARE_CIRCLE_SHARING_REASONS = Object.freeze({
  SHARING_AVAILABLE: "SHARING_AVAILABLE",
  NO_CARE_CIRCLE: "NO_CARE_CIRCLE",
  PERMISSION_NOT_GRANTED: "PERMISSION_NOT_GRANTED"
});

// An invite is a member only once someone accepted it and nobody has taken them back out. A pending
// invite is an invitation that went out, not a person in the patient's circle.
const inviteIsActiveMember = invite =>
  invite?.status === "ACCEPTED" && !invite.removedAt && !invite.canceledAt && !invite.revokedAt;

// §115 minimum necessary: a first name and a relationship are enough to ask "share this with Ana?".
// The phone number and the invite token are not part of that question.
const memberOf = invite => ({
  inviteId: invite.inviteId || "",
  firstName: String(invite.supportPerson?.name || "").trim().split(/\s+/)[0] || "",
  relationship: String(invite.supportPerson?.relationshipOther || invite.supportPerson?.relationship || ""),
  status: invite.status
});

const support = (permitted, available) => Object.freeze({ permitted: Boolean(permitted), available });

// §56 asks for granular permissions. These are the four it names, expressed through the permission
// keys the Care Circle screen already writes — no new permission is invented here. `permitted` is
// what the patient authorised; `available` is what the product can actually do, and the reminder
// §56 imagines is permitted and undeliverable, because there is no way to reach a Care Circle
// member from inside ITERA. It says so rather than being quietly listed as a feature.
const careCircleSupports = permissions => {
  const appointments = permissions?.helpWithAppointments === true;
  return Object.freeze({
    viewDateTimeLocation: support(appointments, true),
    receiveAppointmentReminder: support(appointments && permissions?.receiveReminders === true, false),
    helpWithTransportation: support(appointments, true),
    helpWithVideoSetup: support(appointments && permissions?.helpWithDeviceSetup === true, true)
  });
};

// §54/§56. Two independent facts, both required: somebody actually accepted an invite, and the
// patient turned on the appointments permission for their circle. barrierCapabilities() checks
// neither — it offers the Care Circle on completionRole alone, to patients whose circle is empty —
// so this is the first place in the product where the permission decides anything.
//
// completionRole is carried through and grants nothing. Who may act on an appointment is
// canActOnAppointment's single decision (§157-§160), and a role is not a permission.
export function careCircleSharingOptions({ invites = [], careCirclePermissions = null, completionRole = "" } = {}) {
  const members = (Array.isArray(invites) ? invites : []).filter(inviteIsActiveMember);
  const supports = careCircleSupports(careCirclePermissions);
  if (!members.length) {
    return { allowed: false, reason: CARE_CIRCLE_SHARING_REASONS.NO_CARE_CIRCLE, eligibleMembers: [], supports, completionRole };
  }
  // Permission off means the names are not offered either: a list of people the patient never
  // authorised for this is already more sharing than they asked for.
  if (careCirclePermissions?.helpWithAppointments !== true) {
    return { allowed: false, reason: CARE_CIRCLE_SHARING_REASONS.PERMISSION_NOT_GRANTED, eligibleMembers: [], supports, completionRole };
  }
  return {
    allowed: true,
    reason: CARE_CIRCLE_SHARING_REASONS.SHARING_AVAILABLE,
    eligibleMembers: members.map(memberOf),
    supports,
    completionRole
  };
}

// §55/§115. What a shared appointment is: when, with whom, how and where. Enough for a daughter to
// drive her mother there, and nothing more.
export const APPOINTMENT_SHARE_FIELDS = Object.freeze([
  "scheduledAt",
  "scheduledEndAt",
  "timezone",
  "providerDisplayName",
  "modality",
  "locationName",
  "locationAddress"
]);

// Named rather than merely omitted, so that widening the share is a deliberate edit to this list
// and not a field that quietly arrived on the record. joinUrl is here on purpose: helping someone
// set up their video visit does not require the ability to walk into it.
export const APPOINTMENT_NEVER_SHARED_FIELDS = Object.freeze([
  "reasonCategory",
  "reasonSummary",
  "prep",
  "prepNotes",
  "joinUrl",
  "confirmationNumber",
  "relatedGoalId",
  "relatedBarrierId",
  "relatedRefillId",
  "events",
  "otherAppointments",
  "medications",
  "goals",
  "readings",
  "medicalRecord",
  "patientId"
]);

const SHARE_NOTE = T(
  "They will see the date, the time, who you are seeing and where to go.",
  "Verán la fecha, la hora, con quién es la cita y a dónde ir.",
  "Yo ap wè dat la, lè a, ak ki moun ou gen randevou a, ak ki kote pou ale."
);

const SHARE_LIMITS = T(
  "Sharing this appointment does not give access to your health record, and it does not let anyone change or cancel it.",
  "Compartir esta cita no da acceso a su historial de salud, ni permite que nadie la cambie o la cancele.",
  "Pataje randevou sa a pa bay aksè ak dosye sante ou, epi li pa kite pèsonn chanje ni anile l."
);

// §55. Sharing an appointment is a disclosure of four facts, not a role. It grants no record
// access, no consent authority and no clinical decision rights, and a Care Circle member can never
// cancel or reschedule (§158) — enforced at the chokepoint, stated here.
export function appointmentShareScope(locale = "en") {
  return Object.freeze({
    version: "APPOINTMENT_SHARE_V1",
    shares: APPOINTMENT_SHARE_FIELDS,
    neverShares: APPOINTMENT_NEVER_SHARED_FIELDS,
    grants: Object.freeze({
      view: true,
      cancel: false,
      reschedule: false,
      book: false,
      medicalRecordAccess: false,
      consentAuthority: false,
      clinicalDecisionRights: false
    }),
    revocable: true,
    note: L(SHARE_NOTE, locale),
    limits: L(SHARE_LIMITS, locale)
  });
}

// The scope, applied. Built field by field from the allow-list so that a field added to the
// appointment record tomorrow cannot leak into a share today.
export function sharedAppointmentPayload(appointment, { locale = "en" } = {}) {
  if (!appointment) return null;
  const payload = {};
  APPOINTMENT_SHARE_FIELDS.forEach(field => { payload[field] = appointment[field] ?? ""; });
  return Object.freeze({ ...payload, scope: "APPOINTMENT_SHARE_V1", limits: L(SHARE_LIMITS, locale) });
}
