// The outside world, simulated — and the seam where the real one plugs in.
//
// Every barrier resolution playbook needs something this product does not have: a rideshare
// dispatcher, a scheduling system that can actually move an appointment, a way to text a daughter,
// a microphone. This module is where all of that lives, behind five services with the narrow
// interfaces the playbooks call:
//
//   transportationService.search / reserve / cancel
//   schedulingAssistService.getAvailableSlots / reschedule
//   companionService.contacts / invite / getStatus
//   videoReadinessService.check
//   careTeamService.createAssistanceRequest
//
// Each one is created from a provider object. Today every provider is a demo implementation; an
// UberProvider, a real SchedulingProvider or an SMSProvider replaces one by satisfying the same
// four or five methods, and nothing in src/barrierResolutionViews.js or the shell changes.
//
// THE ONE RULE THIS FILE ENFORCES ABOUT ITSELF
//
// A demo provider must never be mistaken for a real one. Every result it returns carries
// `simulated: true` and a `providerMode` of "DEMO", and the shell refuses to tell a patient a ride
// is booked unless something actually said so. That is why reserve() returns a reservation object
// rather than a boolean: there is no way to render "your ride is booked" without holding the thing
// that says it was.
//
// Latency, availability, ids, pricing and status changes are all simulated. So is failure — one
// controlled failure path per service, because a prototype where nothing can go wrong is a
// prototype that has never shown anyone what happens when it does.

import { getProviderAvailability, reservableAvailabilitySlots } from "./schedulingCapability.js";
import { recommendedPickupTime, returnPickupTime } from "./barrierResolution.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });
const L = (value, locale = "en") => (typeof value === "string" ? value : value?.[locale] || value?.en || "");

export const PROVIDER_MODES = Object.freeze({ DEMO: "DEMO", LIVE: "LIVE" });

// §13. One switch, read by every service. Nothing else in the app decides whether a provider is
// simulated, and a service constructed with a live provider stops stamping `simulated`.
let demoMode = true;
export const setBarrierDemoMode = value => { demoMode = value !== false; };
export const barrierDemoMode = () => demoMode === true;

// Deterministic pseudo-randomness. The same appointment produces the same ride options for the
// patient, for the person demoing it, and for the test suite — which is what makes a simulated
// result reviewable rather than a slot machine.
const seedOf = value => {
  let hash = 2166136261;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

// Simulated network delay. Exposed as a parameter so tests run instantly and the demo feels real:
// a search that returns in 0 ms reads as a hardcoded list, and a search that takes two seconds
// reads as a broken app.
const LATENCY = Object.freeze({
  search: [700, 1100],
  reserve: [600, 900],
  cancel: [400, 600],
  slots: [700, 1100],
  invite: [600, 900],
  inviteAnswer: [1800, 2600],
  deviceCheck: [400, 700],
  careTeam: [400, 700]
});

let latencyScale = 1;
// Playwright and vitest set this to 0. Nothing else should: the delay is the point of the demo.
export const setBarrierLatencyScale = scale => { latencyScale = Number.isFinite(scale) && scale >= 0 ? scale : 1; };

const wait = (key, seed = 0) => {
  const [low, high] = LATENCY[key] || [500, 500];
  const span = high - low;
  const ms = Math.round((low + (span ? seedOf(`${key}:${seed}`) % (span + 1) : 0)) * latencyScale);
  return ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();
};

// A deliberate pause for work that has no provider behind it — classifying what a patient typed,
// for instance. It obeys the same scale as every simulated call, so a test never waits for it.
export const barrierPause = (ms = 500) => {
  const scaled = Math.round(ms * latencyScale);
  return scaled > 0 ? new Promise(resolve => setTimeout(resolve, scaled)) : Promise.resolve();
};

const stamp = () => new Date().toISOString();
const shortId = (prefix, seed) => `${prefix}-${(seedOf(String(seed)) % 90000 + 10000).toString()}`;

/* ==========================================================================================
   Transportation
   ========================================================================================== */

// Ride types, as capabilities rather than brands. "Accessible" is not a nicer car; it is a
// different vehicle with a ramp and a driver trained to use it, and the flow needs to be able to
// say a patient needs one and none is available.
const RIDE_TYPES = Object.freeze([
  Object.freeze({
    id: "STANDARD",
    serviceName: "UberX",
    seats: 3,
    accessible: false,
    priceBase: 14.2,
    priceRate: 0.55,
    pickupOffsetMinutes: 0,
    icon: "car",
    description: T("Standard car", "Vehículo estándar", "Machin estanda")
  }),
  Object.freeze({
    id: "EXTRA_ROOM",
    serviceName: "UberXL",
    seats: 5,
    accessible: false,
    priceBase: 21.4,
    priceRate: 0.78,
    pickupOffsetMinutes: -5,
    icon: "car",
    description: T("More room", "Más espacio", "Plis espas")
  }),
  Object.freeze({
    id: "ACCESSIBLE",
    serviceName: "Uber WAV",
    seats: 2,
    accessible: true,
    priceBase: 18.6,
    priceRate: 0.6,
    pickupOffsetMinutes: -10,
    icon: "car",
    description: T("Wheelchair accessible", "Accesible en silla de ruedas", "Aksesib pou chèz woulant")
  }),
  Object.freeze({
    id: "ASSISTED",
    serviceName: "Assisted ride",
    seats: 2,
    accessible: true,
    priceBase: 0,
    priceRate: 0,
    pickupOffsetMinutes: -15,
    icon: "people",
    description: T("Driver helps you to the door", "El conductor le ayuda hasta la puerta", "Chofè a ede w rive nan pòt la")
  })
]);

const money = value => `$${value.toFixed(2)}`;

// A demo dispatcher. It answers the two questions a real one answers — what can come, and when —
// from the trip itself rather than from a table of pre-written cards, so changing the pickup time
// by fifteen minutes changes every arrival estimate on screen the way it would in life.
export const TransportationDemoProvider = Object.freeze({
  id: "TRANSPORTATION_DEMO",
  mode: PROVIDER_MODES.DEMO,

  async search({ appointmentId = "", pickupAt = "", pickupAddress = null, destination = null, needs = null, locale = "en" } = {}) {
    const seed = seedOf(`${appointmentId}:${pickupAt}:${pickupAddress?.zip || ""}`);
    await wait("search", seed);
    const start = new Date(pickupAt || "");
    if (Number.isNaN(start.getTime())) return { ok: false, error: "NO_PICKUP_TIME", simulated: demoMode };

    const accessibilityRequired = needs?.accessibilityRequired === true;
    const passengers = 1 + Number(needs?.extraPassengers || 0);
    const travelMinutes = Number(needs?.travelMinutes) || 24;

    // §24: "no transportation available" has to be reachable. One in eight demo trips has nothing
    // at the requested hour — enough to be demonstrable, rare enough not to derail a demo.
    if (seed % 8 === 0) return { ok: true, options: [], simulated: demoMode, providerMode: PROVIDER_MODES.DEMO, searchedAt: stamp() };

    const options = RIDE_TYPES
      .filter(type => (accessibilityRequired ? type.accessible : true))
      .filter(type => type.seats >= passengers)
      // The assisted ride is not something a patient books from a list — it is what the care team
      // arranges. It stays out of the options and the flow escalates instead.
      .filter(type => type.id !== "ASSISTED")
      .map((type, index) => {
        const pickup = new Date(start.getTime() + type.pickupOffsetMinutes * 60000);
        const variance = (seedOf(`${appointmentId}:${type.id}`) % 7) - 3;
        const rideMinutes = Math.max(8, travelMinutes + variance);
        const estimate = type.priceBase + type.priceRate * rideMinutes;
        return {
          optionId: `${type.id}_${pickup.getTime()}`,
          rideType: type.id,
          serviceName: type.serviceName,
          description: L(type.description, locale),
          icon: type.icon,
          seats: type.seats,
          accessible: type.accessible,
          pickupAt: pickup.toISOString(),
          estimatedArrivalAt: new Date(pickup.getTime() + rideMinutes * 60000).toISOString(),
          rideMinutes,
          estimatedCost: money(estimate),
          estimatedCostValue: Number(estimate.toFixed(2)),
          recommended: index === 0,
          destinationName: destination?.name || "",
          simulated: demoMode
        };
      });

    return { ok: true, options, simulated: demoMode, providerMode: PROVIDER_MODES.DEMO, searchedAt: stamp() };
  },

  async reserve({ option = null, pickupAddress = null, destination = null, appointmentId = "", tripType = "OUTBOUND" } = {}) {
    const seed = seedOf(`${appointmentId}:${option?.optionId || ""}:${tripType}`);
    await wait("reserve", seed);
    if (!option?.optionId) return { ok: false, error: "NO_OPTION", simulated: demoMode };
    // §24: a reservation that fails. One in eleven, so the happy path is what a demo normally sees
    // and the failure state is still reachable by picking a different ride.
    if (seed % 11 === 0) return { ok: false, error: "PROVIDER_UNAVAILABLE", retryable: true, simulated: demoMode };
    return {
      ok: true,
      simulated: demoMode,
      providerMode: PROVIDER_MODES.DEMO,
      reservation: {
        reservationId: shortId("UB", `${appointmentId}:${option.optionId}:${tripType}`),
        tripType,
        status: "CONFIRMED",
        rideType: option.rideType,
        serviceName: option.serviceName,
        pickupAt: option.pickupAt,
        estimatedArrivalAt: option.estimatedArrivalAt,
        estimatedCost: option.estimatedCost,
        pickupFormatted: pickupAddress?.formatted || "",
        destinationName: destination?.name || "",
        destinationFormatted: destination?.formatted || "",
        reservedAt: stamp(),
        simulated: demoMode
      }
    };
  },

  async cancel({ reservationId = "" } = {}) {
    await wait("cancel", reservationId);
    if (!reservationId) return { ok: false, error: "NO_RESERVATION", simulated: demoMode };
    return { ok: true, reservationId, canceledAt: stamp(), simulated: demoMode, providerMode: PROVIDER_MODES.DEMO };
  }
});

// The service the playbooks call. It adds the two things a provider should not have to know: the
// pickup-time arithmetic that comes from the appointment, and the refusal to reserve anything that
// the patient has not selected on a review step.
export const createTransportationService = (provider = TransportationDemoProvider) => Object.freeze({
  providerId: provider.id,
  providerMode: provider.mode,
  recommendedPickup: (appointment, options) => recommendedPickupTime(appointment?.scheduledAt, options),
  returnPickup: (appointment, choiceId) => returnPickupTime(appointment, choiceId),
  search: params => provider.search(params),
  reserve: params => provider.reserve(params),
  cancel: params => provider.cancel(params)
});

export const transportationService = createTransportationService();

/* ==========================================================================================
   Scheduling — moving an appointment that already exists
   ========================================================================================== */

// This is deliberately NOT a second scheduler. src/schedulingCapability.js already owns what a
// provider's calendar looks like and which offices can be booked at all; this wraps it so the
// reschedule playbook gets slots grouped the way the screen needs them, and so an office that
// cannot be booked directly returns a reason rather than fabricated times.
export const SchedulingDemoProvider = Object.freeze({
  id: "SCHEDULING_DEMO",
  mode: PROVIDER_MODES.DEMO,

  async getAvailableSlots({ appointment = null, now = new Date() } = {}) {
    await wait("slots", appointment?.id || "");
    const providerId = appointment?.requestedProfessionalId || "";
    const availability = getProviderAvailability({
      providerId,
      modality: appointment?.modality || "",
      now
    });
    if (!availability.ok) return { ok: false, error: availability.error, simulated: demoMode, providerMode: PROVIDER_MODES.DEMO };
    // Only slots that carry a live hold are offered: the fixture slot that exists to prove a race
    // is not a time EMMI may put in front of a patient as available.
    const slots = reservableAvailabilitySlots(availability.slots, now)
      // The time they already have is not an alternative to the time they already have.
      .filter(slot => slot.startAt !== appointment?.scheduledAt)
      .slice(0, 5);
    return { ok: true, slots, simulated: demoMode, providerMode: PROVIDER_MODES.DEMO, searchedAt: stamp() };
  },

  async reschedule({ appointment = null, slot = null } = {}) {
    await wait("reserve", `${appointment?.id || ""}:${slot?.slotId || ""}`);
    if (!appointment || !slot?.slotId) return { ok: false, error: "MISSING_INPUT", simulated: demoMode };
    if (new Date(slot.expiresAt || 0).getTime() < Date.now()) return { ok: false, error: "SLOT_GONE", retryable: true, simulated: demoMode };
    return {
      ok: true,
      simulated: demoMode,
      providerMode: PROVIDER_MODES.DEMO,
      scheduledAt: slot.startAt,
      scheduledEndAt: slot.endAt,
      modality: slot.modality || appointment.modality || "",
      locationName: slot.locationName || appointment.locationName || "",
      confirmationNumber: shortId("ITERA", `${appointment.id}:${slot.slotId}`),
      rescheduledAt: stamp()
    };
  }
});

export const createSchedulingAssistService = (provider = SchedulingDemoProvider) => Object.freeze({
  providerId: provider.id,
  providerMode: provider.mode,
  getAvailableSlots: params => provider.getAvailableSlots(params),
  reschedule: params => provider.reschedule(params)
});

export const schedulingAssistService = createSchedulingAssistService();

/* ==========================================================================================
   Companion — asking someone to come along
   ========================================================================================== */

// Demo caregivers, used only when the patient's own Care Circle has nobody in it. A real Care
// Circle member always wins: these exist so the flow is demonstrable on a fresh enrollment, not to
// pad a list the patient actually built.
const DEMO_CONTACTS = Object.freeze([
  Object.freeze({ contactId: "demo-maria", firstName: "Maria", relationship: T("Daughter", "Hija", "Pitit fi"), source: "DEMO" }),
  Object.freeze({ contactId: "demo-carlos", firstName: "Carlos", relationship: T("Son", "Hijo", "Pitit gason"), source: "DEMO" })
]);

// How an invitation answers itself in the demo. A real provider replaces this with an inbound
// webhook; the playbook only ever reads getStatus(), so it does not care which one it is talking to.
const INVITE_ANSWER_MS = 2200;
// The one demo caregiver who says no, named so a test and a demo point at the same fixture.
export const DECLINING_DEMO_CONTACT_ID = "demo-carlos";

export const CompanionDemoProvider = Object.freeze({
  id: "COMPANION_DEMO",
  mode: PROVIDER_MODES.DEMO,

  // careCircleMembers comes from the shell, already filtered to accepted members the patient has
  // permitted for appointments. This provider never reaches into storage for them.
  contacts({ careCircleMembers = [], locale = "en" } = {}) {
    const known = (Array.isArray(careCircleMembers) ? careCircleMembers : [])
      .filter(member => member?.firstName)
      .map(member => ({
        contactId: member.inviteId || `cc-${member.firstName}`,
        firstName: member.firstName,
        relationship: member.relationship || "",
        source: "CARE_CIRCLE"
      }));
    if (known.length) return { ok: true, contacts: known, simulated: false, providerMode: PROVIDER_MODES.DEMO };
    return {
      ok: true,
      contacts: DEMO_CONTACTS.map(contact => ({ ...contact, relationship: L(contact.relationship, locale) })),
      simulated: demoMode,
      providerMode: PROVIDER_MODES.DEMO
    };
  },

  async invite({ contact = null, appointmentId = "" } = {}) {
    await wait("invite", `${appointmentId}:${contact?.contactId || ""}`);
    if (!contact?.firstName) return { ok: false, error: "NO_CONTACT", simulated: demoMode };
    return {
      ok: true,
      simulated: demoMode,
      providerMode: PROVIDER_MODES.DEMO,
      invitation: {
        invitationId: shortId("INV", `${appointmentId}:${contact.contactId}`),
        contactId: contact.contactId,
        firstName: contact.firstName,
        relationship: contact.relationship || "",
        status: "PENDING",
        sentAt: stamp(),
        // The demo answer is decided at send time and revealed later, so getStatus() is a read
        // rather than a coin flip that could return two different answers to two callers.
        answersAt: new Date(Date.now() + INVITE_ANSWER_MS).toISOString(),
        // Which answer comes back is a property of the contact rather than a hash, so a demo can
        // reach BOTH outcomes on purpose: whoever is asked first says yes, and the second demo
        // caregiver says no. That is how §24's "caregiver declined" gets shown without waiting
        // for a hash to happen to land on it.
        answer: contact.contactId === DECLINING_DEMO_CONTACT_ID ? "DECLINED" : "CONFIRMED",
        simulated: demoMode
      }
    };
  },

  // No delay: this is a poll, and the delay is already baked into `answersAt`.
  getStatus({ invitation = null, now = new Date() } = {}) {
    if (!invitation?.invitationId) return { ok: false, error: "NO_INVITATION", simulated: demoMode };
    const due = new Date(invitation.answersAt || 0).getTime();
    if (!Number.isFinite(due) || new Date(now).getTime() < due) {
      return { ok: true, status: "PENDING", simulated: demoMode, providerMode: PROVIDER_MODES.DEMO };
    }
    return {
      ok: true,
      status: invitation.answer === "DECLINED" ? "DECLINED" : "CONFIRMED",
      answeredAt: invitation.answersAt,
      simulated: demoMode,
      providerMode: PROVIDER_MODES.DEMO
    };
  },

  // How long the shell should wait before asking again. Exposed so nothing hardcodes a timer.
  answerDelayMs: INVITE_ANSWER_MS
});

export const createCompanionService = (provider = CompanionDemoProvider) => Object.freeze({
  providerId: provider.id,
  providerMode: provider.mode,
  answerDelayMs: provider.answerDelayMs || 2000,
  contacts: params => provider.contacts(params),
  invite: params => provider.invite(params),
  getStatus: params => provider.getStatus(params)
});

export const companionService = createCompanionService();

/* ==========================================================================================
   Video visit readiness
   ========================================================================================== */

export const READINESS_CHECKS = Object.freeze(["MICROPHONE", "CAMERA", "CONNECTION", "APPOINTMENT_LINK"]);

const CHECK_LABELS = Object.freeze({
  MICROPHONE: T("Microphone", "Micrófono", "Mikwo"),
  CAMERA: T("Camera", "Cámara", "Kamera"),
  CONNECTION: T("Internet connection", "Conexión a internet", "Koneksyon entènèt"),
  APPOINTMENT_LINK: T("Appointment link", "Enlace de la cita", "Lyen randevou a")
});

const CHECK_OK = Object.freeze({
  MICROPHONE: T("Working", "Funciona", "Ap mache"),
  CAMERA: T("Working", "Funciona", "Ap mache"),
  CONNECTION: T("Good connection", "Buena conexión", "Bon koneksyon"),
  APPOINTMENT_LINK: T("Available", "Disponible", "Disponib")
});

const CHECK_PROBLEM = Object.freeze({
  MICROPHONE: T("I couldn’t detect your microphone.", "No pude detectar su micrófono.", "Mwen pa t ka detekte mikwo ou."),
  CAMERA: T("I couldn’t detect your camera.", "No pude detectar su cámara.", "Mwen pa t ka detekte kamera ou."),
  CONNECTION: T("Your connection looks weak right now.", "Su conexión se ve débil en este momento.", "Koneksyon ou sanble fèb kounye a."),
  APPOINTMENT_LINK: T("The link for this visit isn’t ready yet.", "El enlace para esta visita todavía no está listo.", "Lyen pou vizit sa a poko pare.")
});

// The step-by-step guidance behind "Walk me through it". Short, concrete, and about the phone in
// the patient's hand rather than about permissions models.
const CHECK_GUIDE = Object.freeze({
  MICROPHONE: Object.freeze([
    T("Open your phone’s settings and find this app in the list.", "Abra los ajustes de su teléfono y busque esta aplicación en la lista.", "Louvri paramèt telefòn ou epi jwenn aplikasyon sa a nan lis la."),
    T("Turn on the microphone permission.", "Active el permiso del micrófono.", "Mete pèmisyon mikwo a."),
    T("Come back here and check again.", "Vuelva aquí y revise de nuevo.", "Retounen isit la epi tcheke ankò.")
  ]),
  CAMERA: Object.freeze([
    T("Open your phone’s settings and find this app in the list.", "Abra los ajustes de su teléfono y busque esta aplicación en la lista.", "Louvri paramèt telefòn ou epi jwenn aplikasyon sa a nan lis la."),
    T("Turn on the camera permission.", "Active el permiso de la cámara.", "Mete pèmisyon kamera a."),
    T("Make sure nothing is covering the camera.", "Asegúrese de que nada cubra la cámara.", "Asire w anyen pa kouvri kamera a.")
  ]),
  CONNECTION: Object.freeze([
    T("Move closer to your Wi-Fi router if you can.", "Acérquese al router de Wi-Fi si puede.", "Pwoche kote routè Wi-Fi ou si ou kapab."),
    T("If Wi-Fi is weak, your phone’s own data connection often works better.", "Si el Wi-Fi está débil, los datos del teléfono suelen funcionar mejor.", "Si Wi-Fi a fèb, done telefòn ou souvan pi bon."),
    T("Check again once the signal looks stronger.", "Revise de nuevo cuando la señal se vea más fuerte.", "Tcheke ankò lè siyal la parèt pi fò.")
  ]),
  APPOINTMENT_LINK: Object.freeze([
    T("The office sends the link closer to the visit.", "El consultorio envía el enlace más cerca de la visita.", "Kabinè a voye lyen an pi pre vizit la."),
    T("You will find it on this appointment when it arrives.", "Lo encontrará en esta cita cuando llegue.", "W ap jwenn li nan randevou sa a lè li rive."),
    T("If it is not here on the day, I can ask your care team.", "Si no está el día de la cita, puedo avisar a su equipo de cuidado.", "Si li pa la jou a, mwen ka mande ekip swen ou.")
  ])
});

export const readinessCheckLabel = (id, locale = "en") => L(CHECK_LABELS[id] || "", locale);
export const readinessCheckOkText = (id, locale = "en") => L(CHECK_OK[id] || "", locale);
export const readinessCheckProblemText = (id, locale = "en") => L(CHECK_PROBLEM[id] || "", locale);
export const readinessCheckGuide = (id, locale = "en") => (CHECK_GUIDE[id] || []).map(line => L(line, locale));

// Where possible this asks the browser rather than pretending. `navigator.permissions` and
// `navigator.onLine` are read-only and cost nothing; the media devices are enumerated rather than
// opened, so the patient is never shown a permission prompt they did not ask for by tapping the
// button. When any of it is missing — an old browser, a locked-down webview, a test runner — the
// check falls back to the demo answer instead of failing the whole flow.
const probePermission = async name => {
  try {
    const status = await navigator.permissions?.query?.({ name });
    if (status?.state === "granted") return true;
    if (status?.state === "denied") return false;
    return null;
  } catch { return null; }
};

const probeDevice = async kind => {
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices?.();
    if (!Array.isArray(devices)) return null;
    return devices.some(device => device.kind === kind);
  } catch { return null; }
};

export const VideoReadinessDemoProvider = Object.freeze({
  id: "VIDEO_READINESS_DEMO",
  mode: PROVIDER_MODES.DEMO,

  async check({ appointment = null, useBrowserApis = true, locale = "en" } = {}) {
    await wait("deviceCheck", appointment?.id || "");
    const seed = seedOf(`${appointment?.id || ""}:readiness`);

    // The demo baseline. §24 asks for a failing check to be reachable: one appointment in four
    // finds a microphone problem, which is the issue a patient most often actually has.
    const demoAnswers = {
      MICROPHONE: seed % 4 !== 0,
      CAMERA: true,
      CONNECTION: true,
      APPOINTMENT_LINK: Boolean(appointment?.joinUrl) || seed % 3 !== 0
    };

    const live = {};
    if (useBrowserApis && typeof navigator !== "undefined") {
      const [micPermission, cameraPermission, hasMic, hasCamera] = await Promise.all([
        probePermission("microphone"), probePermission("camera"), probeDevice("audioinput"), probeDevice("videoinput")
      ]);
      // A denied permission is a real answer and overrides the demo. A granted one only counts when
      // the device is actually there. Anything indeterminate is left to the demo baseline.
      if (micPermission === false || hasMic === false) live.MICROPHONE = false;
      else if (micPermission === true && hasMic !== false) live.MICROPHONE = true;
      if (cameraPermission === false || hasCamera === false) live.CAMERA = false;
      else if (cameraPermission === true && hasCamera !== false) live.CAMERA = true;
      if (navigator.onLine === false) live.CONNECTION = false;
    }
    // The link is a fact about the record, never a guess: if the appointment carries one, it is
    // available, and the demo only decides the case where the record is silent.
    if (appointment?.joinUrl) live.APPOINTMENT_LINK = true;

    const results = READINESS_CHECKS.map(id => {
      const passed = live[id] === undefined ? demoAnswers[id] : live[id];
      return {
        id,
        passed: passed === true,
        source: live[id] === undefined ? "DEMO" : "BROWSER",
        label: readinessCheckLabel(id, locale),
        detail: passed === true ? readinessCheckOkText(id, locale) : readinessCheckProblemText(id, locale),
        guide: passed === true ? [] : readinessCheckGuide(id, locale)
      };
    });

    return {
      ok: true,
      ready: results.every(result => result.passed),
      results,
      issues: results.filter(result => !result.passed).map(result => result.id),
      simulated: demoMode && results.every(result => result.source === "DEMO"),
      providerMode: PROVIDER_MODES.DEMO,
      checkedAt: stamp()
    };
  }
});

export const createVideoReadinessService = (provider = VideoReadinessDemoProvider) => Object.freeze({
  providerId: provider.id,
  providerMode: provider.mode,
  check: params => provider.check(params)
});

export const videoReadinessService = createVideoReadinessService();

/* ==========================================================================================
   Care team escalation
   ========================================================================================== */

// The last stop in every playbook. It does not "send" anything — it creates the task the shell
// puts on the same care-team queue as an appointment request, and returns it so the shell can hold
// on to the id.
export const CareTeamDemoProvider = Object.freeze({
  id: "CARE_TEAM_DEMO",
  mode: PROVIDER_MODES.DEMO,

  async createAssistanceRequest({ task = null } = {}) {
    await wait("careTeam", task?.id || "");
    if (!task?.id) return { ok: false, error: "NO_TASK", simulated: demoMode };
    return { ok: true, task: { ...task, acknowledgedAt: "" }, simulated: demoMode, providerMode: PROVIDER_MODES.DEMO };
  }
});

export const createCareTeamService = (provider = CareTeamDemoProvider) => Object.freeze({
  providerId: provider.id,
  providerMode: provider.mode,
  createAssistanceRequest: params => provider.createAssistanceRequest(params)
});

export const careTeamService = createCareTeamService();

/* ==========================================================================================
   Demo-mode surface
   ========================================================================================== */

const DEMO_BADGE = T("Demo mode · simulated services", "Modo demostración · servicios simulados", "Mòd demonstrasyon · sèvis similye");
export const demoModeBadgeText = (locale = "en") => L(DEMO_BADGE, locale);

// Which providers are in play right now, for the internal badge and for anything that needs to
// prove it is not talking to a real dispatcher.
export const barrierProviderSummary = () => Object.freeze({
  demoMode: barrierDemoMode(),
  providers: Object.freeze({
    transportation: transportationService.providerId,
    scheduling: schedulingAssistService.providerId,
    companion: companionService.providerId,
    videoReadiness: videoReadinessService.providerId,
    careTeam: careTeamService.providerId
  })
});
