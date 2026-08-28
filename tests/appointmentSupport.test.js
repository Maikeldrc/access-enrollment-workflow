import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BARRIER_CATEGORIES } from "../src/goalBarriers.js";
import {
  APPOINTMENT_BARRIER_REASONS,
  APPOINTMENT_NEVER_SHARED_FIELDS,
  APPOINTMENT_REMINDER_SLOTS,
  APPOINTMENT_SHARE_FIELDS,
  ATTENDANCE_OUTCOMES,
  CARE_CIRCLE_SHARING_REASONS,
  FOLLOW_UP_ACTIONS,
  REMINDER_STATUS,
  appointmentBarrierDescription,
  appointmentBarrierPlan,
  appointmentFollowUpDue,
  appointmentReminderCapability,
  appointmentReminderSlotOptions,
  appointmentShareScope,
  attendanceFollowUpPlan,
  careCircleSharingOptions,
  createAppointmentReminder,
  preVisitCheckOptions,
  sharedAppointmentPayload
} from "../src/appointmentSupport.js";

const LOCALES = ["en", "es", "ht"];
const MODULE_SOURCE = readFileSync(new URL("../src/appointmentSupport.js", import.meta.url), "utf8");

// Appointment times are built in local time so the day-of reminder maths is stable wherever the
// suite runs.
const localIso = (year, month, day, hour, minute = 0) => new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();

const appointment = (overrides = {}) => ({
  id: "appt-1",
  patientId: "patient-1",
  status: "CONFIRMED",
  scheduledAt: localIso(2026, 9, 10, 14, 30),
  scheduledEndAt: localIso(2026, 9, 10, 15, 0),
  timezone: "America/New_York",
  providerDisplayName: "Dr. Martinez",
  practiceName: "Fresner Medical Group",
  modality: "IN_PERSON",
  locationName: "Bayview Clinic",
  locationAddress: "220 Bay Street",
  joinUrl: "https://video.example/abc",
  confirmationNumber: "CONF-9",
  reasonCategory: "BLOOD_PRESSURE_FOLLOW_UP",
  reasonSummary: "My readings have been high in the mornings",
  prep: { topics: ["My BP trend"], notes: "Ask about the dizziness", sharedWithProvider: false, updatedAt: "" },
  attendanceOutcome: null,
  followUpAskedAt: null,
  ...overrides
});

const invite = (overrides = {}) => ({
  inviteId: "CARE-1",
  status: "ACCEPTED",
  supportPerson: { name: "Ana Rodríguez", relationship: "daughter", relationshipOther: "", phone: "3055550147" },
  acceptedAt: "2026-08-01T12:00:00.000Z",
  canceledAt: null,
  removedAt: null,
  ...overrides
});

const PERMISSIONS_ON = { receiveReminders: true, helpWithDeviceSetup: true, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: false };
const PERMISSIONS_OFF = { receiveReminders: false, helpWithDeviceSetup: false, helpWithAppointments: false, receiveCareTasks: false, viewLimitedCareProgress: false };

describe("reminder capability honesty (§50)", () => {
  it("offers one channel and never claims it can reach a device", () => {
    const capability = appointmentReminderCapability();
    expect(capability.channels).toEqual(["IN_APP"]);
    expect(capability.canNotifyDevice).toBe(false);
    expect(capability.reason).toBe("NO_DEVICE_CHANNEL");
  });

  it("tells the patient in every language that the reminder lives in ITERA and nothing is sent out", () => {
    LOCALES.forEach(locale => {
      const note = appointmentReminderCapability(locale).note;
      expect(note).toBeTruthy();
      expect(note).toMatch(/ITERA/);
    });
    expect(appointmentReminderCapability("en").note).toMatch(/will not send/i);
    expect(appointmentReminderCapability("es").note).toMatch(/No enviaremos/i);
    expect(appointmentReminderCapability("ht").note).toMatch(/p ap voye/i);
  });

  it("contains no copy anywhere in the module that promises an outbound notification", () => {
    const promises = [
      /\bSMS\b/i,
      /text message/i,
      /push notification/i,
      /\be-?mails?\b/i,
      /calendar invite/i,
      /\bics\b/i,
      /notify your (phone|device)/i,
      /(we|EMMI|ITERA) will send (you )?(a|an|the)? ?(reminder|notification|alert|message)/i
    ];
    promises.forEach(pattern => expect(MODULE_SOURCE).not.toMatch(pattern));
  });

  it("writes Haitian Creole, never Korean", () => {
    expect(MODULE_SOURCE).not.toMatch(/[가-힣]/);
    expect(appointmentReminderSlotOptions("ht").map(option => option.label).join(" ")).toMatch(/anvan/i);
  });

  it("keeps the three appointment-relative slots and does not reuse the goal module's clock slots", () => {
    expect(APPOINTMENT_REMINDER_SLOTS.map(slot => slot.id)).toEqual(["DAY_BEFORE", "MORNING_OF", "TWO_HOURS_BEFORE"]);
    LOCALES.forEach(locale => {
      appointmentReminderSlotOptions(locale).forEach(option => expect(option.label.length).toBeGreaterThan(0));
    });
  });
});

describe("createAppointmentReminder (§49)", () => {
  const now = localIso(2026, 9, 1, 9, 0);

  it("refuses to create anything without an explicit confirmation", () => {
    expect(createAppointmentReminder(appointment(), "DAY_BEFORE", { now })).toMatchObject({ ok: false, status: REMINDER_STATUS.CONFIRMATION_REQUIRED });
    expect(createAppointmentReminder(appointment(), "DAY_BEFORE", { now, confirmed: false }).reminder).toBeUndefined();
  });

  it("treats a truthy non-true confirmation as no confirmation", () => {
    ["true", 1, {}].forEach(confirmed => {
      expect(createAppointmentReminder(appointment(), "DAY_BEFORE", { now, confirmed })).toMatchObject({ ok: false, status: REMINDER_STATUS.CONFIRMATION_REQUIRED });
    });
  });

  it("carries the honest note even when it refuses", () => {
    expect(createAppointmentReminder(appointment(), "DAY_BEFORE", { now, locale: "es" }).note).toMatch(/ITERA/);
  });

  it("rejects a slot it does not have", () => {
    expect(createAppointmentReminder(appointment(), "EVENING", { now, confirmed: true })).toMatchObject({ ok: false, status: REMINDER_STATUS.UNKNOWN_SLOT });
  });

  it("will not set a reminder for an appointment that is not confirmed", () => {
    ["REQUEST_SENT", "WAITING_FOR_OFFICE", "PROPOSED_TIME", "CANCELED"].forEach(status => {
      expect(createAppointmentReminder(appointment({ status }), "DAY_BEFORE", { now, confirmed: true })).toMatchObject({ ok: false, status: REMINDER_STATUS.APPOINTMENT_NOT_CONFIRMED });
    });
    expect(createAppointmentReminder(null, "DAY_BEFORE", { now, confirmed: true })).toMatchObject({ ok: false, status: REMINDER_STATUS.APPOINTMENT_NOT_CONFIRMED });
  });

  it("will not set a reminder for a confirmed appointment with no time on it", () => {
    expect(createAppointmentReminder(appointment({ scheduledAt: "" }), "DAY_BEFORE", { now, confirmed: true })).toMatchObject({ ok: false, status: REMINDER_STATUS.NO_SCHEDULED_TIME });
  });

  it("counts back from the visit for each slot and records the in-app channel", () => {
    const dayBefore = createAppointmentReminder(appointment(), "DAY_BEFORE", { now, confirmed: true });
    expect(dayBefore).toMatchObject({ ok: true, status: REMINDER_STATUS.CREATED });
    expect(dayBefore.reminder).toEqual({ slot: "DAY_BEFORE", time: localIso(2026, 9, 9, 14, 30), channel: "IN_APP", createdAt: new Date(now).toISOString() });

    expect(createAppointmentReminder(appointment(), "TWO_HOURS_BEFORE", { now, confirmed: true }).reminder.time).toBe(localIso(2026, 9, 10, 12, 30));
    expect(createAppointmentReminder(appointment(), "MORNING_OF", { now, confirmed: true }).reminder.time).toBe(localIso(2026, 9, 10, 8, 0));
  });

  it("does not create a reminder whose moment has already gone by", () => {
    const late = createAppointmentReminder(appointment(), "DAY_BEFORE", { now: localIso(2026, 9, 10, 13, 0), confirmed: true });
    expect(late).toMatchObject({ ok: false, status: REMINDER_STATUS.REMINDER_TIME_PASSED });
    expect(late.reminder).toBeUndefined();
  });

  it("does not create a morning-of reminder for an early-morning visit it would land after", () => {
    const early = appointment({ scheduledAt: localIso(2026, 9, 10, 7, 0), scheduledEndAt: localIso(2026, 9, 10, 7, 30) });
    expect(createAppointmentReminder(early, "MORNING_OF", { now, confirmed: true })).toMatchObject({ ok: false, status: REMINDER_STATUS.SLOT_AFTER_APPOINTMENT });
  });
});

describe("appointmentBarrierPlan (§52)", () => {
  const SPEC_NAMES_MISSING_FROM_TAXONOMY = ["CAREGIVER_AVAILABILITY", "LOCATION_UNCLEAR", "TECHNOLOGY_TELEHEALTH", "MOBILITY", "TIME_CONFLICT"];

  it("proves the mapping is necessary: the spec's names are not barrier categories", () => {
    SPEC_NAMES_MISSING_FROM_TAXONOMY.forEach(name => expect(BARRIER_CATEGORIES[name]).toBeUndefined());
  });

  it("maps every appointment difficulty onto a category that actually exists", () => {
    const expected = {
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
    };
    Object.entries(expected).forEach(([reasonKey, category]) => {
      const plan = appointmentBarrierPlan(reasonKey);
      expect(plan.category).toBe(category);
      expect(BARRIER_CATEGORIES[plan.category]).toBeDefined();
      expect(plan.owner).toBe(BARRIER_CATEGORIES[category].owner);
    });
  });

  it("covers every reason it publishes and invents no category for any of them", () => {
    Object.values(APPOINTMENT_BARRIER_REASONS)
      .filter(reasonKey => reasonKey !== APPOINTMENT_BARRIER_REASONS.ALL_SET)
      .forEach(reasonKey => {
        const plan = appointmentBarrierPlan(reasonKey);
        expect(BARRIER_CATEGORIES[plan.category]).toBeDefined();
        LOCALES.forEach(locale => expect(appointmentBarrierDescription(plan.patientDescriptionKey, locale).length).toBeGreaterThan(0));
      });
  });

  it("records no barrier when the patient says they are all set", () => {
    expect(appointmentBarrierPlan("ALL_SET")).toBeNull();
    expect(appointmentBarrierPlan("")).toBeNull();
    expect(appointmentBarrierPlan(null)).toBeNull();
  });

  it("falls back to OTHER rather than creating a category for something it does not know", () => {
    const plan = appointmentBarrierPlan("PARKING_IS_EXPENSIVE_AND_CONFUSING");
    expect(plan.category).toBe("OTHER");
    expect(plan.patientDescriptionKey).toBe("APPOINTMENT_BARRIER_OTHER");
  });

  it("offers the pre-visit check as five choices, following the modality", () => {
    const inPerson = preVisitCheckOptions({ appointment: appointment(), locale: "en" });
    expect(inPerson.options).toHaveLength(5);
    expect(inPerson.options.map(option => option.reasonKey)).toContain("TRANSPORTATION");
    expect(inPerson.question).toBeTruthy();

    const video = preVisitCheckOptions({ appointment: appointment({ modality: "TELEHEALTH" }), locale: "es" });
    expect(video.options.map(option => option.reasonKey)).toContain("TECHNOLOGY_TELEHEALTH");
    expect(video.options.map(option => option.reasonKey)).not.toContain("TRANSPORTATION");

    LOCALES.forEach(locale => {
      preVisitCheckOptions({ locale }).options.forEach(option => expect(option.label.length).toBeGreaterThan(0));
    });
  });
});

describe("attendance follow-up (§65-69)", () => {
  it("names exactly four outcomes", () => {
    expect(Object.keys(ATTENDANCE_OUTCOMES)).toEqual(["ATTENDED", "MISSED", "RESCHEDULED", "UNKNOWN"]);
  });

  it("opens with a non-judgmental attendance question and three honest answers", () => {
    const plan = attendanceFollowUpPlan(ATTENDANCE_OUTCOMES.UNKNOWN, "en");
    expect(plan.question).toMatch(/were you able/i);
    expect(plan.options.map(option => option.id)).toEqual(["ATTENDED", "MISSED", "RESCHEDULED"]);
    expect(plan.nextAction).toBe(FOLLOW_UP_ACTIONS.ASK_ATTENDANCE);
    expect(plan.barrierCategory).toBeNull();
  });

  it("asks an attended patient what they need help with", () => {
    const plan = attendanceFollowUpPlan(ATTENDANCE_OUTCOMES.ATTENDED, "en");
    expect(plan.nextAction).toBe(FOLLOW_UP_ACTIONS.OFFER_VISIT_SUPPORT);
    expect(plan.options.map(option => option.id)).toContain("NOTHING_RIGHT_NOW");
    expect(plan.barrierCategory).toBeNull();
  });

  it("routes a missed visit into the barrier engine instead of scolding the patient", () => {
    const plan = attendanceFollowUpPlan(ATTENDANCE_OUTCOMES.MISSED, "en");
    expect(plan.nextAction).toBe(FOLLOW_UP_ACTIONS.OFFER_RESCHEDULE);
    expect(plan.question).toMatch(/help rescheduling/i);
    expect(plan.barrierCategory).toBe("APPOINTMENT_NEED");
    expect(BARRIER_CATEGORIES[plan.barrierCategory]).toBeDefined();
    expect(plan.barrierPlan).toMatchObject({ reasonKey: "MISSED_VISIT", patientDescriptionKey: "APPOINTMENT_BARRIER_MISSED_VISIT" });
    expect(plan.options.map(option => option.id)).toContain("SOMETHING_GOT_IN_THE_WAY");
  });

  it("asks for the new time rather than inventing one after a reschedule", () => {
    const plan = attendanceFollowUpPlan(ATTENDANCE_OUTCOMES.RESCHEDULED, "en");
    expect(plan.nextAction).toBe(FOLLOW_UP_ACTIONS.CONFIRM_NEW_TIME);
    expect(plan.options.map(option => option.id)).toContain("WAITING_FOR_OFFICE");
  });

  it("keeps every plan to three options in all three languages, with nothing accusatory in any of them", () => {
    const accusatory = /you missed|missed your|did not attend|didn'?t attend|failed to|no asist|falt[óo] a|ou (te )?rate|ou pa t ale/i;
    Object.values(ATTENDANCE_OUTCOMES).forEach(outcome => {
      LOCALES.forEach(locale => {
        const plan = attendanceFollowUpPlan(outcome, locale);
        expect(plan.options.length).toBeLessThanOrEqual(3);
        expect(plan.question.length).toBeGreaterThan(0);
        expect(plan.question).not.toMatch(accusatory);
        plan.options.forEach(option => {
          expect(option.label.length).toBeGreaterThan(0);
          expect(option.label).not.toMatch(accusatory);
        });
      });
    });
  });

  it("treats an unrecognised outcome as unknown rather than guessing", () => {
    expect(attendanceFollowUpPlan("PROBABLY", "en").outcome).toBe(ATTENDANCE_OUTCOMES.UNKNOWN);
    expect(attendanceFollowUpPlan(undefined, "en").outcome).toBe(ATTENDANCE_OUTCOMES.UNKNOWN);
  });
});

describe("appointmentFollowUpDue (§65)", () => {
  const now = localIso(2026, 9, 11, 9, 0);

  it("is due for a confirmed visit whose time has passed and that has not been asked about", () => {
    expect(appointmentFollowUpDue(appointment(), now)).toBe(true);
  });

  it("is not due before the visit has ended", () => {
    expect(appointmentFollowUpDue(appointment(), localIso(2026, 9, 10, 14, 45))).toBe(false);
    expect(appointmentFollowUpDue(appointment(), localIso(2026, 9, 1, 9, 0))).toBe(false);
  });

  it("gates on the record, not on elapsed time alone", () => {
    expect(appointmentFollowUpDue(appointment({ status: "CANCELED" }), now)).toBe(false);
    expect(appointmentFollowUpDue(appointment({ status: "REQUEST_SENT" }), now)).toBe(false);
    expect(appointmentFollowUpDue(appointment({ attendanceOutcome: "ATTENDED" }), now)).toBe(false);
    expect(appointmentFollowUpDue(appointment({ followUpAskedAt: localIso(2026, 9, 10, 18, 0) }), now)).toBe(false);
    expect(appointmentFollowUpDue(appointment({ scheduledAt: "", scheduledEndAt: "" }), now)).toBe(false);
    expect(appointmentFollowUpDue(null, now)).toBe(false);
  });

  it("uses the end of the visit when the record carries one", () => {
    const long = appointment({ scheduledEndAt: localIso(2026, 9, 11, 10, 0) });
    expect(appointmentFollowUpDue(long, now)).toBe(false);
    expect(appointmentFollowUpDue(long, localIso(2026, 9, 11, 10, 30))).toBe(true);
  });
});

describe("careCircleSharingOptions (§54, §56)", () => {
  it("refuses when the circle is empty, however the permission is set", () => {
    [PERMISSIONS_ON, PERMISSIONS_OFF, null].forEach(careCirclePermissions => {
      expect(careCircleSharingOptions({ invites: [], careCirclePermissions, completionRole: "patient" }))
        .toMatchObject({ allowed: false, reason: CARE_CIRCLE_SHARING_REASONS.NO_CARE_CIRCLE, eligibleMembers: [] });
    });
  });

  it("does not count an invite nobody accepted", () => {
    ["PENDING", "SENT", "OPENED", "EXPIRED", "CANCELED"].forEach(status => {
      expect(careCircleSharingOptions({ invites: [invite({ status })], careCirclePermissions: PERMISSIONS_ON }).reason)
        .toBe(CARE_CIRCLE_SHARING_REASONS.NO_CARE_CIRCLE);
    });
  });

  it("does not count a member the patient removed", () => {
    expect(careCircleSharingOptions({ invites: [invite({ removedAt: "2026-08-20T00:00:00.000Z" })], careCirclePermissions: PERMISSIONS_ON }).reason)
      .toBe(CARE_CIRCLE_SHARING_REASONS.NO_CARE_CIRCLE);
  });

  it("refuses when the appointments permission is off, and offers no names either", () => {
    const result = careCircleSharingOptions({ invites: [invite()], careCirclePermissions: PERMISSIONS_OFF, completionRole: "patient" });
    expect(result).toMatchObject({ allowed: false, reason: CARE_CIRCLE_SHARING_REASONS.PERMISSION_NOT_GRANTED });
    expect(result.eligibleMembers).toEqual([]);
    expect(careCircleSharingOptions({ invites: [invite()], careCirclePermissions: null }).reason).toBe(CARE_CIRCLE_SHARING_REASONS.PERMISSION_NOT_GRANTED);
    expect(careCircleSharingOptions({ invites: [invite()], careCirclePermissions: { helpWithAppointments: "yes" } }).reason).toBe(CARE_CIRCLE_SHARING_REASONS.PERMISSION_NOT_GRANTED);
  });

  it("allows sharing only when both facts are true, and returns the minimum necessary about the member", () => {
    const result = careCircleSharingOptions({ invites: [invite()], careCirclePermissions: PERMISSIONS_ON, completionRole: "patient" });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe(CARE_CIRCLE_SHARING_REASONS.SHARING_AVAILABLE);
    expect(result.eligibleMembers).toEqual([{ inviteId: "CARE-1", firstName: "Ana", relationship: "daughter", status: "ACCEPTED" }]);
    expect(JSON.stringify(result)).not.toMatch(/3055550147/);
  });

  it("does not decide on completionRole, in either direction", () => {
    expect(careCircleSharingOptions({ invites: [invite()], careCirclePermissions: PERMISSIONS_ON, completionRole: "personalRepresentative" }).allowed).toBe(true);
    expect(careCircleSharingOptions({ invites: [], careCirclePermissions: PERMISSIONS_ON, completionRole: "patient" }).allowed).toBe(false);
    expect(careCircleSharingOptions({ invites: [invite()], careCirclePermissions: PERMISSIONS_OFF, completionRole: "patient" }).allowed).toBe(false);
  });

  it("survives being handed nothing at all", () => {
    expect(careCircleSharingOptions()).toMatchObject({ allowed: false, reason: CARE_CIRCLE_SHARING_REASONS.NO_CARE_CIRCLE });
    expect(careCircleSharingOptions({ invites: null }).allowed).toBe(false);
  });

  it("reports the §56 supports granularly and never claims a reminder can reach the member", () => {
    const granted = careCircleSharingOptions({ invites: [invite()], careCirclePermissions: PERMISSIONS_ON }).supports;
    expect(granted.viewDateTimeLocation).toEqual({ permitted: true, available: true });
    expect(granted.helpWithTransportation).toEqual({ permitted: true, available: true });
    expect(granted.helpWithVideoSetup).toEqual({ permitted: true, available: true });
    expect(granted.receiveAppointmentReminder.available).toBe(false);

    const partial = careCircleSharingOptions({ invites: [invite()], careCirclePermissions: { helpWithAppointments: true } }).supports;
    expect(partial.helpWithVideoSetup.permitted).toBe(false);
    expect(partial.receiveAppointmentReminder.permitted).toBe(false);
  });
});

describe("appointmentShareScope (§55, §115)", () => {
  it("shares when, with whom, how and where — and nothing clinical", () => {
    const scope = appointmentShareScope();
    expect(scope.shares).toEqual(expect.arrayContaining(["scheduledAt", "providerDisplayName", "modality", "locationName", "locationAddress"]));
    expect(scope.shares).not.toContain("reasonSummary");
    expect(scope.shares).not.toContain("prep");
    expect(scope.neverShares).toEqual(expect.arrayContaining(["reasonCategory", "reasonSummary", "prep", "joinUrl", "medicalRecord"]));
    expect(APPOINTMENT_SHARE_FIELDS.some(field => APPOINTMENT_NEVER_SHARED_FIELDS.includes(field))).toBe(false);
  });

  it("grants no authority a Care Circle member must never have", () => {
    const scope = appointmentShareScope();
    expect(scope.grants).toMatchObject({ view: true, cancel: false, reschedule: false, book: false, medicalRecordAccess: false, consentAuthority: false, clinicalDecisionRights: false });
    expect(scope.revocable).toBe(true);
  });

  it("says the limits out loud in every language", () => {
    LOCALES.forEach(locale => {
      const scope = appointmentShareScope(locale);
      expect(scope.note.length).toBeGreaterThan(0);
      expect(scope.limits.length).toBeGreaterThan(0);
    });
    expect(appointmentShareScope("en").limits).toMatch(/does not give access/i);
    expect(appointmentShareScope("es").limits).toMatch(/no da acceso/i);
    expect(appointmentShareScope("ht").limits).toMatch(/pa bay aksè/i);
  });

  it("builds the shared payload from the allow-list, so nothing clinical can leak through it", () => {
    const payload = sharedAppointmentPayload(appointment(), { locale: "en" });
    expect(Object.keys(payload).sort()).toEqual([...APPOINTMENT_SHARE_FIELDS, "limits", "scope"].sort());
    APPOINTMENT_NEVER_SHARED_FIELDS.forEach(field => expect(payload[field]).toBeUndefined());
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/readings have been high/i);
    expect(serialized).not.toMatch(/dizziness/i);
    expect(serialized).not.toMatch(/video\.example/);
    expect(serialized).not.toMatch(/CONF-9/);
    expect(payload.providerDisplayName).toBe("Dr. Martinez");
    expect(payload.locationName).toBe("Bayview Clinic");
    expect(sharedAppointmentPayload(null)).toBeNull();
  });
});
