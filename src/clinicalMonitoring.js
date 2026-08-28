import { DEMO_BP_MONITORING_RULES, classifyBloodPressure } from "./goalHealth.js";

// Deterministic blood pressure clinical monitoring.
//
// This module decides what a reading means. EMMI explains what this decides and the care team acts
// on it; neither is allowed to reach its own conclusion about severity. That separation is the
// whole design: a language model asked whether 186/122 is dangerous will usually be right, and the
// times it is wrong are exactly the times it matters.
//
// Thresholds are never written here. They come from the monitoring rules passed in, which carry
// their own version, and every alert records the version it was raised under so a later change to
// the configuration cannot rewrite the past.

const DAY_MS = 24 * 60 * 60 * 1000;

// A richer state than normal/critical, because "out of range once" and "out of range all week"
// call for completely different responses.
export const BP_CLINICAL_STATE = Object.freeze({
  CONTROLLED: "CONTROLLED",
  OUT_OF_EXPECTED_RANGE: "OUT_OF_EXPECTED_RANGE",
  PERSISTENT_INSTABILITY: "PERSISTENT_INSTABILITY",
  CRITICAL: "CRITICAL",
  CRITICAL_WITH_CONCERNING_SYMPTOMS: "CRITICAL_WITH_CONCERNING_SYMPTOMS",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  DATA_QUALITY_ISSUE: "DATA_QUALITY_ISSUE"
});

// Internal only. These numbers order the clinical queue; the patient never sees a level.
export const BP_SEVERITY = Object.freeze({
  [BP_CLINICAL_STATE.CONTROLLED]: 0,
  [BP_CLINICAL_STATE.INSUFFICIENT_DATA]: 0,
  [BP_CLINICAL_STATE.DATA_QUALITY_ISSUE]: 0,
  [BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE]: 1,
  [BP_CLINICAL_STATE.PERSISTENT_INSTABILITY]: 2,
  [BP_CLINICAL_STATE.CRITICAL]: 3,
  [BP_CLINICAL_STATE.CRITICAL_WITH_CONCERNING_SYMPTOMS]: 4
});

export const ALERT_STATUS = Object.freeze({
  NEW: "NEW",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  UNDER_REVIEW: "UNDER_REVIEW",
  PATIENT_CONTACTED: "PATIENT_CONTACTED",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED"
});

// Only these symptoms may raise a critical reading to the highest pathway, and only when the
// approved questionnaire recorded them. Free text never reaches this.
export const CONCERNING_SYMPTOMS = Object.freeze(["chestPain", "shortnessOfBreath", "neurologicSymptoms"]);

export const PLAUSIBLE_RANGE = Object.freeze({
  systolic: Object.freeze({ min: 60, max: 300 }),
  diastolic: Object.freeze({ min: 30, max: 200 })
});

// Trend rules are configuration too. "Three days in a row" is a clinical decision, not something
// a component gets to assume.
export const DEMO_BP_TREND_RULES = Object.freeze({
  version: "demo-bp-trend-v1",
  periodDays: 7,
  minimumReadings: 3,
  minimumQualifyingDays: 3,
  qualifyingDayRatio: 0.5
});

// Time alone is not unique enough: two episodes opened in the same millisecond, or a recurrence
// raised immediately after a resolution, would collide on the id.
const uniqueId = (prefix, at) => `${prefix}_${new Date(at).getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const asNumber = value => (value === null || value === undefined || value === "" ? NaN : Number(value));

// A reading that is malformed, implausible or a retransmission must not reach the clinical rules.
// It is reported as a data quality problem rather than dropped, because a monitor sending nonsense
// is itself something the care team should know about.
export function validateObservation(observation = {}, { existing = [] } = {}) {
  const systolic = asNumber(observation.systolic);
  const diastolic = asNumber(observation.diastolic);
  const problems = [];
  if (!Number.isFinite(systolic)) problems.push("SYSTOLIC_MISSING");
  if (!Number.isFinite(diastolic)) problems.push("DIASTOLIC_MISSING");
  if (observation.unit && observation.unit !== "mmHg") problems.push("UNIT_UNRECOGNIZED");
  const timestamp = observation.timestamp ? new Date(observation.timestamp) : null;
  if (!timestamp || Number.isNaN(timestamp.getTime())) problems.push("TIMESTAMP_INVALID");
  if (Number.isFinite(systolic) && (systolic < PLAUSIBLE_RANGE.systolic.min || systolic > PLAUSIBLE_RANGE.systolic.max)) problems.push("SYSTOLIC_IMPLAUSIBLE");
  if (Number.isFinite(diastolic) && (diastolic < PLAUSIBLE_RANGE.diastolic.min || diastolic > PLAUSIBLE_RANGE.diastolic.max)) problems.push("DIASTOLIC_IMPLAUSIBLE");
  // Diastolic at or above systolic is not a physiological reading.
  if (Number.isFinite(systolic) && Number.isFinite(diastolic) && diastolic >= systolic) problems.push("DIASTOLIC_NOT_BELOW_SYSTOLIC");
  // Transmission retries resend the same measurement; counting it twice would fabricate a trend.
  const duplicate = existing.some(item =>
    (observation.observationId && item.observationId === observation.observationId)
    || (item.systolic === systolic && item.diastolic === diastolic && item.timestamp === observation.timestamp));
  if (duplicate) problems.push("DUPLICATE_OBSERVATION");
  return { valid: problems.length === 0, duplicate, problems };
}

const dayKey = timestamp => new Date(timestamp).toISOString().slice(0, 10);

// Persistent instability is a pattern, not a reading: days count, not individual measurements, so a
// patient who measures five times on one bad afternoon is not mistaken for a week of deterioration.
export function detectPersistentInstability(readings = [], rules = DEMO_BP_MONITORING_RULES, trendRules = DEMO_BP_TREND_RULES, now = new Date()) {
  const since = now.getTime() - trendRules.periodDays * DAY_MS;
  const period = readings.filter(reading =>
    Number.isFinite(Number(reading.systolic)) && Number.isFinite(Number(reading.diastolic))
    && new Date(reading.timestamp).getTime() >= since);
  const days = new Map();
  for (const reading of period) {
    const key = dayKey(reading.timestamp);
    const aboveRange = reading.systolic > rules.expectedMaximum.systolic || reading.diastolic > rules.expectedMaximum.diastolic;
    days.set(key, (days.get(key) || false) || aboveRange);
  }
  const observedDays = days.size;
  const qualifyingDays = [...days.values()].filter(Boolean).length;
  // A pattern claim needs enough measurements to be a pattern. Without them the honest answer is
  // that there is not enough data, never a reassuring "stable".
  if (period.length < trendRules.minimumReadings || observedDays < trendRules.minimumQualifyingDays) {
    return { persistent: false, reason: "INSUFFICIENT_DATA", qualifyingDays, observedDays, readingCount: period.length, ruleVersion: trendRules.version };
  }
  const persistent = qualifyingDays >= trendRules.minimumQualifyingDays
    && qualifyingDays / observedDays >= trendRules.qualifyingDayRatio;
  return {
    persistent,
    reason: persistent ? "PERSISTENTLY_ABOVE_RANGE" : "WITHIN_PATTERN",
    qualifyingDays,
    observedDays,
    readingCount: period.length,
    ruleVersion: trendRules.version
  };
}

// One reading, one clinical meaning. Symptoms only ever raise the state, never lower it.
export function classifyObservation(observation, {
  rules = DEMO_BP_MONITORING_RULES,
  symptoms = {},
  existing = [],
  trendRules = DEMO_BP_TREND_RULES,
  history = [],
  now = new Date()
} = {}) {
  const validation = validateObservation(observation, { existing });
  if (!validation.valid) {
    return { state: BP_CLINICAL_STATE.DATA_QUALITY_ISSUE, severity: BP_SEVERITY[BP_CLINICAL_STATE.DATA_QUALITY_ISSUE], validation, ruleId: rules.version, ruleVersion: rules.version };
  }
  const classification = classifyBloodPressure(observation, rules);
  const concerning = CONCERNING_SYMPTOMS.filter(symptom => symptoms[symptom] === true);
  let state = BP_CLINICAL_STATE.CONTROLLED;
  if (classification === "ACTION_NEEDED") {
    state = concerning.length ? BP_CLINICAL_STATE.CRITICAL_WITH_CONCERNING_SYMPTOMS : BP_CLINICAL_STATE.CRITICAL;
  } else if (classification === "NEEDS_REVIEW" || classification === "ABOVE_EXPECTED_RANGE") {
    state = BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE;
  }
  // A single reading inside range says nothing about the week. A pattern check can raise a
  // non-critical result, but it can never soften a critical one.
  const instability = detectPersistentInstability([...history, observation], rules, trendRules, now);
  if (state !== BP_CLINICAL_STATE.CRITICAL && state !== BP_CLINICAL_STATE.CRITICAL_WITH_CONCERNING_SYMPTOMS && instability.persistent) {
    state = BP_CLINICAL_STATE.PERSISTENT_INSTABILITY;
  }
  return {
    state,
    severity: BP_SEVERITY[state],
    readingClassification: classification,
    concerningSymptoms: concerning,
    instability,
    validation,
    ruleId: rules.version,
    ruleVersion: rules.version,
    classifiedAt: now.toISOString()
  };
}

const openAlert = (episode, state) => (episode?.alerts || []).find(alert => alert.state === state && alert.status !== ALERT_STATUS.RESOLVED);

// One episode holds everything that belongs to a single period of instability, so the care team
// reads a story rather than a pile of identical alerts.
export function applyObservationToEpisode(episode, observation, classification, { now = new Date() } = {}) {
  const at = now.toISOString();
  const current = episode && episode.status !== "RESOLVED" ? episode : null;
  const escalating = classification.severity >= BP_SEVERITY[BP_CLINICAL_STATE.OUT_OF_EXPECTED_RANGE];

  if (!current) {
    if (!escalating) return { episode: episode || null, alert: null, action: "NONE" };
    const created = {
      id: uniqueId("bp_episode", at),
      metricType: "BLOOD_PRESSURE",
      status: "OPEN",
      openedAt: at,
      peakSeverity: classification.severity,
      state: classification.state,
      observations: [observation.observationId || at],
      alerts: [{
        id: uniqueId("bp_alert", at),
        state: classification.state,
        severity: classification.severity,
        status: ALERT_STATUS.NEW,
        ruleId: classification.ruleId,
        // Recorded at creation so a later configuration change cannot rewrite why this was raised.
        ruleVersion: classification.ruleVersion,
        observationId: observation.observationId || null,
        systolic: observation.systolic,
        diastolic: observation.diastolic,
        detectedAt: at,
        concerningSymptoms: classification.concerningSymptoms
      }],
      interventions: []
    };
    return { episode: created, alert: created.alerts[0], action: "EPISODE_OPENED" };
  }

  const updated = { ...current, observations: [...current.observations, observation.observationId || at] };
  if (!escalating) {
    // A better reading is recorded, but it does not close anything. Resolution is a clinical
    // decision, and one calm afternoon is not evidence that a week of instability is over.
    updated.lastNonEscalatingAt = at;
    return { episode: updated, alert: null, action: "OBSERVATION_RECORDED" };
  }

  const existingAlert = openAlert(current, classification.state);
  const worsened = classification.severity > (current.peakSeverity ?? -1);
  if (worsened) {
    updated.peakSeverity = classification.severity;
    updated.state = classification.state;
    updated.alerts = [...current.alerts, {
      id: uniqueId("bp_alert", at),
      state: classification.state,
      severity: classification.severity,
      status: ALERT_STATUS.NEW,
      ruleId: classification.ruleId,
      ruleVersion: classification.ruleVersion,
      observationId: observation.observationId || null,
      systolic: observation.systolic,
      diastolic: observation.diastolic,
      detectedAt: at,
      escalatedFromSeverity: current.peakSeverity,
      concerningSymptoms: classification.concerningSymptoms
    }];
    return { episode: updated, alert: updated.alerts.at(-1), action: "ESCALATED" };
  }
  if (existingAlert) {
    // Correlated into the open alert: a second critical reading is more evidence for the same
    // problem, not a second problem, and an alert per reading buries the care team.
    updated.alerts = current.alerts.map(alert => (alert.id === existingAlert.id
      ? { ...alert, correlatedObservations: [...(alert.correlatedObservations || []), observation.observationId || at], lastObservedAt: at }
      : alert));
    return { episode: updated, alert: null, action: "CORRELATED" };
  }
  updated.alerts = [...current.alerts, {
    id: uniqueId("bp_alert", at),
    state: classification.state,
    severity: classification.severity,
    status: ALERT_STATUS.NEW,
    ruleId: classification.ruleId,
    ruleVersion: classification.ruleVersion,
    observationId: observation.observationId || null,
    systolic: observation.systolic,
    diastolic: observation.diastolic,
    detectedAt: at,
    concerningSymptoms: classification.concerningSymptoms
  }];
  return { episode: updated, alert: updated.alerts.at(-1), action: "ALERT_ADDED" };
}

// The whole chain for one arriving reading, in one deterministic call.
export function ingestBloodPressureObservation({
  observation,
  history = [],
  episode = null,
  symptoms = {},
  rules = DEMO_BP_MONITORING_RULES,
  trendRules = DEMO_BP_TREND_RULES,
  now = new Date()
} = {}) {
  const classification = classifyObservation(observation, { rules, symptoms, existing: history, trendRules, history, now });
  if (classification.state === BP_CLINICAL_STATE.DATA_QUALITY_ISSUE) {
    return { classification, episode, alert: null, action: "REJECTED", careTeamNotified: false };
  }
  const applied = applyObservationToEpisode(episode, observation, classification, { now });
  return {
    classification,
    episode: applied.episode,
    alert: applied.alert,
    action: applied.action,
    // Whether the care team was actually told. The patient is only ever shown that claim when this
    // is true, because "your care team has been notified" has to be a fact, not a reassurance.
    careTeamNotified: Boolean(applied.alert)
  };
}

// Resolution is a clinical act, recorded with who did it and why. Nothing here closes on its own.
export function resolveEpisode(episode, { resolvedBy, outcome, now = new Date() } = {}) {
  if (!episode) return null;
  const at = now.toISOString();
  return {
    ...episode,
    status: "RESOLVED",
    resolvedAt: at,
    resolvedBy: resolvedBy || null,
    resolutionOutcome: outcome || null,
    alerts: (episode.alerts || []).map(alert => ({ ...alert, status: ALERT_STATUS.RESOLVED, resolvedAt: at }))
  };
}
