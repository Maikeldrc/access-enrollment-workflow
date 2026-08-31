export const EMMI_PREFERENCES_KEY = "itera.emmi.preferences.v1";

export function readEmmiPreferences(storage = globalThis.localStorage) {
  try { return JSON.parse(storage?.getItem(EMMI_PREFERENCES_KEY) || "null") || {}; }
  catch { return {}; }
}

// Voice guidance is a browser preference. Having already met EMMI is a fact about one patient's
// conversation, so /new must not carry it to the next patient and make a fresh chat look resumed.
export function clearEmmiEnrollmentContinuity(storage = globalThis.localStorage) {
  const preferences = readEmmiPreferences(storage);
  if (!("emmiWelcomeAcknowledged" in preferences)) return;
  delete preferences.emmiWelcomeAcknowledged;
  try {
    if (Object.keys(preferences).length) storage?.setItem(EMMI_PREFERENCES_KEY, JSON.stringify(preferences));
    else storage?.removeItem(EMMI_PREFERENCES_KEY);
  } catch { /* Storage is best-effort; the rest of the enrollment reset must continue. */ }
}
