// EMMI Barrier Resolution Engine — the domain layer.
//
// src/appointmentSupport.js answers "what kind of difficulty is this?" and hands it to the barrier
// taxonomy. That is where the product used to stop: a barrier was recorded, a care-team task was
// opened, and the patient was told somebody would be in touch. This module is the part that comes
// next — the attempt to actually solve it with the patient still on the screen.
//
// The shape is always the same, whatever the difficulty is:
//
//   BARRIER → ASSISTANCE OFFERED → INFORMATION COLLECTED → OPTIONS FOUND → PATIENT SELECTS
//           → PATIENT CONFIRMS → ACTION EXECUTED → RESOLVED
//
// and when any step cannot be completed:
//
//   BARRIER → ATTEMPTED → ESCALATED TO CARE TEAM
//
// Three rules run through all of it:
//   - reporting a difficulty is never the end state. Every playbook ends in a resolution or in a
//     named person who owns it;
//   - nothing that changes the world happens before the patient says so on a review step. The
//     step machine is written so that CONFIRM is always a separate step from SELECT;
//   - this file knows nothing about Uber, about a scheduler, about SMS or about the DOM. It owns
//     the state machine and the arithmetic; src/barrierProviders.js owns the outside world and
//     src/barrierResolutionViews.js owns the pixels.
//
// Pure module: no DOM, no storage, no app state, no timers. Every export is a function of its
// arguments.

import { APPOINTMENT_BARRIER_REASONS } from "./appointmentSupport.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localResolutionText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");
const L = localResolutionText;

/* ------------------------------------------------------------------------ the vocabulary -- */

// What kind of difficulty a resolution is working on. These are the barriers EMMI can attempt,
// not the whole taxonomy: a difficulty with no playbook is not listed here and goes straight to
// the care team, which is the honest answer rather than a flow that pretends to help.
export const BARRIER_TYPES = Object.freeze({
  TRANSPORTATION: "transportation",
  VIDEO_VISIT: "video_visit",
  COMPANION: "companion",
  RESCHEDULE: "reschedule",
  OTHER: "other"
});

// The lifecycle a resolution moves through, independent of which playbook is running. A care team
// looking at two different difficulties should be able to read the same word for "the patient has
// been offered help and has not answered yet".
export const RESOLUTION_STATUS = Object.freeze({
  IDENTIFIED: "identified",
  ASSISTANCE_OFFERED: "assistance_offered",
  PATIENT_ACCEPTED: "patient_accepted",
  COLLECTING_INFORMATION: "collecting_information",
  SEARCHING_OPTIONS: "searching_options",
  OPTION_SELECTED: "option_selected",
  AWAITING_CONFIRMATION: "awaiting_confirmation",
  RESOLVED: "resolved",
  NEEDS_CARE_TEAM: "needs_care_team",
  CANCELLED: "cancelled"
});

// What a resolved resolution actually produced. This is the noun a care team reads, and the reason
// the appointment readiness panel can say "Transportation arranged" rather than "barrier closed".
export const RESOLUTION_TYPES = Object.freeze({
  TRANSPORTATION_BOOKING: "transportation_booking",
  VIDEO_READINESS: "video_readiness",
  COMPANION_INVITATION: "companion_invitation",
  APPOINTMENT_RESCHEDULE: "appointment_reschedule",
  CARE_TEAM_ESCALATION: "care_team_escalation"
});

// §23 of the resolution spec: an activity log that is not shown to the patient and is not analytics
// either. It is the record of what EMMI actually did on their behalf, which is the thing a care
// team needs when a patient calls and asks "who booked me a car?".
export const RESOLUTION_EVENTS = Object.freeze({
  BARRIER_IDENTIFIED: "barrier_identified",
  ASSISTANCE_OFFERED: "assistance_offered",
  ASSISTANCE_DECLINED: "assistance_declined",
  TRANSPORTATION_SEARCH_STARTED: "transportation_search_started",
  TRANSPORTATION_OPTIONS_RETURNED: "transportation_options_returned",
  TRANSPORTATION_OPTION_SELECTED: "transportation_option_selected",
  TRANSPORTATION_CONFIRMED: "transportation_confirmed",
  TRANSPORTATION_RESERVED: "transportation_reserved",
  TRANSPORTATION_RESERVATION_FAILED: "transportation_reservation_failed",
  TRANSPORTATION_CANCELED: "transportation_canceled",
  RETURN_TRIP_RESERVED: "return_trip_reserved",
  COMPANION_INVITED: "companion_invited",
  COMPANION_CONFIRMED: "companion_confirmed",
  COMPANION_DECLINED: "companion_declined",
  VIDEO_READINESS_STARTED: "video_readiness_started",
  VIDEO_READINESS_COMPLETED: "video_readiness_completed",
  APPOINTMENT_RESCHEDULE_REQUESTED: "appointment_reschedule_requested",
  APPOINTMENT_RESCHEDULED: "appointment_rescheduled",
  BARRIER_DESCRIBED: "barrier_described",
  BARRIER_INTENT_CLASSIFIED: "barrier_intent_classified",
  CARE_TEAM_ASSISTANCE_REQUESTED: "care_team_assistance_requested",
  RESOLUTION_ABANDONED: "resolution_abandoned"
});

/* ---------------------------------------------------------------------------- playbooks --- */

// Which playbook a pre-visit answer opens. The keys on the left are src/appointmentSupport.js's
// APPOINTMENT_BARRIER_REASONS, so the screen the patient already has keeps emitting exactly what it
// emits today and this module decides what that means.
//
// A reason that is absent here is not broken: it records a barrier the way it always did and the
// care team owns it. That is deliberate. A playbook that cannot finish is worse than no playbook.
const PLAYBOOK_BY_REASON = Object.freeze({
  [APPOINTMENT_BARRIER_REASONS.TRANSPORTATION]: BARRIER_TYPES.TRANSPORTATION,
  [APPOINTMENT_BARRIER_REASONS.MOBILITY]: BARRIER_TYPES.TRANSPORTATION,
  [APPOINTMENT_BARRIER_REASONS.TECHNOLOGY_TELEHEALTH]: BARRIER_TYPES.VIDEO_VISIT,
  [APPOINTMENT_BARRIER_REASONS.CAREGIVER_AVAILABILITY]: BARRIER_TYPES.COMPANION,
  [APPOINTMENT_BARRIER_REASONS.TIME_CONFLICT]: BARRIER_TYPES.RESCHEDULE,
  [APPOINTMENT_BARRIER_REASONS.OTHER]: BARRIER_TYPES.OTHER
});

export const resolutionPlaybookFor = reasonKey =>
  PLAYBOOK_BY_REASON[String(reasonKey || "").trim().toUpperCase()] || "";

const RESOLUTION_TYPE_BY_BARRIER = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: RESOLUTION_TYPES.TRANSPORTATION_BOOKING,
  [BARRIER_TYPES.VIDEO_VISIT]: RESOLUTION_TYPES.VIDEO_READINESS,
  [BARRIER_TYPES.COMPANION]: RESOLUTION_TYPES.COMPANION_INVITATION,
  [BARRIER_TYPES.RESCHEDULE]: RESOLUTION_TYPES.APPOINTMENT_RESCHEDULE,
  [BARRIER_TYPES.OTHER]: RESOLUTION_TYPES.CARE_TEAM_ESCALATION
});

export const resolutionTypeFor = barrierType =>
  RESOLUTION_TYPE_BY_BARRIER[barrierType] || RESOLUTION_TYPES.CARE_TEAM_ESCALATION;

// Every step each playbook can be on. The names are the contract between this module, the view
// module and the shell's handler switch, so they are listed rather than assembled.
//
// The pattern §12 asks for is visible in the ordering: SELECT, then REVIEW, then a *_WORKING step
// that only ever begins after the patient pressed the button on REVIEW, then SUCCESS.
export const RESOLUTION_STEPS = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: Object.freeze([
    "OFFER", "PICKUP", "PICKUP_EDIT", "NEEDS", "NEEDS_UNSUPPORTED", "TIME", "TIME_EDIT",
    "SEARCHING", "OPTIONS", "OPTIONS_EMPTY", "REVIEW", "BOOKING", "BOOKED", "BOOKING_FAILED",
    "RETURN_OFFER", "RETURN_TIME", "RETURN_BOOKING", "CANCEL_CONFIRM", "CANCELED", "DECLINED", "ESCALATED"
  ]),
  [BARRIER_TYPES.VIDEO_VISIT]: Object.freeze([
    "OFFER", "CHECKING", "READY", "ISSUES", "GUIDE", "DECLINED", "ESCALATED"
  ]),
  [BARRIER_TYPES.COMPANION]: Object.freeze([
    "OFFER", "CONTACTS", "NEW_CONTACT", "REVIEW", "SENDING", "SENT", "CONFIRMED", "DECLINED_BY_CONTACT",
    "NO_CONTACT", "DECLINED", "ESCALATED"
  ]),
  [BARRIER_TYPES.RESCHEDULE]: Object.freeze([
    "OFFER", "SEARCHING", "SLOTS", "SLOTS_EMPTY", "REVIEW", "CHANGING", "CHANGED", "CHANGE_FAILED",
    "DECLINED", "ESCALATED"
  ]),
  [BARRIER_TYPES.OTHER]: Object.freeze([
    "DESCRIBE", "CLASSIFYING", "ROUTED", "ESCALATE_OFFER", "ESCALATED"
  ])
});

const FIRST_STEP = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: "OFFER",
  [BARRIER_TYPES.VIDEO_VISIT]: "OFFER",
  [BARRIER_TYPES.COMPANION]: "OFFER",
  [BARRIER_TYPES.RESCHEDULE]: "OFFER",
  [BARRIER_TYPES.OTHER]: "DESCRIBE"
});

// The steps where a provider call is in flight. The shell reads this rather than keeping its own
// list, so a step added here cannot be one the shell forgets to drive.
export const WORKING_STEPS = Object.freeze([
  "SEARCHING", "BOOKING", "RETURN_BOOKING", "CHECKING", "SENDING", "CHANGING", "CLASSIFYING"
]);
export const isWorkingStep = step => WORKING_STEPS.includes(step);

// The steps that mean the patient is done here — nothing is in flight and nothing is owed.
const TERMINAL_STEPS = Object.freeze([
  "BOOKED", "READY", "CONFIRMED", "CHANGED", "CANCELED", "DECLINED", "ESCALATED", "ROUTED"
]);
export const isTerminalStep = step => TERMINAL_STEPS.includes(step);

// The status a step implies. Keeping this as a lookup rather than a field the shell sets means the
// two can never drift: a resolution on OPTIONS is searching_options whoever put it there.
const STATUS_BY_STEP = Object.freeze({
  OFFER: RESOLUTION_STATUS.ASSISTANCE_OFFERED,
  DESCRIBE: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  PICKUP: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  PICKUP_EDIT: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  NEEDS: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  TIME: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  TIME_EDIT: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  NEW_CONTACT: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  CONTACTS: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  SEARCHING: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  CHECKING: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  CLASSIFYING: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  OPTIONS: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  SLOTS: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  ISSUES: RESOLUTION_STATUS.SEARCHING_OPTIONS,
  REVIEW: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  RETURN_OFFER: RESOLUTION_STATUS.RESOLVED,
  RETURN_TIME: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  CANCEL_CONFIRM: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  BOOKING: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  RETURN_BOOKING: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  SENDING: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  CHANGING: RESOLUTION_STATUS.AWAITING_CONFIRMATION,
  SENT: RESOLUTION_STATUS.OPTION_SELECTED,
  GUIDE: RESOLUTION_STATUS.COLLECTING_INFORMATION,
  BOOKED: RESOLUTION_STATUS.RESOLVED,
  READY: RESOLUTION_STATUS.RESOLVED,
  CONFIRMED: RESOLUTION_STATUS.RESOLVED,
  CHANGED: RESOLUTION_STATUS.RESOLVED,
  ROUTED: RESOLUTION_STATUS.PATIENT_ACCEPTED,
  CANCELED: RESOLUTION_STATUS.CANCELLED,
  DECLINED: RESOLUTION_STATUS.CANCELLED,
  DECLINED_BY_CONTACT: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  NO_CONTACT: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  OPTIONS_EMPTY: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  SLOTS_EMPTY: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  NEEDS_UNSUPPORTED: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  BOOKING_FAILED: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  CHANGE_FAILED: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  ESCALATE_OFFER: RESOLUTION_STATUS.NEEDS_CARE_TEAM,
  ESCALATED: RESOLUTION_STATUS.NEEDS_CARE_TEAM
});

export const resolutionStatusForStep = step => STATUS_BY_STEP[step] || RESOLUTION_STATUS.IDENTIFIED;

/* --------------------------------------------------------------------------- the record --- */

const nowIso = at => (at instanceof Date ? at : new Date(at || Date.now())).toISOString();

// A resolution is created the moment the patient taps a barrier, not when they accept help. A
// patient who backs out has still told us something, and §24's "returns to a previously resolved
// barrier" needs a record to return to.
export function createResolution({
  id = "",
  appointmentId = "",
  patientId = "",
  barrierType = "",
  reasonKey = "",
  at = new Date()
} = {}) {
  const type = Object.values(BARRIER_TYPES).includes(barrierType)
    ? barrierType
    : resolutionPlaybookFor(reasonKey);
  if (!type) return null;
  const created = nowIso(at);
  return {
    id: id || `res_${created.replace(/\D/g, "").slice(-12)}_${type}`,
    appointmentId,
    patientId,
    barrierType: type,
    reasonKey: String(reasonKey || "").toUpperCase(),
    resolutionType: resolutionTypeFor(type),
    step: FIRST_STEP[type],
    status: resolutionStatusForStep(FIRST_STEP[type]),
    // Playbook-specific working memory. Every playbook writes only its own keys, and nothing here
    // is ever rendered without going through the view module's escaper.
    data: {},
    careTeamTaskId: "",
    createdAt: created,
    updatedAt: created,
    resolvedAt: ""
  };
}

// The single writer. Steps are validated against the playbook so a typo in a handler cannot put a
// resolution on a step no view knows how to draw — it stays where it was instead.
export function advanceResolution(resolution, step, patch = {}, { at = new Date() } = {}) {
  if (!resolution) return null;
  const steps = RESOLUTION_STEPS[resolution.barrierType] || [];
  const next = steps.includes(step) ? step : resolution.step;
  const status = resolutionStatusForStep(next);
  const stamp = nowIso(at);
  return {
    ...resolution,
    step: next,
    status,
    data: { ...(resolution.data || {}), ...patch },
    updatedAt: stamp,
    resolvedAt: status === RESOLUTION_STATUS.RESOLVED ? resolution.resolvedAt || stamp : resolution.resolvedAt
  };
}

// §23. An event carries what happened and the shape of it, never a street address, a phone number
// or a word the patient typed. `metadata` is for ids, counts and enum values.
export function resolutionEvent(type, { resolution = null, patientId = "", appointmentId = "", metadata = {}, at = new Date() } = {}) {
  const stamp = nowIso(at);
  return Object.freeze({
    id: `evt_${stamp.replace(/\D/g, "").slice(-14)}_${String(type).slice(0, 12)}`,
    timestamp: stamp,
    patientId: patientId || resolution?.patientId || "",
    appointmentId: appointmentId || resolution?.appointmentId || "",
    resolutionId: resolution?.id || "",
    barrierType: resolution?.barrierType || "",
    type,
    metadata: Object.freeze({ ...metadata })
  });
}

/* -------------------------------------------------------- transportation: what EMMI knows -- */

// The special needs the pre-ride question offers. `standardRide: false` is the one fact that
// matters downstream: it means a car pulling up to the curb is not an answer for this patient, and
// EMMI must say so instead of booking one.
export const TRANSPORT_NEEDS = Object.freeze([
  Object.freeze({ id: "NONE", standardRide: true, exclusive: true, seats: 0, label: T("No, none", "No, ninguna", "Non, okenn") }),
  Object.freeze({ id: "CANE_WALKER", standardRide: true, exclusive: false, seats: 0, label: T("I use a cane or walker", "Uso bastón o andador", "Mwen sèvi ak baton oswa machwa") }),
  Object.freeze({ id: "WHEELCHAIR", standardRide: false, exclusive: false, seats: 0, label: T("I use a wheelchair", "Uso silla de ruedas", "Mwen sèvi ak chèz woulant") }),
  Object.freeze({ id: "COMPANION_RIDING", standardRide: true, exclusive: false, seats: 1, label: T("Someone will ride with me", "Viajará alguien conmigo", "Yon moun ap vwayaje avè m") }),
  Object.freeze({ id: "HELP_IN_OUT", standardRide: false, exclusive: false, seats: 0, label: T("I need help getting in or out of the car", "Necesito ayuda para entrar o salir del vehículo", "Mwen bezwen èd pou antre oswa soti nan machin nan") })
]);

export const transportNeedOptions = (locale = "en") =>
  TRANSPORT_NEEDS.map(need => ({ id: need.id, label: L(need.label, locale), exclusive: need.exclusive }));

// "No" cancels everything else and everything else cancels "No", so a patient can never be recorded
// as needing nothing and needing a wheelchair at the same time.
export function toggleTransportNeed(selected = [], id = "") {
  const current = (Array.isArray(selected) ? selected : []).filter(value => TRANSPORT_NEEDS.some(need => need.id === value));
  const option = TRANSPORT_NEEDS.find(need => need.id === id);
  if (!option) return current;
  if (option.exclusive) return current.includes(id) ? [] : [id];
  const without = current.filter(value => value !== id && !TRANSPORT_NEEDS.find(need => need.id === value)?.exclusive);
  return current.includes(id) ? without : [...without, id];
}

// Whether a standard ride is an appropriate offer at all. A wheelchair or a patient who cannot get
// in and out of a car unaided is not "a filter on the search results" — it is the point at which
// EMMI should stop offering and start coordinating. Getting this wrong is the failure mode that
// leaves someone waiting at the curb for a car they cannot use.
export function transportationSuitability(selectedNeeds = []) {
  const needs = (Array.isArray(selectedNeeds) ? selectedNeeds : [])
    .map(id => TRANSPORT_NEEDS.find(need => need.id === id))
    .filter(Boolean);
  const blocking = needs.filter(need => !need.standardRide).map(need => need.id);
  return {
    standardRideAppropriate: blocking.length === 0,
    blockingNeeds: blocking,
    // A companion riding along is a seat, not a refusal. It narrows the options rather than ending
    // the flow, which is why it is counted separately from `blockingNeeds`.
    extraPassengers: needs.reduce((total, need) => total + need.seats, 0),
    accessibilityRequired: blocking.length > 0
  };
}

/* ------------------------------------------------------------------ transportation: time -- */

export const PICKUP_DEFAULTS = Object.freeze({
  arriveEarlyMinutes: 15,
  travelMinutes: 24,
  bufferMinutes: 6
});

// Pickup time is arithmetic on the appointment, not a number a provider invents: arrive early,
// travel, and a buffer for the car being a few minutes late. Rounded down to five minutes because
// "1:59 p.m." reads as a computed number and "2:00 p.m." reads as a plan.
export function recommendedPickupTime(scheduledAt, {
  arriveEarlyMinutes = PICKUP_DEFAULTS.arriveEarlyMinutes,
  travelMinutes = PICKUP_DEFAULTS.travelMinutes,
  bufferMinutes = PICKUP_DEFAULTS.bufferMinutes
} = {}) {
  const start = new Date(scheduledAt || "");
  if (Number.isNaN(start.getTime())) return null;
  const arriveBy = new Date(start.getTime() - arriveEarlyMinutes * 60000);
  const leaveBy = new Date(arriveBy.getTime() - (travelMinutes + bufferMinutes) * 60000);
  const rounded = new Date(leaveBy.getTime() - (leaveBy.getMinutes() % 5) * 60000);
  rounded.setSeconds(0, 0);
  return {
    pickupAt: rounded.toISOString(),
    arriveByAt: arriveBy.toISOString(),
    arriveEarlyMinutes,
    travelMinutes,
    bufferMinutes
  };
}

// The alternative pickup times the patient may choose instead of the recommendation. Offered as
// whole options rather than a time picker, because a spinner at 384px is a worse experience than
// four buttons and because "30 minutes earlier" is what a patient actually means.
export function pickupTimeChoices(recommendedIso, locale = "en") {
  const base = new Date(recommendedIso || "");
  if (Number.isNaN(base.getTime())) return [];
  return [
    { offsetMinutes: -30, label: L(T("30 minutes earlier", "30 minutos antes", "30 minit pi bonè"), locale) },
    { offsetMinutes: -15, label: L(T("15 minutes earlier", "15 minutos antes", "15 minit pi bonè"), locale) },
    { offsetMinutes: 0, label: L(T("The time you suggested", "La hora que sugirió", "Lè ou pwopoze a"), locale) },
    { offsetMinutes: 15, label: L(T("15 minutes later", "15 minutos después", "15 minit pi ta"), locale) }
  ].map(choice => ({
    ...choice,
    id: `PICKUP_${choice.offsetMinutes >= 0 ? "PLUS" : "MINUS"}_${Math.abs(choice.offsetMinutes)}`,
    pickupAt: new Date(base.getTime() + choice.offsetMinutes * 60000).toISOString()
  }));
}

// A return trip has no known end time — the visit runs as long as it runs. "When my visit ends" is
// therefore a real answer and not a cop-out, and it is the default.
export const RETURN_TRIP_CHOICES = Object.freeze([
  Object.freeze({ id: "WHEN_VISIT_ENDS", offsetMinutes: null, label: T("When my visit ends", "Cuando termine mi cita", "Lè vizit mwen fini") }),
  Object.freeze({ id: "PLUS_45", offsetMinutes: 45, label: T("About 45 minutes after it starts", "Unos 45 minutos después de empezar", "Anviwon 45 minit apre li kòmanse") }),
  Object.freeze({ id: "PLUS_90", offsetMinutes: 90, label: T("About an hour and a half after it starts", "Aproximadamente hora y media después de empezar", "Anviwon inè edmi apre li kòmanse") })
]);

export const returnTripChoices = (locale = "en") =>
  RETURN_TRIP_CHOICES.map(choice => ({ id: choice.id, offsetMinutes: choice.offsetMinutes, label: L(choice.label, locale) }));

// The estimated moment a return car should be asked for. "When my visit ends" resolves to the
// appointment's own end time when the record has one, and to a 45-minute visit when it does not —
// stated as an estimate everywhere it is shown, never as a booked time.
export function returnPickupTime(appointment, choiceId = "WHEN_VISIT_ENDS") {
  const start = new Date(appointment?.scheduledAt || "");
  if (Number.isNaN(start.getTime())) return null;
  const choice = RETURN_TRIP_CHOICES.find(item => item.id === choiceId) || RETURN_TRIP_CHOICES[0];
  if (choice.offsetMinutes !== null) return new Date(start.getTime() + choice.offsetMinutes * 60000).toISOString();
  const end = new Date(appointment?.scheduledEndAt || "");
  return Number.isNaN(end.getTime()) ? new Date(start.getTime() + 45 * 60000).toISOString() : end.toISOString();
}

/* ------------------------------------------------------------------------- addresses ------ */

// The patient's home, as the ride flow needs it. Built from whatever the record actually holds; a
// record with no street line has no home address, and the flow asks rather than inventing one.
export function homeAddressFrom(source) {
  if (!source) return null;
  const line1 = String(source.line1 || "").trim();
  if (!line1) return null;
  const unit = String(source.unit || "").trim();
  const city = String(source.city || "").trim();
  const region = String(source.state || "").trim();
  const zip = String(source.zip || "").trim();
  return {
    label: "HOME",
    line1,
    unit,
    city,
    state: region,
    zip,
    formatted: [[line1, unit].filter(Boolean).join(", "), [city, [region, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ")
  };
}

export const ADDRESS_ERRORS = Object.freeze({
  MISSING_STREET: "MISSING_STREET",
  MISSING_CITY: "MISSING_CITY",
  MISSING_ZIP: "MISSING_ZIP",
  BAD_ZIP: "BAD_ZIP"
});

const ADDRESS_ERROR_TEXT = Object.freeze({
  MISSING_STREET: T("Add the street and number.", "Agregue la calle y el número.", "Ajoute ri a ak nimewo a."),
  MISSING_CITY: T("Add the city.", "Agregue la ciudad.", "Ajoute vil la."),
  MISSING_ZIP: T("Add the ZIP code.", "Agregue el código postal.", "Ajoute kòd postal la."),
  BAD_ZIP: T("A ZIP code has five numbers.", "Un código postal tiene cinco números.", "Yon kòd postal gen senk chif.")
});

export const addressErrorText = (code, locale = "en") => L(ADDRESS_ERROR_TEXT[code] || "", locale);

// Simulated validation, and honest about it: it checks the shape of what was typed and nothing
// else. There is no geocoder here, so it never claims an address exists.
export function validateAddress(input = {}) {
  const line1 = String(input.line1 || "").trim();
  const city = String(input.city || "").trim();
  const zip = String(input.zip || "").trim();
  const errors = [];
  if (line1.length < 4) errors.push(ADDRESS_ERRORS.MISSING_STREET);
  if (!city) errors.push(ADDRESS_ERRORS.MISSING_CITY);
  if (!zip) errors.push(ADDRESS_ERRORS.MISSING_ZIP);
  else if (!/^\d{5}(-\d{4})?$/.test(zip)) errors.push(ADDRESS_ERRORS.BAD_ZIP);
  if (errors.length) return { ok: false, errors };
  const region = String(input.state || "").trim().toUpperCase();
  const unit = String(input.unit || "").trim();
  return {
    ok: true,
    address: {
      label: "OTHER",
      line1,
      unit,
      city,
      state: region,
      zip,
      formatted: [[line1, unit].filter(Boolean).join(", "), [city, [region, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ")
    }
  };
}

/* ----------------------------------------------------------------- "something else" ------- */

// A keyword classifier, deliberately small and deliberately replaceable. The contract is the return
// shape — { barrierType, confidence, matched } — so an LLM can be dropped in behind
// classifyResolutionIntent() without a single resolution component changing.
//
// Rules, not scores: each pattern is a phrase a patient actually says in one of the three
// languages this product speaks, and it maps to a playbook that can finish.
const INTENT_RULES = Object.freeze([
  Object.freeze({ barrierType: BARRIER_TYPES.TRANSPORTATION, weight: 3, patterns: [
    /\b(no tengo|sin)\s+(carro|coche|auto|carr[oó]|transporte|veh[ií]culo)/i,
    /\bno\s+(tengo|puedo)\s+c[oó]mo\s+llegar/i,
    /\b(no|don'?t)\s+have\s+(a\s+)?(car|ride|way to get)/i,
    /\b(ride|lift|transportation|transporte|taxi|uber|bus|autob[uú]s|guagua|machin|taksi)\b/i,
    /\bcan'?t\s+(get|drive)\s+(there|to)/i,
    /\bmwen\s+pa\s+gen\s+(machin|transp[oò])/i
  ] }),
  Object.freeze({ barrierType: BARRIER_TYPES.COMPANION, weight: 3, patterns: [
    /\b(mi|my)\s+(hija|hijo|daughter|son|esposa|esposo|wife|husband|pitit)\b[^.]{0,40}\b(no puede|can'?t|cannot|pa ka)\b/i,
    /\b(alguien|someone|yon moun)\b[^.]{0,30}\b(acompa[nñ]e|come with|vin avè)/i,
    /\b(nadie|no one|nobody|p[eè]son)\b[^.]{0,30}\b(puede|can|ka)\b/i,
    /\bir\s+sola?\b|\bgo\s+alone\b|\bsolo\s+no\b/i
  ] }),
  Object.freeze({ barrierType: BARRIER_TYPES.VIDEO_VISIT, weight: 3, patterns: [
    /\b(no s[eé]|don'?t know|pa konnen)\b[^.]{0,30}\b(usar|use|c[aá]mara|camera|video|videyo|link|enlace|zoom|app|aplicaci[oó]n)/i,
    /\b(c[aá]mara|camera|micr[oó]fono|microphone|mikwo|videollamada|video visit|vizit videyo)\b/i,
    /\b(mi (tel[eé]fono|celular)|my phone)\b[^.]{0,30}\b(no|not|pa)\b/i,
    /\binternet\b|\bwifi\b|\bwi-?fi\b/i
  ] }),
  Object.freeze({ barrierType: BARRIER_TYPES.RESCHEDULE, weight: 3, patterns: [
    /\bno\s+puedo\s+a\s+esa\s+hora\b/i,
    /\b(otra|other|another)\s+(hora|fecha|d[ií]a|time|day|date)\b/i,
    /\b(cambiar|change|move|mover|chanje)\b[^.]{0,25}\b(hora|cita|fecha|time|appointment|date|randevou|l[eè])/i,
    /\b(trabajo|work|working|travay)\b[^.]{0,30}\b(esa hora|that time|no puedo|can'?t)/i,
    /\bcan'?t\s+make\s+(it|that)\b/i
  ] })
]);

// A single strong phrase is enough — a patient writing "no tengo carro" has told us exactly what
// they need. Two matching rules for different barriers means neither is confident, because acting
// on the wrong one wastes the patient's time and teaches them the assistant does not listen.
export function classifyResolutionIntent(text = "") {
  // Speech transcription and iOS keyboards both produce curly apostrophes. Folded once here rather
  // than every pattern carrying two spellings of "don't" — the same move src/goalBarriers.js makes.
  const value = String(text || "").replace(/[‘’ʼ]/g, "'").trim();
  if (value.length < 3) return { barrierType: "", confidence: 0, matched: [] };
  const scores = INTENT_RULES.map(rule => ({
    barrierType: rule.barrierType,
    hits: rule.patterns.filter(pattern => pattern.test(value)).length,
    weight: rule.weight
  })).filter(entry => entry.hits > 0);
  if (!scores.length) return { barrierType: "", confidence: 0, matched: [] };
  const ranked = [...scores].sort((a, b) => b.hits - a.hits);
  const top = ranked[0];
  const runnerUp = ranked[1];
  // Two barriers tied means the sentence genuinely names both ("my daughter can't drive me") — and
  // the honest move there is to take the one the patient can act on now, which is the higher rule
  // in declaration order, not to guess between them silently at high confidence.
  const contested = runnerUp && runnerUp.hits === top.hits;
  const confidence = Math.min(1, (top.hits * top.weight) / 4) * (contested ? 0.5 : 1);
  return {
    barrierType: confidence >= 0.5 ? top.barrierType : "",
    candidate: top.barrierType,
    confidence: Number(confidence.toFixed(2)),
    matched: ranked.map(entry => entry.barrierType)
  };
}

/* ------------------------------------------------------------- appointment readiness ------ */

export const READINESS_ITEMS = Object.freeze({
  APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
  TRANSPORTATION: "TRANSPORTATION",
  COMPANION: "COMPANION",
  VIDEO_READINESS: "VIDEO_READINESS"
});

const READINESS_STATE = Object.freeze({
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  NEEDS_CARE_TEAM: "NEEDS_CARE_TEAM",
  NOT_NEEDED: "NOT_NEEDED"
});
export const READINESS_STATES = READINESS_STATE;

const readinessStateFor = resolution => {
  if (!resolution) return READINESS_STATE.NOT_NEEDED;
  if (resolution.status === RESOLUTION_STATUS.RESOLVED) return READINESS_STATE.READY;
  if (resolution.status === RESOLUTION_STATUS.NEEDS_CARE_TEAM) return READINESS_STATE.NEEDS_CARE_TEAM;
  if (resolution.status === RESOLUTION_STATUS.CANCELLED) return READINESS_STATE.NOT_NEEDED;
  return READINESS_STATE.IN_PROGRESS;
};

// What is settled for this visit and what is not. Only items the patient actually raised appear:
// a readiness panel that lists transportation for someone who drives themselves invents a problem,
// and §10 asks for compact status rather than a wall of badges.
//
// "appointmentConfirmed" is the one item that is always present, because every other item is
// arranged around a time — and a time that is not confirmed cannot be arranged around.
export function appointmentReadiness({ appointment = null, resolutions = [], locale = "en" } = {}) {
  const list = (Array.isArray(resolutions) ? resolutions : []).filter(item => item?.appointmentId === appointment?.id);
  const latest = type => [...list].filter(item => item.barrierType === type)
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt))).at(-1) || null;

  const confirmed = appointment?.status === "CONFIRMED" && Boolean(appointment?.scheduledAt);
  const transportation = latest(BARRIER_TYPES.TRANSPORTATION);
  const companion = latest(BARRIER_TYPES.COMPANION);
  const video = latest(BARRIER_TYPES.VIDEO_VISIT);
  const reschedule = latest(BARRIER_TYPES.RESCHEDULE);
  const other = latest(BARRIER_TYPES.OTHER);

  const items = [
    {
      id: READINESS_ITEMS.APPOINTMENT_CONFIRMED,
      state: confirmed ? READINESS_STATE.READY : READINESS_STATE.IN_PROGRESS,
      label: confirmed
        ? L(T("Appointment confirmed", "Cita confirmada", "Randevou konfime"), locale)
        : L(T("Appointment not confirmed yet", "Cita todavía sin confirmar", "Randevou poko konfime"), locale),
      detail: ""
    },
    transportation ? {
      id: READINESS_ITEMS.TRANSPORTATION,
      state: readinessStateFor(transportation),
      label: readinessStateFor(transportation) === READINESS_STATE.READY
        ? L(T("Transportation arranged", "Transporte organizado", "Transpò òganize"), locale)
        : readinessStateFor(transportation) === READINESS_STATE.NEEDS_CARE_TEAM
          ? L(T("Your care team is arranging your ride", "Su equipo de cuidado está organizando su viaje", "Ekip swen ou ap òganize vwayaj ou"), locale)
          : L(T("Arranging transportation", "Organizando el transporte", "N ap òganize transpò a"), locale),
      detail: transportation.data?.reservation
        ? [transportation.data.reservation.serviceName, transportation.data.reservation.pickupLabel].filter(Boolean).join(" · ")
        : ""
    } : null,
    companion ? {
      id: READINESS_ITEMS.COMPANION,
      state: readinessStateFor(companion),
      label: readinessStateFor(companion) === READINESS_STATE.READY && companion.data?.contactName
        ? L(
          T(`${companion.data.contactName} is coming with you`, `${companion.data.contactName} le acompañará`, `${companion.data.contactName} ap vin avè w`),
          locale
        )
        : readinessStateFor(companion) === READINESS_STATE.NEEDS_CARE_TEAM
          ? L(T("Your care team is helping find someone", "Su equipo de cuidado busca a alguien", "Ekip swen ou ap chèche yon moun"), locale)
          : L(T("Waiting on an answer about company", "Esperando respuesta sobre el acompañamiento", "N ap tann repons sou akonpayman an"), locale),
      detail: ""
    } : null,
    video ? {
      id: READINESS_ITEMS.VIDEO_READINESS,
      state: readinessStateFor(video),
      label: readinessStateFor(video) === READINESS_STATE.READY
        ? L(T("Your device is ready for the video visit", "Su dispositivo está listo para la visita por video", "Aparèy ou pare pou vizit videyo a"), locale)
        : readinessStateFor(video) === READINESS_STATE.NEEDS_CARE_TEAM
          ? L(T("Your care team is helping with the video visit", "Su equipo de cuidado le ayuda con la visita por video", "Ekip swen ou ap ede w ak vizit videyo a"), locale)
          : L(T("Checking your device", "Revisando su dispositivo", "N ap tcheke aparèy ou"), locale),
      detail: ""
    } : null
  ].filter(Boolean);

  // A reschedule and a "something else" are worked on, not arranged around; they belong in the
  // outstanding count rather than as their own readiness row, so the panel keeps the four lines
  // §9 asks for instead of growing one per barrier.
  const openExtras = [reschedule, other].filter(item => item
    && item.status !== RESOLUTION_STATUS.RESOLVED
    && item.status !== RESOLUTION_STATUS.CANCELLED);

  const unresolved = items.filter(item => item.state === READINESS_STATE.IN_PROGRESS || item.state === READINESS_STATE.NEEDS_CARE_TEAM).length + openExtras.length;
  return {
    appointmentId: appointment?.id || "",
    appointmentConfirmed: confirmed,
    items,
    unresolvedCount: unresolved,
    ready: unresolved === 0,
    summary: unresolved === 0
      ? L(T("Ready for your appointment", "Todo listo para su cita", "Tout bagay pare pou randevou ou"), locale)
      : unresolved === 1
        ? L(T("1 thing left to sort out", "1 cosa por resolver", "1 bagay ki rete pou regle"), locale)
        : L(
          T(`${unresolved} things left to sort out`, `${unresolved} cosas por resolver`, `${unresolved} bagay ki rete pou regle`),
          locale
        )
  };
}

/* ------------------------------------------------------- barrier status on the list ------- */

const BARRIER_STATE_TEXT = Object.freeze({
  RESOLVED: Object.freeze({
    [BARRIER_TYPES.TRANSPORTATION]: T("Arranged", "Coordinado", "Òganize"),
    [BARRIER_TYPES.VIDEO_VISIT]: T("All set", "Todo listo", "Tout bagay pare"),
    [BARRIER_TYPES.COMPANION]: T("Confirmed", "Confirmado", "Konfime"),
    [BARRIER_TYPES.RESCHEDULE]: T("Time changed", "Hora cambiada", "Lè chanje"),
    [BARRIER_TYPES.OTHER]: T("Sorted", "Resuelto", "Regle")
  }),
  IN_PROGRESS: T("In progress", "En progreso", "An kou"),
  NEEDS_CARE_TEAM: T("Help requested", "Ayuda solicitada", "Èd mande")
});

// §10. One short state per barrier, never a badge stack. A resolution the patient walked away from
// reads as in progress, because it is: they can come back to exactly where they stopped.
export function barrierListState(resolution, locale = "en") {
  if (!resolution) return null;
  if (resolution.status === RESOLUTION_STATUS.CANCELLED) return null;
  if (resolution.status === RESOLUTION_STATUS.RESOLVED) {
    const name = resolution.barrierType === BARRIER_TYPES.COMPANION && resolution.data?.contactName
      ? L(T(`${resolution.data.contactName} confirmed`, `${resolution.data.contactName} confirmó`, `${resolution.data.contactName} konfime`), locale)
      : L(BARRIER_STATE_TEXT.RESOLVED[resolution.barrierType] || BARRIER_STATE_TEXT.RESOLVED[BARRIER_TYPES.OTHER], locale);
    return { tone: "CONFIRMED", icon: "check", label: name };
  }
  if (resolution.status === RESOLUTION_STATUS.NEEDS_CARE_TEAM) {
    return { tone: "WAITING", icon: "people", label: L(BARRIER_STATE_TEXT.NEEDS_CARE_TEAM, locale) };
  }
  return { tone: "WAITING", icon: "clock", label: L(BARRIER_STATE_TEXT.IN_PROGRESS, locale) };
}

/* ------------------------------------------------------------------------ care team ------- */

// §11. The task a care team picks up when EMMI could not finish. It is deliberately the same shape
// as the appointment-request task the shell already queues, with the barrier named, so nothing
// downstream needs a second queue to read.
export function careTeamAssistanceRequest({
  resolution = null,
  appointmentId = "",
  patientId = "",
  reason = "",
  priority = "ROUTINE",
  at = new Date()
} = {}) {
  const stamp = nowIso(at);
  return {
    id: `barrier_task_${stamp.replace(/\D/g, "").slice(-12)}`,
    type: "APPOINTMENT_BARRIER",
    barrierType: resolution?.barrierType || "",
    resolutionId: resolution?.id || "",
    appointmentId: appointmentId || resolution?.appointmentId || "",
    patientId: patientId || resolution?.patientId || "",
    // Why EMMI stopped, as an enum. It is the difference between "no cars available" and "this
    // patient cannot use a standard car", and a care team needs to know which one it is.
    reason: String(reason || "EMMI_COULD_NOT_RESOLVE"),
    priority: priority === "PRIORITY" ? "PRIORITY" : "ROUTINE",
    status: "OPEN",
    createdAt: stamp
  };
}

/* ---------------------------------------------------------------------- EMMI's voice ------ */

// Every line EMMI says inside a resolution. Kept here rather than in the view module for one
// reason: §18 asks that these flows be drivable by voice later, and a spoken flow needs the same
// sentences the screen shows. A view holding its own copy would drift from what EMMI says out loud.
const SPEECH = Object.freeze({
  TRANSPORTATION_OFFER: T(
    "I can help with that. I can arrange a ride so you get to your appointment.",
    "Puedo ayudarle con eso. Puedo coordinar un viaje para que llegue a su cita.",
    "Mwen ka ede w ak sa. Mwen ka òganize yon vwayaj pou w rive nan randevou ou."
  ),
  TRANSPORTATION_ASK: T(
    "Would you like me to look for transportation options?",
    "¿Quiere que busque opciones de transporte?",
    "Èske ou vle m chèche opsyon transpò?"
  ),
  TRANSPORTATION_SEARCHING: T(
    "Looking for transportation options…",
    "Buscando opciones de transporte…",
    "N ap chèche opsyon transpò…"
  ),
  TRANSPORTATION_REVIEW: T(
    "Check the details before I book it.",
    "Revise los detalles antes de que lo reserve.",
    "Gade detay yo anvan m rezève l."
  ),
  TRANSPORTATION_UNSUPPORTED: T(
    "A standard ride may not be right for you. I can ask your care team to arrange the right kind of transportation.",
    "Un viaje estándar podría no ser adecuado para usted. Puedo pedirle a su equipo de cuidado que organice el transporte adecuado.",
    "Yon vwayaj estanda ka pa bon pou ou. Mwen ka mande ekip swen ou òganize bon kalite transpò a."
  ),
  VIDEO_OFFER: T(
    "I can help you check that your phone is ready for the visit.",
    "Puedo ayudarle a comprobar que su teléfono está listo para la visita.",
    "Mwen ka ede w tcheke si telefòn ou pare pou vizit la."
  ),
  VIDEO_READY: T(
    "Everything is ready for your visit.",
    "Todo está listo para su visita.",
    "Tout bagay pare pou vizit ou."
  ),
  COMPANION_OFFER: T(
    "I can help you arrange that.",
    "Puedo ayudarle a coordinarlo.",
    "Mwen ka ede w òganize sa."
  ),
  COMPANION_ASK: T(
    "Is there someone who usually comes with you to your appointments?",
    "¿Hay alguien que normalmente le acompañe a sus citas?",
    "Èske gen yon moun ki konn vin avè w nan randevou ou yo?"
  ),
  RESCHEDULE_OFFER: T(
    "Of course. I can look for other times for your appointment.",
    "Claro. Puedo buscar otros horarios para su cita.",
    "Byen sûr. Mwen ka chèche lòt lè pou randevou ou."
  ),
  RESCHEDULE_SEARCHING: T(
    "Looking for available times…",
    "Buscando horarios disponibles…",
    "N ap chèche lè ki disponib…"
  ),
  OTHER_ASK: T(
    "Tell me what could make your visit difficult.",
    "Cuénteme qué podría dificultar su visita.",
    "Di m kisa ki ka fè vizit ou difisil."
  ),
  CARE_TEAM_OFFER: T(
    "I can ask your care team to help you with this.",
    "Puedo pedirle a su equipo de cuidado que le ayude con esto.",
    "Mwen ka mande ekip swen ou ede w ak sa."
  ),
  CARE_TEAM_DONE: T(
    "I let your care team know.",
    "Le avisamos a su equipo de cuidado.",
    "Nou fè ekip swen ou konnen."
  ),
  ALL_SET: T(
    "Perfect. Everything looks ready for your visit.",
    "Perfecto. Todo parece estar listo para su visita.",
    "Bon. Tout bagay sanble pare pou vizit ou."
  )
});

export const resolutionSpeech = (key, locale = "en") => L(SPEECH[key] || "", locale);
export const RESOLUTION_SPEECH_KEYS = Object.freeze(Object.keys(SPEECH));
