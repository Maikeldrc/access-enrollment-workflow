import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BloodPressureSimulator, DEFAULT_INTERVAL_MS, SIMULATION_STATUS, SIMULATION_TARGET,
  bloodPressureBandsFor, buildObservation, createRandom, generateReading, simulationAllowed
} from "../src/bpSimulator.js";
import { DEMO_BP_MONITORING_RULES, classifyBloodPressure } from "../src/goalHealth.js";

const rules = DEMO_BP_MONITORING_RULES;

// The simulator's job is to produce observations. Whether one is a concern is the monitoring
// engine's call, so every test below asks the real classifyBloodPressure rather than trusting the
// generator's own label.

describe("simulated reading generation", () => {
  it("produces readings the real engine classifies as needing review", () => {
    const random = createRandom(12345);
    for (let i = 0; i < 200; i += 1) {
      const reading = generateReading(SIMULATION_TARGET.CAUTION, rules, random);
      expect(classifyBloodPressure(reading, rules)).toBe("NEEDS_REVIEW");
    }
  });

  it("produces readings the real engine classifies as needing action", () => {
    const random = createRandom(999);
    for (let i = 0; i < 200; i += 1) {
      const reading = generateReading(SIMULATION_TARGET.CRITICAL, rules, random);
      expect(classifyBloodPressure(reading, rules)).toBe("ACTION_NEEDED");
    }
  });

  it("keeps readings clinically plausible", () => {
    const random = createRandom(7);
    for (const target of Object.values(SIMULATION_TARGET)) {
      for (let i = 0; i < 200; i += 1) {
        const { systolic, diastolic, heartRate } = generateReading(target, rules, random);
        expect(systolic).toBeGreaterThan(diastolic);
        // No cuff prints 190/60. The gap between the two numbers has to stay believable.
        expect(diastolic / systolic).toBeGreaterThanOrEqual(0.45);
        expect(diastolic / systolic).toBeLessThanOrEqual(0.72);
        expect(heartRate).toBeGreaterThanOrEqual(60);
        expect(heartRate).toBeLessThanOrEqual(90);
      }
    }
  });

  it("takes every bound from the monitoring rules rather than restating them", () => {
    // Move the thresholds and the generator has to move with them, or the two would drift apart.
    const shifted = { ...rules, reviewAt: { systolic: 150, diastolic: 95 }, actionAt: { systolic: 170, diastolic: 110 } };
    const bands = bloodPressureBandsFor(shifted);
    expect(bands[SIMULATION_TARGET.CAUTION].systolic).toEqual([150, 169]);
    expect(bands[SIMULATION_TARGET.CRITICAL].systolic[0]).toBe(170);

    const random = createRandom(24);
    for (let i = 0; i < 100; i += 1) {
      expect(classifyBloodPressure(generateReading(SIMULATION_TARGET.CAUTION, shifted, random), shifted)).toBe("NEEDS_REVIEW");
      expect(classifyBloodPressure(generateReading(SIMULATION_TARGET.CRITICAL, shifted, random), shifted)).toBe("ACTION_NEEDED");
    }
  });

  it("refuses to generate without rules", () => {
    expect(() => bloodPressureBandsFor(null)).toThrow(/source of truth/);
  });

  it("classifies boundary values the way the rules say, not the way the generator guessed", () => {
    // Each of the three thresholds, from either side, so a change to any of them shows up here.
    // expectedMaximum 139/89, reviewAt 160/100, actionAt 180/120.
    expect(classifyBloodPressure({ systolic: 139, diastolic: 89 }, rules)).toBe("WITHIN_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 140, diastolic: 89 }, rules)).toBe("ABOVE_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 139, diastolic: 90 }, rules)).toBe("ABOVE_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 159, diastolic: 99 }, rules)).toBe("ABOVE_EXPECTED_RANGE");
    expect(classifyBloodPressure({ systolic: 160, diastolic: 89 }, rules)).toBe("NEEDS_REVIEW");
    expect(classifyBloodPressure({ systolic: 139, diastolic: 100 }, rules)).toBe("NEEDS_REVIEW");
    expect(classifyBloodPressure({ systolic: 179, diastolic: 119 }, rules)).toBe("NEEDS_REVIEW");
    expect(classifyBloodPressure({ systolic: 180, diastolic: 89 }, rules)).toBe("ACTION_NEEDED");
    expect(classifyBloodPressure({ systolic: 159, diastolic: 120 }, rules)).toBe("ACTION_NEEDED");
  });
});

describe("randomisation", () => {
  it("reproduces the same sequence from the same seed", () => {
    const draw = () => {
      const random = createRandom(4242);
      return Array.from({ length: 12 }, () => generateReading(SIMULATION_TARGET.CAUTION, rules, random));
    };
    expect(draw()).toEqual(draw());
  });

  it("produces both clinical states over a run", async () => {
    const seen = new Set();
    const simulator = new BloodPressureSimulator({
      rules, seed: 2024, intervalMs: 1000,
      onObservation: observation => { seen.add(classifyBloodPressure(observation, rules)); }
    });
    simulator.start();
    for (let i = 0; i < 60; i += 1) await simulator.inject();
    simulator.dispose();
    expect(seen).toContain("NEEDS_REVIEW");
    expect(seen).toContain("ACTION_NEEDED");
  });
});

describe("observations", () => {
  it("marks every reading as simulated and traceable to its session", () => {
    const observation = buildObservation({
      target: SIMULATION_TARGET.CAUTION, rules, random: createRandom(1),
      sessionId: "sim_abc", sequence: 3, patientId: "patient_demo", now: new Date("2026-08-27T23:42:20Z")
    });
    expect(observation.isSimulated).toBe(true);
    expect(observation.source).toBe("SIMULATED_DEVICE");
    expect(observation.simulationSessionId).toBe("sim_abc");
    expect(observation.simulationSequence).toBe(3);
    expect(observation.observationId).toBe("sim:sim_abc:3");
    expect(observation.observedAt).toBe("2026-08-27T23:42:20.000Z");
  });

  it("timestamps each reading when it happens rather than backdating", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-27T23:00:00Z"));
    const seen = [];
    const simulator = new BloodPressureSimulator({ rules, seed: 5, onObservation: o => seen.push(o.observedAt) });
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    simulator.dispose();
    expect(seen).toEqual(["2026-08-27T23:02:00.000Z", "2026-08-27T23:04:00.000Z"]);
    vi.useRealTimers();
  });
});

describe("the scheduler", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-08-27T23:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); });

  const makeSimulator = (overrides = {}) => {
    const observations = [];
    const simulator = new BloodPressureSimulator({ rules, seed: 11, onObservation: o => observations.push(o), ...overrides });
    return { simulator, observations };
  };

  it("generates nothing until it is started", async () => {
    const { simulator, observations } = makeSimulator();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 5);
    expect(observations).toHaveLength(0);
    expect(simulator.status).toBe(SIMULATION_STATUS.READY);
  });

  it("generates one reading per interval, and none before the first is due", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS - 1000);
    expect(observations).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(observations).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(observations).toHaveLength(4);
    simulator.dispose();
  });

  it("stops immediately, with no further readings", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS);
    simulator.stop();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 10);
    expect(observations).toHaveLength(1);
    expect(simulator.status).toBe(SIMULATION_STATUS.STOPPED);
  });

  it("starting twice keeps one timer and one session", async () => {
    // A double mount or an impatient second click must not double the cadence.
    const { simulator, observations } = makeSimulator();
    const first = simulator.start();
    const second = simulator.start();
    expect(second).toBe(first);
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 2);
    expect(observations).toHaveLength(2);
    expect(new Set(observations.map(o => o.simulationSessionId)).size).toBe(1);
    simulator.dispose();
  });

  it("keeps one session across a whole run and numbers the readings in order", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 3);
    expect(observations.map(o => o.simulationSequence)).toEqual([1, 2, 3]);
    expect(new Set(observations.map(o => o.simulationSessionId)).size).toBe(1);
    simulator.dispose();
  });

  it("never overlaps a slow handler with the next reading", async () => {
    let active = 0;
    let overlapped = false;
    const simulator = new BloodPressureSimulator({
      rules, seed: 3,
      onObservation: async () => {
        active += 1;
        if (active > 1) overlapped = true;
        await new Promise(resolve => setTimeout(resolve, DEFAULT_INTERVAL_MS * 2));
        active -= 1;
      }
    });
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 6);
    expect(overlapped).toBe(false);
    simulator.dispose();
  });

  it("injects on demand and restarts the countdown from that moment", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS / 2);
    await simulator.inject(SIMULATION_TARGET.CRITICAL);
    expect(observations).toHaveLength(1);
    expect(classifyBloodPressure(observations[0], rules)).toBe("ACTION_NEEDED");
    // The injection resets the clock, so the half interval already elapsed does not also fire.
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS - 1000);
    expect(observations).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(observations).toHaveLength(2);
    simulator.dispose();
  });

  it("ignores injection while stopped", async () => {
    const { simulator, observations } = makeSimulator();
    expect(await simulator.inject()).toBeNull();
    simulator.start();
    simulator.stop();
    expect(await simulator.inject()).toBeNull();
    expect(observations).toHaveLength(0);
  });

  it("reports the countdown to the next reading", async () => {
    const { simulator } = makeSimulator();
    expect(simulator.msUntilNextReading()).toBeNull();
    simulator.start();
    expect(simulator.msUntilNextReading()).toBe(DEFAULT_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(simulator.msUntilNextReading()).toBe(DEFAULT_INTERVAL_MS - 30_000);
    simulator.dispose();
    expect(simulator.msUntilNextReading()).toBeNull();
  });

  it("releases its timer on dispose", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    simulator.dispose();
    await vi.advanceTimersByTimeAsync(DEFAULT_INTERVAL_MS * 5);
    expect(observations).toHaveLength(0);
    expect(simulator.status).toBe(SIMULATION_STATUS.OFF);
  });

  it("lets repeated readings of one kind build a sequence for the trend engine", async () => {
    const { simulator, observations } = makeSimulator();
    simulator.start();
    for (let i = 0; i < 4; i += 1) await simulator.inject(SIMULATION_TARGET.CAUTION);
    expect(observations).toHaveLength(4);
    expect(observations.every(o => classifyBloodPressure(o, rules) === "NEEDS_REVIEW")).toBe(true);
    // Repeated readings are distinct observations, so nothing downstream collapses them by id.
    expect(new Set(observations.map(o => o.observationId)).size).toBe(4);
    simulator.dispose();
  });
});

describe("environment gating", () => {
  it("runs only in prototype mode without real patient data", () => {
    expect(simulationAllowed({ prototypeMode: true, allowRealPatientData: false })).toBe(true);
    expect(simulationAllowed({ prototypeMode: false, allowRealPatientData: false })).toBe(false);
    expect(simulationAllowed({ prototypeMode: true, allowRealPatientData: true })).toBe(false);
    expect(simulationAllowed()).toBe(false);
  });
});
