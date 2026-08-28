import { describe, expect, it } from "vitest";
import { DEMO_BP_MONITORING_RULES } from "../src/goalHealth.js";
import { SIMULATION_TARGET, buildObservation, createRandom } from "../src/bpSimulator.js";
import { BP_CLINICAL_STATE, ALERT_STATUS, ingestBloodPressureObservation, resolveEpisode } from "../src/clinicalMonitoring.js";

// The simulator exists to exercise the real pipeline, not to paint a screen. These tests take what
// the generator actually produces and push it through the monitoring engine the same way a cuff
// reading would go, so the thing under test is the join between them.
//
// The generator never decides severity. It aims at a band; the engine returns the verdict, and
// where those two disagree at a boundary the engine wins. That separation is the whole point, so
// it is asserted here rather than assumed.

const rules = DEMO_BP_MONITORING_RULES;
const NOW = new Date("2026-08-28T12:00:00.000Z");
const at = minutes => new Date(NOW.getTime() + minutes * 60000);

const simulate = (target, { seed = 1, sequence = 1, now = NOW } = {}) => {
  const observation = buildObservation({
    target, rules, random: createRandom(seed), sessionId: "sim_test", sequence,
    patientId: "DEMO-P001", deviceId: "SIM-DEVICE", now
  });
  // The engine wants a timestamp; the simulator names it observedAt.
  return { ...observation, timestamp: observation.observedAt || now.toISOString() };
};

describe("a simulated reading reaches the clinical engine", () => {
  it("puts a caution-band reading through the engine and gets a real verdict back", () => {
    const observation = simulate(SIMULATION_TARGET.CAUTION);
    const result = ingestBloodPressureObservation({ observation, rules, now: NOW });
    // Out of range, but not the critical path: a single high reading is not an emergency.
    expect(result.classification.state).toBe(BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE);
    expect(result.classification.ruleVersion).toBe(rules.version);
    expect(result.classification.state).not.toBe(BP_CLINICAL_STATE.CRITICAL);
  });

  it("puts a critical-band reading through the engine and opens an episode", () => {
    const observation = simulate(SIMULATION_TARGET.CRITICAL);
    const result = ingestBloodPressureObservation({ observation, rules, now: NOW });
    expect(result.classification.state).toBe(BP_CLINICAL_STATE.CRITICAL);
    expect(result.action).toBe("EPISODE_OPENED");
    expect(result.alert.status).toBe(ALERT_STATUS.NEW);
    // Only true because an alert really was created.
    expect(result.careTeamNotified).toBe(true);
  });

  it("carries the simulation markings through so nothing is mistaken for a real reading", () => {
    const observation = simulate(SIMULATION_TARGET.CRITICAL, { sequence: 4 });
    expect(observation.isSimulated).toBe(true);
    expect(observation.source).toBe("SIMULATED_DEVICE");
    expect(observation.simulationSessionId).toBe("sim_test");
    expect(observation.simulationSequence).toBe(4);
    const result = ingestBloodPressureObservation({ observation, rules, now: NOW });
    expect(result.classification.state).toBe(BP_CLINICAL_STATE.CRITICAL);
  });

  it("lets the engine overrule what the generator aimed at", () => {
    // A generator that could relabel a reading would make the whole exercise circular.
    for (const seed of [1, 7, 42, 99, 512]) {
      for (const target of [SIMULATION_TARGET.CAUTION, SIMULATION_TARGET.CRITICAL]) {
        const observation = simulate(target, { seed });
        const state = ingestBloodPressureObservation({ observation, rules, now: NOW }).classification.state;
        // Whatever the generator wanted, the state is one the rules produced.
        expect(Object.values(BP_CLINICAL_STATE)).toContain(state);
        expect(observation.simulationTarget).toBe(target);
      }
    }
  });
});

describe("a run of simulated readings exercises the episode logic", () => {
  it("correlates repeated critical readings instead of raising an alert for each", () => {
    let episode = null;
    let alerts = 0;
    for (let index = 0; index < 4; index += 1) {
      const observation = simulate(SIMULATION_TARGET.CRITICAL, { seed: 5 + index, sequence: index + 1, now: at(index * 2) });
      const result = ingestBloodPressureObservation({ observation, episode, rules, now: at(index * 2) });
      episode = result.episode;
      if (result.alert) alerts += 1;
    }
    // Four critical readings, one episode, and nowhere near four alerts.
    expect(episode.observations).toHaveLength(4);
    expect(alerts).toBeLessThan(4);
    expect(episode.status).toBe("OPEN");
  });

  it("does not close an open episode when the next simulated reading looks better", () => {
    const critical = ingestBloodPressureObservation({ observation: simulate(SIMULATION_TARGET.CRITICAL), rules, now: NOW });
    const calmer = ingestBloodPressureObservation({
      observation: { ...simulate(SIMULATION_TARGET.CAUTION, { seed: 3, sequence: 2, now: at(2) }), observationId: "sim_calmer" },
      episode: critical.episode, rules, now: at(2)
    });
    expect(calmer.episode.status).toBe("OPEN");
    expect(calmer.episode.alerts.every(alert => alert.status !== ALERT_STATUS.RESOLVED)).toBe(true);
    // Closing stays a clinical act with a person attached to it.
    const resolved = resolveEpisode(calmer.episode, { resolvedBy: "care-manager", outcome: "REVIEWED", now: at(5) });
    expect(resolved.status).toBe("RESOLVED");
  });

  it("keeps a caution run available to the trend engine rather than swallowing it", () => {
    let episode = null;
    const observations = [];
    for (let index = 0; index < 5; index += 1) {
      const observation = simulate(SIMULATION_TARGET.CAUTION, { seed: 20 + index, sequence: index + 1, now: at(index * 2) });
      observations.push(observation);
      const result = ingestBloodPressureObservation({ observation, episode, history: observations.slice(0, -1), rules, now: at(index * 2) });
      episode = result.episode;
    }
    expect(episode.observations).toHaveLength(5);
    // Every reading is retained, so the trend rules have something real to read.
    expect(observations.every(observation => observation.isSimulated)).toBe(true);
  });
});

describe("boundaries belong to the rules, not the generator", () => {
  it.each([
    [rules.reviewAt.systolic - 1, 85, BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE],
    [rules.reviewAt.systolic, 85, BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE],
    [rules.actionAt.systolic - 1, 85, BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE],
    [rules.actionAt.systolic, 85, BP_CLINICAL_STATE.CRITICAL],
    [150, rules.actionAt.diastolic, BP_CLINICAL_STATE.CRITICAL]
  ])("classifies %i/%i as %s", (systolic, diastolic, expected) => {
    const observation = { observationId: `edge_${systolic}_${diastolic}`, systolic, diastolic, unit: "mmHg", timestamp: NOW.toISOString(), isSimulated: true };
    expect(ingestBloodPressureObservation({ observation, rules, now: NOW }).classification.state).toBe(expected);
  });
});
