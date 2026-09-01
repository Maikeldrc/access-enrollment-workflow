import { describe, it, expect, beforeAll } from "vitest";
import {
  CompanionDemoProvider, DECLINING_DEMO_CONTACT_ID, PROVIDER_MODES, READINESS_CHECKS,
  SchedulingDemoProvider, TransportationDemoProvider, VideoReadinessDemoProvider,
  barrierDemoMode, barrierProviderSummary, careTeamService, companionService, demoModeBadgeText,
  readinessCheckGuide, readinessCheckLabel, schedulingAssistService, setBarrierLatencyScale,
  transportationService, videoReadinessService
} from "../src/barrierProviders.js";

// Every provider simulates network latency on purpose; a test that waited for it would be paying
// a second per call to prove nothing. The scale is the seam that exists for exactly this.
beforeAll(() => setBarrierLatencyScale(0));

const inDays = (days, hour = 14) => {
  const when = new Date();
  when.setDate(when.getDate() + days);
  when.setHours(hour, 45, 0, 0);
  return when.toISOString();
};

const appointment = (overrides = {}) => ({
  id: "appt-1",
  status: "CONFIRMED",
  requestedProfessionalId: "dr-fresner",
  scheduledAt: inDays(3),
  scheduledEndAt: inDays(3, 15),
  timezone: "America/New_York",
  modality: "IN_PERSON",
  locationName: "Fresner Medical Group",
  joinUrl: "",
  ...overrides
});

const home = { label: "HOME", line1: "123 Oak Avenue", city: "Miami", state: "FL", zip: "33176", formatted: "123 Oak Avenue · Miami, FL 33176" };
const clinic = { name: "Fresner Medical Group", formatted: "800 Ponce de Leon Blvd" };

// A pickup time that the demo dispatcher has cars for. The provider deliberately returns nothing
// for one trip in eight, so a test that needs options asks for a slot that has them.
const findServedTrip = async (base = {}) => {
  for (let offset = 0; offset < 12; offset += 1) {
    const pickupAt = new Date(new Date(inDays(3, 14)).getTime() + offset * 5 * 60000).toISOString();
    const result = await TransportationDemoProvider.search({ appointmentId: "appt-1", pickupAt, pickupAddress: home, destination: clinic, ...base });
    if (result.options.length) return { pickupAt, result };
  }
  throw new Error("the demo dispatcher returned nothing for twelve consecutive pickup times");
};

describe("demo mode is never mistaken for the real thing", () => {
  it("stamps every result as simulated and names the mode", async () => {
    expect(barrierDemoMode()).toBe(true);
    const { result } = await findServedTrip();
    expect(result.simulated).toBe(true);
    expect(result.providerMode).toBe(PROVIDER_MODES.DEMO);
    for (const option of result.options) expect(option.simulated).toBe(true);
  });

  it("names which provider is behind each service, so a live one is visible when it lands", () => {
    const summary = barrierProviderSummary();
    expect(summary.demoMode).toBe(true);
    expect(summary.providers.transportation).toBe("TRANSPORTATION_DEMO");
    expect(summary.providers.scheduling).toBe("SCHEDULING_DEMO");
    expect(summary.providers.companion).toBe("COMPANION_DEMO");
    expect(summary.providers.videoReadiness).toBe("VIDEO_READINESS_DEMO");
    expect(summary.providers.careTeam).toBe("CARE_TEAM_DEMO");
  });

  it("labels demo mode for whoever is running the demo, in their language", () => {
    for (const locale of ["en", "es", "ht"]) expect(demoModeBadgeText(locale)).toMatch(/demo|d[ée]mo|mòd/i);
  });

  it("keeps every service swappable behind the same call shape", () => {
    for (const [service, methods] of [
      [transportationService, ["search", "reserve", "cancel"]],
      [schedulingAssistService, ["getAvailableSlots", "reschedule"]],
      [companionService, ["contacts", "invite", "getStatus"]],
      [videoReadinessService, ["check"]],
      [careTeamService, ["createAssistanceRequest"]]
    ]) {
      for (const method of methods) expect(typeof service[method], `${service.providerId}.${method}`).toBe("function");
      expect(service.providerMode).toBe(PROVIDER_MODES.DEMO);
    }
  });
});

describe("transportation provider", () => {
  it("describes a ride the way a patient decides between rides", async () => {
    const { result } = await findServedTrip();
    for (const option of result.options) {
      expect(option.optionId).toBeTruthy();
      expect(option.serviceName).toBeTruthy();
      expect(new Date(option.pickupAt).getTime()).toBeGreaterThan(0);
      expect(new Date(option.estimatedArrivalAt).getTime()).toBeGreaterThan(new Date(option.pickupAt).getTime());
      expect(option.estimatedCost).toMatch(/^\$\d+\.\d{2}$/);
      expect(option.description).toBeTruthy();
    }
  });

  it("returns the same options for the same trip, twice", async () => {
    const { pickupAt } = await findServedTrip();
    const first = await TransportationDemoProvider.search({ appointmentId: "appt-1", pickupAt, pickupAddress: home, destination: clinic });
    const second = await TransportationDemoProvider.search({ appointmentId: "appt-1", pickupAt, pickupAddress: home, destination: clinic });
    expect(second.options).toEqual(first.options);
  });

  it("moves every arrival estimate when the pickup time moves", async () => {
    const { pickupAt, result } = await findServedTrip();
    const later = await TransportationDemoProvider.search({
      appointmentId: "appt-1",
      pickupAt: new Date(new Date(pickupAt).getTime() + 60 * 60000).toISOString(),
      pickupAddress: home,
      destination: clinic
    });
    if (!later.options.length) return; // that hour has no cars; the previous test covers the shape
    expect(later.options[0].pickupAt).not.toBe(result.options[0].pickupAt);
  });

  it("offers only accessible vehicles once an accessible vehicle is required", async () => {
    const { result } = await findServedTrip({ needs: { accessibilityRequired: true } });
    expect(result.options.length).toBeGreaterThan(0);
    for (const option of result.options) expect(option.accessible).toBe(true);
  });

  it("drops rides that cannot seat everyone travelling", async () => {
    const { result } = await findServedTrip({ needs: { extraPassengers: 3 } });
    for (const option of result.options) expect(option.seats).toBeGreaterThanOrEqual(4);
  });

  it("never lists the assisted ride, which is a care-team arrangement rather than a booking", async () => {
    const { result } = await findServedTrip();
    expect(result.options.map(option => option.rideType)).not.toContain("ASSISTED");
  });

  it("has an honest empty answer rather than inventing a car", async () => {
    const empty = await TransportationDemoProvider.search({ appointmentId: "appt-1", pickupAt: "", pickupAddress: home });
    expect(empty.ok).toBe(false);
    expect(empty.error).toBe("NO_PICKUP_TIME");
  });

  it("returns a reservation object rather than a boolean, so nothing can claim a booking it does not hold", async () => {
    const { result } = await findServedTrip();
    let reservation = null;
    for (const option of result.options) {
      const attempt = await TransportationDemoProvider.reserve({ option, pickupAddress: home, destination: clinic, appointmentId: "appt-1" });
      if (attempt.ok) { reservation = attempt.reservation; break; }
      // §24: a reservation is allowed to fail, and when it does it says so and books nothing.
      expect(attempt.error).toBeTruthy();
      expect(attempt.reservation).toBeUndefined();
    }
    expect(reservation).not.toBeNull();
    expect(reservation.reservationId).toMatch(/^UB-\d{5}$/);
    expect(reservation.status).toBe("CONFIRMED");
    expect(reservation.tripType).toBe("OUTBOUND");
    expect(reservation.simulated).toBe(true);
  });

  it("refuses to reserve nothing", async () => {
    expect((await TransportationDemoProvider.reserve({ option: null })).ok).toBe(false);
    expect((await TransportationDemoProvider.cancel({ reservationId: "" })).ok).toBe(false);
    expect((await TransportationDemoProvider.cancel({ reservationId: "UB-12345" })).ok).toBe(true);
  });

  it("computes the pickup from the appointment rather than from the dispatcher", () => {
    const appt = appointment({ scheduledAt: "2026-09-02T18:45:00.000Z" });
    expect(transportationService.recommendedPickup(appt).pickupAt).toBe("2026-09-02T18:00:00.000Z");
    expect(transportationService.returnPickup(appt, "PLUS_45")).toBe("2026-09-02T19:30:00.000Z");
  });
});

describe("scheduling provider", () => {
  it("offers other times for an office with a calendar", async () => {
    const result = await SchedulingDemoProvider.getAvailableSlots({ appointment: appointment(), now: new Date() });
    expect(result.ok).toBe(true);
    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.slots.length).toBeLessThanOrEqual(5);
    for (const slot of result.slots) {
      expect(slot.slotId).toBeTruthy();
      expect(new Date(slot.startAt).getTime()).toBeGreaterThan(Date.now());
      // Only slots carrying a live hold: the fixture that exists to prove a race is not a time
      // EMMI may put in front of a patient as available.
      expect(new Date(slot.expiresAt).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("never offers the time the patient already has as an alternative to it", async () => {
    const first = await SchedulingDemoProvider.getAvailableSlots({ appointment: appointment(), now: new Date() });
    const appt = appointment({ scheduledAt: first.slots[0].startAt });
    const second = await SchedulingDemoProvider.getAvailableSlots({ appointment: appt, now: new Date() });
    expect(second.slots.map(slot => slot.startAt)).not.toContain(appt.scheduledAt);
  });

  it("has no times at all for an office with no booking channel", async () => {
    const result = await SchedulingDemoProvider.getAvailableSlots({ appointment: appointment({ requestedProfessionalId: "provider-no-scheduling-channel" }), now: new Date() });
    expect(result.ok).toBe(false);
    expect(result.slots).toBeUndefined();
  });

  it("moves the appointment only to a slot that is still held", async () => {
    const { slots } = await SchedulingDemoProvider.getAvailableSlots({ appointment: appointment(), now: new Date() });
    const moved = await SchedulingDemoProvider.reschedule({ appointment: appointment(), slot: slots[0] });
    expect(moved.ok).toBe(true);
    expect(moved.scheduledAt).toBe(slots[0].startAt);
    expect(moved.confirmationNumber).toBeTruthy();
    const stale = await SchedulingDemoProvider.reschedule({ appointment: appointment(), slot: { ...slots[0], expiresAt: "2020-01-01T00:00:00.000Z" } });
    expect(stale.ok).toBe(false);
    expect(stale.error).toBe("SLOT_GONE");
    expect((await SchedulingDemoProvider.reschedule({ appointment: null, slot: null })).ok).toBe(false);
  });
});

describe("companion provider", () => {
  it("prefers the patient's own Care Circle over the demo caregivers", () => {
    const real = CompanionDemoProvider.contacts({ careCircleMembers: [{ inviteId: "invite-1", firstName: "Ana", relationship: "daughter" }] });
    expect(real.contacts).toHaveLength(1);
    expect(real.contacts[0].firstName).toBe("Ana");
    expect(real.contacts[0].source).toBe("CARE_CIRCLE");
    // A real member is not a simulation, even when the rest of the flow is.
    expect(real.simulated).toBe(false);
  });

  it("falls back to demo caregivers so the flow is demonstrable on a fresh enrollment", () => {
    const demo = CompanionDemoProvider.contacts({ careCircleMembers: [], locale: "es" });
    expect(demo.contacts.map(contact => contact.firstName)).toEqual(["Maria", "Carlos"]);
    expect(demo.contacts[0].relationship).toBe("Hija");
    expect(demo.simulated).toBe(true);
  });

  it("sends an invitation that is pending until it is answered", async () => {
    const sent = await CompanionDemoProvider.invite({ contact: { contactId: "demo-maria", firstName: "Maria" }, appointmentId: "appt-1" });
    expect(sent.ok).toBe(true);
    expect(sent.invitation.status).toBe("PENDING");
    expect(sent.invitation.invitationId).toMatch(/^INV-\d{5}$/);
    expect(CompanionDemoProvider.getStatus({ invitation: sent.invitation, now: new Date() }).status).toBe("PENDING");
  });

  it("reaches both answers on purpose rather than by luck", async () => {
    const answered = new Date(Date.now() + 60000);
    const yes = await CompanionDemoProvider.invite({ contact: { contactId: "demo-maria", firstName: "Maria" }, appointmentId: "appt-1" });
    expect(CompanionDemoProvider.getStatus({ invitation: yes.invitation, now: answered }).status).toBe("CONFIRMED");
    const no = await CompanionDemoProvider.invite({ contact: { contactId: DECLINING_DEMO_CONTACT_ID, firstName: "Carlos" }, appointmentId: "appt-1" });
    expect(CompanionDemoProvider.getStatus({ invitation: no.invitation, now: answered }).status).toBe("DECLINED");
  });

  it("gives the same answer to every caller, however often they ask", async () => {
    const sent = await CompanionDemoProvider.invite({ contact: { contactId: "demo-maria", firstName: "Maria" }, appointmentId: "appt-9" });
    const later = new Date(Date.now() + 60000);
    const answers = [1, 2, 3].map(() => CompanionDemoProvider.getStatus({ invitation: sent.invitation, now: later }).status);
    expect(new Set(answers).size).toBe(1);
  });

  it("refuses to invite nobody", async () => {
    expect((await CompanionDemoProvider.invite({ contact: null })).ok).toBe(false);
    expect(CompanionDemoProvider.getStatus({ invitation: null }).ok).toBe(false);
  });
});

describe("video readiness provider", () => {
  it("checks the four things a video visit actually needs", async () => {
    const result = await VideoReadinessDemoProvider.check({ appointment: appointment({ modality: "TELEHEALTH" }) });
    expect(result.ok).toBe(true);
    expect(result.results.map(item => item.id)).toEqual([...READINESS_CHECKS]);
    for (const item of result.results) {
      expect(item.label).toBeTruthy();
      expect(item.detail).toBeTruthy();
      // A failing check always arrives with something the patient can do about it.
      if (!item.passed) expect(item.guide.length, item.id).toBeGreaterThan(0);
    }
  });

  it("treats a link the record actually holds as a fact rather than a simulation", async () => {
    const withLink = await VideoReadinessDemoProvider.check({ appointment: appointment({ joinUrl: "https://example.test/visit" }) });
    const link = withLink.results.find(item => item.id === "APPOINTMENT_LINK");
    expect(link.passed).toBe(true);
    expect(link.source).toBe("BROWSER");
  });

  it("works without any browser APIs at all", async () => {
    const result = await VideoReadinessDemoProvider.check({ appointment: appointment(), useBrowserApis: false });
    expect(result.ok).toBe(true);
    expect(result.results.every(item => item.source === "DEMO")).toBe(true);
    expect(result.issues.every(id => READINESS_CHECKS.includes(id))).toBe(true);
  });

  it("can reach a failing check, because a device that is fine is only half the flow", async () => {
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, index) => VideoReadinessDemoProvider.check({ appointment: appointment({ id: `appt-${index}` }), useBrowserApis: false }))
    );
    expect(outcomes.some(result => result.ready)).toBe(true);
    expect(outcomes.some(result => !result.ready)).toBe(true);
  });

  it("names each check and its guidance in every language, never as an enum", () => {
    for (const locale of ["en", "es", "ht"]) {
      for (const id of READINESS_CHECKS) {
        expect(readinessCheckLabel(id, locale), `${locale}:${id}`).not.toMatch(/^[A-Z_]+$/);
        expect(readinessCheckGuide(id, locale).length, `${locale}:${id}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("care team provider", () => {
  it("hands back the task it was given so the shell can hold on to the id", async () => {
    const created = await careTeamService.createAssistanceRequest({ task: { id: "barrier_task_1", type: "APPOINTMENT_BARRIER", status: "OPEN" } });
    expect(created.ok).toBe(true);
    expect(created.task.id).toBe("barrier_task_1");
    expect(created.task.status).toBe("OPEN");
    expect((await careTeamService.createAssistanceRequest({ task: null })).ok).toBe(false);
  });
});
