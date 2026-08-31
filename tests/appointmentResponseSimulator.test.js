import { describe, expect, it } from "vitest";
import { APPOINTMENT_STATUS } from "../src/appointments.js";
import { SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS, simulateAppointmentServiceResponse, simulatedAppointmentResponseDueAt, simulatedAppointmentResponseIsDue } from "../src/appointmentResponseSimulator.js";

const REQUESTED_AT = "2026-08-31T15:00:00.000Z";
const request = (overrides = {}) => ({
  id: "appt-care-manager",
  status: APPOINTMENT_STATUS.REQUEST_SENT,
  requestSentAt: REQUESTED_AT,
  updatedAt: REQUESTED_AT,
  requestedProfessionalType: "CARE_MANAGER",
  providerDisplayName: "Alicia Ramírez, RN",
  preferredModality: "TELEHEALTH",
  preferredTimeOfDay: "AFTERNOON",
  practiceName: "ITERA HEALTH",
  ...overrides
});

describe("simulated appointment response service", () => {
  it("answers only after the configured response delay", () => {
    const dueAt = new Date(REQUESTED_AT).getTime() + SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS;
    expect(simulatedAppointmentResponseDueAt(request())).toBe(dueAt);
    expect(simulatedAppointmentResponseIsDue(request(), new Date(dueAt - 1))).toBe(false);
    expect(simulatedAppointmentResponseIsDue(request(), new Date(dueAt))).toBe(true);
    expect(simulatedAppointmentResponseDueAt(request({ status: APPOINTMENT_STATUS.CONFIRMED }))).toBeNull();
  });

  it("returns a persistent confirmation matching the requested modality and time bucket", () => {
    const now = new Date("2026-08-31T15:00:10.000Z");
    const first = simulateAppointmentServiceResponse(request(), { now });
    const second = simulateAppointmentServiceResponse(request(), { now });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: true, modality: "TELEHEALTH", timezone: "America/New_York", locationName: "ITERA virtual care" });
    expect(first.confirmationNumber).toMatch(/^ITERA-[0-9A-Z]{7}$/);
    expect(new Intl.DateTimeFormat("en-US", { timeZone: first.timezone, hour: "numeric", minute: "2-digit", hour12: false }).format(new Date(first.scheduledAt))).toBe("14:30");
    expect(new Date(first.scheduledEndAt).getTime() - new Date(first.scheduledAt).getTime()).toBe(30 * 60 * 1000);
  });
});
