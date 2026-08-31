import { APPOINTMENT_MODALITY, APPOINTMENT_STATUS, TIME_OF_DAY } from "./appointments.js";

export const SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS = 2500;
export const SIMULATED_APPOINTMENT_TIMEZONE = "America/New_York";

const PENDING_RESPONSE_STATUSES = new Set([
  APPOINTMENT_STATUS.REQUEST_SENT,
  APPOINTMENT_STATUS.WAITING_FOR_OFFICE
]);

const responseAnchor = appointment => appointment?.requestSentAt || appointment?.updatedAt || appointment?.createdAt || "";

export function simulatedAppointmentResponseDueAt(appointment, delayMs = SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS) {
  if (!PENDING_RESPONSE_STATUSES.has(appointment?.status)) return null;
  const anchor = new Date(responseAnchor(appointment)).getTime();
  return Number.isFinite(anchor) ? anchor + delayMs : Date.now();
}

export const simulatedAppointmentResponseIsDue = (appointment, now = new Date(), delayMs = SIMULATED_APPOINTMENT_RESPONSE_DELAY_MS) => {
  const dueAt = simulatedAppointmentResponseDueAt(appointment, delayMs);
  return dueAt !== null && dueAt <= new Date(now).getTime();
};

const datePartsIn = (date, timeZone) => Object.fromEntries(new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
}).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));

const zonedInstant = ({ year, month, day, hour, minute }, timeZone) => {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = wallClockUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = datePartsIn(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess = wallClockUtc - (renderedAsUtc - guess);
  }
  return new Date(guess);
};

const nextServiceDay = (now, timeZone) => {
  const parts = datePartsIn(now, timeZone);
  const cursor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  let businessDays = 0;
  while (businessDays < 2) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
};

const preferredClock = preferredTimeOfDay => ({
  [TIME_OF_DAY.MORNING]: [10, 30],
  [TIME_OF_DAY.AFTERNOON]: [14, 30],
  [TIME_OF_DAY.EVENING]: [17, 30],
  [TIME_OF_DAY.NO_PREFERENCE]: [10, 30]
}[preferredTimeOfDay] || [10, 30]);

const resolvedModality = appointment => {
  if (Object.values(APPOINTMENT_MODALITY).includes(appointment?.preferredModality) && appointment.preferredModality !== APPOINTMENT_MODALITY.NO_PREFERENCE) return appointment.preferredModality;
  return appointment?.requestedProfessionalType === "CARE_MANAGER" ? APPOINTMENT_MODALITY.TELEHEALTH : APPOINTMENT_MODALITY.IN_PERSON;
};

const stableCode = value => {
  let hash = 2166136261;
  for (const character of String(value || "appointment")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0").slice(-7);
};

export function simulateAppointmentServiceResponse(appointment, { now = new Date(), timeZone = SIMULATED_APPOINTMENT_TIMEZONE } = {}) {
  if (!PENDING_RESPONSE_STATUSES.has(appointment?.status)) return { ok: false, error: "REQUEST_NOT_PENDING" };
  const serviceDay = nextServiceDay(new Date(now), timeZone);
  const [hour, minute] = preferredClock(appointment.preferredTimeOfDay);
  const start = zonedInstant({ ...serviceDay, hour, minute }, timeZone);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const modality = resolvedModality(appointment);
  return {
    ok: true,
    confirmationNumber: `ITERA-${stableCode(`${appointment.id}|${start.toISOString()}`)}`,
    scheduledAt: start.toISOString(),
    scheduledEndAt: end.toISOString(),
    timezone: timeZone,
    modality,
    locationName: modality === APPOINTMENT_MODALITY.TELEHEALTH
      ? "ITERA virtual care"
      : modality === APPOINTMENT_MODALITY.PHONE
        ? "Phone visit"
        : appointment.practiceName || appointment.providerDisplayName || "Care team office",
    locationAddress: modality === APPOINTMENT_MODALITY.IN_PERSON ? appointment.locationAddress || "" : "",
    joinUrl: ""
  };
}
