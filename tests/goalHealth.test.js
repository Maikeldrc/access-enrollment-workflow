import { describe, expect, it } from "vitest";
import { DEMO_BP_MONITORING_RULES, buildBloodPressureGoalRuntime, calculateBloodPressureTrend, classifyBloodPressure, createDemoBloodPressureRuntime, nextBestGoalEducation, resolveGoalActionVerification } from "../src/goalHealth.js";

describe("longitudinal goal health runtime", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");

  it("keeps demo health data outside the view and identifies its source", () => {
    const runtime = buildBloodPressureGoalRuntime({ demoMode: true, now });
    expect(runtime.mode).toBe("DEMO");
    expect(runtime.latest).toMatchObject({ systolic: 120, diastolic: 80, source: "CONNECTED_DEVICE", sourceVerified: true, classification: "WITHIN_EXPECTED_RANGE" });
    expect(runtime.monitoringRuleVersion).toBe("demo-bp-monitoring-v1");
  });

  it("uses configured monitoring rules instead of patient-facing labels", () => {
    expect(classifyBloodPressure({ systolic: 120, diastolic: 80 }, DEMO_BP_MONITORING_RULES)).toBe("WITHIN_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 145, diastolic: 91 }, DEMO_BP_MONITORING_RULES)).toBe("ABOVE_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 165, diastolic: 101 }, DEMO_BP_MONITORING_RULES)).toBe("NEEDS_REVIEW");
    expect(classifyBloodPressure({ systolic: 180, diastolic: 80 }, DEMO_BP_MONITORING_RULES)).toBe("ACTION_NEEDED");
  });

  it("calculates a stable seven-day trend deterministically", () => {
    const fixture = createDemoBloodPressureRuntime(now);
    const trend = calculateBloodPressureTrend(fixture.readings, fixture.monitoringRules, 7, now);
    expect(trend).toMatchObject({ count: 5, averageSystolic: 124, averageDiastolic: 81, direction: "STABLE" });
  });

  it("does not fabricate a trend without enough readings", () => {
    const trend = calculateBloodPressureTrend([{ systolic: 120, diastolic: 80, timestamp: now.toISOString() }], DEMO_BP_MONITORING_RULES, 7, now);
    expect(trend.direction).toBe("INSUFFICIENT_DATA");
  });

  it("distinguishes device, patient report, and EMMI lesson actions", () => {
    expect(resolveGoalActionVerification({ templateId: "check-bp" })).toBe("DEVICE");
    expect(resolveGoalActionVerification({ templateId: "medications-as-directed" })).toBe("PATIENT_REPORT");
    expect(resolveGoalActionVerification({ templateId: "learn-bp-numbers" })).toBe("EMMI_LESSON");
  });

  it("selects only approved education that has not been completed", () => {
    expect(nextBestGoalEducation({ goalType: "BLOOD_PRESSURE_CONTROL", completedTopicIds: [] })?.id).toBe("bp-numbers");
    expect(nextBestGoalEducation({ goalType: "BLOOD_PRESSURE_CONTROL", completedTopicIds: ["bp-numbers"] })).toBeNull();
  });
});
