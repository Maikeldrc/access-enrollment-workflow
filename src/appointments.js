// An appointment is not a calendar entry. It is: what does the patient need, who should help, can
// ITERA actually coordinate it, is it really confirmed, and what could stop the patient attending.
// This module owns that record, its status machine and the language the patient reads.
//
// The one rule everything else is built on: the product may only claim what it has been told.
// An illegal transition returns the record it was given, unchanged — a booking that failed goes
// back to the times the patient can still choose from, never forward to "confirmed".

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localAppointmentText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

const DAY_MS = 24 * 60 * 60 * 1000;

// Where the need came from. A need EMMI heard in conversation and a need a care manager typed are
// the same entity with different provenance, and the trail has to say which.
export const APPOINTMENT_SOURCES = Object.freeze({
  PATIENT_DIRECT_REQUEST: "PATIENT_DIRECT_REQUEST",
  EMMI_CONVERSATION: "EMMI_CONVERSATION",
  GOAL_BARRIER: "GOAL_BARRIER",
  CARE_TEAM: "CARE_TEAM",
  FOLLOW_UP: "FOLLOW_UP",
  SYSTEM_WORKFLOW: "SYSTEM_WORKFLOW"
});

// Internal status is never shown to a patient. Requested, waiting, proposed and confirmed are four
// different facts from up to three different systems, and each one is only ever set by whoever is
// actually entitled to know it.
export const APPOINTMENT_STATUS = Object.freeze({
  NEED_IDENTIFIED: "NEED_IDENTIFIED",
  DRAFT: "DRAFT",
  COLLECTING_PREFERENCES: "COLLECTING_PREFERENCES",
  SEARCHING_AVAILABILITY: "SEARCHING_AVAILABILITY",
  SLOTS_AVAILABLE: "SLOTS_AVAILABLE",
  PENDING_PATIENT_SELECTION: "PENDING_PATIENT_SELECTION",
  BOOKING: "BOOKING",
  REQUEST_SENT: "REQUEST_SENT",
  WAITING_FOR_OFFICE: "WAITING_FOR_OFFICE",
  PROPOSED_TIME: "PROPOSED_TIME",
  CONFIRMED: "CONFIRMED",
  RESCHEDULE_REQUESTED: "RESCHEDULE_REQUESTED",
  CANCEL_REQUESTED: "CANCEL_REQUESTED",
  CANCELED: "CANCELED",
  COMPLETED: "COMPLETED",
  NO_SHOW: "NO_SHOW",
  UNABLE_TO_SCHEDULE: "UNABLE_TO_SCHEDULE",
  DECLINED: "DECLINED"
});

export const APPOINTMENT_MODALITY = Object.freeze({
  IN_PERSON: "IN_PERSON",
  TELEHEALTH: "TELEHEALTH",
  PHONE: "PHONE",
  NO_PREFERENCE: "NO_PREFERENCE"
});

// Urgency is classified by the clinical safety engine, never by this module and never by a model.
// It is carried here so a care team sees it on the task, not so scheduling can decide it.
export const APPOINTMENT_URGENCY = Object.freeze({
  EMERGENCY: "EMERGENCY",
  URGENT_CARE_TEAM_REVIEW: "URGENT_CARE_TEAM_REVIEW",
  SOON: "SOON",
  ROUTINE: "ROUTINE"
});

export const TIME_OF_DAY = Object.freeze({
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  EVENING: "EVENING",
  NO_PREFERENCE: "NO_PREFERENCE"
});

// Who acted. Every mutation records one of these, because "the appointment was canceled" is not a
// complete fact until it says who canceled it.
export const APPOINTMENT_ACTORS = Object.freeze({
  PATIENT: "PATIENT",
  PERSONAL_REPRESENTATIVE: "PERSONAL_REPRESENTATIVE",
  CARE_TEAM: "CARE_TEAM",
  EMMI_ASSISTED_PATIENT: "EMMI_ASSISTED_PATIENT",
  SYSTEM: "SYSTEM"
});

// Patient-friendly reasons. Deliberately coarse: the category decides who can help and what may be
// offered. Anything specific about this patient's visit lives in reasonSummary, in their words.
export const APPOINTMENT_REASON_CATEGORIES = Object.freeze({
  MEDICATION_RENEWAL: "MEDICATION_RENEWAL",
  MEDICATION_CONCERN: "MEDICATION_CONCERN",
  BLOOD_PRESSURE_FOLLOW_UP: "BLOOD_PRESSURE_FOLLOW_UP",
  SYMPTOM_REVIEW: "SYMPTOM_REVIEW",
  DEVICE_SUPPORT: "DEVICE_SUPPORT",
  LAB_OR_TEST: "LAB_OR_TEST",
  ROUTINE_FOLLOW_UP: "ROUTINE_FOLLOW_UP",
  NEW_CONCERN: "NEW_CONCERN",
  CARE_PLAN_REVIEW: "CARE_PLAN_REVIEW",
  OTHER: "OTHER"
});

// What a person can try to do to an appointment. The authorization chokepoint below answers for
// each one; the confirmation rules for the destructive ones live in the EMMI tool layer.
export const APPOINTMENT_ACTIONS = Object.freeze({
  VIEW: "VIEW",
  CREATE: "CREATE",
  BOOK: "BOOK",
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL",
  SHARE: "SHARE",
  REMIND: "REMIND"
});

// The four mutations that must survive a double tap without becoming two appointments.
export const IDEMPOTENT_ACTIONS = Object.freeze({
  BOOK: "BOOK",
  REQUEST: "REQUEST",
  RESCHEDULE: "RESCHEDULE",
  CANCEL: "CANCEL"
});

const CLOSED_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.CANCELED,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.DECLINED,
  APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE
]);

const PENDING_REQUEST_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.SEARCHING_AVAILABILITY,
  APPOINTMENT_STATUS.SLOTS_AVAILABLE,
  APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION,
  APPOINTMENT_STATUS.BOOKING,
  APPOINTMENT_STATUS.REQUEST_SENT,
  APPOINTMENT_STATUS.WAITING_FOR_OFFICE,
  APPOINTMENT_STATUS.PROPOSED_TIME,
  APPOINTMENT_STATUS.RESCHEDULE_REQUESTED
]);

export const appointmentIsOpen = appointment => Boolean(appointment) && !CLOSED_STATUSES.includes(appointment.status);
export const openAppointments = (appointments = []) => appointments.filter(appointmentIsOpen);

// ---------------------------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------------------------

const bounded = (value, max = 400) => String(value || "").slice(0, max);
const enumValue = (table, value, fallback) => (table[value] ? table[value] : fallback);

// Frozen on the way out, so nothing downstream can quietly promote a request into a confirmation
// by assignment. Every change goes through advanceAppointment, which records who said so.
function freezeAppointment(record) {
  return Object.freeze({
    ...record,
    preferredDateRange: record.preferredDateRange ? Object.freeze({ ...record.preferredDateRange }) : null,
    proposedTimes: Object.freeze((record.proposedTimes || []).map(slot => Object.freeze({ ...slot }))),
    events: Object.freeze((record.events || []).map(event => Object.freeze({ ...event }))),
    sharedWith: Object.freeze((record.sharedWith || []).map(share => Object.freeze({ ...share }))),
    reminder: record.reminder ? Object.freeze({ ...record.reminder }) : null,
    prep: Object.freeze({ topics: Object.freeze([...(record.prep?.topics || [])]), notes: record.prep?.notes || "", sharedWithProvider: record.prep?.sharedWithProvider === true, updatedAt: record.prep?.updatedAt || "" })
  });
}

// One record ties the need, the provider, the capability that was resolved, the preferences, the
// booking and the follow-up together. A real appointment never widens barrier.appointmentRequest:
// barriers stay goal-scoped, and this record is what a scheduler would own.
export function createAppointmentNeed({
  id = `appointment_${Date.now().toString(36)}`,
  patientId = "",
  source = APPOINTMENT_SOURCES.PATIENT_DIRECT_REQUEST,
  reasonCategory = APPOINTMENT_REASON_CATEGORIES.OTHER,
  reasonSummary = "",
  relatedGoalId = null,
  relatedBarrierId = null,
  relatedRefillId = null,
  requestedProfessionalId = null,
  requestedProfessionalType = "",
  requestedSpecialty = "",
  providerDisplayName = "",
  practiceName = "",
  preferredModality = APPOINTMENT_MODALITY.NO_PREFERENCE,
  preferredTimeOfDay = TIME_OF_DAY.NO_PREFERENCE,
  preferredDateRange = null,
  urgencyClassification = APPOINTMENT_URGENCY.ROUTINE,
  schedulingCapability = "",
  status = APPOINTMENT_STATUS.NEED_IDENTIFIED,
  actor = APPOINTMENT_ACTORS.PATIENT,
  idempotencyKey = null,
  now = new Date().toISOString()
} = {}) {
  const initialStatus = enumValue(APPOINTMENT_STATUS, status, APPOINTMENT_STATUS.NEED_IDENTIFIED);
  return freezeAppointment({
    id,
    patientId,
    source: enumValue(APPOINTMENT_SOURCES, source, APPOINTMENT_SOURCES.PATIENT_DIRECT_REQUEST),
    reasonCategory: enumValue(APPOINTMENT_REASON_CATEGORIES, reasonCategory, APPOINTMENT_REASON_CATEGORIES.OTHER),
    // The patient's own words, bounded the way a barrier description is. It never reaches analytics.
    reasonSummary: bounded(reasonSummary),
    relatedGoalId,
    relatedBarrierId,
    relatedRefillId,
    requestedProfessionalId,
    requestedProfessionalType,
    requestedSpecialty,
    // Provider identity is copied from a resolved directory entry or left empty. Never inferred.
    providerDisplayName,
    practiceName,
    preferredModality: enumValue(APPOINTMENT_MODALITY, preferredModality, APPOINTMENT_MODALITY.NO_PREFERENCE),
    preferredTimeOfDay: enumValue(TIME_OF_DAY, preferredTimeOfDay, TIME_OF_DAY.NO_PREFERENCE),
    preferredDateRange,
    urgencyClassification: enumValue(APPOINTMENT_URGENCY, urgencyClassification, APPOINTMENT_URGENCY.ROUTINE),
    schedulingCapability,
    status: initialStatus,
    // Everything below is empty until an external system says otherwise. A blank scheduledAt is the
    // product being honest that nothing is booked.
    scheduledAt: "",
    scheduledEndAt: "",
    timezone: "",
    modality: "",
    locationName: "",
    locationAddress: "",
    joinUrl: "",
    confirmationNumber: "",
    proposedTimes: [],
    idempotencyKey,
    events: [{ status: initialStatus, source: "ITERA", actor: enumValue(APPOINTMENT_ACTORS, actor, APPOINTMENT_ACTORS.PATIENT), at: now, detail: null }],
    createdAt: now,
    updatedAt: now,
    requestSentAt: "",
    confirmedAt: "",
    canceledAt: "",
    completedAt: "",
    resolvedAt: "",
    attendanceOutcome: "",
    followUpAskedAt: "",
    reminder: null,
    prep: { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" },
    sharedWith: []
  });
}

// ---------------------------------------------------------------------------------------------
// The status machine — explicit, fail-closed
// ---------------------------------------------------------------------------------------------

// Read this as the whole set of things that are allowed to happen. Anything not written here
// cannot happen, which is the point: BOOKING can only reach CONFIRMED or fall back to the times
// the patient can still choose from, and nothing at all reaches CONFIRMED except a real
// confirmation from the system that holds the calendar.
export const ALLOWED_TRANSITIONS = Object.freeze({
  [APPOINTMENT_STATUS.NEED_IDENTIFIED]: Object.freeze([APPOINTMENT_STATUS.DRAFT, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.DRAFT]: Object.freeze([APPOINTMENT_STATUS.COLLECTING_PREFERENCES, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.COLLECTING_PREFERENCES]: Object.freeze([APPOINTMENT_STATUS.SEARCHING_AVAILABILITY, APPOINTMENT_STATUS.REQUEST_SENT, APPOINTMENT_STATUS.DRAFT, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.SEARCHING_AVAILABILITY]: Object.freeze([APPOINTMENT_STATUS.SLOTS_AVAILABLE, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE]),
  [APPOINTMENT_STATUS.SLOTS_AVAILABLE]: Object.freeze([APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION, APPOINTMENT_STATUS.SEARCHING_AVAILABILITY, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.PENDING_PATIENT_SELECTION]: Object.freeze([APPOINTMENT_STATUS.BOOKING, APPOINTMENT_STATUS.SLOTS_AVAILABLE, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  // A failed booking returns to the times that are still on offer. It never reaches CONFIRMED.
  [APPOINTMENT_STATUS.BOOKING]: Object.freeze([APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.SLOTS_AVAILABLE, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE]),
  [APPOINTMENT_STATUS.REQUEST_SENT]: Object.freeze([APPOINTMENT_STATUS.WAITING_FOR_OFFICE, APPOINTMENT_STATUS.CANCEL_REQUESTED, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.WAITING_FOR_OFFICE]: Object.freeze([APPOINTMENT_STATUS.PROPOSED_TIME, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCEL_REQUESTED, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE, APPOINTMENT_STATUS.DECLINED]),
  [APPOINTMENT_STATUS.PROPOSED_TIME]: Object.freeze([APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.DECLINED]),
  // The office can move a confirmed appointment. The patient is shown the change and chooses.
  [APPOINTMENT_STATUS.CONFIRMED]: Object.freeze([APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, APPOINTMENT_STATUS.CANCEL_REQUESTED, APPOINTMENT_STATUS.PROPOSED_TIME, APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.NO_SHOW]),
  // The original stays live until the new time is confirmed: a reschedule is not a cancellation.
  [APPOINTMENT_STATUS.RESCHEDULE_REQUESTED]: Object.freeze([APPOINTMENT_STATUS.SLOTS_AVAILABLE, APPOINTMENT_STATUS.WAITING_FOR_OFFICE, APPOINTMENT_STATUS.PROPOSED_TIME, APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELED, APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE]),
  // A cancellation that the office never confirmed leaves the appointment standing.
  [APPOINTMENT_STATUS.CANCEL_REQUESTED]: Object.freeze([APPOINTMENT_STATUS.CANCELED, APPOINTMENT_STATUS.CONFIRMED]),
  // Nothing was scheduled, so the patient may try again rather than being stuck.
  [APPOINTMENT_STATUS.UNABLE_TO_SCHEDULE]: Object.freeze([APPOINTMENT_STATUS.DRAFT, APPOINTMENT_STATUS.COLLECTING_PREFERENCES]),
  [APPOINTMENT_STATUS.CANCELED]: Object.freeze([]),
  [APPOINTMENT_STATUS.COMPLETED]: Object.freeze([]),
  [APPOINTMENT_STATUS.NO_SHOW]: Object.freeze([]),
  [APPOINTMENT_STATUS.DECLINED]: Object.freeze([])
});

const FIRST_TRANSITION_TIMESTAMP = Object.freeze({
  [APPOINTMENT_STATUS.REQUEST_SENT]: "requestSentAt",
  [APPOINTMENT_STATUS.CONFIRMED]: "confirmedAt",
  [APPOINTMENT_STATUS.CANCELED]: "canceledAt",
  [APPOINTMENT_STATUS.COMPLETED]: "completedAt"
});

export function canAdvanceAppointment(appointment, nextStatus) {
  if (!appointment || !nextStatus || !APPOINTMENT_STATUS[nextStatus]) return false;
  const current = appointment.status;
  if (!current || !ALLOWED_TRANSITIONS[current]) return false;
  // Asking for the status the record already has is a repeated call, not a transition. Returning
  // false here is what makes a double tap harmless.
  if (current === nextStatus) return false;
  return ALLOWED_TRANSITIONS[current].includes(nextStatus);
}

// The only way a record changes. A legal transition produces a new frozen record with the event
// appended and the first-transition timestamp stamped; an illegal one hands back exactly what it
// was given, so a caller that ignores the result cannot end up displaying an invented success.
export function advanceAppointment(appointment, { status, source = "ITERA", actor = APPOINTMENT_ACTORS.SYSTEM, at = new Date().toISOString(), detail = null } = {}) {
  if (!canAdvanceAppointment(appointment, status)) return appointment;
  const stamp = FIRST_TRANSITION_TIMESTAMP[status];
  const closes = CLOSED_STATUSES.includes(status);
  return freezeAppointment({
    ...appointment,
    status,
    ...(stamp && !appointment[stamp] ? { [stamp]: at } : {}),
    ...(closes && !appointment.resolvedAt ? { resolvedAt: at } : {}),
    events: [...(appointment.events || []), { status, source, actor: enumValue(APPOINTMENT_ACTORS, actor, APPOINTMENT_ACTORS.SYSTEM), at, detail }],
    updatedAt: at
  });
}

// A newly identified need cannot skip DRAFT on its way to the preference questions. Keeping this
// transition here makes UI-, EMMI- and workflow-created needs follow the same state-machine path.
export function beginAppointmentPreferences(appointment, { source = "ITERA", actor = APPOINTMENT_ACTORS.SYSTEM, at = new Date().toISOString(), detail = null } = {}) {
  if (!appointment) return appointment;
  let current = appointment;
  if (current.status === APPOINTMENT_STATUS.NEED_IDENTIFIED) {
    current = advanceAppointment(current, { status: APPOINTMENT_STATUS.DRAFT, source, actor, at, detail });
  }
  if (current.status === APPOINTMENT_STATUS.DRAFT) {
    current = advanceAppointment(current, { status: APPOINTMENT_STATUS.COLLECTING_PREFERENCES, source, actor, at, detail });
  }
  return current;
}

// Confirmation details arrive with the confirmation, never before it, and only ever from the system
// that holds the calendar. Anything the booking result did not carry stays empty.
export function applyBookingConfirmation(appointment, { confirmationNumber = "", scheduledAt = "", scheduledEndAt = "", modality = "", locationName = "", locationAddress = "", joinUrl = "", timezone = "", source = "SCHEDULING_SYSTEM", actor = APPOINTMENT_ACTORS.PATIENT, at = new Date().toISOString() } = {}) {
  if (!canAdvanceAppointment(appointment, APPOINTMENT_STATUS.CONFIRMED)) return appointment;
  const confirmed = advanceAppointment(appointment, { status: APPOINTMENT_STATUS.CONFIRMED, source, actor, at, detail: { confirmationNumber } });
  return freezeAppointment({
    ...confirmed,
    confirmationNumber: confirmationNumber || confirmed.confirmationNumber,
    scheduledAt: scheduledAt || confirmed.scheduledAt,
    scheduledEndAt: scheduledEndAt || confirmed.scheduledEndAt,
    modality: modality || confirmed.modality,
    locationName: locationName || confirmed.locationName,
    locationAddress: locationAddress || confirmed.locationAddress,
    joinUrl: joinUrl || confirmed.joinUrl,
    timezone: timezone || confirmed.timezone
  });
}

// ---------------------------------------------------------------------------------------------
// What the patient reads
// ---------------------------------------------------------------------------------------------

// Never an enum, never a claim the product cannot support, and never a word that suggests the
// patient did something wrong.
export const APPOINTMENT_PATIENT_STATUS = Object.freeze({
  NEED_IDENTIFIED: T("Let’s set up this visit", "Vamos a coordinar esta visita", "Ann òganize vizit sa a"),
  DRAFT: T("Not sent yet", "Todavía no se ha enviado", "Poko voye"),
  COLLECTING_PREFERENCES: T("A few quick questions", "Unas preguntas rápidas", "Kèk kesyon rapid"),
  SEARCHING_AVAILABILITY: T("Looking for times", "Buscando horarios", "N ap chèche lè"),
  SLOTS_AVAILABLE: T("Choose a time", "Elija una hora", "Chwazi yon lè"),
  PENDING_PATIENT_SELECTION: T("Choose a time", "Elija una hora", "Chwazi yon lè"),
  BOOKING: T("Confirming your time", "Confirmando su hora", "N ap konfime lè ou"),
  REQUEST_SENT: T("Request sent", "Solicitud enviada", "Demann voye"),
  WAITING_FOR_OFFICE: T("Waiting for confirmation", "Esperando confirmación", "N ap tann konfimasyon"),
  PROPOSED_TIME: T("The office suggested a time", "La oficina propuso una hora", "Biwo a pwopoze yon lè"),
  CONFIRMED: T("Appointment confirmed", "Cita confirmada", "Randevou konfime"),
  RESCHEDULE_REQUESTED: T("Change requested", "Cambio solicitado", "Demann chanjman voye"),
  CANCEL_REQUESTED: T("Cancellation requested", "Cancelación solicitada", "Demann anilasyon voye"),
  CANCELED: T("Canceled", "Cancelada", "Anile"),
  COMPLETED: T("Visit completed", "Visita completada", "Vizit fini"),
  NO_SHOW: T("This visit was missed", "No se asistió a esta visita", "Vizit sa a pa t fèt"),
  UNABLE_TO_SCHEDULE: T("We could not schedule this yet", "Aún no pudimos programar esto", "Nou poko rive pwograme sa"),
  DECLINED: T("Not scheduled", "No programada", "Pa pwograme")
});

export const appointmentPatientStatus = (appointment, locale = "en") =>
  localAppointmentText(APPOINTMENT_PATIENT_STATUS[appointment?.status] || APPOINTMENT_PATIENT_STATUS.NEED_IDENTIFIED, locale);

// What the patient does next, in their terms. Empty when there is nothing for them to do — a
// confirmed appointment does not need to invent a task for the patient.
export const APPOINTMENT_NEXT_STEP = Object.freeze({
  NEED_IDENTIFIED: T("EMMI can help you coordinate this with your care team.", "EMMI puede ayudarle a coordinar esto con su equipo de atención.", "EMMI ka ede w òganize sa ak ekip swen ou."),
  DRAFT: T("You can finish this whenever you are ready.", "Puede terminar esto cuando quiera.", "Ou ka fini sa lè ou pare."),
  COLLECTING_PREFERENCES: T("Answer a few questions so your team can help.", "Responda unas preguntas para que su equipo pueda ayudar.", "Reponn kèk kesyon pou ekip ou ka ede w."),
  SLOTS_AVAILABLE: T("Choose one of the times below.", "Elija una de las horas de abajo.", "Chwazi youn nan lè ki anba yo."),
  PENDING_PATIENT_SELECTION: T("Choose one of the times below.", "Elija una de las horas de abajo.", "Chwazi youn nan lè ki anba yo."),
  REQUEST_SENT: T("EMMI will let you know when the office answers.", "EMMI le avisará cuando la oficina responda.", "EMMI ap fè w konnen lè biwo a reponn."),
  WAITING_FOR_OFFICE: T("EMMI will let you know when the office answers.", "EMMI le avisará cuando la oficina responda.", "EMMI ap fè w konnen lè biwo a reponn."),
  PROPOSED_TIME: T("Review the new time and tell us if it works.", "Revise la nueva hora y díganos si le sirve.", "Gade nouvo lè a epi di nou si li bon pou ou."),
  RESCHEDULE_REQUESTED: T("EMMI will let you know when the office answers.", "EMMI le avisará cuando la oficina responda.", "EMMI ap fè w konnen lè biwo a reponn."),
  CANCEL_REQUESTED: T("EMMI will let you know when the office answers.", "EMMI le avisará cuando la oficina responda.", "EMMI ap fè w konnen lè biwo a reponn."),
  UNABLE_TO_SCHEDULE: T("Your care team will follow up with you.", "Su equipo de atención se comunicará con usted.", "Ekip swen ou ap kontakte w."),
  NO_SHOW: T("EMMI can help you set up another visit.", "EMMI puede ayudarle a coordinar otra visita.", "EMMI ka ede w òganize yon lòt vizit.")
});

export const appointmentNextStep = (appointment, locale = "en") =>
  localAppointmentText(APPOINTMENT_NEXT_STEP[appointment?.status] || "", locale);

// Tone is for styling only. Colour is never the sole carrier of meaning: every view pairs this
// with the patient-facing text above and an icon.
const STATUS_TONE = Object.freeze({
  CONFIRMED: "CONFIRMED",
  SEARCHING_AVAILABILITY: "WAITING",
  BOOKING: "WAITING",
  REQUEST_SENT: "WAITING",
  WAITING_FOR_OFFICE: "WAITING",
  RESCHEDULE_REQUESTED: "WAITING",
  CANCEL_REQUESTED: "WAITING",
  NEED_IDENTIFIED: "ACTION_NEEDED",
  DRAFT: "ACTION_NEEDED",
  COLLECTING_PREFERENCES: "ACTION_NEEDED",
  SLOTS_AVAILABLE: "ACTION_NEEDED",
  PENDING_PATIENT_SELECTION: "ACTION_NEEDED",
  PROPOSED_TIME: "ACTION_NEEDED",
  CANCELED: "CLOSED",
  COMPLETED: "CLOSED",
  DECLINED: "CLOSED",
  NO_SHOW: "PROBLEM",
  UNABLE_TO_SCHEDULE: "PROBLEM"
});

export const appointmentStatusTone = appointment => STATUS_TONE[appointment?.status] || "WAITING";

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

const time = value => {
  const parsed = new Date(value || "").getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

// Upcoming means there is a real time on the record and it has not passed. A request with no
// scheduled time is never upcoming care, however much the patient is hoping for it.
export function upcomingAppointments(appointments = [], now = new Date()) {
  const from = new Date(now).getTime();
  return appointments
    .filter(appointment => appointmentIsOpen(appointment) && time(appointment.scheduledAt) !== null && time(appointment.scheduledAt) >= from)
    .sort((a, b) => time(a.scheduledAt) - time(b.scheduledAt));
}

export const pendingRequests = (appointments = []) =>
  appointments.filter(appointment => PENDING_REQUEST_STATUSES.includes(appointment?.status));

// Past covers both what happened and what stopped: a completed visit, a missed one, and a
// cancellation all belong in the same place the patient looks back at.
export function pastAppointments(appointments = [], now = new Date()) {
  const from = new Date(now).getTime();
  return appointments
    .filter(appointment => CLOSED_STATUSES.includes(appointment?.status) || (time(appointment?.scheduledAt) !== null && time(appointment.scheduledAt) < from))
    .sort((a, b) => (time(b.scheduledAt) ?? time(b.updatedAt) ?? 0) - (time(a.scheduledAt) ?? time(a.updatedAt) ?? 0));
}

export const findUpcomingAppointmentWithProvider = (appointments = [], providerId, now = new Date()) =>
  (providerId ? upcomingAppointments(appointments, now).find(appointment => appointment.requestedProfessionalId === providerId) || null : null);

// Before creating a second need for the same provider and reason, find the first one. The patient
// is told about it and chooses; nothing is silently merged or silently duplicated.
export function findDuplicateAppointmentNeed(appointments = [], { requestedProfessionalId = null, reasonCategory = "" } = {}) {
  if (!requestedProfessionalId && !reasonCategory) return null;
  return openAppointments(appointments).find(appointment => {
    if (requestedProfessionalId && appointment.requestedProfessionalId !== requestedProfessionalId) return false;
    if (reasonCategory && appointment.reasonCategory !== reasonCategory) return false;
    return true;
  }) || null;
}

// ---------------------------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------------------------

// A double tap, a voice turn and a button press are the same intent. The key is derived from what
// the request is about, never from when it was made, so a retry cannot become a second booking.
export const appointmentIdempotencyKey = ({ patientId = "", providerId = "", slotId = "", action = IDEMPOTENT_ACTIONS.REQUEST } = {}) =>
  `appointment:${patientId || "unknown"}:${providerId || "none"}:${slotId || "none"}:${IDEMPOTENT_ACTIONS[action] || IDEMPOTENT_ACTIONS.REQUEST}`;

export const findByIdempotencyKey = (appointments = [], key) =>
  (key ? appointments.find(appointment => appointment?.idempotencyKey === key) || null : null);

// ---------------------------------------------------------------------------------------------
// Draft
// ---------------------------------------------------------------------------------------------

// What survives an interrupted conversation. A draft is a saved intention, never a submission:
// nothing here sends anything.
export const APPOINTMENT_DRAFT_FIELDS = Object.freeze([
  "reasonCategory",
  "reasonSummary",
  "requestedProfessionalId",
  "requestedProfessionalType",
  "requestedSpecialty",
  "providerDisplayName",
  "preferredModality",
  "preferredTimeOfDay",
  "preferredDateRange",
  "selectedSlotId",
  "relatedGoalId",
  "relatedBarrierId",
  "relatedRefillId",
  "urgencyClassification"
]);

const EMPTY_DRAFT = Object.freeze({
  reasonCategory: "",
  reasonSummary: "",
  requestedProfessionalId: null,
  requestedProfessionalType: "",
  requestedSpecialty: "",
  providerDisplayName: "",
  preferredModality: APPOINTMENT_MODALITY.NO_PREFERENCE,
  preferredTimeOfDay: TIME_OF_DAY.NO_PREFERENCE,
  preferredDateRange: null,
  selectedSlotId: "",
  relatedGoalId: null,
  relatedBarrierId: null,
  relatedRefillId: null,
  urgencyClassification: APPOINTMENT_URGENCY.ROUTINE
});

const pickDraftFields = (seed = {}) => APPOINTMENT_DRAFT_FIELDS.reduce((draft, field) => (
  Object.prototype.hasOwnProperty.call(seed, field) && seed[field] !== undefined ? { ...draft, [field]: seed[field] } : draft
), {});

export function createAppointmentDraft(seed = {}) {
  const now = seed.now || new Date().toISOString();
  return Object.freeze({
    id: seed.id || `appointment_draft_${Date.now().toString(36)}`,
    step: seed.step || "",
    ...EMPTY_DRAFT,
    ...pickDraftFields(seed),
    reasonSummary: bounded(seed.reasonSummary || ""),
    createdAt: seed.createdAt || now,
    updatedAt: now
  });
}

// Only the fields a draft is allowed to hold are applied. Anything else a caller passes is dropped
// rather than quietly persisted into a record that later looks like a real appointment.
export function updateAppointmentDraft(draft, patch = {}) {
  if (!draft) return draft;
  const applied = pickDraftFields(patch);
  return Object.freeze({
    ...draft,
    ...applied,
    ...(Object.prototype.hasOwnProperty.call(applied, "reasonSummary") ? { reasonSummary: bounded(applied.reasonSummary) } : {}),
    ...(patch.step !== undefined ? { step: patch.step } : {}),
    updatedAt: patch.now || new Date().toISOString()
  });
}

const APPOINTMENT_REQUEST_STEPS = Object.freeze(["PROVIDER", "REASON", "MODALITY", "TIME_OF_DAY", "REVIEW"]);
const hasRequestedProfessional = draft => Boolean(
  draft?.requestedProfessionalId
  || draft?.requestedSpecialty
  || (draft?.requestedProfessionalType && draft.requestedProfessionalType !== "UNKNOWN")
);

// Re-entry follows the information that actually exists, not a stale UI step. EMMI can identify a
// need before it knows who should handle it; in that case the first screen must be PROVIDER even if
// an earlier transition happened to store REASON. A generic UNKNOWN classification is not a person.
export function appointmentPreferenceResumeStep(draft, requestedStep = "PROVIDER") {
  const requested = APPOINTMENT_REQUEST_STEPS.includes(requestedStep) ? requestedStep : "PROVIDER";
  if (!hasRequestedProfessional(draft)) return "PROVIDER";
  const hasReason = Boolean(draft?.reasonCategory || draft?.reasonSummary);
  if (!hasReason && APPOINTMENT_REQUEST_STEPS.indexOf(requested) > APPOINTMENT_REQUEST_STEPS.indexOf("REASON")) return "REASON";
  return requested;
}

// The gate on the submit button, not the submit itself. §81: a patient may always stop, and a
// draft is never sent because it happens to be complete.
export function draftIsSubmittable(draft) {
  const missing = [];
  if (!draft) return { ok: false, missing: ["requestedProfessionalId", "reasonCategory"] };
  if (!hasRequestedProfessional(draft)) missing.push("requestedProfessionalId");
  if (!draft.reasonCategory && !draft.reasonSummary) missing.push("reasonCategory");
  return { ok: missing.length === 0, missing };
}

export const serializeAppointmentDraft = draft => (draft
  ? {
    id: draft.id,
    step: draft.step || "",
    ...APPOINTMENT_DRAFT_FIELDS.reduce((fields, field) => ({ ...fields, [field]: draft[field] ?? EMPTY_DRAFT[field] ?? null }), {}),
    createdAt: draft.createdAt || "",
    updatedAt: draft.updatedAt || ""
  }
  : null);

// Persistence takes a plain, unfrozen copy. Reload rebuilds the record from exactly these fields,
// so anything not listed here is gone — which is the same contract DraftStore already has.
export const serializeAppointmentForDraft = record => (record
  ? {
    id: record.id,
    patientId: record.patientId,
    source: record.source,
    reasonCategory: record.reasonCategory,
    reasonSummary: record.reasonSummary,
    relatedGoalId: record.relatedGoalId ?? null,
    relatedBarrierId: record.relatedBarrierId ?? null,
    relatedRefillId: record.relatedRefillId ?? null,
    requestedProfessionalId: record.requestedProfessionalId ?? null,
    requestedProfessionalType: record.requestedProfessionalType || "",
    requestedSpecialty: record.requestedSpecialty || "",
    providerDisplayName: record.providerDisplayName || "",
    practiceName: record.practiceName || "",
    preferredModality: record.preferredModality,
    preferredTimeOfDay: record.preferredTimeOfDay,
    preferredDateRange: record.preferredDateRange ? { ...record.preferredDateRange } : null,
    urgencyClassification: record.urgencyClassification,
    schedulingCapability: record.schedulingCapability || "",
    status: record.status,
    scheduledAt: record.scheduledAt || "",
    scheduledEndAt: record.scheduledEndAt || "",
    timezone: record.timezone || "",
    modality: record.modality || "",
    locationName: record.locationName || "",
    locationAddress: record.locationAddress || "",
    joinUrl: record.joinUrl || "",
    confirmationNumber: record.confirmationNumber || "",
    proposedTimes: (record.proposedTimes || []).map(slot => ({ ...slot })),
    idempotencyKey: record.idempotencyKey ?? null,
    events: (record.events || []).map(event => ({ ...event })),
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
    requestSentAt: record.requestSentAt || "",
    confirmedAt: record.confirmedAt || "",
    canceledAt: record.canceledAt || "",
    completedAt: record.completedAt || "",
    resolvedAt: record.resolvedAt || "",
    attendanceOutcome: record.attendanceOutcome || "",
    followUpAskedAt: record.followUpAskedAt || "",
    reminder: record.reminder ? { ...record.reminder } : null,
    prep: { topics: [...(record.prep?.topics || [])], notes: record.prep?.notes || "", sharedWithProvider: record.prep?.sharedWithProvider === true, updatedAt: record.prep?.updatedAt || "" },
    sharedWith: (record.sharedWith || []).map(share => ({ ...share }))
  }
  : null);

// A record read back from storage returns to the frozen shape, with anything the stored copy is
// missing filled from the empty record rather than left undefined.
export const restoreAppointment = stored => (stored
  ? freezeAppointment({ ...createAppointmentNeed({ id: stored.id, now: stored.createdAt || new Date().toISOString() }), ...serializeAppointmentForDraft(stored) })
  : null);

// ---------------------------------------------------------------------------------------------
// The care-team handoff
// ---------------------------------------------------------------------------------------------

const barrierCategoryOf = barrier => (typeof barrier === "string" ? barrier : barrier?.category || "");

const PREFERRED_TIME_LABEL = Object.freeze({
  MORNING: "MORNING",
  AFTERNOON: "AFTERNOON",
  EVENING: "EVENING"
});

const LEGACY_APPOINTMENT_STATUS = Object.freeze({
  CONFIRMED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED"
});

// The one summary the whole product uses when a person has to coordinate this. It carries what a
// scheduler needs to act and nothing else: no transcript, no free text the patient did not intend
// for the office, and barrier categories rather than what the patient said about them.
//
// Every value is a code or the patient's own words. `locale` is accepted because callers have it,
// and deliberately unused: a care team console renders these codes in its own language, and
// translating them here would make the same task read differently depending on who filed it.
// eslint-disable-next-line no-unused-vars
export function appointmentCareTeamSummary(appointment, { patientLabel = "", knownBarriers = [], contactPreference = "", locale = "en" } = {}) {
  if (!appointment) return null;
  const preferredTime = PREFERRED_TIME_LABEL[appointment.preferredTimeOfDay] || "";
  return {
    patient: patientLabel,
    requestedProfessional: appointment.providerDisplayName || "",
    requestedProfessionalType: appointment.requestedProfessionalType || "",
    specialty: appointment.requestedSpecialty || "",
    reasonCategory: appointment.reasonCategory,
    reasonSummary: appointment.reasonSummary || "",
    preferredModality: appointment.preferredModality,
    preferredTiming: preferredTime,
    knownBarriers: [...new Set((knownBarriers || []).map(barrierCategoryOf).filter(Boolean))],
    contactPreference,
    needId: appointment.id,
    urgencyClassification: appointment.urgencyClassification,
    requestedAt: appointment.requestSentAt || appointment.createdAt || "",
    // Back-compat: the existing care-team task consumers and their e2e assertions read these two
    // keys by name. They keep the vocabulary they already had.
    appointmentStatus: LEGACY_APPOINTMENT_STATUS[appointment.status] || "NOT_SCHEDULED",
    patientPreferredTime: preferredTime
  };
}

// ---------------------------------------------------------------------------------------------
// Authorization and audit
// ---------------------------------------------------------------------------------------------

const REPRESENTATIVE_ROLES = ["representative", "personal_representative", "personalrepresentative", "proxy"];
const CARE_TEAM_ROLES = ["care_team", "careteam", "clinician", "nurse", "care_manager", "caremanager"];

// Who is acting, derived from the state the shell already keeps. A role this module does not
// recognise resolves to nothing at all, and nothing at all is denied everything.
export function resolveAppointmentActor({ completionRole = "", role = "", viaEmmi = false } = {}) {
  const value = String(completionRole || role || "").trim().toLowerCase();
  if (REPRESENTATIVE_ROLES.includes(value)) return APPOINTMENT_ACTORS.PERSONAL_REPRESENTATIVE;
  if (CARE_TEAM_ROLES.includes(value)) return APPOINTMENT_ACTORS.CARE_TEAM;
  if (value === "system") return APPOINTMENT_ACTORS.SYSTEM;
  if (value === "patient") return viaEmmi ? APPOINTMENT_ACTORS.EMMI_ASSISTED_PATIENT : APPOINTMENT_ACTORS.PATIENT;
  return "";
}

const CARE_CIRCLE_ALLOWED = Object.freeze([APPOINTMENT_ACTIONS.VIEW, APPOINTMENT_ACTIONS.REMIND]);
const SYSTEM_ALLOWED = Object.freeze([APPOINTMENT_ACTIONS.VIEW, APPOINTMENT_ACTIONS.CREATE, APPOINTMENT_ACTIONS.REMIND]);

// The single chokepoint. There is no backend here, so this is a product rule written down in one
// place — documented as a prototype limitation, not as security. Everything it denies, it denies
// with a reason a care team could audit.
//
// A Care Circle member is not an actor in the audit vocabulary: they act on the patient's behalf
// and are recognised by careCirclePermissions.actingAsCareCircle. That branch is evaluated first,
// because the one thing that must never depend on how an actor was resolved is a Care Circle
// member reaching cancel or reschedule.
export function canActOnAppointment({ actor = "", action = "", identityVerified = false, careCirclePermissions = null } = {}) {
  if (!APPOINTMENT_ACTIONS[action]) return { allowed: false, reason: "UNKNOWN_ACTION" };

  if (careCirclePermissions?.actingAsCareCircle === true) {
    if (!CARE_CIRCLE_ALLOWED.includes(action)) return { allowed: false, reason: "CARE_CIRCLE_CANNOT_ACT" };
    if (careCirclePermissions.helpWithAppointments !== true) return { allowed: false, reason: "CARE_CIRCLE_PERMISSION_REQUIRED" };
    return { allowed: true, reason: "CARE_CIRCLE_PERMISSION_GRANTED" };
  }

  if (!APPOINTMENT_ACTORS[actor]) return { allowed: false, reason: "UNKNOWN_ACTOR" };

  if (actor === APPOINTMENT_ACTORS.PERSONAL_REPRESENTATIVE) {
    // Verified authority, or no authority. There is no partial representative.
    if (identityVerified !== true) return { allowed: false, reason: "IDENTITY_VERIFICATION_REQUIRED" };
    return { allowed: true, reason: "VERIFIED_REPRESENTATIVE" };
  }

  if (actor === APPOINTMENT_ACTORS.CARE_TEAM) {
    // Sharing an appointment with someone is the patient's decision, not their care team's.
    if (action === APPOINTMENT_ACTIONS.SHARE) return { allowed: false, reason: "PATIENT_CONTROLS_SHARING" };
    return { allowed: true, reason: "CARE_TEAM_COORDINATION" };
  }

  if (actor === APPOINTMENT_ACTORS.SYSTEM) {
    // A workflow may notice a need and may remind. Booking, moving or canceling a visit is
    // something a person decides.
    if (!SYSTEM_ALLOWED.includes(action)) return { allowed: false, reason: "REQUIRES_A_PERSON" };
    return { allowed: true, reason: "SYSTEM_WORKFLOW" };
  }

  return { allowed: true, reason: actor === APPOINTMENT_ACTORS.EMMI_ASSISTED_PATIENT ? "PATIENT_VIA_EMMI" : "PATIENT_OWN_RECORD" };
}

export const APPOINTMENT_AUDIT_EVENTS = Object.freeze({
  NEED_CREATED: "appointment_need_created",
  PROVIDER_RESOLVED: "appointment_provider_resolved",
  AVAILABILITY_REQUESTED: "appointment_availability_requested",
  SLOTS_SHOWN: "appointment_slots_shown",
  SLOT_SELECTED: "appointment_slot_selected",
  BOOKING_ATTEMPTED: "appointment_booking_attempted",
  BOOKING_CONFIRMED: "appointment_booking_confirmed",
  REQUEST_SENT: "appointment_request_sent",
  RESCHEDULE_REQUESTED: "appointment_reschedule_requested",
  CANCELED: "appointment_canceled",
  REMINDER_CREATED: "appointment_reminder_created",
  BARRIER_IDENTIFIED: "appointment_barrier_identified",
  CARE_TEAM_TASK_CREATED: "appointment_care_team_task_created",
  FOLLOW_UP_OUTCOME: "appointment_follow_up_outcome",
  SHARED_WITH_CARE_CIRCLE: "appointment_shared_with_care_circle"
});

// Analytics describe the shape of the coordination, never the patient. No provider name, no
// practice, no address, no join link, no appointment time and nothing the patient typed: the only
// thing said about the schedule is how many days away it is.
export function appointmentAnalytics(appointment, { now = new Date() } = {}) {
  if (!appointment) return {};
  const scheduled = time(appointment.scheduledAt);
  const lastActor = [...(appointment.events || [])].reverse().find(event => event?.actor)?.actor || "";
  return {
    needId: appointment.id,
    source: appointment.source,
    reasonCategory: appointment.reasonCategory,
    urgencyClassification: appointment.urgencyClassification,
    schedulingCapability: appointment.schedulingCapability || "",
    status: appointment.status,
    modality: appointment.modality || appointment.preferredModality || "",
    hasProvider: Boolean(appointment.requestedProfessionalId || appointment.providerDisplayName),
    actor: lastActor,
    daysUntil: scheduled === null ? null : Math.round((scheduled - new Date(now).getTime()) / DAY_MS)
  };
}
