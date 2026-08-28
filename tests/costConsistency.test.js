import { describe, expect, it } from "vitest";
import { ACCESS_COST_BY_TRACK, SECONDARY_COVERAGE_STATUSES, resolveAccessCost } from "../src/config.js";
import { accessTrackCost, resolveExpectedPatientResponsibility } from "../src/financialResponsibility.js";
import { EMMI_DEMO_PATIENTS, emmiDemoCoverage, emmiDemoSecondaryCoverageStatus } from "../src/mock/emmiFixtures.js";

// A patient can read an amount on the cost card and then ask EMMI what they will pay. If those two
// answers disagree the patient has no way to know which is true, and one of them is wrong about
// money on a consent screen. These tests exist because they did disagree: the card said $6 a month
// for the primary demo patient while EMMI said $0.

const paysNothingOnCard = status => resolveAccessCost("eCKM", status).displayValue === "$0";

describe("cost card and EMMI agree about what the patient pays", () => {
  it("never quotes a different answer for the same demo patient", () => {
    for (const [patientId, patient] of Object.entries(EMMI_DEMO_PATIENTS)) {
      const card = resolveAccessCost(patient.accessTrack, patient.secondaryCoverageStatus);
      const engine = resolveExpectedPatientResponsibility({ track: patient.accessTrack, coverage: emmiDemoCoverage(patientId) });
      expect(card.displayValue === "$0", `${patientId}: card says ${card.displayValue}, EMMI says ${engine.expectedPatientPayment}`)
        .toBe(engine.expectedPatientPayment === 0);
    }
  });

  it("shows the primary demo patient $0 on the card, not just in conversation", () => {
    const patient = EMMI_DEMO_PATIENTS["DEMO-P001"];
    expect(resolveAccessCost(patient.accessTrack, patient.secondaryCoverageStatus).displayValue).toBe("$0");
    expect(resolveExpectedPatientResponsibility({ track: patient.accessTrack, coverage: emmiDemoCoverage("DEMO-P001") }).expectedPatientPayment).toBe(0);
  });
});

describe("secondary coverage status is derived, not written twice", () => {
  it("uses the vocabulary the cost resolver actually recognises", () => {
    // The fixtures used to carry short keys like "VERIFIED" that resolveAccessCost never matched,
    // so every patient silently fell through to the unverified branch and was quoted the full
    // amount whatever their coverage record said.
    for (const [patientId, patient] of Object.entries(EMMI_DEMO_PATIENTS)) {
      expect(Object.values(SECONDARY_COVERAGE_STATUSES), `${patientId} status must be canonical`)
        .toContain(patient.secondaryCoverageStatus);
    }
    expect(paysNothingOnCard("VERIFIED")).toBe(false);
    expect(paysNothingOnCard(SECONDARY_COVERAGE_STATUSES.VERIFIED)).toBe(true);
  });

  it("reaches verified only when the supplement is verified to cover this cost share", () => {
    expect(emmiDemoSecondaryCoverageStatus("DEMO-P001")).toBe(SECONDARY_COVERAGE_STATUSES.VERIFIED);
    // Active and verified, but nobody established whether it pays the ACCESS share.
    expect(emmiDemoSecondaryCoverageStatus("DEMO-P002")).toBe(SECONDARY_COVERAGE_STATUSES.PRESENT_NOT_CONFIRMED);
    expect(emmiDemoSecondaryCoverageStatus("DEMO-P003")).toBe(SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED);
    // Verification too old to rely on must not read as verified.
    expect(emmiDemoSecondaryCoverageStatus("DEMO-P005")).toBe(SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED);
    // A QMB designation is not a Medicare Supplement and never counts as one.
    expect(emmiDemoSecondaryCoverageStatus("DEMO-P006")).toBe(SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED);
    expect(emmiDemoSecondaryCoverageStatus("NOT-A-PATIENT")).toBe(SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED);
  });
});

describe("track amounts come from one configuration", () => {
  it("prices each track from the canonical table rather than a remembered figure", () => {
    for (const [track, amount] of Object.entries(ACCESS_COST_BY_TRACK)) {
      expect(resolveAccessCost(track, SECONDARY_COVERAGE_STATUSES.NOT_VERIFIED).expectedMonthlyAmount).toBe(amount);
      expect(accessTrackCost(track)).toBe(amount);
    }
    // The tracks genuinely differ, so a hardcoded default would be wrong for most patients.
    expect(new Set(Object.values(ACCESS_COST_BY_TRACK)).size).toBeGreaterThan(1);
    expect(ACCESS_COST_BY_TRACK.CKM).not.toBe(ACCESS_COST_BY_TRACK.eCKM);
  });
});
