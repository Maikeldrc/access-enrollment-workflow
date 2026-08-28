// Getting a refill is not a button. It is: does the patient still take this, has anything changed,
// is it safe to continue, whose approval does it need, where does it go, what actually happened,
// and did the medication ever reach the patient. This module owns those decisions. It never
// prescribes: every path either uses an existing authorisation or hands the decision to a person.

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localRefillText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

export const REFILL_PATHS = Object.freeze({
  DIRECT_PHARMACY_FULFILLMENT: "DIRECT_PHARMACY_FULFILLMENT",
  PRESCRIBER_REFILL_REQUEST: "PRESCRIBER_REFILL_REQUEST",
  CARE_TEAM_REVIEW: "CARE_TEAM_REVIEW",
  CLINICAL_REVIEW_REQUIRED: "CLINICAL_REVIEW_REQUIRED",
  APPOINTMENT_REQUIRED: "APPOINTMENT_REQUIRED",
  LAB_OR_OTHER_REQUIREMENT: "LAB_OR_OTHER_REQUIREMENT",
  PATIENT_ACTION_REQUIRED: "PATIENT_ACTION_REQUIRED",
  UNSUPPORTED: "UNSUPPORTED"
});

// Where a refill actually is. Requested, approved and ready are three different facts from three
// different sources, and the product may only ever claim the one it has been told.
export const REFILL_STATUS = Object.freeze({
  DRAFT: "REFILL_DRAFT",
  SUBMITTING: "REQUEST_SUBMITTING",
  REQUESTED: "REFILL_REQUESTED",
  PENDING_PRESCRIBER: "PENDING_PRESCRIBER",
  NEEDS_CLINICAL_REVIEW: "NEEDS_CLINICAL_REVIEW",
  NEEDS_APPOINTMENT: "NEEDS_APPOINTMENT",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
  SENT_TO_PHARMACY: "SENT_TO_PHARMACY",
  PHARMACY_PROCESSING: "PHARMACY_PROCESSING",
  READY_FOR_PICKUP: "READY_FOR_PICKUP",
  DELIVERY_SCHEDULED: "DELIVERY_SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELED",
  UNABLE_TO_PROCESS: "UNABLE_TO_PROCESS"
});

export const REFILL_BLOCKERS = Object.freeze({
  MEDICATION_CONCERN: "MEDICATION_CONCERN",
  MEDICATION_DISCREPANCY: "MEDICATION_DISCREPANCY",
  PATIENT_STOPPED: "PATIENT_STOPPED",
  UNSURE: "UNSURE",
  CLINICAL_SAFETY: "CLINICAL_SAFETY"
});

const OPEN_STATUSES = [REFILL_STATUS.DRAFT, REFILL_STATUS.SUBMITTING, REFILL_STATUS.REQUESTED, REFILL_STATUS.PENDING_PRESCRIBER, REFILL_STATUS.NEEDS_CLINICAL_REVIEW, REFILL_STATUS.NEEDS_APPOINTMENT, REFILL_STATUS.APPROVED, REFILL_STATUS.SENT_TO_PHARMACY, REFILL_STATUS.PHARMACY_PROCESSING, REFILL_STATUS.READY_FOR_PICKUP, REFILL_STATUS.DELIVERY_SCHEDULED];
export const refillIsOpen = refill => OPEN_STATUSES.includes(refill?.status);
export const openRefills = (refills = []) => refills.filter(refillIsOpen);
export const openRefillFor = (refills = [], medicationId) => openRefills(refills).find(refill => refill.medicationId === medicationId) || null;

// What the patient said when asked whether they still take it. A patient report is an input to
// reconciliation, never an edit to the clinical order.
export const TAKING_ANSWERS = Object.freeze({ YES: "YES", CHANGED: "CHANGED", STOPPED: "STOPPED", UNSURE: "UNSURE" });
export const SUPPLY_ANSWERS = Object.freeze({ RUNNING_LOW: "RUNNING_LOW", ENOUGH: "ENOUGH", UNSURE: "UNSURE" });

// The resolver. Safety first, then what the patient told us, then what the prescription itself
// allows. Nothing here is decided by a model, and nothing invents a requirement: an appointment or
// a lab is only ever required because the medication's own workflow says so.
export function resolveRefillPath({
  medication = null,
  blocker = "",
  safetyResult = null,
  capabilities = {},
  now = new Date()
} = {}) {
  if (!medication) return { path: REFILL_PATHS.UNSUPPORTED, reason: "NO_MEDICATION", requiresPrescriber: false, requiresClinicalReview: false, requiresAppointment: false };
  if (safetyResult && ["EMERGENCY", "CARE_TEAM_REVIEW"].includes(safetyResult.severity)) {
    return { path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, reason: "CLINICAL_SAFETY", severity: safetyResult.severity, requiresPrescriber: false, requiresClinicalReview: true, requiresAppointment: false };
  }
  if (blocker === REFILL_BLOCKERS.MEDICATION_CONCERN) return { path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, reason: "MEDICATION_CONCERN", requiresPrescriber: false, requiresClinicalReview: true, requiresAppointment: false };
  if (blocker === REFILL_BLOCKERS.MEDICATION_DISCREPANCY) return { path: REFILL_PATHS.CLINICAL_REVIEW_REQUIRED, reason: "MEDICATION_DISCREPANCY", requiresPrescriber: false, requiresClinicalReview: true, requiresAppointment: false };
  if (blocker === REFILL_BLOCKERS.PATIENT_STOPPED) return { path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "PATIENT_REPORTED_STOPPED", requiresPrescriber: false, requiresClinicalReview: true, requiresAppointment: false };
  if (blocker === REFILL_BLOCKERS.UNSURE) return { path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "PATIENT_UNSURE", requiresPrescriber: false, requiresClinicalReview: false, requiresAppointment: false };
  if (!medication.active) return { path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "MEDICATION_NOT_ACTIVE", requiresPrescriber: false, requiresClinicalReview: true, requiresAppointment: false };

  const workflow = medication.refillWorkflow || {};
  // Requirements come from the medication's own workflow — a prescriber, a practice, a policy —
  // and never from EMMI deciding a visit or a test would be sensible.
  if (workflow.requiresAppointmentBeforeRenewal) return { path: REFILL_PATHS.APPOINTMENT_REQUIRED, reason: workflow.requirementReason || "FOLLOW_UP_VISIT_REQUIRED", requiresPrescriber: true, requiresClinicalReview: false, requiresAppointment: true };
  if (workflow.requiresMonitoringResult) return { path: REFILL_PATHS.LAB_OR_OTHER_REQUIREMENT, reason: workflow.requirementReason || "MONITORING_REQUIRED", requiresPrescriber: true, requiresClinicalReview: true, requiresAppointment: false };
  if (workflow.controlled || workflow.restricted) return { path: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, reason: "RESTRICTED_WORKFLOW", requiresPrescriber: true, requiresClinicalReview: false, requiresAppointment: false };

  const expired = medication.prescriptionExpiresOn && new Date(medication.prescriptionExpiresOn) < new Date(now);
  const refillsRemaining = Number(medication.refillsRemaining);
  if (!expired && Number.isFinite(refillsRemaining) && refillsRemaining > 0 && capabilities.pharmacyFulfillment !== false && medication.pharmacy) {
    // The prescription already authorises this fill; involving the prescriber would only add a wait.
    return { path: REFILL_PATHS.DIRECT_PHARMACY_FULFILLMENT, reason: "REFILLS_REMAINING", requiresPrescriber: false, requiresClinicalReview: false, requiresAppointment: false };
  }
  if (!medication.prescriber) return { path: REFILL_PATHS.CARE_TEAM_REVIEW, reason: "PRESCRIBER_UNKNOWN", requiresPrescriber: true, requiresClinicalReview: false, requiresAppointment: false };
  return { path: REFILL_PATHS.PRESCRIBER_REFILL_REQUEST, reason: expired ? "PRESCRIPTION_EXPIRED" : "NO_REFILLS_REMAINING", requiresPrescriber: true, requiresClinicalReview: false, requiresAppointment: false };
}

const STATUS_BY_PATH = Object.freeze({
  [REFILL_PATHS.DIRECT_PHARMACY_FULFILLMENT]: REFILL_STATUS.SENT_TO_PHARMACY,
  [REFILL_PATHS.PRESCRIBER_REFILL_REQUEST]: REFILL_STATUS.PENDING_PRESCRIBER,
  [REFILL_PATHS.CARE_TEAM_REVIEW]: REFILL_STATUS.NEEDS_CLINICAL_REVIEW,
  [REFILL_PATHS.CLINICAL_REVIEW_REQUIRED]: REFILL_STATUS.NEEDS_CLINICAL_REVIEW,
  [REFILL_PATHS.APPOINTMENT_REQUIRED]: REFILL_STATUS.NEEDS_APPOINTMENT,
  [REFILL_PATHS.LAB_OR_OTHER_REQUIREMENT]: REFILL_STATUS.NEEDS_CLINICAL_REVIEW,
  [REFILL_PATHS.PATIENT_ACTION_REQUIRED]: REFILL_STATUS.DRAFT,
  [REFILL_PATHS.UNSUPPORTED]: REFILL_STATUS.UNABLE_TO_PROCESS
});

export const statusForPath = path => STATUS_BY_PATH[path] || REFILL_STATUS.REQUESTED;

// One episode ties the signal, the conversation, the request, the prescriber, the pharmacy, any
// barrier and any appointment together, so nothing about one refill has to be reassembled later
// from scattered records.
export function createRefillEpisode({
  id = `refill_${Date.now().toString(36)}`,
  patientId = "",
  medication,
  supplySignalId = null,
  source = "PATIENT",
  now = new Date().toISOString()
} = {}) {
  return {
    id,
    patientId,
    medicationId: medication?.id || "",
    medicationRequestId: medication?.medicationRequestId || null,
    medicationSnapshot: medication ? { name: medication.name, strength: medication.strength || "", sig: medication.sig || "", details: medication.details || "" } : null,
    supplySignalId,
    prescriberId: medication?.prescriber?.id || null,
    pharmacyId: medication?.pharmacy?.id || null,
    source,
    patientConfirmedTaking: null,
    patientConfirmedLowSupply: null,
    blocker: "",
    refillPath: null,
    refillReason: "",
    requiresPrescriber: false,
    requiresClinicalReview: false,
    requiresAppointment: false,
    status: REFILL_STATUS.DRAFT,
    statusSource: "ITERA",
    idempotencyKey: null,
    careTeamTaskId: null,
    relatedBarrierId: null,
    relatedAppointmentNeedId: null,
    events: [{ at: now, status: REFILL_STATUS.DRAFT, source: "ITERA" }],
    createdAt: now,
    requestedAt: null,
    approvedAt: null,
    sentToPharmacyAt: null,
    readyAt: null,
    completedAt: null,
    resolutionOutcome: null,
    updatedAt: now
  };
}

// Every status change records who said so. "Approved" from ITERA's own optimism is not a thing that
// can happen: only a prescriber source can set it, only a pharmacy source can set ready.
export function advanceRefill(episode, { status, source = "ITERA", detail = {}, now = new Date().toISOString() } = {}) {
  if (!episode || !status) return episode;
  const timestamps = {
    [REFILL_STATUS.REQUESTED]: "requestedAt",
    [REFILL_STATUS.PENDING_PRESCRIBER]: "requestedAt",
    [REFILL_STATUS.APPROVED]: "approvedAt",
    [REFILL_STATUS.SENT_TO_PHARMACY]: "sentToPharmacyAt",
    [REFILL_STATUS.READY_FOR_PICKUP]: "readyAt",
    [REFILL_STATUS.COMPLETED]: "completedAt"
  };
  const stamp = timestamps[status];
  return {
    ...episode,
    status,
    statusSource: source,
    ...(stamp && !episode[stamp] ? { [stamp]: now } : {}),
    events: [...(episode.events || []), { at: now, status, source, ...detail }],
    updatedAt: now
  };
}

// A double tap, a voice turn and a button press are the same intent. The key is derived from what
// the request is about, not from when it was made, so a retry cannot become a second prescription.
export const refillIdempotencyKey = ({ patientId = "", medicationId = "", supplySignalId = "", day = new Date().toISOString().slice(0, 10) } = {}) =>
  `refill:${patientId}:${medicationId}:${supplySignalId || "manual"}:${day}`;

export function findDuplicateRefill(refills = [], { patientId, medicationId, supplySignalId, now = new Date() } = {}) {
  const key = refillIdempotencyKey({ patientId, medicationId, supplySignalId, day: new Date(now).toISOString().slice(0, 10) });
  return refills.find(refill => refill.idempotencyKey === key && refillIsOpen(refill))
    || openRefillFor(refills, medicationId);
}

// What the patient reads. Never an enum, never a claim the product cannot support, and never a word
// that implies the patient did something wrong.
export const REFILL_PATIENT_STATUS = Object.freeze({
  REFILL_DRAFT: T("Ready to review", "Listo para revisar", "Pare pou revize"),
  REQUEST_SUBMITTING: T("Sending your request", "Enviando su solicitud", "N ap voye demann ou"),
  REFILL_REQUESTED: T("Refill requested", "Solicitud enviada", "Demann ranplisaj voye"),
  PENDING_PRESCRIBER: T("Waiting for your doctor", "Esperando a su médico", "N ap tann doktè ou"),
  NEEDS_CLINICAL_REVIEW: T("Your care team is reviewing this", "Su equipo de atención lo está revisando", "Ekip swen ou ap revize sa"),
  NEEDS_APPOINTMENT: T("One more step is needed", "Falta un paso más", "Gen yon etap ki manke"),
  APPROVED: T("Approved and sent to your pharmacy", "Aprobada y enviada a su farmacia", "Apwouve epi voye nan famasi ou"),
  DENIED: T("This needs another step", "Esto necesita otro paso", "Sa bezwen yon lòt etap"),
  SENT_TO_PHARMACY: T("Sent to your pharmacy", "Enviada a su farmacia", "Voye nan famasi ou"),
  PHARMACY_PROCESSING: T("Your pharmacy is preparing it", "Su farmacia la está preparando", "Famasi ou ap prepare l"),
  READY_FOR_PICKUP: T("Ready for pickup", "Lista para recoger", "Pare pou w al pran l"),
  DELIVERY_SCHEDULED: T("Delivery scheduled", "Entrega programada", "Livrezon pwograme"),
  COMPLETED: T("Refill completed", "Surtida completada", "Ranplisaj fini"),
  CANCELED: T("Canceled", "Cancelada", "Anile"),
  UNABLE_TO_PROCESS: T("Needs your attention", "Necesita su atención", "Bezwen atansyon ou")
});

export const refillPatientStatus = (episode, locale = "en") =>
  localRefillText(REFILL_PATIENT_STATUS[episode?.status] || REFILL_PATIENT_STATUS.REFILL_DRAFT, locale);

// What happens next, in the patient's terms. Sent to a pharmacy that cannot report back says so
// plainly instead of implying ITERA will know when it is ready.
export const REFILL_NEXT_STEP = Object.freeze({
  PENDING_PRESCRIBER: T("EMMI will let you know when the status changes.", "EMMI le avisará cuando cambie el estado.", "EMMI ap fè w konnen lè estati a chanje."),
  NEEDS_CLINICAL_REVIEW: T("Your care team will follow up with you.", "Su equipo de atención se comunicará con usted.", "Ekip swen ou ap kontakte w."),
  NEEDS_APPOINTMENT: T("EMMI can help you coordinate the visit.", "EMMI puede ayudarle a coordinar la visita.", "EMMI ka ede w òganize vizit la."),
  SENT_TO_PHARMACY_UNTRACKED: T("Contact the pharmacy to confirm when it is ready.", "Comuníquese con la farmacia para confirmar cuándo estará lista.", "Kontakte famasi a pou konfime lè li pare."),
  SENT_TO_PHARMACY_TRACKED: T("EMMI will let you know when the pharmacy has it ready.", "EMMI le avisará cuando la farmacia la tenga lista.", "EMMI ap fè w konnen lè famasi a gen li pare."),
  READY_FOR_PICKUP: T("You can pick it up at your pharmacy.", "Puede recogerla en su farmacia.", "Ou ka al pran l nan famasi ou.")
});

export function refillNextStep(episode, { pharmacyStatusAvailable = false } = {}, locale = "en") {
  if (!episode) return "";
  if (episode.status === REFILL_STATUS.SENT_TO_PHARMACY || episode.status === REFILL_STATUS.APPROVED) {
    return localRefillText(pharmacyStatusAvailable ? REFILL_NEXT_STEP.SENT_TO_PHARMACY_TRACKED : REFILL_NEXT_STEP.SENT_TO_PHARMACY_UNTRACKED, locale);
  }
  return localRefillText(REFILL_NEXT_STEP[episode.status] || "", locale);
}

// The structured handoff. A care team gets the medication, what the patient said, what stopped the
// refill and what is being asked of them — not a transcript.
export function refillCareTeamSummary({ episode, medication, supplyEstimate = null, request = "" } = {}) {
  if (!episode) return null;
  return {
    medication: medication ? `${medication.name}${medication.strength ? ` ${medication.strength}` : ""}` : episode.medicationSnapshot?.name || "",
    documentedSig: medication?.sig || episode.medicationSnapshot?.sig || "",
    patientConfirmedTaking: episode.patientConfirmedTaking,
    patientConfirmedLowSupply: episode.patientConfirmedLowSupply,
    estimatedDaysRemaining: supplyEstimate?.estimatedDaysRemaining ?? null,
    supplyConfidence: supplyEstimate?.confidence ?? null,
    issue: episode.blocker || null,
    refillPath: episode.refillPath,
    refillStatus: episode.status,
    prescriber: medication?.prescriber?.name || null,
    pharmacy: medication?.pharmacy?.name || null,
    request: request || "CLINICAL_REVIEW",
    requestedAt: episode.requestedAt || episode.createdAt
  };
}

// Analytics describe the shape of the episode, never the medication name or anything the patient
// typed about how they feel.
export const refillAnalytics = episode => (episode
  ? {
    refillId: episode.id,
    medicationId: episode.medicationId,
    source: episode.source,
    refillPath: episode.refillPath,
    status: episode.status,
    statusSource: episode.statusSource,
    blocker: episode.blocker || null,
    requiresPrescriber: episode.requiresPrescriber,
    requiresClinicalReview: episode.requiresClinicalReview,
    requiresAppointment: episode.requiresAppointment,
    hoursToRequest: episode.requestedAt && episode.createdAt ? Math.round((new Date(episode.requestedAt) - new Date(episode.createdAt)) / 3600000) : null,
    outcome: episode.resolutionOutcome
  }
  : {});
