// Before anything is offered to a patient, one question has to be answered honestly: can this
// actually be scheduled, and by whom? Not every office has the same integration, and the product
// that pretends otherwise is the product that tells a 78-year-old her cardiology appointment is
// booked when nobody has been told about it.
//
// This module owns that answer, and it owns availability. Slots exist only where a real booking
// channel exists; everywhere else the patient is told the truth and offered the next real step.
// The prototype data here is deterministic and tagged as prototype config, so nothing downstream
// can mistake it for a live calendar.

import { APPOINTMENT_MODALITY, APPOINTMENT_STATUS, TIME_OF_DAY } from "./appointments.js";

const MINUTE_MS = 60 * 1000;
const SLOT_SOURCE = "PROTOTYPE_CONFIG";
const SLOT_MINUTES = 30;
const SLOT_HOLD_MINUTES = 30;
const SEARCH_WINDOW_DAYS = 14;
const MAX_BOOKABLE_SLOTS = 5;

// The four honest answers to "can ITERA coordinate this?". Everything the patient is shown, and
// every fallback they are offered, follows from which one of these came back.
export const SCHEDULING_CAPABILITY = Object.freeze({
  DIRECT_BOOKING: "DIRECT_BOOKING",
  STRUCTURED_REQUEST: "STRUCTURED_REQUEST",
  HUMAN_COORDINATION: "HUMAN_COORDINATION",
  NO_AVAILABLE_CHANNEL: "NO_AVAILABLE_CHANNEL"
});

// Prototype directory ids, exported so the shell and the tests name the same fixtures rather than
// hard-coding strings in four places.
export const PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID = "dr-fresner";
// These records exercise request-only and human-coordination contracts without appearing in the
// demo patient's care team. Every professional shown to that patient has a connected calendar.
export const PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID = "provider-structured-request";
export const PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID = "provider-human-coordination";
// §23 has to be provable: one provider the platform genuinely cannot coordinate with.
export const PROTOTYPE_NO_CHANNEL_PROVIDER_ID = "provider-no-scheduling-channel";

const ALL_MODALITIES = Object.freeze([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH, APPOINTMENT_MODALITY.PHONE]);

// The prototype's scheduling directory. In production this is whatever the integration layer
// reports per practice; the shape is the same, and so is the rule that an unlisted provider gets
// a person rather than a fabricated calendar.
const PROVIDER_SCHEDULING = Object.freeze({
  [PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID]: Object.freeze({
    capability: SCHEDULING_CAPABILITY.DIRECT_BOOKING,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH, APPOINTMENT_MODALITY.PHONE]),
    locationName: "Fresner Medical Group"
  }),
  "dr-martinez-cardiology": Object.freeze({
    capability: SCHEDULING_CAPABILITY.DIRECT_BOOKING,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH]),
    locationName: "Coral Gables Cardiology"
  }),
  "itera-care-manager": Object.freeze({
    capability: SCHEDULING_CAPABILITY.DIRECT_BOOKING,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.PHONE, APPOINTMENT_MODALITY.TELEHEALTH]),
    locationName: ""
  }),
  [PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID]: Object.freeze({
    capability: SCHEDULING_CAPABILITY.STRUCTURED_REQUEST,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH]),
    locationName: ""
  }),
  [PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID]: Object.freeze({
    capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.PHONE, APPOINTMENT_MODALITY.TELEHEALTH]),
    locationName: ""
  }),
  [PROTOTYPE_NO_CHANNEL_PROVIDER_ID]: Object.freeze({
    capability: SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL,
    supportedModalities: Object.freeze([]),
    locationName: ""
  })
});

const PRACTICE_SCHEDULING = Object.freeze({
  "fresner-medical-group": Object.freeze({
    capability: SCHEDULING_CAPABILITY.DIRECT_BOOKING,
    supportedModalities: Object.freeze([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH, APPOINTMENT_MODALITY.PHONE]),
    locationName: "Fresner Medical Group"
  })
});

const directoryEntry = (providerId, practiceId) =>
  PROVIDER_SCHEDULING[providerId] || PRACTICE_SCHEDULING[practiceId] || null;

// The resolver every flow calls first. It never guesses upward: an unknown provider resolves to
// human coordination, because a care manager can always pick up a phone, and never to direct
// booking, because a calendar we do not have cannot be searched.
// eslint-disable-next-line no-unused-vars
export function resolveSchedulingCapability({ patientId = "", providerId = "", practiceId = "", appointmentType = "" } = {}) {
  if (!providerId && !practiceId) {
    return { capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION, supportedModalities: [], reason: "NO_PROVIDER_RESOLVED", source: SLOT_SOURCE };
  }
  const entry = directoryEntry(providerId, practiceId);
  if (!entry) {
    return { capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION, supportedModalities: [], reason: "PROVIDER_NOT_IN_SCHEDULING_DIRECTORY", source: SLOT_SOURCE };
  }
  return {
    capability: entry.capability,
    supportedModalities: [...entry.supportedModalities],
    reason: entry.capability === SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL ? "NO_SCHEDULING_CHANNEL" : "DIRECTORY_MATCH",
    source: SLOT_SOURCE
  };
}

// ---------------------------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------------------------

// Deterministic, so the same provider on the same day offers the same times to the patient, to the
// care team looking at the same screen, and to the test suite.
const seedOf = value => {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const TIME_BUCKETS = Object.freeze({
  MORNING: Object.freeze([9, 10, 11]),
  AFTERNOON: Object.freeze([13, 14, 15, 16]),
  EVENING: Object.freeze([17, 18]),
  NO_PREFERENCE: Object.freeze([9, 11, 14, 16, 18])
});

// Slot ids carry everything a booking call needs to verify them: which provider, when, how long,
// which modality, when the hold expires, and whether this is the fixture that proves a slot can
// vanish. No hidden server state, and nothing a caller can rewrite into a different appointment
// without it being obvious.
const SLOT_PREFIX = "apt";
const SLOT_TAG = Object.freeze({ OPEN: "OPEN", STALE: "STALE" });
const safeId = value => String(value || "").replace(/\|/g, "-");

const encodeSlotId = ({ providerId, startMs, minutes, modality, expiresMs, tag }) =>
  [SLOT_PREFIX, safeId(providerId), startMs, minutes, modality, expiresMs, tag].join("|");

export function decodeSlotId(slotId) {
  const parts = String(slotId || "").split("|");
  if (parts.length !== 7 || parts[0] !== SLOT_PREFIX) return null;
  const [, providerId, startMs, minutes, modality, expiresMs, tag] = parts;
  if (!Number.isFinite(Number(startMs)) || !Number.isFinite(Number(expiresMs))) return null;
  return { providerId, startMs: Number(startMs), minutes: Number(minutes), modality, expiresMs: Number(expiresMs), tag };
}

// §124 made provable: one slot in every availability response is a slot the office will say is
// gone. It is placed last, so the two or three cards a patient sees first are real ones.
export const isPrototypeStaleSlot = slotId => decodeSlotId(slotId)?.tag === SLOT_TAG.STALE;

// The stale fixture exists to prove that the booking flow handles a real race safely, but it is not
// availability an assistant may promise to a patient. Conversational surfaces use this filter so
// every time they name carries a live hold and can be booked when the patient confirms it.
export const reservableAvailabilitySlots = (slots, now = new Date()) => (Array.isArray(slots) ? slots : [])
  .filter(slot => slot?.slotId && !isPrototypeStaleSlot(slot.slotId) && new Date(slot.expiresAt).getTime() > new Date(now).getTime());

const buildSlot = ({ providerId, start, minutes, modality, locationName, expiresMs, tag }) => {
  const startMs = start.getTime();
  return {
    slotId: encodeSlotId({ providerId, startMs, minutes, modality, expiresMs, tag }),
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(startMs + minutes * MINUTE_MS).toISOString(),
    modality,
    providerId,
    // Only in-person visits have somewhere to go. A telehealth slot does not invent an address,
    // and no slot ever invents a join link.
    locationName: modality === APPOINTMENT_MODALITY.IN_PERSON ? locationName || "" : "",
    expiresAt: new Date(expiresMs).toISOString()
  };
};

const withinRange = (start, range) => {
  if (!range) return true;
  const from = range.from ? new Date(range.from).getTime() : null;
  const to = range.to ? new Date(range.to).getTime() : null;
  if (from !== null && Number.isFinite(from) && start.getTime() < from) return false;
  if (to !== null && Number.isFinite(to) && start.getTime() > to) return false;
  return true;
};

// Availability comes only from a provider whose directory entry says a calendar exists. Everything
// else — a request-only office, a practice we can only phone, a provider we cannot reach at all —
// returns no availability source rather than a plausible-looking list of times.
export function getProviderAvailability({ providerId = "", practiceId = "", preferredTimeOfDay = TIME_OF_DAY.NO_PREFERENCE, preferredDateRange = null, modality = "", now = new Date() } = {}) {
  const resolved = resolveSchedulingCapability({ providerId, practiceId });
  if (resolved.capability !== SCHEDULING_CAPABILITY.DIRECT_BOOKING) {
    return { ok: false, error: "NO_AVAILABILITY_SOURCE" };
  }
  const entry = directoryEntry(providerId, practiceId);
  const wantsModality = modality && modality !== APPOINTMENT_MODALITY.NO_PREFERENCE ? modality : "";
  const supportedPreference = wantsModality && entry.supportedModalities.includes(wantsModality) ? wantsModality : "";

  const from = new Date(now);
  const bucket = TIME_BUCKETS[preferredTimeOfDay] || TIME_BUCKETS.NO_PREFERENCE;
  const expiresMs = from.getTime() + SLOT_HOLD_MINUTES * MINUTE_MS;
  // An unsupported modality narrows the explanation, not the calendar to zero. Returning the
  // provider's real alternatives lets EMMI say, for example, that this care manager has phone and
  // video times instead of incorrectly claiming no availability exists.
  const offeredModalities = supportedPreference ? [supportedPreference] : entry.supportedModalities.filter(item => ALL_MODALITIES.includes(item));
  const slots = [];

  for (let offset = 1; offset <= SEARCH_WINDOW_DAYS && slots.length < MAX_BOOKABLE_SLOTS; offset += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
    // Offices keep office days. A prototype that offers Sunday at 9am reads as fake immediately.
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const seed = seedOf(`${providerId}:${day.toDateString()}`);
    if (seed % 3 === 0) continue;
    const hour = bucket[seed % bucket.length];
    const minute = [0, 15, 30, 45][(seed >>> 3) % 4];
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
    if (!withinRange(start, preferredDateRange)) continue;
    slots.push(buildSlot({
      providerId,
      start,
      minutes: SLOT_MINUTES,
      modality: offeredModalities[(seed >>> 5) % offeredModalities.length] || APPOINTMENT_MODALITY.IN_PERSON,
      locationName: entry.locationName,
      expiresMs,
      tag: SLOT_TAG.OPEN
    }));
  }

  if (!slots.length) return { ok: false, error: "AVAILABILITY_UNAVAILABLE" };

  // The designated fixture slot, always last: the one the office will have already given away. It
  // sits on the same day as a real slot, so it never falls outside the window the patient asked
  // for — a slot that vanishes has to look exactly like a slot that does not.
  const staleSeed = seedOf(`${providerId}:stale:${from.toDateString()}`);
  const staleDay = new Date(slots.at(-1).startAt);
  const staleHour = bucket[(staleSeed + 1) % bucket.length] === staleDay.getHours() ? bucket[(staleSeed + 2) % bucket.length] : bucket[(staleSeed + 1) % bucket.length];
  const staleStart = new Date(staleDay.getFullYear(), staleDay.getMonth(), staleDay.getDate(), staleHour, 30, 0, 0);
  slots.push(buildSlot({
    providerId,
    start: staleStart,
    minutes: SLOT_MINUTES,
    modality: offeredModalities[0] || APPOINTMENT_MODALITY.IN_PERSON,
    locationName: entry.locationName,
    expiresMs,
    tag: SLOT_TAG.STALE
  }));

  return { ok: true, slots, source: SLOT_SOURCE, preferenceAdjusted: Boolean(wantsModality && !supportedPreference) };
}

// ---------------------------------------------------------------------------------------------
// Booking and requesting
// ---------------------------------------------------------------------------------------------

const confirmationNumberFor = slotId => `ITERA-${seedOf(slotId).toString(36).toUpperCase().padStart(7, "0").slice(-7)}`;

// The only call that may produce a confirmation, and it produces one only when the slot it was
// given is a real, current slot for this appointment's provider. Every other outcome is a failure
// with a reason — never a success with a caveat.
export function bookSlot({ appointment = null, slotId = "", idempotencyKey = "", now = new Date() } = {}) {
  if (!appointment || !slotId) return { ok: false, error: "MISSING_INPUT" };

  // A second tap on the same button is the same booking. It returns what the first one produced,
  // never a second appointment.
  if (idempotencyKey && appointment.idempotencyKey === idempotencyKey && appointment.status === APPOINTMENT_STATUS.CONFIRMED && appointment.confirmationNumber) {
    return {
      ok: true,
      status: APPOINTMENT_STATUS.CONFIRMED,
      confirmationNumber: appointment.confirmationNumber,
      scheduledAt: appointment.scheduledAt,
      scheduledEndAt: appointment.scheduledEndAt,
      modality: appointment.modality,
      locationName: appointment.locationName,
      idempotent: true
    };
  }

  const providerId = appointment.requestedProfessionalId || "";
  const practiceId = String(appointment.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const resolved = resolveSchedulingCapability({ providerId, practiceId });
  if (resolved.capability !== SCHEDULING_CAPABILITY.DIRECT_BOOKING) return { ok: false, error: "NO_BOOKING_CHANNEL" };

  const slot = decodeSlotId(slotId);
  if (!slot || slot.providerId !== safeId(providerId)) return { ok: false, error: "SLOT_NOT_FOUND" };

  // §124. The patient did nothing wrong; the time is simply no longer there.
  if (slot.tag === SLOT_TAG.STALE) return { ok: false, slotGone: true };
  if (new Date(now).getTime() > slot.expiresMs) return { ok: false, slotGone: true };

  const entry = directoryEntry(providerId, practiceId);
  return {
    ok: true,
    status: APPOINTMENT_STATUS.CONFIRMED,
    confirmationNumber: confirmationNumberFor(slotId),
    scheduledAt: new Date(slot.startMs).toISOString(),
    scheduledEndAt: new Date(slot.startMs + slot.minutes * MINUTE_MS).toISOString(),
    modality: slot.modality,
    locationName: slot.modality === APPOINTMENT_MODALITY.IN_PERSON ? entry?.locationName || "" : ""
  };
}

// A request is not an appointment, and this function is careful never to look like one. It returns
// REQUEST_SENT — the office has been asked — and nothing about a time.
export function submitAppointmentRequest({ appointment = null, idempotencyKey = "", now = new Date() } = {}) {
  if (!appointment) return { ok: false, error: "MISSING_INPUT" };

  if (idempotencyKey && appointment.idempotencyKey === idempotencyKey && appointment.requestSentAt) {
    return { ok: true, status: APPOINTMENT_STATUS.REQUEST_SENT, requestSentAt: appointment.requestSentAt, idempotent: true };
  }

  const resolved = resolveSchedulingCapability({
    providerId: appointment.requestedProfessionalId || "",
    practiceId: String(appointment.practiceName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    appointmentType: appointment.reasonCategory || ""
  });
  if (resolved.capability === SCHEDULING_CAPABILITY.DIRECT_BOOKING) return { ok: false, error: "USE_DIRECT_BOOKING" };
  // A practice we can only reach through a person does not receive a structured request. The care
  // team task is the real next step, and the patient is told that in those words.
  if (resolved.capability === SCHEDULING_CAPABILITY.HUMAN_COORDINATION) return { ok: false, error: "REQUIRES_HUMAN_COORDINATION" };
  if (resolved.capability === SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL) return { ok: false, error: "NO_AVAILABLE_CHANNEL" };

  return { ok: true, status: APPOINTMENT_STATUS.REQUEST_SENT, requestSentAt: new Date(now).toISOString() };
}
