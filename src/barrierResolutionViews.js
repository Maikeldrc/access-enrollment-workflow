// Barrier resolution — patient-facing views.
//
// Same contract as src/appointmentViews.js, deliberately: pure functions returning HTML strings,
// one props object carrying { locale, icon, escapeHtml }, no DOM and no imports from the shell.
// The classes are the appointment sheet's classes wherever one already fits, because these screens
// are not a new product surface — they are what happens after the patient taps a barrier on a
// screen they are already on, and a different visual language there would read as leaving the app.
//
// THE SHAPE OF EVERY SCREEN, and why
//
//   [ EMMI says one or two sentences ]     ← conversation, for explaining and asking
//   [ structured UI ]                      ← cards, choices, addresses, prices, confirmations
//   [ one primary action, one way back ]
//
// §17 is the rule this file exists to keep: EMMI explains in language and the patient ACTS through
// structured components. Nothing here renders a chat log. A ride is chosen from a card with a
// price on it, not from a bubble; a time is confirmed on a review screen, not by typing "yes".
//
// DATA-ACTION CONTRACT — every button this module emits carries one of these. The shell builds its
// handler switch from BARRIER_VIEW_ACTIONS below.
//
//   barrier-accept / barrier-decline               data-resolution-id
//   barrier-back                                   data-resolution-id, data-step (where to go back to)
//   barrier-close                                  data-resolution-id  → back to the appointment
//   barrier-escalate                               data-resolution-id, data-reason
//   barrier-retry                                  data-resolution-id
//   barrier-pickup-home / barrier-pickup-other     data-resolution-id
//   barrier-pickup-save                            data-resolution-id  (reads #barrier-address-form)
//   barrier-need-toggle                            data-resolution-id, data-need
//   barrier-needs-continue                         data-resolution-id
//   barrier-time-accept / barrier-time-change      data-resolution-id
//   barrier-time-select                            data-resolution-id, data-pickup-at
//   barrier-option-select                          data-resolution-id, data-option-id
//   barrier-reserve-confirm                        data-resolution-id
//   barrier-ride-cancel / barrier-ride-cancel-confirm / barrier-ride-change
//                                                  data-resolution-id
//   barrier-return-yes / barrier-return-no         data-resolution-id
//   barrier-return-select                          data-resolution-id, data-return-choice
//   barrier-video-start / barrier-video-guide / barrier-video-recheck
//                                                  data-resolution-id
//   barrier-companion-answer                       data-resolution-id, data-answer="YES|NO"
//   barrier-companion-select                       data-resolution-id, data-contact-id
//   barrier-companion-new                          data-resolution-id
//   barrier-companion-save                         data-resolution-id  (reads #barrier-contact-form)
//   barrier-companion-send                         data-resolution-id
//   barrier-companion-another                      data-resolution-id
//   barrier-reschedule-start                       data-resolution-id
//   barrier-slot-select                            data-resolution-id, data-slot-id
//   barrier-reschedule-confirm                     data-resolution-id
//   barrier-transport-update                       data-resolution-id
//   barrier-other-submit                           data-resolution-id  (reads #barrier-describe-form)
//   barrier-route                                  data-resolution-id, data-barrier-type
//
// Never emitted: any control that books, cancels, invites or moves an appointment directly from a
// list. Every one of those is reached only from a review step (§12).

import { BARRIER_TYPES, RESOLUTION_STATUS, READINESS_STATES, resolutionSpeech, transportNeedOptions, pickupTimeChoices, returnTripChoices } from "./barrierResolution.js";
import { demoModeBadgeText } from "./barrierProviders.js";
import { endSentence, formatAppointmentLongDate, formatAppointmentTime, formatAppointmentWhen } from "./appointmentViews.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localBarrierText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

export const BARRIER_VIEW_ACTIONS = Object.freeze([
  "barrier-accept", "barrier-decline", "barrier-back", "barrier-close", "barrier-escalate", "barrier-retry",
  "barrier-pickup-home", "barrier-pickup-other", "barrier-pickup-save",
  "barrier-need-toggle", "barrier-needs-continue",
  "barrier-time-accept", "barrier-time-change", "barrier-time-select",
  "barrier-option-select", "barrier-reserve-confirm",
  "barrier-ride-cancel", "barrier-ride-cancel-confirm", "barrier-ride-change",
  "barrier-return-yes", "barrier-return-no", "barrier-return-select",
  "barrier-video-start", "barrier-video-guide", "barrier-video-recheck",
  "barrier-companion-answer", "barrier-companion-select", "barrier-companion-new",
  "barrier-companion-save", "barrier-companion-send", "barrier-companion-another",
  "barrier-reschedule-start", "barrier-slot-select", "barrier-reschedule-confirm",
  "barrier-transport-update", "barrier-other-submit", "barrier-route"
]);

/* ------------------------------------------------------------------- props plumbing ------- */

const FALLBACK_ESCAPE = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const escaper = props => (typeof props?.escapeHtml === "function" ? props.escapeHtml : FALLBACK_ESCAPE);
const iconOf = props => (typeof props?.icon === "function" ? props.icon : () => "");
const localeOf = props => (props?.locale === "es" || props?.locale === "ht" ? props.locale : "en");
const say = locale => (en, es, ht) => localBarrierText(T(en, es, ht), locale);

/* ------------------------------------------------------------------ shared components ----- */

// EMMI's voice on the screen. One short paragraph, never a stack of bubbles: §16 and §17 both
// depend on this staying a single element with a single line of text in it.
const emmiMessage = (props, text) => {
  // A caller that already said the thing itself passes " " to suppress EMMI's default line, so
  // whitespace has to count as nothing — otherwise the screen carries an empty bordered box.
  if (!String(text || "").trim()) return "";
  const esc = escaper(props);
  return `<p class="barrier-emmi-line">${iconOf(props)("chat")}<span>${esc(text)}</span></p>`;
};

const screenHead = (props, title, lead = "", eyebrow = "") => {
  const esc = escaper(props);
  return `<header class="appointment-screen-head">${eyebrow ? `<p class="appointment-eyebrow">${esc(eyebrow)}</p>` : ""}<h1 class="appointment-screen-title">${esc(title)}</h1>${lead ? `<p class="appointment-lead">${esc(lead)}</p>` : ""}</header>`;
};

const primary = (props, action, label, { resolutionId = "", extra = "", glyph = "" } = {}) => {
  const esc = escaper(props);
  return `<button type="button" class="appointment-action primary" data-action="${esc(action)}" data-resolution-id="${esc(resolutionId)}"${extra}>${glyph ? iconOf(props)(glyph) : ""}<span>${esc(label)}</span></button>`;
};

const secondary = (props, action, label, { resolutionId = "", extra = "", glyph = "" } = {}) => {
  const esc = escaper(props);
  return `<button type="button" class="appointment-action secondary" data-action="${esc(action)}" data-resolution-id="${esc(resolutionId)}"${extra}>${glyph ? iconOf(props)(glyph) : ""}<span>${esc(label)}</span></button>`;
};

const inlineLink = (props, action, label, { resolutionId = "", extra = "" } = {}) => {
  const esc = escaper(props);
  return `<button type="button" class="appointment-inline-link" data-action="${esc(action)}" data-resolution-id="${esc(resolutionId)}"${extra}><span>${esc(label)}</span>${iconOf(props)("arrowRight")}</button>`;
};

// §25. Going back is always available and never destroys a confirmed fact: it is a step name, so
// "Change" from the review screen returns to the options the patient already has rather than
// restarting a search.
const backLink = (props, resolutionId, step, label) => {
  const esc = escaper(props);
  return `<button type="button" class="appointment-back" data-action="barrier-back" data-resolution-id="${esc(resolutionId)}" data-step="${esc(step)}">${iconOf(props)("arrowLeft")}<span>${esc(label)}</span></button>`;
};

const closeLink = (props, resolutionId) => {
  const t = say(localeOf(props));
  const esc = escaper(props);
  return `<button type="button" class="appointment-back" data-action="barrier-close" data-resolution-id="${esc(resolutionId)}">${iconOf(props)("arrowLeft")}<span>${t("Back to my appointment", "Volver a mi cita", "Retounen nan randevou m")}</span></button>`;
};

// A named waiting state. §13 asks the simulation to feel real, and a skeleton that shows the shape
// of what is coming does that better than a spinner — but it is also the honest thing to draw,
// because the list really is about to have that shape.
const loadingState = (props, message, rows = 2) => {
  const esc = escaper(props);
  return `<section class="barrier-loading" role="status" aria-live="polite">
    <p class="barrier-loading-text">${esc(message)}</p>
    <div class="barrier-skeletons" aria-hidden="true">${Array.from({ length: rows }, () => `<div class="barrier-skeleton"></div>`).join("")}</div>
  </section>`;
};

const successState = (props, title, detail = "") => {
  const esc = escaper(props);
  return `<section class="barrier-success">
    <p class="barrier-success-mark">${iconOf(props)("check")}</p>
    <h2 class="barrier-success-title">${esc(title)}</h2>
    ${detail ? `<p class="barrier-success-detail">${esc(detail)}</p>` : ""}
  </section>`;
};

// The review pattern §12 asks for, as one component. Everything about to happen, in rows, above the
// only button that makes it happen.
const confirmationCard = (props, title, rows = []) => {
  const esc = escaper(props);
  const visible = rows.filter(row => row && row[1]);
  return `<section class="barrier-review">
    <h2 class="appointment-section-title">${esc(title)}</h2>
    <dl class="appointment-facts">${visible.map(([label, value, note]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}${note ? `<small>${esc(note)}</small>` : ""}</dd></div>`).join("")}</dl>
  </section>`;
};

const addressCard = (props, address, { label = "", selected = false } = {}) => {
  if (!address) return "";
  const esc = escaper(props);
  return `<article class="barrier-address-card"${selected ? ` data-selected="true"` : ""}>
    ${iconOf(props)("home")}
    <div><strong>${esc(label || address.label || "")}</strong><span>${esc(address.formatted || address.line1 || "")}</span></div>
  </article>`;
};

// §3.5. A ride, described the way a patient decides between rides: when it comes, when it gets
// there, what it costs and what it is. No brand chrome, no surge banner, no map.
const transportationOptionCard = (props, option, { selectedId = "", resolutionId = "" } = {}) => {
  const esc = escaper(props);
  const locale = localeOf(props);
  const t = say(locale);
  const selected = option.optionId === selectedId;
  return `<button type="button" class="barrier-option" data-action="barrier-option-select" data-resolution-id="${esc(resolutionId)}" data-option-id="${esc(option.optionId)}" aria-pressed="${selected ? "true" : "false"}">
    <span class="barrier-option-head">${iconOf(props)(option.icon || "car")}<strong>${esc(option.serviceName)}</strong>${selected ? `<span class="barrier-option-selected">${iconOf(props)("check")}<span class="appointment-visually-hidden">${esc(t("Selected", "Seleccionado", "Chwazi"))}</span></span>` : ""}</span>
    <span class="barrier-option-rows">
      <span class="barrier-option-row"><span>${esc(t("Pickup", "Recogida", "Pran"))}</span><strong>${esc(formatAppointmentTime(option.pickupAt, props.timezone || "", locale))}</strong></span>
      <span class="barrier-option-row"><span>${esc(t("Arrives about", "Llega alrededor de", "Rive anviwon"))}</span><strong>${esc(formatAppointmentTime(option.estimatedArrivalAt, props.timezone || "", locale))}</strong></span>
      ${option.estimatedCost ? `<span class="barrier-option-row"><span>${esc(t("Estimated cost", "Costo estimado", "Kòb estime"))}</span><strong>${esc(option.estimatedCost)}</strong></span>` : ""}
    </span>
    <span class="barrier-option-meta">${esc([option.description, option.seats ? t(`Up to ${option.seats} people`, `Hasta ${option.seats} personas`, `Jiska ${option.seats} moun`) : ""].filter(Boolean).join(" · "))}</span>
  </button>`;
};

// §6. A time to move to, grouped by the day it falls on so a patient reads "Thursday" once.
const appointmentSlotCard = (props, slot, { selectedId = "", resolutionId = "" } = {}) => {
  const esc = escaper(props);
  const locale = localeOf(props);
  const selected = slot.slotId === selectedId;
  return `<button type="button" class="barrier-slot" data-action="barrier-slot-select" data-resolution-id="${esc(resolutionId)}" data-slot-id="${esc(slot.slotId)}" aria-pressed="${selected ? "true" : "false"}">
    <span class="barrier-slot-time">${esc(formatAppointmentTime(slot.startAt, props.timezone || "", locale))}</span>
    ${selected ? `<span class="barrier-slot-check">${iconOf(props)("check")}</span>` : ""}
  </button>`;
};

const personCard = (props, contact, { resolutionId = "", selectedId = "" } = {}) => {
  const esc = escaper(props);
  const selected = contact.contactId === selectedId;
  return `<button type="button" class="barrier-person" data-action="barrier-companion-select" data-resolution-id="${esc(resolutionId)}" data-contact-id="${esc(contact.contactId)}" aria-pressed="${selected ? "true" : "false"}">
    ${iconOf(props)("person")}
    <span class="barrier-person-identity"><strong>${esc(contact.firstName)}</strong>${contact.relationship ? `<small>${esc(contact.relationship)}</small>` : ""}</span>
    ${selected ? `<span class="barrier-person-check">${iconOf(props)("check")}</span>` : ""}
  </button>`;
};

// §11 and §28. The last screen of any playbook EMMI could not finish, and never a dead end: it
// always carries the one action that puts a person on it.
const careTeamEscalation = (props, { resolutionId = "", reason = "", message = "" } = {}) => {
  const t = say(localeOf(props));
  const esc = escaper(props);
  return `${emmiMessage(props, message || resolutionSpeech("CARE_TEAM_OFFER", localeOf(props)))}
    ${primary(props, "barrier-escalate", t("Ask for help", "Pedir ayuda", "Mande èd"), { resolutionId, extra: ` data-reason="${esc(reason)}"`, glyph: "people" })}`;
};

const escalatedState = (props, resolutionId, detail = "") => {
  const locale = localeOf(props);
  const t = say(locale);
  return `${successState(props, resolutionSpeech("CARE_TEAM_DONE", locale), detail || t("Someone from your care team will follow up with you.", "Alguien de su equipo de cuidado se comunicará con usted.", "Yon moun nan ekip swen ou ap kontakte w."))}
    ${primary(props, "barrier-close", t("Done", "Listo", "Fini"), { resolutionId })}`;
};

// §13. Visible only where the shell asks for it, muted, and worded for the person running the demo
// rather than for the patient — it names the mode, never a fake booking.
const demoBadge = (props) => {
  if (!props?.showDemoBadge) return "";
  const esc = escaper(props);
  return `<p class="barrier-demo-badge">${esc(demoModeBadgeText(localeOf(props)))}</p>`;
};

const errorNote = (props, text) => {
  if (!text) return "";
  const esc = escaper(props);
  return `<p class="appointment-note" data-tone="ACTION_NEEDED" role="status">${iconOf(props)("alert")}<span>${esc(text)}</span></p>`;
};

/* ---------------------------------------------------------------- shared vocabulary ------- */

const EYEBROW = T("Appointment", "Cita", "Randevou");

const appointmentLine = (props, appointment) => {
  const locale = localeOf(props);
  const t = say(locale);
  const when = formatAppointmentLongDate(appointment?.scheduledAt, appointment?.timezone, locale);
  const time = formatAppointmentTime(appointment?.scheduledAt, appointment?.timezone, locale);
  const provider = appointment?.providerDisplayName || t("your care team", "su equipo de cuidado", "ekip swen ou");
  if (!when || !time) return "";
  return endSentence(t(
    `Your appointment with ${provider} is ${when} at ${time}.`,
    `Su cita con ${provider} es el ${when} a las ${time}.`,
    `Randevou ou ak ${provider} se ${when} a ${time}.`
  ));
};

/* ==========================================================================================
   Transportation
   ========================================================================================== */

function transportationView(props) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const resolution = props.resolution || {};
  const id = resolution.id || "";
  const data = resolution.data || {};
  const appointment = props.appointment || {};
  const step = resolution.step;

  if (step === "OFFER") {
    return `${screenHead(props, t("Getting there", "Cómo llegar", "Kijan pou rive"), appointmentLine(props, appointment), localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, resolutionSpeech("TRANSPORTATION_OFFER", locale))}
      ${emmiMessage(props, resolutionSpeech("TRANSPORTATION_ASK", locale))}
      <div class="appointment-actions">
        ${primary(props, "barrier-accept", t("Yes, find transportation", "Sí, buscar transporte", "Wi, chèche transpò"), { resolutionId: id, glyph: "car" })}
        ${secondary(props, "barrier-decline", t("Not right now", "No por ahora", "Pa kounye a"), { resolutionId: id })}
      </div>`;
  }

  if (step === "PICKUP") {
    const home = props.homeAddress;
    return `${screenHead(props, t("Where should the car pick you up?", "¿Dónde quiere que le recojan?", "Ki kote machin nan dwe vin pran w?"), "", localBarrierText(EYEBROW, locale))}
      ${home ? `${addressCard(props, home, { label: t("Home", "Casa", "Kay"), selected: true })}
        ${primary(props, "barrier-pickup-home", t("Use this address", "Usar esta dirección", "Sèvi ak adrès sa a"), { resolutionId: id, glyph: "check" })}
        ${inlineLink(props, "barrier-pickup-other", t("Use a different address", "Usar otra dirección", "Sèvi ak yon lòt adrès"), { resolutionId: id })}`
        : `${emmiMessage(props, t("I don’t have an address on file for you. Tell me where to send the car.", "No tengo una dirección suya registrada. Dígame a dónde envío el vehículo.", "Mwen pa gen yon adrès pou ou. Di m ki kote pou m voye machin nan."))}
        ${primary(props, "barrier-pickup-other", t("Add an address", "Agregar una dirección", "Ajoute yon adrès"), { resolutionId: id, glyph: "mapPin" })}`}
      ${backLink(props, id, "OFFER", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "PICKUP_EDIT") {
    const draft = data.addressDraft || {};
    return `${screenHead(props, t("Where should the car pick you up?", "¿Dónde quiere que le recojan?", "Ki kote machin nan dwe vin pran w?"), "", localBarrierText(EYEBROW, locale))}
      ${errorNote(props, props.error)}
      <form id="barrier-address-form" class="appointment-prep-form" novalidate>
        <label class="appointment-field" for="barrier-address-line1">${t("Street address", "Dirección", "Adrès")}
          <input id="barrier-address-line1" name="line1" maxlength="80" autocomplete="street-address" value="${esc(draft.line1 || "")}">
        </label>
        <label class="appointment-field" for="barrier-address-unit">${t("Apartment or unit (optional)", "Apartamento o unidad (opcional)", "Apatman oswa inite (opsyonèl)")}
          <input id="barrier-address-unit" name="unit" maxlength="24" autocomplete="address-line2" value="${esc(draft.unit || "")}">
        </label>
        <label class="appointment-field" for="barrier-address-city">${t("City", "Ciudad", "Vil")}
          <input id="barrier-address-city" name="city" maxlength="40" autocomplete="address-level2" value="${esc(draft.city || "")}">
        </label>
        <label class="appointment-field" for="barrier-address-state">${t("State", "Estado", "Eta")}
          <input id="barrier-address-state" name="state" maxlength="2" autocomplete="address-level1" value="${esc(draft.state || "")}">
        </label>
        <label class="appointment-field" for="barrier-address-zip">${t("ZIP code", "Código postal", "Kòd postal")}
          <input id="barrier-address-zip" name="zip" inputmode="numeric" maxlength="10" autocomplete="postal-code" value="${esc(draft.zip || "")}">
        </label>
      </form>
      ${primary(props, "barrier-pickup-save", t("Use this address", "Usar esta dirección", "Sèvi ak adrès sa a"), { resolutionId: id, glyph: "check" })}
      ${backLink(props, id, "PICKUP", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "NEEDS") {
    const selected = Array.isArray(data.needs) ? data.needs : [];
    return `${screenHead(props, t("Do you need any special help for the ride?", "¿Necesita alguna ayuda especial para el viaje?", "Èske ou bezwen yon èd espesyal pou vwayaj la?"), t("Choose everything that applies.", "Elija todo lo que corresponda.", "Chwazi tout sa ki aplike."), localBarrierText(EYEBROW, locale))}
      <div class="appointment-choices" role="group">
        ${transportNeedOptions(locale).map(need => `<button type="button" class="appointment-choice barrier-toggle" data-action="barrier-need-toggle" data-resolution-id="${esc(id)}" data-need="${esc(need.id)}" aria-pressed="${selected.includes(need.id) ? "true" : "false"}">${iconOf(props)(selected.includes(need.id) ? "check" : "person")}<span>${esc(need.label)}</span></button>`).join("")}
      </div>
      ${primary(props, "barrier-needs-continue", t("Continue", "Continuar", "Kontinye"), { resolutionId: id, extra: selected.length ? "" : " disabled" })}
      ${backLink(props, id, "PICKUP", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "NEEDS_UNSUPPORTED") {
    return `${screenHead(props, t("Let me get you the right kind of ride", "Consigamos el transporte adecuado", "Ann jwenn bon kalite transpò a"), "", localBarrierText(EYEBROW, locale))}
      ${careTeamEscalation(props, { resolutionId: id, reason: "ACCESSIBLE_TRANSPORT_REQUIRED", message: resolutionSpeech("TRANSPORTATION_UNSUPPORTED", locale) })}
      ${backLink(props, id, "NEEDS", t("Change what I chose", "Cambiar lo que elegí", "Chanje sa m te chwazi"))}`;
  }

  if (step === "TIME") {
    const pickup = formatAppointmentTime(data.pickupAt, appointment.timezone, locale);
    const arriveBy = formatAppointmentTime(data.arriveByAt, appointment.timezone, locale);
    const appointmentTime = formatAppointmentTime(appointment.scheduledAt, appointment.timezone, locale);
    return `${screenHead(props, t("Pickup time", "Hora de recogida", "Lè pou pran w"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, endSentence(t(
        `To get to your appointment with time to spare, I suggest the car picks you up around ${pickup}.`,
        `Para llegar a su cita con tiempo, sugiero que el vehículo le recoja alrededor de las ${pickup}.`,
        `Pou rive nan randevou ou ak tan, mwen sijere machin nan vin pran w anviwon ${pickup}.`
      )))}
      ${confirmationCard(props, t("How I worked that out", "Cómo lo calculé", "Kijan m kalkile sa"), [
        [t("Appointment", "Cita", "Randevou"), appointmentTime],
        [t("Arrive by", "Llegar antes de", "Rive anvan"), arriveBy],
        [t("Travel time", "Tiempo de viaje", "Tan vwayaj"), t(`About ${data.travelMinutes || 24} minutes`, `Unos ${data.travelMinutes || 24} minutos`, `Anviwon ${data.travelMinutes || 24} minit`)],
        [t("Pickup", "Recogida", "Pran"), pickup]
      ])}
      ${primary(props, "barrier-time-accept", t("Look for rides", "Buscar vehículos", "Chèche machin"), { resolutionId: id, glyph: "car" })}
      ${inlineLink(props, "barrier-time-change", t("Choose a different pickup time", "Elegir otra hora de recogida", "Chwazi yon lòt lè"), { resolutionId: id })}
      ${backLink(props, id, "NEEDS", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "TIME_EDIT") {
    const choices = pickupTimeChoices(data.recommendedPickupAt || data.pickupAt, locale);
    return `${screenHead(props, t("Choose a pickup time", "Elija la hora de recogida", "Chwazi lè pou pran w"), "", localBarrierText(EYEBROW, locale))}
      <div class="appointment-choices">
        ${choices.map(choice => `<button type="button" class="appointment-choice" data-action="barrier-time-select" data-resolution-id="${esc(id)}" data-pickup-at="${esc(choice.pickupAt)}">${iconOf(props)("clock")}<span>${esc(formatAppointmentTime(choice.pickupAt, appointment.timezone, locale))} · ${esc(choice.label)}</span></button>`).join("")}
      </div>
      ${backLink(props, id, "TIME", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "SEARCHING") {
    return `${screenHead(props, t("Finding a ride", "Buscando transporte", "N ap chèche transpò"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, resolutionSpeech("TRANSPORTATION_SEARCHING", locale), 3)}`;
  }

  if (step === "OPTIONS") {
    const options = Array.isArray(props.options) ? props.options : [];
    return `${screenHead(props, t("Choose a ride", "Elija un vehículo", "Chwazi yon machin"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, options.length === 1
        ? t("I found one option.", "Encontré una opción.", "Mwen jwenn yon opsyon.")
        : t(`I found ${options.length} options.`, `Encontré ${options.length} opciones.`, `Mwen jwenn ${options.length} opsyon.`))}
      <div class="barrier-options">${options.map(option => transportationOptionCard(props, option, { selectedId: data.selectedOptionId || "", resolutionId: id })).join("")}</div>
      <p class="appointment-legal">${t("Prices and times are estimates.", "Los precios y las horas son estimados.", "Pri ak lè yo se estimasyon.")}</p>
      ${backLink(props, id, "TIME", t("Back", "Atrás", "Retounen"))}
      ${demoBadge(props)}`;
  }

  if (step === "OPTIONS_EMPTY") {
    return `${screenHead(props, t("No rides available right now", "No hay vehículos disponibles ahora", "Pa gen machin disponib kounye a"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        "I couldn’t find a ride for that time. We can try another pickup time, or I can ask your care team to arrange it.",
        "No encontré transporte para esa hora. Podemos probar otra hora de recogida, o puedo pedirle a su equipo de cuidado que lo organice.",
        "Mwen pa t jwenn machin pou lè sa a. Nou ka eseye yon lòt lè, oswa mwen ka mande ekip swen ou òganize l."
      ))}
      ${secondary(props, "barrier-time-change", t("Try another pickup time", "Probar otra hora", "Eseye yon lòt lè"), { resolutionId: id, glyph: "clock" })}
      ${careTeamEscalation(props, { resolutionId: id, reason: "NO_TRANSPORT_AVAILABLE", message: " " })}
      ${closeLink(props, id)}`;
  }

  if (step === "REVIEW") {
    const option = (Array.isArray(props.options) ? props.options : []).find(item => item.optionId === data.selectedOptionId) || data.selectedOption || null;
    if (!option) {
      return `${screenHead(props, t("Choose a ride", "Elija un vehículo", "Chwazi yon machin"), "", localBarrierText(EYEBROW, locale))}
        ${errorNote(props, t("That ride is no longer available. Choose another one.", "Ese vehículo ya no está disponible. Elija otro.", "Machin sa a pa disponib ankò. Chwazi yon lòt."))}
        ${primary(props, "barrier-time-accept", t("Look again", "Buscar de nuevo", "Chèche ankò"), { resolutionId: id })}
        ${closeLink(props, id)}`;
    }
    const destination = props.destination || {};
    return `${screenHead(props, t("Review your ride", "Revise su viaje", "Gade vwayaj ou"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, resolutionSpeech("TRANSPORTATION_REVIEW", locale))}
      ${confirmationCard(props, t("Your ride", "Su viaje", "Vwayaj ou"), [
        [t("Pickup", "Recogida", "Pran"), data.pickupAddress?.formatted || ""],
        [t("Date", "Fecha", "Dat"), formatAppointmentLongDate(option.pickupAt, appointment.timezone, locale)],
        [t("Pickup time", "Hora de recogida", "Lè pou pran w"), formatAppointmentTime(option.pickupAt, appointment.timezone, locale)],
        [t("Destination", "Destino", "Destinasyon"), destination.name || appointment.providerDisplayName || "", destination.formatted || appointment.locationAddress || ""],
        [t("Arrives about", "Llega alrededor de", "Rive anviwon"), formatAppointmentTime(option.estimatedArrivalAt, appointment.timezone, locale)],
        [t("Ride", "Vehículo", "Machin"), option.serviceName, option.description],
        [t("Estimated cost", "Costo estimado", "Kòb estime"), option.estimatedCost]
      ])}
      ${primary(props, "barrier-reserve-confirm", t("Book this ride", "Reservar viaje", "Rezève vwayaj la"), { resolutionId: id, glyph: "check" })}
      ${secondary(props, "barrier-back", t("Change", "Cambiar", "Chanje"), { resolutionId: id, extra: ` data-step="OPTIONS"` })}
      ${demoBadge(props)}`;
  }

  if (step === "BOOKING" || step === "RETURN_BOOKING") {
    return `${screenHead(props, t("Booking your ride", "Reservando su viaje", "N ap rezève vwayaj ou"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, t("Booking your ride…", "Reservando su viaje…", "N ap rezève vwayaj ou…"), 1)}`;
  }

  if (step === "BOOKING_FAILED") {
    return `${screenHead(props, t("I couldn’t book that ride", "No pude reservar ese viaje", "Mwen pa t ka rezève vwayaj sa a"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        "Nothing was booked and nothing was charged. We can try again, or I can ask your care team to arrange it.",
        "No se reservó ni se cobró nada. Podemos intentarlo de nuevo, o puedo pedirle a su equipo de cuidado que lo organice.",
        "Anyen pa rezève e anyen pa chaje. Nou ka eseye ankò, oswa mwen ka mande ekip swen ou òganize l."
      ))}
      ${primary(props, "barrier-retry", t("Try again", "Intentar de nuevo", "Eseye ankò"), { resolutionId: id, glyph: "rotate" })}
      ${careTeamEscalation(props, { resolutionId: id, reason: "TRANSPORT_BOOKING_FAILED", message: " " })}
      ${backLink(props, id, "OPTIONS", t("Choose another ride", "Elegir otro vehículo", "Chwazi yon lòt machin"))}`;
  }

  if (step === "BOOKED" || step === "RETURN_OFFER" || step === "RETURN_TIME") {
    const reservation = data.reservation || null;
    const returnReservation = data.returnReservation || null;
    const outdated = data.reservationOutdated === true;
    return `${screenHead(props, t("Your ride is booked", "Su transporte está reservado", "Transpò ou rezève"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, t("Your ride is booked", "Su transporte está reservado", "Transpò ou rezève"))}
      ${reservation ? reservationCard(props, reservation, { resolutionId: id, appointment, canChange: true }) : ""}
      ${outdated ? errorNote(props, t("Your appointment time changed, so this ride needs updating.", "Su cita cambió de hora, así que este viaje debe actualizarse.", "Lè randevou ou chanje, kidonk vwayaj sa a bezwen mete ajou.")) : ""}
      ${returnReservation ? reservationCard(props, returnReservation, { resolutionId: id, appointment, canChange: false }) : ""}
      ${step === "RETURN_OFFER" && !returnReservation ? `<section class="barrier-followup">
        ${emmiMessage(props, t("Do you also need a ride home after the appointment?", "¿También necesita transporte para regresar a casa después de la cita?", "Èske ou bezwen yon machin pou tounen lakay apre randevou a tou?"))}
        ${primary(props, "barrier-return-yes", t("Yes, arrange the ride home", "Sí, coordinar el regreso", "Wi, òganize retou a"), { resolutionId: id, glyph: "car" })}
        ${secondary(props, "barrier-return-no", t("No", "No", "Non"), { resolutionId: id })}
      </section>` : ""}
      ${data.returnUnavailable && step !== "RETURN_TIME" ? `<section class="barrier-followup">
        ${emmiMessage(props, t(
          "I couldn’t find a ride home for that time. We can try a different time, or I can ask your care team to arrange it.",
          "No encontré transporte de regreso para esa hora. Podemos probar otra hora, o puedo pedirle a su equipo de cuidado que lo organice.",
          "Mwen pa t jwenn machin pou tounen nan lè sa a. Nou ka eseye yon lòt lè, oswa mwen ka mande ekip swen ou òganize l."
        ))}
        ${secondary(props, "barrier-return-yes", t("Try a different time", "Probar otra hora", "Eseye yon lòt lè"), { resolutionId: id, glyph: "clock" })}
        ${careTeamEscalation(props, { resolutionId: id, reason: "NO_RETURN_TRANSPORT_AVAILABLE", message: " " })}
      </section>` : ""}
      ${step === "RETURN_TIME" ? `<section class="barrier-followup">
        ${emmiMessage(props, t("When should the car come back for you?", "¿Cuándo debe volver el vehículo por usted?", "Kilè machin nan dwe tounen pou ou?"))}
        <div class="appointment-choices">
          ${returnTripChoices(locale).map(choice => `<button type="button" class="appointment-choice" data-action="barrier-return-select" data-resolution-id="${esc(id)}" data-return-choice="${esc(choice.id)}">${iconOf(props)("clock")}<span>${esc(choice.label)}</span></button>`).join("")}
        </div>
      </section>` : ""}
      ${step === "BOOKED" ? primary(props, "barrier-close", t("Done", "Listo", "Fini"), { resolutionId: id }) : ""}
      ${closeLink(props, id)}
      ${demoBadge(props)}`;
  }

  if (step === "CANCEL_CONFIRM") {
    const reservation = data.reservation || {};
    return `${screenHead(props, t("Cancel this ride?", "¿Cancelar este viaje?", "Anile vwayaj sa a?"), "", localBarrierText(EYEBROW, locale))}
      ${confirmationCard(props, t("The ride you booked", "El viaje que reservó", "Vwayaj ou te rezève a"), [
        [t("Ride", "Vehículo", "Machin"), reservation.serviceName || ""],
        [t("Pickup time", "Hora de recogida", "Lè pou pran w"), formatAppointmentTime(reservation.pickupAt, appointment.timezone, locale)],
        [t("Reservation", "Reserva", "Rezèvasyon"), reservation.reservationId || ""]
      ])}
      ${primary(props, "barrier-ride-cancel-confirm", t("Yes, cancel the ride", "Sí, cancelar el viaje", "Wi, anile vwayaj la"), { resolutionId: id })}
      ${secondary(props, "barrier-back", t("Keep my ride", "Conservar mi viaje", "Kenbe vwayaj mwen"), { resolutionId: id, extra: ` data-step="BOOKED"` })}`;
  }

  if (step === "CANCELED") {
    return `${screenHead(props, t("Your ride is canceled", "Su viaje está cancelado", "Vwayaj ou anile"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, t("Your ride is canceled", "Su viaje está cancelado", "Vwayaj ou anile"), t("You can arrange another one whenever you need it.", "Puede coordinar otro cuando lo necesite.", "Ou ka òganize yon lòt lè ou bezwen l."))}
      ${primary(props, "barrier-accept", t("Arrange another ride", "Coordinar otro viaje", "Òganize yon lòt vwayaj"), { resolutionId: id, glyph: "car" })}
      ${closeLink(props, id)}`;
  }

  return declinedOrEscalated(props, resolution);
}

// The booked ride, as a summary a patient can act on. §3.7's three actions, with cancel routed
// through its own confirmation rather than firing from this card.
function reservationCard(props, reservation, { resolutionId = "", appointment = {}, canChange = false } = {}) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const isReturn = reservation.tripType === "RETURN";
  return `<article class="barrier-reservation">
    <p class="barrier-reservation-head">${iconOf(props)("car")}<strong>${esc(reservation.serviceName || "")}</strong><span>${esc(isReturn ? t("Ride home", "Viaje de regreso", "Vwayaj retou") : t("Ride there", "Viaje de ida", "Vwayaj ale"))}</span></p>
    <p class="barrier-reservation-when">${esc(formatAppointmentWhen(reservation.pickupAt, appointment.timezone, locale))}</p>
    <ol class="barrier-route">
      <li>${iconOf(props)("mapPin")}<span>${esc(isReturn ? (reservation.pickupFormatted || appointment.locationName || "") : (reservation.pickupFormatted || t("Home", "Casa", "Kay")))}</span></li>
      <li>${iconOf(props)("arrowRight")}<span>${esc(isReturn ? t("Home", "Casa", "Kay") : (reservation.destinationName || appointment.providerDisplayName || ""))}</span></li>
    </ol>
    <dl class="appointment-facts">
      ${reservation.estimatedArrivalAt ? `<div><dt>${esc(isReturn ? t("Estimated pickup", "Recogida estimada", "Lè estime pou pran w") : t("Estimated arrival", "Llegada estimada", "Lè estime pou rive"))}</dt><dd>${esc(formatAppointmentTime(isReturn ? reservation.pickupAt : reservation.estimatedArrivalAt, appointment.timezone, locale))}</dd></div>` : ""}
      ${reservation.estimatedCost ? `<div><dt>${esc(t("Estimated cost", "Costo estimado", "Kòb estime"))}</dt><dd>${esc(reservation.estimatedCost)}</dd></div>` : ""}
      <div><dt>${esc(t("Reservation", "Reserva", "Rezèvasyon"))}</dt><dd>${esc(reservation.reservationId || "")}</dd></div>
    </dl>
    ${canChange ? `<div class="appointment-card-actions">
      ${`<button type="button" class="appointment-card-action" data-action="barrier-ride-change" data-resolution-id="${esc(resolutionId)}">${iconOf(props)("rotate")}<span>${esc(t("Change ride", "Cambiar viaje", "Chanje vwayaj"))}</span></button>`}
      ${`<button type="button" class="appointment-card-action appointment-danger" data-action="barrier-ride-cancel" data-resolution-id="${esc(resolutionId)}">${iconOf(props)("alert")}<span>${esc(t("Cancel ride", "Cancelar viaje", "Anile vwayaj"))}</span></button>`}
    </div>` : ""}
  </article>`;
}

/* ==========================================================================================
   Video visit readiness
   ========================================================================================== */

function videoVisitView(props) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const resolution = props.resolution || {};
  const id = resolution.id || "";
  const data = resolution.data || {};
  const step = resolution.step;
  const results = Array.isArray(data.results) ? data.results : [];

  if (step === "OFFER") {
    return `${screenHead(props, t("Getting ready for the video visit", "Prepararse para la visita por video", "Prepare pou vizit videyo a"), appointmentLine(props, props.appointment), localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, resolutionSpeech("VIDEO_OFFER", locale))}
      <div class="appointment-actions">
        ${primary(props, "barrier-video-start", t("Check my device", "Revisar mi dispositivo", "Tcheke aparèy mwen"), { resolutionId: id, glyph: "video" })}
        ${secondary(props, "barrier-decline", t("Not right now", "No por ahora", "Pa kounye a"), { resolutionId: id })}
      </div>`;
  }

  if (step === "CHECKING") {
    return `${screenHead(props, t("Checking your device", "Revisando su dispositivo", "N ap tcheke aparèy ou"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, t("Checking your microphone, camera and connection…", "Revisando su micrófono, cámara y conexión…", "N ap tcheke mikwo, kamera ak koneksyon ou…"), 4)}`;
  }

  const checkList = `<ul class="barrier-checks">${results.map(result => `<li data-state="${result.passed ? "OK" : "PROBLEM"}">${iconOf(props)(result.passed ? "check" : "alert")}<span><strong>${esc(result.label)}</strong><small>${esc(result.detail)}</small></span></li>`).join("")}</ul>`;

  if (step === "READY") {
    return `${screenHead(props, t("Your device is ready", "Su dispositivo está listo", "Aparèy ou pare"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, resolutionSpeech("VIDEO_READY", locale))}
      ${checkList}
      ${primary(props, "barrier-close", t("Done", "Listo", "Fini"), { resolutionId: id })}
      ${demoBadge(props)}`;
  }

  if (step === "ISSUES") {
    const failed = results.filter(result => !result.passed);
    const first = failed[0];
    // A screen listing two problems must not be titled "one thing to fix": the count on the title
    // is the first thing a patient reads and it has to match the list under it.
    const title = failed.length > 1
      ? t(`${failed.length} things to fix`, `${failed.length} cosas por arreglar`, `${failed.length} bagay pou ranje`)
      : t("One thing to fix", "Una cosa por arreglar", "Yon bagay pou ranje");
    return `${screenHead(props, title, "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, failed.length > 1
        ? t("A couple of things aren’t ready yet. I can walk you through them.", "Un par de cosas todavía no están listas. Puedo guiárle paso a paso.", "De twa bagay poko pare. Mwen ka gide w etap pa etap.")
        : (first?.detail || t("Something isn’t ready yet.", "Algo todavía no está listo.", "Yon bagay poko pare.")))}
      ${checkList}
      <div class="appointment-actions">
        ${primary(props, "barrier-video-guide", t("Walk me through it", "Guíeme paso a paso", "Gide m etap pa etap"), { resolutionId: id, glyph: "info" })}
        ${secondary(props, "barrier-escalate", t("Ask for help", "Pedir ayuda", "Mande èd"), { resolutionId: id, extra: ` data-reason="VIDEO_READINESS_FAILED"`, glyph: "people" })}
      </div>
      ${closeLink(props, id)}
      ${demoBadge(props)}`;
  }

  if (step === "GUIDE") {
    const issues = results.filter(result => !result.passed);
    return `${screenHead(props, t("Let’s fix it together", "Arreglémoslo juntos", "Ann ranje l ansanm"), "", localBarrierText(EYEBROW, locale))}
      ${issues.map(result => `<section class="barrier-guide">
        <h2 class="appointment-section-title">${esc(result.label)}</h2>
        <ol class="barrier-guide-steps">${(result.guide || []).map(line => `<li>${esc(line)}</li>`).join("")}</ol>
      </section>`).join("")}
      ${primary(props, "barrier-video-recheck", t("Check again", "Revisar de nuevo", "Tcheke ankò"), { resolutionId: id, glyph: "rotate" })}
      ${secondary(props, "barrier-escalate", t("Ask for help", "Pedir ayuda", "Mande èd"), { resolutionId: id, extra: ` data-reason="VIDEO_READINESS_FAILED"`, glyph: "people" })}
      ${backLink(props, id, "ISSUES", t("Back", "Atrás", "Retounen"))}`;
  }

  return declinedOrEscalated(props, resolution);
}

/* ==========================================================================================
   Companion
   ========================================================================================== */

function companionView(props) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const resolution = props.resolution || {};
  const id = resolution.id || "";
  const data = resolution.data || {};
  const step = resolution.step;
  const contacts = Array.isArray(props.contacts) ? props.contacts : [];
  const appointment = props.appointment || {};
  const when = formatAppointmentLongDate(appointment.scheduledAt, appointment.timezone, locale);
  const time = formatAppointmentTime(appointment.scheduledAt, appointment.timezone, locale);

  if (step === "OFFER") {
    return `${screenHead(props, t("Someone to come with you", "Alguien que le acompañe", "Yon moun pou vin avè w"), appointmentLine(props, appointment), localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, resolutionSpeech("COMPANION_OFFER", locale))}
      ${emmiMessage(props, resolutionSpeech("COMPANION_ASK", locale))}
      <div class="appointment-actions">
        ${primary(props, "barrier-companion-answer", t("Yes", "Sí", "Wi"), { resolutionId: id, extra: ` data-answer="YES"` })}
        ${secondary(props, "barrier-companion-answer", t("No", "No", "Non"), { resolutionId: id, extra: ` data-answer="NO"` })}
      </div>
      ${closeLink(props, id)}`;
  }

  if (step === "CONTACTS") {
    return `${screenHead(props, t("Who would you like to ask?", "¿A quién le gustaría pedírselo?", "Ki moun ou ta renmen mande?"), "", localBarrierText(EYEBROW, locale))}
      <div class="barrier-people">${contacts.map(contact => personCard(props, contact, { resolutionId: id, selectedId: data.contactId || "" })).join("")}</div>
      ${secondary(props, "barrier-companion-new", t("Someone else", "Otra persona", "Yon lòt moun"), { resolutionId: id, glyph: "userPlus" })}
      ${backLink(props, id, "OFFER", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "NEW_CONTACT") {
    const draft = data.contactDraft || {};
    return `${screenHead(props, t("Who should I ask?", "¿A quién le pregunto?", "Ki moun pou m mande?"), t("Just enough to send them a message.", "Solo lo necesario para enviarle un mensaje.", "Jis sa ki nesesè pou voye yon mesaj ba li."), localBarrierText(EYEBROW, locale))}
      ${errorNote(props, props.error)}
      <form id="barrier-contact-form" class="appointment-prep-form" novalidate>
        <label class="appointment-field" for="barrier-contact-name">${t("First name", "Nombre", "Non")}
          <input id="barrier-contact-name" name="firstName" maxlength="40" autocomplete="given-name" value="${esc(draft.firstName || "")}">
        </label>
        <label class="appointment-field" for="barrier-contact-relationship">${t("How do you know them?", "¿Qué relación tienen?", "Ki relasyon ou genyen?")}
          <input id="barrier-contact-relationship" name="relationship" maxlength="40" placeholder="${esc(t("Daughter, neighbor, friend…", "Hija, vecino, amigo…", "Pitit fi, vwazen, zanmi…"))}" value="${esc(draft.relationship || "")}">
        </label>
        <label class="appointment-field" for="barrier-contact-phone">${t("Phone number", "Número de teléfono", "Nimewo telefòn")}
          <input id="barrier-contact-phone" name="phone" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" value="${esc(draft.phone || "")}">
        </label>
      </form>
      ${primary(props, "barrier-companion-save", t("Continue", "Continuar", "Kontinye"), { resolutionId: id })}
      ${backLink(props, id, "CONTACTS", t("Back", "Atrás", "Retounen"))}`;
  }

  if (step === "REVIEW") {
    const name = data.contactName || "";
    return `${screenHead(props, t("Send the invitation?", "¿Enviar la invitación?", "Voye envitasyon an?"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, endSentence(t(
        `I can send ${name} a message asking if they can come with you to your appointment on ${when} at ${time}.`,
        `Puedo enviarle un mensaje a ${name} preguntándole si puede acompañarle a su cita del ${when} a las ${time}.`,
        `Mwen ka voye yon mesaj bay ${name} pou mande si li ka vin avè w nan randevou ou ${when} a ${time}.`
      )))}
      ${confirmationCard(props, t("What they will see", "Lo que verá", "Sa l ap wè"), [
        [t("Who", "Quién", "Kiyès"), name, data.contactRelationship || ""],
        [t("Date", "Fecha", "Dat"), when],
        [t("Time", "Hora", "Lè"), time],
        [t("Where", "Dónde", "Ki kote"), appointment.locationName || appointment.providerDisplayName || ""]
      ])}
      <p class="appointment-legal">${t("They will see when and where the visit is, and nothing about your health.", "Verá cuándo y dónde es la visita, y nada sobre su salud.", "L ap wè kilè ak kote vizit la ye, epi anyen sou sante ou.")}</p>
      ${primary(props, "barrier-companion-send", t("Send invitation", "Enviar invitación", "Voye envitasyon"), { resolutionId: id, glyph: "share" })}
      ${secondary(props, "barrier-back", t("Choose someone else", "Elegir a otra persona", "Chwazi yon lòt moun"), { resolutionId: id, extra: ` data-step="CONTACTS"` })}`;
  }

  if (step === "SENDING") {
    return `${screenHead(props, t("Sending the invitation", "Enviando la invitación", "N ap voye envitasyon an"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, t("Sending…", "Enviando…", "N ap voye…"), 1)}`;
  }

  if (step === "SENT") {
    return `${screenHead(props, t("Invitation sent", "Invitación enviada", "Envitasyon voye"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, t(`I asked ${data.contactName || ""}`, `Le pregunté a ${data.contactName || ""}`, `Mwen mande ${data.contactName || ""}`), t("I’ll tell you as soon as they answer.", "Le avisaré en cuanto responda.", "M ap di w kou li reponn."))}
      <p class="appointment-status" data-tone="WAITING" role="status" aria-live="polite">${iconOf(props)("clock")}<span>${esc(t("Waiting for an answer", "Esperando respuesta", "N ap tann yon repons"))}</span></p>
      ${closeLink(props, id)}
      ${demoBadge(props)}`;
  }

  if (step === "CONFIRMED") {
    return `${screenHead(props, t("Someone is coming with you", "Alguien le acompañará", "Yon moun ap vin avè w"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, t(`${data.contactName || ""} confirmed`, `${data.contactName || ""} confirmó`, `${data.contactName || ""} konfime`), t("They will be with you at your appointment.", "Le acompañará en su cita.", "L ap avè w nan randevou ou."))}
      ${primary(props, "barrier-close", t("Done", "Listo", "Fini"), { resolutionId: id })}
      ${demoBadge(props)}`;
  }

  if (step === "DECLINED_BY_CONTACT") {
    return `${screenHead(props, t("They can’t make it", "No puede acompañarle", "Li pa ka vini"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        `${data.contactName || ""} can’t come this time. We can ask someone else, or I can ask your care team.`,
        `${data.contactName || ""} no puede esta vez. Podemos pedírselo a otra persona, o puedo avisar a su equipo de cuidado.`,
        `${data.contactName || ""} pa ka vini fwa sa a. Nou ka mande yon lòt moun, oswa mwen ka mande ekip swen ou.`
      ))}
      ${primary(props, "barrier-companion-another", t("Ask someone else", "Pedírselo a otra persona", "Mande yon lòt moun"), { resolutionId: id, glyph: "people" })}
      ${careTeamEscalation(props, { resolutionId: id, reason: "COMPANION_DECLINED", message: " " })}
      ${closeLink(props, id)}`;
  }

  if (step === "NO_CONTACT") {
    return `${screenHead(props, t("Let me find someone", "Busquemos a alguien", "Ann jwenn yon moun"), "", localBarrierText(EYEBROW, locale))}
      ${careTeamEscalation(props, {
        resolutionId: id,
        reason: "NO_COMPANION_AVAILABLE",
        message: t(
          "Your care team can look at what support is available for this visit.",
          "Su equipo de cuidado puede ver qué apoyo hay disponible para esta visita.",
          "Ekip swen ou ka gade ki sipò ki disponib pou vizit sa a."
        )
      })}
      ${backLink(props, id, "OFFER", t("Back", "Atrás", "Retounen"))}`;
  }

  return declinedOrEscalated(props, resolution);
}

/* ==========================================================================================
   Reschedule
   ========================================================================================== */

function rescheduleView(props) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const resolution = props.resolution || {};
  const id = resolution.id || "";
  const data = resolution.data || {};
  const step = resolution.step;
  const appointment = props.appointment || {};
  const provider = appointment.providerDisplayName || t("your care team", "su equipo de cuidado", "ekip swen ou");

  if (step === "OFFER") {
    return `${screenHead(props, t("Changing your appointment time", "Cambiar la hora de su cita", "Chanje lè randevou ou"), appointmentLine(props, appointment), localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        `Of course. I can look for other times for your appointment with ${provider}.`,
        `Claro. Puedo buscar otros horarios para su cita con ${provider}.`,
        `Byen sûr. Mwen ka chèche lòt lè pou randevou ou ak ${provider}.`
      ))}
      <div class="appointment-actions">
        ${primary(props, "barrier-reschedule-start", t("Find other times", "Buscar otros horarios", "Chèche lòt lè"), { resolutionId: id, glyph: "calendarClock" })}
        ${secondary(props, "barrier-decline", t("Not right now", "No por ahora", "Pa kounye a"), { resolutionId: id })}
      </div>`;
  }

  if (step === "SEARCHING") {
    return `${screenHead(props, t("Finding other times", "Buscando otros horarios", "N ap chèche lòt lè"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, resolutionSpeech("RESCHEDULE_SEARCHING", locale), 3)}`;
  }

  if (step === "SLOTS") {
    const slots = Array.isArray(props.slots) ? props.slots : [];
    // §6 asks for a grouping by date, which is also how a patient reads a list of times: pick the
    // day first, then the hour.
    const groups = slots.reduce((all, slot) => {
      const key = formatAppointmentLongDate(slot.startAt, appointment.timezone, locale);
      const bucket = all.find(entry => entry.key === key);
      if (bucket) bucket.slots.push(slot);
      else all.push({ key, slots: [slot] });
      return all;
    }, []);
    return `${screenHead(props, t("Choose a new time", "Elija un nuevo horario", "Chwazi yon nouvo lè"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, slots.length === 1
        ? t("I found one other time.", "Encontré otro horario.", "Mwen jwenn yon lòt lè.")
        : t(`I found ${slots.length} other times.`, `Encontré ${slots.length} horarios.`, `Mwen jwenn ${slots.length} lòt lè.`))}
      ${groups.map(group => `<section class="barrier-slot-group">
        <h2 class="appointment-subsection-title">${esc(group.key)}</h2>
        <div class="barrier-slots">${group.slots.map(slot => appointmentSlotCard(props, slot, { selectedId: data.selectedSlotId || "", resolutionId: id })).join("")}</div>
      </section>`).join("")}
      ${backLink(props, id, "OFFER", t("Back", "Atrás", "Retounen"))}
      ${demoBadge(props)}`;
  }

  if (step === "SLOTS_EMPTY") {
    return `${screenHead(props, t("No other times right now", "No hay otros horarios ahora", "Pa gen lòt lè kounye a"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        "I couldn’t find another time in this office’s calendar. Your care team can work one out with them.",
        "No encontré otro horario en el calendario de este consultorio. Su equipo de cuidado puede coordinarlo con ellos.",
        "Mwen pa t jwenn yon lòt lè nan kalandriye kabinè sa a. Ekip swen ou ka antann yo avèk yo."
      ))}
      ${careTeamEscalation(props, { resolutionId: id, reason: "NO_SLOTS_AVAILABLE", message: " " })}
      ${closeLink(props, id)}`;
  }

  if (step === "REVIEW") {
    const slot = (Array.isArray(props.slots) ? props.slots : []).find(item => item.slotId === data.selectedSlotId) || null;
    if (!slot) {
      return `${screenHead(props, t("Choose a new time", "Elija un nuevo horario", "Chwazi yon nouvo lè"), "", localBarrierText(EYEBROW, locale))}
        ${errorNote(props, t("That time is no longer available. Choose another one.", "Ese horario ya no está disponible. Elija otro.", "Lè sa a pa disponib ankò. Chwazi yon lòt."))}
        ${primary(props, "barrier-reschedule-start", t("Look again", "Buscar de nuevo", "Chèche ankò"), { resolutionId: id })}
        ${closeLink(props, id)}`;
    }
    return `${screenHead(props, t("Confirm the change", "Confirmar el cambio", "Konfime chanjman an"), "", localBarrierText(EYEBROW, locale))}
      <div class="barrier-change">
        <section class="barrier-change-side" data-side="current">
          <h2 class="appointment-share-heading">${esc(t("Current", "Actual", "Kounye a"))}</h2>
          <p class="barrier-change-date">${esc(formatAppointmentLongDate(appointment.scheduledAt, appointment.timezone, locale))}</p>
          <p class="barrier-change-time">${esc(formatAppointmentTime(appointment.scheduledAt, appointment.timezone, locale))}</p>
        </section>
        <p class="barrier-change-arrow" aria-hidden="true">${iconOf(props)("arrowRight")}</p>
        <section class="barrier-change-side" data-side="new">
          <h2 class="appointment-share-heading">${esc(t("New", "Nuevo", "Nouvo"))}</h2>
          <p class="barrier-change-date">${esc(formatAppointmentLongDate(slot.startAt, appointment.timezone, locale))}</p>
          <p class="barrier-change-time">${esc(formatAppointmentTime(slot.startAt, appointment.timezone, locale))}</p>
        </section>
      </div>
      ${data.hasTransportation ? `<p class="appointment-note">${iconOf(props)("car")}<span>${esc(t("Your ride is booked for the old time. I’ll help you update it right after.", "Su viaje está reservado para la hora anterior. Le ayudaré a actualizarlo enseguida.", "Vwayaj ou rezève pou ansyen lè a. M ap ede w mete l ajou touswit apre."))}</span></p>` : ""}
      ${primary(props, "barrier-reschedule-confirm", t("Confirm the change", "Confirmar el cambio", "Konfime chanjman an"), { resolutionId: id, glyph: "check" })}
      ${secondary(props, "barrier-back", t("Choose another time", "Elegir otro horario", "Chwazi yon lòt lè"), { resolutionId: id, extra: ` data-step="SLOTS"` })}`;
  }

  if (step === "CHANGING") {
    return `${screenHead(props, t("Changing your appointment", "Cambiando su cita", "N ap chanje randevou ou"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, t("Changing your appointment…", "Cambiando su cita…", "N ap chanje randevou ou…"), 1)}`;
  }

  if (step === "CHANGE_FAILED") {
    return `${screenHead(props, t("I couldn’t change it", "No pude cambiarla", "Mwen pa t ka chanje l"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, t(
        "Your appointment is unchanged. We can look at other times again, or I can ask your care team.",
        "Su cita no cambió. Podemos ver otros horarios de nuevo, o puedo avisar a su equipo de cuidado.",
        "Randevou ou pa chanje. Nou ka gade lòt lè ankò, oswa mwen ka mande ekip swen ou."
      ))}
      ${primary(props, "barrier-reschedule-start", t("Look again", "Buscar de nuevo", "Chèche ankò"), { resolutionId: id, glyph: "rotate" })}
      ${careTeamEscalation(props, { resolutionId: id, reason: "RESCHEDULE_FAILED", message: " " })}
      ${closeLink(props, id)}`;
  }

  if (step === "CHANGED") {
    return `${screenHead(props, t("Your appointment was changed", "Su cita fue cambiada", "Randevou ou chanje"), "", localBarrierText(EYEBROW, locale))}
      ${successState(props, t("Your appointment was rescheduled.", "Su cita fue reprogramada.", "Randevou ou reprograme."))}
      ${confirmationCard(props, t("Your new appointment", "Su nueva cita", "Nouvo randevou ou"), [
        [t("Provider", "Profesional", "Pwofesyonèl"), appointment.providerDisplayName || ""],
        [t("Date", "Fecha", "Dat"), formatAppointmentLongDate(appointment.scheduledAt, appointment.timezone, locale)],
        [t("Time", "Hora", "Lè"), formatAppointmentTime(appointment.scheduledAt, appointment.timezone, locale)],
        [t("Where", "Dónde", "Ki kote"), appointment.locationName || ""]
      ])}
      ${data.transportationNeedsUpdate ? `<section class="barrier-followup">
        ${emmiMessage(props, t("Your ride also needs updating.", "Su transporte también necesita actualizarse.", "Transpò ou bezwen mete ajou tou."))}
        ${primary(props, "barrier-transport-update", t("Update my ride", "Actualizar transporte", "Mete transpò a ajou"), { resolutionId: id, glyph: "car" })}
      </section>` : primary(props, "barrier-close", t("Done", "Listo", "Fini"), { resolutionId: id })}
      ${closeLink(props, id)}
      ${demoBadge(props)}`;
  }

  return declinedOrEscalated(props, resolution);
}

/* ==========================================================================================
   Something else
   ========================================================================================== */

function otherView(props) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  const resolution = props.resolution || {};
  const id = resolution.id || "";
  const data = resolution.data || {};
  const step = resolution.step;

  if (step === "DESCRIBE") {
    return `${screenHead(props, t("Tell me what’s making this hard", "Cuénteme qué lo dificulta", "Di m kisa k ap fè sa difisil"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, resolutionSpeech("OTHER_ASK", locale))}
      <form id="barrier-describe-form" class="appointment-prep-form" novalidate>
        <label class="appointment-field" for="barrier-describe">${t("In your own words", "En sus propias palabras", "Nan mo pa ou")}
          <textarea id="barrier-describe" name="describe" rows="4" maxlength="400" placeholder="${esc(t("For example: I don’t have a car that day", "Por ejemplo: no tengo carro ese día", "Pa egzanp: mwen pa gen machin jou sa a"))}">${esc(data.text || "")}</textarea>
        </label>
      </form>
      ${primary(props, "barrier-other-submit", t("Continue", "Continuar", "Kontinye"), { resolutionId: id })}
      <p class="appointment-legal">${t("You can also use the voice guide at the top of the screen.", "También puede usar la guía por voz en la parte superior.", "Ou ka sèvi ak gid vwa a anlè ekran an tou.")}</p>
      ${closeLink(props, id)}`;
  }

  if (step === "CLASSIFYING") {
    return `${screenHead(props, t("One moment", "Un momento", "Yon moman"), "", localBarrierText(EYEBROW, locale))}
      ${loadingState(props, t("Let me see what I can do…", "Veamos qué puedo hacer…", "Ann wè sa m ka fè…"), 1)}`;
  }

  if (step === "ROUTED") {
    const routed = data.routedTo || "";
    const offer = {
      [BARRIER_TYPES.TRANSPORTATION]: t("I understand. I can help you find transportation.", "Entiendo. Puedo ayudarle a buscar transporte.", "Mwen konprann. Mwen ka ede w chèche transpò."),
      [BARRIER_TYPES.COMPANION]: t("I understand. I can help you find someone to come with you.", "Entiendo. Puedo ayudarle a buscar quién le acompañe.", "Mwen konprann. Mwen ka ede w jwenn yon moun pou vin avè w."),
      [BARRIER_TYPES.VIDEO_VISIT]: t("I understand. I can check that your device is ready.", "Entiendo. Puedo revisar que su dispositivo esté listo.", "Mwen konprann. Mwen ka tcheke si aparèy ou pare."),
      [BARRIER_TYPES.RESCHEDULE]: t("I understand. I can look for another time.", "Entiendo. Puedo buscar otro horario.", "Mwen konprann. Mwen ka chèche yon lòt lè.")
    }[routed] || "";
    const cta = {
      [BARRIER_TYPES.TRANSPORTATION]: t("Find transportation", "Buscar transporte", "Chèche transpò"),
      [BARRIER_TYPES.COMPANION]: t("Find someone to come with me", "Buscar quién me acompañe", "Chèche yon moun pou vin avè m"),
      [BARRIER_TYPES.VIDEO_VISIT]: t("Check my device", "Revisar mi dispositivo", "Tcheke aparèy mwen"),
      [BARRIER_TYPES.RESCHEDULE]: t("Find other times", "Buscar otros horarios", "Chèche lòt lè")
    }[routed] || t("Continue", "Continuar", "Kontinye");
    return `${screenHead(props, t("I can help with that", "Puedo ayudarle con eso", "Mwen ka ede w ak sa"), "", localBarrierText(EYEBROW, locale))}
      ${emmiMessage(props, offer)}
      ${primary(props, "barrier-route", cta, { resolutionId: id, extra: ` data-barrier-type="${esc(routed)}"`, glyph: "arrowRight" })}
      ${secondary(props, "barrier-escalate", t("Ask my care team instead", "Mejor pedir a mi equipo de cuidado", "Pito mande ekip swen mwen"), { resolutionId: id, extra: ` data-reason="PATIENT_PREFERS_CARE_TEAM"`, glyph: "people" })}
      ${backLink(props, id, "DESCRIBE", t("Say it differently", "Decirlo de otra forma", "Di l yon lòt jan"))}`;
  }

  if (step === "ESCALATE_OFFER") {
    return `${screenHead(props, t("Let me get you help", "Consigamos ayuda", "Ann jwenn èd pou ou"), "", localBarrierText(EYEBROW, locale))}
      ${careTeamEscalation(props, { resolutionId: id, reason: "UNCLASSIFIED_BARRIER" })}
      ${backLink(props, id, "DESCRIBE", t("Say it differently", "Decirlo de otra forma", "Di l yon lòt jan"))}`;
  }

  return declinedOrEscalated(props, resolution);
}

/* ------------------------------------------------------------- shared terminal states ----- */

function declinedOrEscalated(props, resolution) {
  const locale = localeOf(props);
  const t = say(locale);
  const id = resolution?.id || "";
  if (resolution?.step === "ESCALATED") {
    return `${screenHead(props, t("Your care team knows", "Su equipo de cuidado ya lo sabe", "Ekip swen ou konnen"), "", localBarrierText(EYEBROW, locale))}
      ${escalatedState(props, id)}`;
  }
  return `${screenHead(props, t("That’s okay", "Está bien", "Sa bon"), "", localBarrierText(EYEBROW, locale))}
    ${emmiMessage(props, t(
      "No problem. You can come back to this from your appointment whenever you want.",
      "Sin problema. Puede volver a esto desde su cita cuando quiera.",
      "Pa gen pwoblèm. Ou ka retounen sou sa nan randevou ou lè ou vle."
    ))}
    ${primary(props, "barrier-close", t("Back to my appointment", "Volver a mi cita", "Retounen nan randevou m"), { resolutionId: id })}`;
}

/* ==========================================================================================
   Entry point + the two panels other screens embed
   ========================================================================================== */

// The one export the shell renders. It picks the playbook and the step; every screen above is a
// branch of this, so there is exactly one place that decides what a patient is looking at.
export function barrierResolutionScreen(props = {}) {
  const resolution = props.resolution;
  if (!resolution) return "";
  const body = resolution.barrierType === BARRIER_TYPES.TRANSPORTATION ? transportationView(props)
    : resolution.barrierType === BARRIER_TYPES.VIDEO_VISIT ? videoVisitView(props)
      : resolution.barrierType === BARRIER_TYPES.COMPANION ? companionView(props)
        : resolution.barrierType === BARRIER_TYPES.RESCHEDULE ? rescheduleView(props)
          : otherView(props);
  return `<div class="appointment-screen barrier-screen" data-barrier="${escaper(props)(resolution.barrierType)}" data-step="${escaper(props)(resolution.step)}">${body}</div>`;
}

// §9. What is settled for this visit, on the appointment screen itself. Compact by construction:
// one line per item, one summary line, and nothing at all when the patient has raised nothing.
export function appointmentReadinessPanel(props = {}) {
  const readiness = props.readiness;
  if (!readiness || !readiness.items?.length) return "";
  const esc = escaper(props);
  const locale = localeOf(props);
  const t = say(locale);
  const glyphFor = state => (state === READINESS_STATES.READY ? "check" : state === READINESS_STATES.NEEDS_CARE_TEAM ? "people" : "clock");
  const toneFor = state => (state === READINESS_STATES.READY ? "CONFIRMED" : "WAITING");
  return `<section class="barrier-readiness">
    <h2 class="appointment-section-title">${esc(t("Getting ready for your visit", "Preparación para su cita", "Preparasyon pou vizit ou"))}</h2>
    <ul class="barrier-readiness-list">
      ${readiness.items.map(item => `<li data-state="${esc(item.state)}"><span class="appointment-status" data-tone="${toneFor(item.state)}">${iconOf(props)(glyphFor(item.state))}<span>${esc(item.label)}</span></span>${item.detail ? `<small>${esc(item.detail)}</small>` : ""}</li>`).join("")}
    </ul>
    <p class="appointment-status" data-tone="${readiness.ready ? "CONFIRMED" : "WAITING"}">${iconOf(props)(readiness.ready ? "check" : "clock")}<span>${esc(readiness.summary)}</span></p>
  </section>`;
}

// §8. "I'm all set" is an answer, and it deserves one sentence rather than a flow.
export function allSetConfirmation(props = {}) {
  const locale = localeOf(props);
  const t = say(locale);
  const esc = escaper(props);
  return `<p class="appointment-status" data-tone="CONFIRMED" role="status">${iconOf(props)("check")}<span>${esc(resolutionSpeech("ALL_SET", locale))}</span></p>
    ${props.hideAction ? "" : `<button type="button" class="appointment-inline-link" data-action="barrier-close"><span>${esc(t("Back to my appointment", "Volver a mi cita", "Retounen nan randevou m"))}</span>${iconOf(props)("arrowRight")}</button>`}`;
}

export const RESOLUTION_TERMINAL_STATUSES = Object.freeze([RESOLUTION_STATUS.RESOLVED, RESOLUTION_STATUS.CANCELLED]);
