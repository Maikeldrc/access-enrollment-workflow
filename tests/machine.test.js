import { describe, expect, it } from "vitest";
import { createOffer } from "../src/config.js";
import { journeyFor, nextScreen, progressFor } from "../src/machine.js";

const stateFor = (scenarioId, overrides = {}) => ({ offer: createOffer(scenarioId), screen: "INVITATION", devicePath: null, ...overrides });

describe("enrollment state machine", () => {
  it("uses the official ITERA support number", () => {
    expect(createOffer("ccm-happy").participantProvider.supportPhone).toBe("(305) 394-8070");
  });

  it("never asks the patient to select a program", () => {
    for (const scenario of ["ccm-happy", "rpm-shipping", "access-happy"]) {
      expect(journeyFor(stateFor(scenario))).not.toContain("PROGRAM_SELECTION");
    }
  });

  it("places ACCESS alignment before confirmed enrollment", () => {
    const journey = journeyFor(stateFor("access-happy"));
    expect(journey.indexOf("ACCESS_ALIGNMENT_PROCESSING")).toBeLessThan(journey.indexOf("ENROLLMENT_CONFIRMED"));
  });

  it("includes shipping only for the ship-device RPM branch", () => {
    expect(journeyFor(stateFor("rpm-shipping", { devicePath: "ship" }))).toContain("RPM_ADDRESS_CONFIRMATION");
    expect(journeyFor(stateFor("rpm-owned", { devicePath: "owned" }))).not.toContain("RPM_ADDRESS_CONFIRMATION");
  });

  it("requests Medicare ID only when it is missing", () => {
    expect(journeyFor(stateFor("access-missing-mbi"))).toContain("ACCESS_MEDICARE_IDENTIFIER");
    expect(journeyFor(stateFor("access-happy"))).not.toContain("ACCESS_MEDICARE_IDENTIFIER");
  });

  it("uses a separate setup progress phase", () => {
    const state = stateFor("rpm-shipping", { screen: "RPM_DEVICE_PATH", devicePath: "ship" });
    expect(progressFor(state).label).toBe("Home monitoring setup");
    expect(nextScreen(state)).toBe("RPM_ADDRESS_CONFIRMATION");
  });
});
