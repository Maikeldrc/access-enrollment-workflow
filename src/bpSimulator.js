// Simulated blood-pressure readings for demos and QA.
//
// The point is not to fake a screen. It is to put a plausible observation into the same pipeline a
// real cuff would feed, so a tester can start the simulation, wait, and watch the actual monitoring
// rules classify it and the patient UI and EMMI react. Everything here stops at producing an
// observation: this module never decides whether a reading is a concern. classifyBloodPressure in
// goalHealth.js does that, from the same rules the rest of the app reads.
//
// Prototype only. ensureSimulationAllowed refuses to start anywhere else.

export const SIMULATION_STATUS = Object.freeze({
  OFF: "OFF",
  READY: "READY",
  RUNNING: "RUNNING",
  STOPPED: "STOPPED"
});

// What the generator aims at. These are targets for generation, not verdicts — the engine still
// classifies whatever comes out, and a boundary value can legitimately land elsewhere.
export const SIMULATION_TARGET = Object.freeze({
  CAUTION: "CAUTION",
  CRITICAL: "CRITICAL"
});

export const DEFAULT_INTERVAL_MS = 2 * 60 * 1000;
// Roughly two cautions per critical: often enough to watch a trend build, often enough to see the
// critical path without sitting through a long demo.
export const DEFAULT_CRITICAL_SHARE = 0.35;

// ---------------------------------------------------------------------------------------------
// Deterministic randomness
//
// A seeded generator so QA can reproduce a sequence exactly. Without a seed it falls back to
// Math.random and behaves like an unpredictable device.
// ---------------------------------------------------------------------------------------------

export function createRandom(seed) {
  if (seed == null) return Math.random;
  // mulberry32: small, fast, good enough to make a sequence repeatable.
  let state = Number(seed) >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const intBetween = (random, low, high) => low + Math.floor(random() * (high - low + 1));

// ---------------------------------------------------------------------------------------------
// Generation
//
// Every bound is read from the monitoring rules. Nothing here restates a threshold, so moving
// reviewAt or actionAt moves the simulator with it and the two cannot drift apart.
// ---------------------------------------------------------------------------------------------

export function bloodPressureBandsFor(rules) {
  if (!rules?.expectedMaximum || !rules?.reviewAt || !rules?.actionAt) {
    throw new Error("bpSimulator: monitoring rules are the source of truth and are required");
  }
  return {
    // A reading the rules will call NEEDS_REVIEW: at or above the review threshold, below action.
    [SIMULATION_TARGET.CAUTION]: {
      systolic: [rules.reviewAt.systolic, rules.actionAt.systolic - 1],
      diastolic: [rules.expectedMaximum.diastolic + 1, rules.actionAt.diastolic - 1]
    },
    // A reading the rules will call ACTION_NEEDED. Systolic alone clears the bar, so the diastolic
    // range spans both sides of its own threshold and some readings carry only a high systolic.
    [SIMULATION_TARGET.CRITICAL]: {
      systolic: [rules.actionAt.systolic, rules.actionAt.systolic + 25],
      diastolic: [rules.actionAt.diastolic - 25, rules.actionAt.diastolic + 12]
    }
  };
}

// Blood pressure is not two independent numbers. Keeping the diastolic inside a believable fraction
// of the systolic avoids readings no cuff would ever print, like 190/60.
const plausibleDiastolic = (systolic, [low, high]) => {
  const floor = Math.max(low, Math.round(systolic * 0.48));
  const ceiling = Math.min(high, Math.round(systolic * 0.7));
  return ceiling < floor ? floor : { floor, ceiling };
};

export function generateReading(target, rules, random = Math.random) {
  const band = bloodPressureBandsFor(rules)[target];
  if (!band) throw new Error(`bpSimulator: unknown target ${target}`);
  const systolic = intBetween(random, band.systolic[0], band.systolic[1]);
  const range = plausibleDiastolic(systolic, band.diastolic);
  const diastolic = typeof range === "number" ? range : intBetween(random, range.floor, range.ceiling);
  return {
    systolic,
    diastolic,
    // A resting pulse in a believable range. The scenario under test is blood pressure, so this
    // stays unremarkable rather than adding a second abnormality nobody asked for.
    heartRate: intBetween(random, 62, 88)
  };
}

export function pickTarget(random = Math.random, criticalShare = DEFAULT_CRITICAL_SHARE) {
  return random() < criticalShare ? SIMULATION_TARGET.CRITICAL : SIMULATION_TARGET.CAUTION;
}

// ---------------------------------------------------------------------------------------------
// Observations
//
// Shaped like the observations recordAccessBpObservation already handles, plus the marks that make
// a simulated reading impossible to mistake for a real one at any later point.
// ---------------------------------------------------------------------------------------------

export function buildObservation({ target, rules, random, sessionId, sequence, patientId, deviceId = "", now = new Date() }) {
  const reading = generateReading(target, rules, random);
  const timestamp = now.toISOString();
  return {
    observationId: `sim:${sessionId}:${sequence}`,
    patientId,
    metricType: "BLOOD_PRESSURE",
    deviceType: "BLOOD_PRESSURE_MONITOR",
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    heartRate: reading.heartRate,
    observedAt: timestamp,
    timestamp,
    receivedAt: timestamp,
    source: "SIMULATED_DEVICE",
    deviceId,
    sourceVerified: true,
    status: "received",
    // The three marks that keep simulated data out of anything real: the source above, this flag,
    // and the session it belongs to.
    isSimulated: true,
    simulationSessionId: sessionId,
    simulationSequence: sequence,
    // What the generator was aiming at. Recorded for QA only -- the engine's own verdict is what
    // the app acts on, and the two are compared in the tests rather than assumed equal.
    simulationTarget: target
  };
}

// ---------------------------------------------------------------------------------------------
// The scheduler
//
// One chained timer, never setInterval: the next reading is scheduled only once the previous one
// has finished being processed, so a slow handler cannot overlap itself or stack up a backlog.
// Starting an already-running session is a no-op rather than a second timer, which is what keeps a
// double mount or a double click from doubling the readings.
// ---------------------------------------------------------------------------------------------

export class BloodPressureSimulator {
  constructor({ rules, onObservation, intervalMs = DEFAULT_INTERVAL_MS, criticalShare = DEFAULT_CRITICAL_SHARE, seed = null, now = () => new Date(), timers = null } = {}) {
    if (typeof onObservation !== "function") throw new Error("bpSimulator: onObservation is required");
    this.rules = rules;
    this.onObservation = onObservation;
    this.intervalMs = intervalMs;
    this.criticalShare = criticalShare;
    this.seed = seed;
    this.now = now;
    // Wrapped rather than passed by reference: a browser's setTimeout throws if it is called with
    // anything other than the global as its receiver, and resolving it at call time is also what
    // lets a test's fake timers take over.
    this.timers = timers || { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: id => clearTimeout(id) };
    this.random = createRandom(seed);
    this.status = SIMULATION_STATUS.READY;
    this.sessionId = "";
    this.sequence = 0;
    this.timer = null;
    this.nextReadingAt = null;
    this.processing = false;
  }

  start() {
    if (this.status === SIMULATION_STATUS.RUNNING) return this.sessionId;
    this.sessionId = `sim_${this.now().getTime().toString(36)}_${Math.floor(this.random() * 1e6).toString(36)}`;
    this.sequence = 0;
    this.random = createRandom(this.seed);
    this.status = SIMULATION_STATUS.RUNNING;
    this.#schedule();
    return this.sessionId;
  }

  stop() {
    this.#cancel();
    if (this.status === SIMULATION_STATUS.RUNNING) this.status = SIMULATION_STATUS.STOPPED;
    return this.sessionId;
  }

  // Everything the simulator owns, released. Called on stop, reset, scenario change and teardown so
  // no timer outlives the session that created it.
  dispose() {
    this.#cancel();
    this.status = SIMULATION_STATUS.OFF;
    this.sessionId = "";
    this.sequence = 0;
  }

  msUntilNextReading() {
    if (this.status !== SIMULATION_STATUS.RUNNING || this.nextReadingAt == null) return null;
    return Math.max(0, this.nextReadingAt - this.now().getTime());
  }

  // QA and demos: produce a reading immediately without waiting out the interval. The automated
  // cadence is untouched -- the countdown restarts from now, exactly as it would after a scheduled
  // reading, so an injection never leaves two readings due at once.
  async inject(target = null) {
    if (this.status !== SIMULATION_STATUS.RUNNING) return null;
    this.#cancel();
    const observation = await this.#emit(target);
    if (this.status === SIMULATION_STATUS.RUNNING) this.#schedule();
    return observation;
  }

  #cancel() {
    if (this.timer != null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.nextReadingAt = null;
  }

  #schedule() {
    this.#cancel();
    this.nextReadingAt = this.now().getTime() + this.intervalMs;
    this.timer = this.timers.setTimeout(async () => {
      this.timer = null;
      await this.#emit();
      if (this.status === SIMULATION_STATUS.RUNNING) this.#schedule();
    }, this.intervalMs);
  }

  async #emit(target = null) {
    if (this.processing) return null;
    this.processing = true;
    try {
      this.sequence += 1;
      const observation = buildObservation({
        target: target || pickTarget(this.random, this.criticalShare),
        rules: this.rules,
        random: this.random,
        sessionId: this.sessionId,
        sequence: this.sequence,
        now: this.now()
      });
      await this.onObservation(observation);
      return observation;
    } finally {
      this.processing = false;
    }
  }
}

// Prototype only, and deliberately explicit rather than a default-on flag: a simulated reading must
// never be able to appear in an environment holding real patient data.
export function simulationAllowed({ prototypeMode = false, allowRealPatientData = true } = {}) {
  return Boolean(prototypeMode) && !allowRealPatientData;
}
