// Starting over, and what "over" has to mean.
//
// An enrollment is not one record. It is a draft, an EMMI conversation, a Care Circle, an audit
// trail and the shares the patient sent — five stores, written at different moments by different
// parts of the journey. "Start a new enrollment" is only honest if it reaches all five, because a
// patient who begins again and finds the previous patient's Care Circle waiting for them has not
// started again; they have inherited someone else.
//
// So this module decides ONE thing: which stores hold enrollment data and which hold the person's
// own preferences. It deliberately does not know any storage keys. Every key here would be a
// second source of truth that goes stale the first time a store adds one, and the store would keep
// working while the reset quietly stopped covering it — the exact failure that leaks patient A
// into patient B. Each store clears itself; this only says who gets asked.
//
// What survives is what belongs to the browser rather than to the enrollment: the chosen language,
// EMMI's voice-guidance setting and where the assistant sits on screen, the growth prompt
// cooldowns, and the QA console's own configuration. Wiping those would punish somebody for
// starting a second enrollment by making them pick their language again, and none of them can
// carry a fact about the previous patient. Conversation continuity is different: whether EMMI has
// already been introduced belongs to the enrollment and is cleared with the transcript.

// The two demo enrollments are the same fictional patient, so nothing here can be scoped by
// patient id: A and B share one. The enrollment boundary is the session itself, which is why each
// store is cleared whole rather than filtered.
export function resetEnrollmentSession({ draftStore, growthStore, clearConversation, clearAuditLog, clearAssistantContinuity } = {}) {
  const cleared = [];
  const attempt = (name, run) => {
    if (typeof run !== "function") return;
    // One store failing to clear must not leave the rest of the previous enrollment in place.
    // A partial reset is worse than a loud one: it is the state that looks new and is not.
    try { run(); cleared.push(name); } catch { /* storage can be unavailable; keep clearing */ }
  };
  // Each store is offered only when it is actually there, so `cleared` reports what was reset
  // rather than what was asked for. A caller that forgot to pass a store should see it missing
  // from the result, not read a reassuring name for something nothing touched.
  attempt("draft", draftStore && (() => draftStore.clear()));
  attempt("careCircleAndShares", growthStore && (() => growthStore.clearEnrollmentData()));
  attempt("emmiConversation", clearConversation);
  attempt("emmiAuditLog", clearAuditLog);
  attempt("emmiAssistantContinuity", clearAssistantContinuity);
  return { cleared };
}
