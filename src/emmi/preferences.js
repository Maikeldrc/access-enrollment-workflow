export const EMMI_PREFERENCES_KEY = "itera.emmi.preferences.v1";

export function readEmmiPreferences(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(EMMI_PREFERENCES_KEY) || "null") || {}; }
  catch { return {}; }
}

// /new represents a completely fresh enrollment. Neither having already met EMMI nor having
// enabled voice in the previous enrollment may carry over; the new patient must opt in themselves.
// Other EMMI preferences can remain if they are added later.
export function clearEmmiEnrollmentContinuity(storage = globalThis.localStorage) {
  const preferences = readEmmiPreferences(storage);
  delete preferences.emmiWelcomeAcknowledged;
  delete preferences.emmiVoiceGuidance;
  try {
    if (Object.keys(preferences).length) storage?.setItem(EMMI_PREFERENCES_KEY, JSON.stringify(preferences));
    else storage?.removeItem(EMMI_PREFERENCES_KEY);
  } catch { /* Storage is best-effort; the rest of the enrollment reset must continue. */ }
}
