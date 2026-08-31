import { describe, expect, it } from "vitest";
import {
  PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID,
  PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID,
  PROTOTYPE_NO_CHANNEL_PROVIDER_ID,
  PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID,
  SCHEDULING_CAPABILITY,
  bookSlot,
  decodeSlotId,
  getProviderAvailability,
  isPrototypeStaleSlot,
  reservableAvailabilitySlots,
  resolveSchedulingCapability,
  submitAppointmentRequest
} from "../src/schedulingCapability.js";
import {
  APPOINTMENT_MODALITY,
  APPOINTMENT_REASON_CATEGORIES,
  APPOINTMENT_STATUS,
  TIME_OF_DAY,
  appointmentIdempotencyKey,
  createAppointmentNeed
} from "../src/appointments.js";

const NOW = new Date("2026-08-27T12:00:00.000Z");

const need = (overrides = {}) => createAppointmentNeed({
  id: "appointment_1",
  patientId: "patient_demo",
  requestedProfessionalId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID,
  reasonCategory: APPOINTMENT_REASON_CATEGORIES.ROUTINE_FOLLOW_UP,
  now: NOW.toISOString(),
  ...overrides
});

const openSlots = result => result.slots.filter(slot => !isPrototypeStaleSlot(slot.slotId));

describe("resolving whether this can be scheduled at all", () => {
  it("resolves all four capability levels from the directory", () => {
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID }).capability).toBe(SCHEDULING_CAPABILITY.DIRECT_BOOKING);
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID }).capability).toBe(SCHEDULING_CAPABILITY.STRUCTURED_REQUEST);
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID }).capability).toBe(SCHEDULING_CAPABILITY.HUMAN_COORDINATION);
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_NO_CHANNEL_PROVIDER_ID })).toMatchObject({
      capability: SCHEDULING_CAPABILITY.NO_AVAILABLE_CHANNEL,
      supportedModalities: [],
      reason: "NO_SCHEDULING_CHANNEL"
    });
  });

  it("tags every answer as prototype config and lists the modalities that are real", () => {
    const resolved = resolveSchedulingCapability({ patientId: "patient_demo", providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID });
    expect(resolved.source).toBe("PROTOTYPE_CONFIG");
    expect(resolved.supportedModalities).toEqual([APPOINTMENT_MODALITY.IN_PERSON, APPOINTMENT_MODALITY.TELEHEALTH, APPOINTMENT_MODALITY.PHONE]);
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID }).supportedModalities).not.toContain(APPOINTMENT_MODALITY.PHONE);
  });

  it("sends an unknown provider to a person rather than to a calendar we do not have", () => {
    expect(resolveSchedulingCapability({ providerId: "dr-nobody" })).toMatchObject({
      capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION,
      reason: "PROVIDER_NOT_IN_SCHEDULING_DIRECTORY"
    });
    expect(resolveSchedulingCapability({})).toMatchObject({
      capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION,
      reason: "NO_PROVIDER_RESOLVED"
    });
    expect(resolveSchedulingCapability()).toMatchObject({ capability: SCHEDULING_CAPABILITY.HUMAN_COORDINATION });
  });

  it("falls back to what the practice can do when the provider is not listed", () => {
    expect(resolveSchedulingCapability({ providerId: "dr-nobody", practiceId: "fresner-medical-group" }).capability).toBe(SCHEDULING_CAPABILITY.STRUCTURED_REQUEST);
  });

  it("downgrades a visit type the office does not take through its calendar", () => {
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, appointmentType: APPOINTMENT_REASON_CATEGORIES.NEW_CONCERN })).toMatchObject({
      capability: SCHEDULING_CAPABILITY.STRUCTURED_REQUEST,
      reason: "TYPE_NOT_DIRECTLY_BOOKABLE"
    });
    expect(resolveSchedulingCapability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, appointmentType: APPOINTMENT_REASON_CATEGORIES.MEDICATION_RENEWAL }).capability).toBe(SCHEDULING_CAPABILITY.DIRECT_BOOKING);
  });
});

describe("availability", () => {
  it("returns slots only where a booking channel actually exists", () => {
    [PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID, PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID, PROTOTYPE_NO_CHANNEL_PROVIDER_ID, "dr-nobody", ""].forEach(providerId => {
      expect(getProviderAvailability({ providerId, now: NOW })).toEqual({ ok: false, error: "NO_AVAILABILITY_SOURCE" });
    });
  });

  it("returns real, future, well-formed slots for a direct-booking provider", () => {
    const result = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("PROTOTYPE_CONFIG");
    expect(result.slots.length).toBeGreaterThan(1);
    result.slots.forEach(slot => {
      expect(Object.keys(slot).sort()).toEqual(["endAt", "expiresAt", "locationName", "modality", "providerId", "slotId", "startAt"]);
      expect(slot.providerId).toBe(PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID);
      expect(new Date(slot.startAt).getTime()).toBeGreaterThan(NOW.getTime());
      expect(new Date(slot.endAt).getTime()).toBeGreaterThan(new Date(slot.startAt).getTime());
      // Nothing in a slot invents a way to get there or a link to join.
      expect(slot).not.toHaveProperty("joinUrl");
      expect(slot).not.toHaveProperty("locationAddress");
      if (slot.modality !== APPOINTMENT_MODALITY.IN_PERSON) expect(slot.locationName).toBe("");
    });
  });

  it("offers the same times to everyone looking at the same day", () => {
    const first = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW });
    const second = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: new Date(NOW.getTime() + 60 * 1000) });
    expect(second.slots.map(slot => slot.startAt)).toEqual(first.slots.map(slot => slot.startAt));
  });

  it("keeps the times inside the part of the day the patient asked for", () => {
    const morning = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, preferredTimeOfDay: TIME_OF_DAY.MORNING, now: NOW });
    morning.slots.forEach(slot => expect(new Date(slot.startAt).getHours()).toBeLessThan(12));
    const afternoon = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, preferredTimeOfDay: TIME_OF_DAY.AFTERNOON, now: NOW });
    afternoon.slots.forEach(slot => expect(new Date(slot.startAt).getHours()).toBeGreaterThanOrEqual(12));
  });

  it("offers only the modality the patient asked for, and refuses one the office does not support", () => {
    const telehealth = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, modality: APPOINTMENT_MODALITY.TELEHEALTH, now: NOW });
    telehealth.slots.forEach(slot => expect(slot.modality).toBe(APPOINTMENT_MODALITY.TELEHEALTH));
    expect(getProviderAvailability({ providerId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID, modality: APPOINTMENT_MODALITY.PHONE, now: NOW })).toEqual({ ok: false, error: "NO_AVAILABILITY_SOURCE" });
  });

  it("honours a date range and says so plainly when nothing is left", () => {
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-05T12:00:00.000Z");
    const range = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, preferredDateRange: { from: from.toISOString(), to: to.toISOString() }, now: NOW });
    expect(range.ok).toBe(true);
    // The slot that will vanish is held to the same window as the ones that will not.
    range.slots.forEach(slot => {
      expect(new Date(slot.startAt).getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(new Date(slot.startAt).getTime()).toBeLessThanOrEqual(to.getTime() + 24 * 60 * 60 * 1000);
    });
    const impossible = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, preferredDateRange: { from: "2027-01-01T00:00:00.000Z", to: "2027-01-02T00:00:00.000Z" }, now: NOW });
    expect(impossible).toEqual({ ok: false, error: "AVAILABILITY_UNAVAILABLE" });
  });

  it("never offers a weekend as an office visit", () => {
    openSlots(getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW })).forEach(slot => {
      const day = new Date(slot.startAt).getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    });
  });

  it("always includes exactly one designated slot that the office will say is gone", () => {
    const result = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW });
    const stale = result.slots.filter(slot => isPrototypeStaleSlot(slot.slotId));
    expect(stale).toHaveLength(1);
    // It is last, so the two or three cards a patient is shown first are all bookable.
    expect(result.slots.at(-1).slotId).toBe(stale[0].slotId);
  });

  it("gives conversational surfaces only held slots that can be confirmed", () => {
    const result = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW });
    const offered = reservableAvailabilitySlots(result.slots, NOW);
    expect(offered).toHaveLength(result.slots.length - 1);
    expect(offered.every(slot => !isPrototypeStaleSlot(slot.slotId))).toBe(true);
    offered.forEach(slot => expect(bookSlot({ appointment: need(), slotId: slot.slotId, now: NOW })).toMatchObject({ ok: true, status: APPOINTMENT_STATUS.CONFIRMED }));
  });

  it("carries everything a booking call needs inside the slot id", () => {
    const slot = openSlots(getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW }))[0];
    expect(decodeSlotId(slot.slotId)).toMatchObject({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, modality: slot.modality, tag: "OPEN" });
    expect(decodeSlotId("not-a-slot")).toBeNull();
    expect(decodeSlotId("")).toBeNull();
  });
});

describe("booking", () => {
  const availability = getProviderAvailability({ providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, now: NOW });
  const bookable = openSlots(availability)[0];
  const staleSlot = availability.slots.at(-1);

  it("confirms a real slot and returns what the office said", () => {
    const result = bookSlot({ appointment: need(), slotId: bookable.slotId, now: NOW });
    expect(result).toMatchObject({
      ok: true,
      status: APPOINTMENT_STATUS.CONFIRMED,
      scheduledAt: bookable.startAt,
      scheduledEndAt: bookable.endAt,
      modality: bookable.modality
    });
    expect(result.confirmationNumber).toMatch(/^ITERA-[0-9A-Z]{7}$/);
    // A booking result never invents the things the honesty ledger says we do not have.
    expect(result).not.toHaveProperty("joinUrl");
    expect(result).not.toHaveProperty("locationAddress");
  });

  it("fails with slotGone when the slot vanished between display and booking", () => {
    expect(bookSlot({ appointment: need(), slotId: staleSlot.slotId, now: NOW })).toEqual({ ok: false, slotGone: true });
  });

  it("fails with slotGone when the hold has expired rather than booking a stale time", () => {
    const later = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    expect(bookSlot({ appointment: need(), slotId: bookable.slotId, now: later })).toEqual({ ok: false, slotGone: true });
  });

  it("refuses a slot that belongs to a different provider", () => {
    expect(bookSlot({ appointment: need({ requestedProfessionalId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID }), slotId: "apt|dr-someone-else|1790000000000|30|IN_PERSON|1790000000000|OPEN", now: NOW })).toEqual({ ok: false, error: "SLOT_NOT_FOUND" });
    expect(bookSlot({ appointment: need(), slotId: "made-up", now: NOW })).toEqual({ ok: false, error: "SLOT_NOT_FOUND" });
  });

  it("refuses to book at all where there is no booking channel", () => {
    expect(bookSlot({ appointment: need({ requestedProfessionalId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID }), slotId: bookable.slotId, now: NOW })).toEqual({ ok: false, error: "NO_BOOKING_CHANNEL" });
    expect(bookSlot({ appointment: need({ requestedProfessionalId: PROTOTYPE_NO_CHANNEL_PROVIDER_ID }), slotId: bookable.slotId, now: NOW })).toEqual({ ok: false, error: "NO_BOOKING_CHANNEL" });
  });

  it("says what is missing rather than guessing", () => {
    expect(bookSlot({ appointment: null, slotId: bookable.slotId, now: NOW })).toEqual({ ok: false, error: "MISSING_INPUT" });
    expect(bookSlot({ appointment: need(), slotId: "", now: NOW })).toEqual({ ok: false, error: "MISSING_INPUT" });
    expect(bookSlot()).toEqual({ ok: false, error: "MISSING_INPUT" });
  });

  it("returns the first booking on a rapid double tap instead of making a second one", () => {
    const key = appointmentIdempotencyKey({ patientId: "patient_demo", providerId: PROTOTYPE_DIRECT_BOOKING_PROVIDER_ID, slotId: bookable.slotId, action: "BOOK" });
    const first = bookSlot({ appointment: need({ idempotencyKey: key }), slotId: bookable.slotId, idempotencyKey: key, now: NOW });
    const booked = {
      ...need({ idempotencyKey: key }),
      status: APPOINTMENT_STATUS.CONFIRMED,
      confirmationNumber: first.confirmationNumber,
      scheduledAt: first.scheduledAt,
      scheduledEndAt: first.scheduledEndAt,
      modality: first.modality,
      locationName: first.locationName
    };
    const second = bookSlot({ appointment: booked, slotId: bookable.slotId, idempotencyKey: key, now: NOW });
    expect(second).toMatchObject({ ok: true, idempotent: true, confirmationNumber: first.confirmationNumber, scheduledAt: first.scheduledAt });
  });
});

describe("sending a request", () => {
  it("sends a request where the office takes requests, and says only that it was sent", () => {
    const result = submitAppointmentRequest({ appointment: need({ requestedProfessionalId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID }), now: NOW });
    expect(result).toEqual({ ok: true, status: APPOINTMENT_STATUS.REQUEST_SENT, requestSentAt: NOW.toISOString() });
    expect(result.status).not.toBe(APPOINTMENT_STATUS.CONFIRMED);
    expect(result).not.toHaveProperty("scheduledAt");
    expect(result).not.toHaveProperty("confirmationNumber");
  });

  it("routes each other capability to the step that is actually real", () => {
    expect(submitAppointmentRequest({ appointment: need(), now: NOW })).toEqual({ ok: false, error: "USE_DIRECT_BOOKING" });
    expect(submitAppointmentRequest({ appointment: need({ requestedProfessionalId: PROTOTYPE_HUMAN_COORDINATION_PROVIDER_ID }), now: NOW })).toEqual({ ok: false, error: "REQUIRES_HUMAN_COORDINATION" });
    expect(submitAppointmentRequest({ appointment: need({ requestedProfessionalId: PROTOTYPE_NO_CHANNEL_PROVIDER_ID }), now: NOW })).toEqual({ ok: false, error: "NO_AVAILABLE_CHANNEL" });
    expect(submitAppointmentRequest({ appointment: null })).toEqual({ ok: false, error: "MISSING_INPUT" });
  });

  it("treats a visit type the calendar will not take as a request instead of a refusal", () => {
    expect(submitAppointmentRequest({ appointment: need({ reasonCategory: APPOINTMENT_REASON_CATEGORIES.NEW_CONCERN }), now: NOW })).toMatchObject({ ok: true, status: APPOINTMENT_STATUS.REQUEST_SENT });
  });

  it("returns the first request on a rapid double tap instead of sending a second one", () => {
    const key = appointmentIdempotencyKey({ patientId: "patient_demo", providerId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID, action: "REQUEST" });
    const sent = { ...need({ requestedProfessionalId: PROTOTYPE_STRUCTURED_REQUEST_PROVIDER_ID, idempotencyKey: key }), status: APPOINTMENT_STATUS.REQUEST_SENT, requestSentAt: NOW.toISOString() };
    const again = submitAppointmentRequest({ appointment: sent, idempotencyKey: key, now: new Date(NOW.getTime() + 1000) });
    expect(again).toEqual({ ok: true, status: APPOINTMENT_STATUS.REQUEST_SENT, requestSentAt: NOW.toISOString(), idempotent: true });
  });
});
