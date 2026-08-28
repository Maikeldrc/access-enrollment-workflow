import { describe, expect, it } from "vitest";
import { DEMO_BP_MONITORING_RULES } from "../src/goalHealth.js";
import {
  ALERT_STATUS, BP_CLINICAL_STATE, BP_SEVERITY, DEMO_BP_TREND_RULES,
  classifyObservation, detectPersistentInstability, ingestBloodPressureObservation,
  resolveEpisode, validateObservation
} from "../src/clinicalMonitoring.js";

const NOW = new Date("2026-08-27T18:00:00.000Z");
const daysAgo = (days, hour = 9) => {
  const date = new Date(NOW.getTime() - days * 86400000);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};
const reading = (systolic, diastolic, days = 0, extra = {}) => ({
  observationId: `obs_${days}_${systolic}_${diastolic}`,
  systolic, diastolic, unit: "mmHg", timestamp: daysAgo(days), source: "CONNECTED_DEVICE", ...extra
});
const ingest = (observation, options = {}) => ingestBloodPressureObservation({ observation, now: NOW, ...options });

describe("observation validation", () => {
  it("rejects readings the clinical rules must never see", () => {
    expect(validateObservation(reading(400, 20)).problems).toContain("SYSTOLIC_IMPLAUSIBLE");
    expect(validateObservation(reading(120, 10)).problems).toContain("DIASTOLIC_IMPLAUSIBLE");
    // Diastolic at or above systolic is not physiological.
    expect(validateObservation(reading(120, 130)).problems).toContain("DIASTOLIC_NOT_BELOW_SYSTOLIC");
    expect(validateObservation({ diastolic: 80, timestamp: daysAgo(0) }).problems).toContain("SYSTOLIC_MISSING");
    expect(validateObservation({ systolic: 120, diastolic: 80, timestamp: "not a date" }).problems).toContain("TIMESTAMP_INVALID");
    expect(validateObservation({ systolic: 120, diastolic: 80, timestamp: daysAgo(0), unit: "kPa" }).problems).toContain("UNIT_UNRECOGNIZED");
  });

  it("catches a retransmitted reading so it cannot fabricate a pattern", () => {
    const original = reading(160, 95);
    const validation = validateObservation(original, { existing: [original] });
    expect(validation.duplicate).toBe(true);
    expect(validation.valid).toBe(false);
  });

  it("flags bad data instead of silently discarding it, and raises nothing clinical", () => {
    const result = ingest(reading(400, 20));
    expect(result.classification.state).toBe(BP_CLINICAL_STATE.DATA_QUALITY_ISSUE);
    expect(result.action).toBe("REJECTED");
    expect(result.alert).toBeNull();
    expect(result.careTeamNotified).toBe(false);
  });
});

describe("classification", () => {
  it("uses a richer model than normal and critical", () => {
    expect(classifyObservation(reading(120, 80), { now: NOW }).state).toBe(BP_CLINICAL_STATE.CONTROLLED);
    expect(classifyObservation(reading(165, 95), { now: NOW }).state).toBe(BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE);
    expect(classifyObservation(reading(186, 122), { now: NOW }).state).toBe(BP_CLINICAL_STATE.CRITICAL);
  });

  it("raises a critical reading further only for approved recorded symptoms", () => {
    const withSymptom = classifyObservation(reading(186, 122), { symptoms: { chestPain: true }, now: NOW });
    expect(withSymptom.state).toBe(BP_CLINICAL_STATE.CRITICAL_WITH_CONCERNING_SYMPTOMS);
    expect(withSymptom.concerningSymptoms).toEqual(["chestPain"]);
    // A symptom outside the approved questionnaire changes nothing.
    expect(classifyObservation(reading(186, 122), { symptoms: { feelingTired: true }, now: NOW }).state).toBe(BP_CLINICAL_STATE.CRITICAL);
  });

  it("never lets absent symptoms soften a critical reading", () => {
    const noSymptoms = classifyObservation(reading(186, 122), { symptoms: { chestPain: false, shortnessOfBreath: false }, now: NOW });
    expect(noSymptoms.state).toBe(BP_CLINICAL_STATE.CRITICAL);
    expect(noSymptoms.severity).toBe(BP_SEVERITY[BP_CLINICAL_STATE.CRITICAL]);
  });

  it("records the rule version that raised it so a later config change cannot rewrite the past", () => {
    const result = classifyObservation(reading(186, 122), { now: NOW });
    expect(result.ruleVersion).toBe(DEMO_BP_MONITORING_RULES.version);
    const stricter = { ...DEMO_BP_MONITORING_RULES, version: "demo-bp-monitoring-v2", actionAt: { systolic: 200, diastolic: 130 } };
    const later = classifyObservation(reading(186, 122), { rules: stricter, now: NOW });
    // Same reading, different published rules, different outcome — and each says which it used.
    expect(later.state).toBe(BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE);
    expect(later.ruleVersion).toBe("demo-bp-monitoring-v2");
  });
});

describe("persistent instability", () => {
  const elevatedWeek = [reading(162, 94, 4), reading(168, 96, 3), reading(171, 98, 2), reading(166, 95, 1)];

  it("detects several days above range even when no single reading is critical", () => {
    const result = detectPersistentInstability([...elevatedWeek, reading(173, 99, 0)], DEMO_BP_MONITORING_RULES, DEMO_BP_TREND_RULES, NOW);
    expect(result.persistent).toBe(true);
    expect(result.reason).toBe("PERSISTENTLY_ABOVE_RANGE");
    expect(result.qualifyingDays).toBe(5);
    const ingested = ingest(reading(173, 99, 0), { history: elevatedWeek });
    expect(ingested.classification.state).toBe(BP_CLINICAL_STATE.PERSISTENT_INSTABILITY);
  });

  it("counts days rather than readings, so one bad afternoon is not a week", () => {
    // Five elevated readings, all on the same day.
    const sameDay = [0, 1, 2, 3, 4].map(index => ({ ...reading(168, 96, 0), observationId: `same_${index}`, timestamp: daysAgo(0, 8 + index) }));
    expect(detectPersistentInstability(sameDay, DEMO_BP_MONITORING_RULES, DEMO_BP_TREND_RULES, NOW).persistent).toBe(false);
  });

  it("reports insufficient data rather than inventing a reassuring pattern", () => {
    const single = detectPersistentInstability([reading(165, 95, 0)], DEMO_BP_MONITORING_RULES, DEMO_BP_TREND_RULES, NOW);
    expect(single.persistent).toBe(false);
    expect(single.reason).toBe("INSUFFICIENT_DATA");
    // One isolated deviation is exactly that, not a trend.
    expect(ingest(reading(165, 95, 0)).classification.state).toBe(BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE);
  });

  it("takes its window and day count from configuration, not from a hardcoded three days", () => {
    const strict = { ...DEMO_BP_TREND_RULES, version: "demo-bp-trend-v2", minimumQualifyingDays: 6 };
    expect(detectPersistentInstability([...elevatedWeek, reading(173, 99, 0)], DEMO_BP_MONITORING_RULES, strict, NOW).persistent).toBe(false);
    // Readings outside the configured window do not count toward the pattern.
    const old = [reading(162, 94, 20), reading(168, 96, 19), reading(171, 98, 18)];
    expect(detectPersistentInstability(old, DEMO_BP_MONITORING_RULES, DEMO_BP_TREND_RULES, NOW).persistent).toBe(false);
  });

  it("never lets a pattern check soften a critical reading", () => {
    const result = ingest(reading(186, 122, 0), { history: elevatedWeek });
    expect(result.classification.state).toBe(BP_CLINICAL_STATE.CRITICAL);
  });
});

describe("episode lifecycle", () => {
  it("opens an episode and notifies only when an alert was really created", () => {
    const controlled = ingest(reading(120, 80));
    expect(controlled.action).toBe("NONE");
    expect(controlled.careTeamNotified).toBe(false);

    const critical = ingest(reading(186, 122));
    expect(critical.action).toBe("EPISODE_OPENED");
    expect(critical.alert.status).toBe(ALERT_STATUS.NEW);
    expect(critical.alert.ruleVersion).toBe(DEMO_BP_MONITORING_RULES.version);
    expect(critical.careTeamNotified).toBe(true);
  });

  it("correlates repeat critical readings instead of flooding the queue", () => {
    let episode = ingest(reading(186, 122, 0)).episode;
    for (const [systolic, diastolic] of [[184, 121], [187, 123], [185, 120]]) {
      const next = ingest({ ...reading(systolic, diastolic, 0), observationId: `repeat_${systolic}` }, { episode });
      episode = next.episode;
      expect(next.action).toBe("CORRELATED");
      expect(next.alert).toBeNull();
    }
    expect(episode.alerts).toHaveLength(1);
    expect(episode.alerts[0].correlatedObservations).toHaveLength(3);
  });

  it("escalates rather than suppressing a reading that is genuinely worse", () => {
    const first = ingest(reading(182, 121, 0));
    const worse = ingest({ ...reading(210, 132, 0), observationId: "worsening" }, { episode: first.episode, symptoms: { chestPain: true } });
    expect(worse.action).toBe("ESCALATED");
    expect(worse.alert.severity).toBeGreaterThan(first.alert.severity);
    expect(worse.alert.escalatedFromSeverity).toBe(first.alert.severity);
    expect(worse.episode.alerts).toHaveLength(2);
  });

  it("does not close a critical episode because one later reading looks better", () => {
    const critical = ingest(reading(186, 122, 0));
    const better = ingest({ ...reading(128, 82, 0), observationId: "later_normal" }, { episode: critical.episode });
    expect(better.action).toBe("OBSERVATION_RECORDED");
    expect(better.episode.status).toBe("OPEN");
    expect(better.episode.alerts.every(alert => alert.status !== ALERT_STATUS.RESOLVED)).toBe(true);
  });

  it("closes only when a clinician resolves it, and records who and why", () => {
    const critical = ingest(reading(186, 122, 0));
    const resolved = resolveEpisode(critical.episode, { resolvedBy: "care-manager-1", outcome: "PATIENT_CONTACTED_AND_STABLE", now: NOW });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedBy).toBe("care-manager-1");
    expect(resolved.resolutionOutcome).toBe("PATIENT_CONTACTED_AND_STABLE");
    expect(resolved.alerts.every(alert => alert.status === ALERT_STATUS.RESOLVED)).toBe(true);
    // A recurrence after resolution opens a new episode rather than reviving the closed one.
    const recurrence = ingest({ ...reading(190, 124, 0), observationId: "recurrence" }, { episode: resolved });
    expect(recurrence.action).toBe("EPISODE_OPENED");
    expect(recurrence.episode.id).not.toBe(resolved.id);
  });

  it("keeps every observation on the episode so the history is auditable", () => {
    const first = ingest(reading(186, 122, 0));
    const second = ingest({ ...reading(128, 82, 0), observationId: "second" }, { episode: first.episode });
    const third = ingest({ ...reading(205, 130, 0), observationId: "third" }, { episode: second.episode });
    expect(third.episode.observations).toEqual(expect.arrayContaining(["second", "third"]));
    expect(third.episode.openedAt).toBe(first.episode.openedAt);
  });
});
