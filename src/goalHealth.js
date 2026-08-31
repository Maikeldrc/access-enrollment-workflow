const DAY_MS = 24 * 60 * 60 * 1000;

export const GOAL_ACTION_VERIFICATION = Object.freeze({
  "check-bp": "DEVICE",
  "medications-as-directed": "PATIENT_REPORT",
  "learn-bp-numbers": "EMMI_LESSON",
  "reduce-salt": "PATIENT_REPORT",
  "be-active": "PATIENT_REPORT"
});

// Prototype-only clinical configuration. The view never owns thresholds or invents a target.
// A production adapter can replace this object with versioned care-team monitoring rules.
export const DEMO_BP_MONITORING_RULES = Object.freeze({
  version: "demo-bp-monitoring-v1",
  expectedMaximum: Object.freeze({ systolic: 139, diastolic: 89 }),
  reviewAt: Object.freeze({ systolic: 160, diastolic: 100 }),
  actionAt: Object.freeze({ systolic: 180, diastolic: 120 }),
  stableDelta: Object.freeze({ systolic: 5, diastolic: 3 })
});

// The care team's own threshold for this prototype. It is a CONFIGURATION, not a measurement: it
// is knowable on day one, it claims nothing about the patient, and it stays true whether or not a
// single reading has ever arrived. That is what separates it from the demo readings below, which
// are fabricated events and may only stand in for a feed that could actually exist.
export const DEMO_BP_CLINICAL_TARGET = Object.freeze({
  metricType: "BLOOD_PRESSURE",
  label: "Less than 140/90 mmHg",
  systolicMaximum: 139,
  diastolicMaximum: 89,
  source: "CARE_TEAM",
  version: "demo-care-team-target-v1"
});

const isoAt = (date, hours, minutes) => {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
};

// Explicit demo adapter used only when the prototype has no longitudinal observation feed.
export function createDemoBloodPressureRuntime(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const samples = [
    { daysAgo: 6, systolic: 127, diastolic: 83 },
    { daysAgo: 5, systolic: 125, diastolic: 81 },
    { daysAgo: 3, systolic: 124, diastolic: 82 },
    { daysAgo: 1, systolic: 124, diastolic: 79 },
    { daysAgo: 0, systolic: 120, diastolic: 80 }
  ];
  return {
    mode: "DEMO",
    readings: samples.map((sample, index) => {
      const timestamp = new Date(today.getTime() - sample.daysAgo * DAY_MS);
      return {
        id: `demo-bp-${index + 1}`,
        metricType: "BLOOD_PRESSURE",
        systolic: sample.systolic,
        diastolic: sample.diastolic,
        unit: "mmHg",
        timestamp: isoAt(timestamp, index === samples.length - 1 ? 8 : 9, index === samples.length - 1 ? 42 : 15),
        source: "CONNECTED_DEVICE",
        sourceVerified: true,
        deviceId: "demo-connected-bp-monitor",
        observationId: `demo-observation-${index + 1}`,
        clinicalRuleVersion: DEMO_BP_MONITORING_RULES.version
      };
    }),
    monitoringRules: DEMO_BP_MONITORING_RULES,
    clinicalTarget: DEMO_BP_CLINICAL_TARGET
  };
}

export function classifyBloodPressure(reading, rules) {
  if (!reading || !rules) return "NEEDS_REVIEW";
  if (reading.systolic >= rules.actionAt.systolic || reading.diastolic >= rules.actionAt.diastolic) return "ACTION_NEEDED";
  if (reading.systolic >= rules.reviewAt.systolic || reading.diastolic >= rules.reviewAt.diastolic) return "NEEDS_REVIEW";
  if (reading.systolic > rules.expectedMaximum.systolic || reading.diastolic > rules.expectedMaximum.diastolic) return "ABOVE_EXPECTED_RANGE";
  return "WITHIN_EXPECTED_RANGE";
}

const roundedAverage = (items, key) => items.length ? Math.round(items.reduce((sum, item) => sum + Number(item[key] || 0), 0) / items.length) : null;

export function calculateBloodPressureTrend(readings, rules, periodDays = 7, now = new Date()) {
  const since = now.getTime() - periodDays * DAY_MS;
  const periodReadings = (readings || [])
    .filter(reading => Number.isFinite(Number(reading.systolic)) && Number.isFinite(Number(reading.diastolic)) && new Date(reading.timestamp).getTime() >= since)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (!periodReadings.length) return { periodDays, count: 0, averageSystolic: null, averageDiastolic: null, direction: "INSUFFICIENT_DATA", computedAt: now.toISOString(), readings: [] };
  const middle = Math.max(1, Math.floor(periodReadings.length / 2));
  const earlier = periodReadings.slice(0, middle);
  const recent = periodReadings.slice(middle);
  const systolicDelta = recent.length ? roundedAverage(recent, "systolic") - roundedAverage(earlier, "systolic") : 0;
  const diastolicDelta = recent.length ? roundedAverage(recent, "diastolic") - roundedAverage(earlier, "diastolic") : 0;
  let direction = "INSUFFICIENT_DATA";
  if (periodReadings.length >= 3) {
    if (Math.abs(systolicDelta) <= rules.stableDelta.systolic && Math.abs(diastolicDelta) <= rules.stableDelta.diastolic) direction = "STABLE";
    else if (systolicDelta > 0 || diastolicDelta > 0) direction = "TRENDING_UP";
    else direction = "TRENDING_DOWN";
  }
  return {
    metricType: "BLOOD_PRESSURE",
    periodDays,
    count: periodReadings.length,
    averageSystolic: roundedAverage(periodReadings, "systolic"),
    averageDiastolic: roundedAverage(periodReadings, "diastolic"),
    minSystolic: Math.min(...periodReadings.map(item => item.systolic)),
    maxSystolic: Math.max(...periodReadings.map(item => item.systolic)),
    minDiastolic: Math.min(...periodReadings.map(item => item.diastolic)),
    maxDiastolic: Math.max(...periodReadings.map(item => item.diastolic)),
    direction,
    comparison: { systolicDelta, diastolicDelta },
    computedAt: now.toISOString(),
    readings: periodReadings
  };
}

export function resolveGoalActionVerification(action = {}) {
  return action.verificationMethod || GOAL_ACTION_VERIFICATION[action.templateId] || "PATIENT_REPORT";
}

export function buildBloodPressureGoalRuntime({ readings = [], demoMode = false, monitoringRules = null, clinicalTarget = null, now = new Date() } = {}) {
  const demo = demoMode && !readings.length ? createDemoBloodPressureRuntime(now) : null;
  const resolvedReadings = demo?.readings || readings;
  const resolvedRules = monitoringRules || demo?.monitoringRules || null;
  const ordered = [...resolvedReadings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latest = ordered.at(-1) || null;
  const classifiedLatest = latest && resolvedRules ? { ...latest, classification: latest.classification || classifyBloodPressure(latest, resolvedRules) } : latest;
  return {
    mode: demo ? "DEMO" : "RUNTIME",
    latest: classifiedLatest,
    readings: ordered.map(reading => ({ ...reading, classification: reading.classification || (resolvedRules ? classifyBloodPressure(reading, resolvedRules) : "NEEDS_REVIEW") })),
    trend: resolvedRules ? calculateBloodPressureTrend(ordered, resolvedRules, 7, now) : calculateBloodPressureTrend([], DEMO_BP_MONITORING_RULES, 7, now),
    clinicalTarget: clinicalTarget || demo?.clinicalTarget || null,
    monitoringRuleVersion: resolvedRules?.version || null
  };
}

export const BP_EDUCATION_CATALOG = Object.freeze([{
  id: "bp-numbers",
  metricType: "BLOOD_PRESSURE",
  condition: "Hypertension",
  riskLevel: "LOW",
  source: "ITERA_APPROVED_KNOWLEDGE_BASE",
  version: "1.0",
  lastReviewed: "2026-08-01",
  title: Object.freeze({ en: "What do 120/80 mean?", es: "¿Qué significan 120/80?", ht: "Kisa 120/80 vle di?" }),
  summary: Object.freeze({ en: "A simple explanation of the two blood pressure numbers.", es: "Una explicación sencilla sobre los dos números de su presión.", ht: "Yon eksplikasyon senp sou de chif tansyon ou yo." })
}]);

export function nextBestGoalEducation({ goalType, completedTopicIds = [] } = {}) {
  if (goalType !== "BLOOD_PRESSURE_CONTROL") return null;
  return BP_EDUCATION_CATALOG.find(topic => !completedTopicIds.includes(topic.id)) || null;
}
