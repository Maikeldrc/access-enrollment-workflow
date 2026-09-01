// What EMMI sees when the patient is anywhere in appointment coordination.
//
// src/emmi/viewContext.js owns the shape; this file owns the meaning. One describer per view, each
// answering the same seven questions the contract asks, from the same records the screen renders
// from — so what EMMI says and what the patient reads can never be two different things.
//
// The rule that decides where a fact goes:
//
//   `selection`  the patient has picked it. Nothing has happened yet.
//   `pending`    it still has to happen, and EMMI must say so.
//   `completed`  a real source said it happened. ONLY here may EMMI answer "yes, it is booked".
//
// A ride the patient selected on the review screen is a `selection` with "confirm the booking" in
// `pending`. It becomes `completed` when — and only when — the record carries a reservation id.
// That single discipline is what makes "¿ya está reservado?" answerable correctly at every step.
//
// Every option and action names the control that produces it, using the same data-action contract
// the views emit. The shell drops the ones that are not on screen, so a describer that drifts from
// its view degrades to silence rather than to a promise nobody can keep.
//
// Pure module: no DOM, no app state, no storage.

import { BARRIER_TYPES, RESOLUTION_STEPS } from "./barrierResolution.js";
import { formatAppointmentLongDate, formatAppointmentTime, formatAppointmentWhen } from "./appointmentViews.js";

const T = (en, es, ht) => Object.freeze({ en, es, ht });
const L = (value, locale = "en") => (typeof value === "string" ? value : value?.[locale] || value?.en || "");

const APPOINTMENT_VIEW_IDS = Object.freeze({
  LIST: "APPOINTMENT_LIST",
  DETAIL_CONFIRMED: "APPOINTMENT_CONFIRMED",
  DETAIL_REQUEST: "APPOINTMENT_REQUEST",
  PREP: "APPOINTMENT_TOPICS",
  BRIEF: "APPOINTMENT_TOPIC_LIST",
  BARRIER_CHECK: "APPOINTMENT_PRE_VISIT_CHECK",
  ALL_SET: "APPOINTMENT_READY_CONFIRMED",
  SHARE: "APPOINTMENT_SHARE",
  REMINDER: "APPOINTMENT_REMINDER",
  CANCEL_CONFIRM: "APPOINTMENT_CANCEL_CONFIRM",
  FOLLOW_UP: "APPOINTMENT_FOLLOW_UP",
  SCHEDULING: "APPOINTMENT_SCHEDULING"
});
export const EMMI_APPOINTMENT_VIEW_IDS = APPOINTMENT_VIEW_IDS;

/* ------------------------------------------------------------------------ small helpers -- */

const when = (appointment, locale) => formatAppointmentWhen(appointment?.scheduledAt, appointment?.timezone, locale);
const day = (value, appointment, locale) => formatAppointmentLongDate(value, appointment?.timezone, locale);
const clock = (value, appointment, locale) => formatAppointmentTime(value, appointment?.timezone, locale);

// The facts every appointment view repeats, so a patient who asks "which appointment is this?"
// gets the same answer wherever they are standing.
const appointmentFacts = (appointment, locale) => [
  appointment?.providerDisplayName ? { label: L(T("Doctor", "Doctor", "Doktè"), locale), value: appointment.providerDisplayName } : null,
  appointment?.scheduledAt ? { label: L(T("Date", "Fecha", "Dat"), locale), value: day(appointment.scheduledAt, appointment, locale) } : null,
  appointment?.scheduledAt ? { label: L(T("Time", "Hora", "Lè"), locale), value: clock(appointment.scheduledAt, appointment, locale) } : null,
  appointment?.locationName ? { label: L(T("Where", "Dónde", "Ki kote"), locale), value: appointment.locationName } : null
].filter(Boolean);

const action = (id, label, kind, { selector = "", effect = "", inputSelector = "", inputHint = "" } = {}) => ({ id, label, kind, selector: selector || `[data-action="${id}"]`, effect, inputSelector, inputHint });

/* =========================================================================================
   Barrier resolution — the flow EMMI has to be able to walk beside
   ========================================================================================= */

// The one sentence that says what this step is for. It is what "¿qué tengo que hacer aquí?"
// answers with, so it is written as an instruction rather than as a label.
const RESOLUTION_TASK = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: Object.freeze({
    OFFER: T("Decide whether you want me to look for a ride to this appointment.", "Decida si quiere que busque un viaje para esta cita.", "Deside si ou vle m chèche yon machin pou randevou sa a."),
    PICKUP: T("Confirm where the car should pick you up, or give a different address.", "Confirme dónde debe recogerle el vehículo, o indique otra dirección.", "Konfime ki kote machin nan dwe vin pran w, oswa bay yon lòt adrès."),
    PICKUP_EDIT: T("Type the address where the car should pick you up.", "Escriba la dirección donde debe recogerle el vehículo.", "Ekri adrès kote machin nan dwe vin pran w."),
    NEEDS: T("Choose any special help you need for the journey, then continue.", "Elija la ayuda especial que necesite para el viaje y continúe.", "Chwazi èd espesyal ou bezwen pou vwayaj la, epi kontinye."),
    NEEDS_UNSUPPORTED: T("A standard car is not right for what you need, so the care team arranges this one.", "Un vehículo estándar no sirve para lo que necesita, así que el equipo de cuidado lo organiza.", "Yon machin estanda pa bon pou sa ou bezwen, kidonk ekip swen an ap òganize sa a."),
    TIME: T("Check the suggested pickup time, then look for rides — or choose a different time.", "Revise la hora de recogida sugerida y busque vehículos, o elija otra hora.", "Gade lè pou pran w la, epi chèche machin, oswa chwazi yon lòt lè."),
    TIME_EDIT: T("Choose a different pickup time.", "Elija otra hora de recogida.", "Chwazi yon lòt lè pou pran w."),
    SEARCHING: T("I am looking for rides. Nothing is booked yet.", "Estoy buscando vehículos. Todavía no hay nada reservado.", "M ap chèche machin. Anyen poko rezève."),
    OPTIONS: T("Choose one of the rides. Choosing one does not book it — you review it first.", "Elija uno de los vehículos. Elegirlo no lo reserva: primero lo revisa.", "Chwazi youn nan machin yo. Chwazi youn pa rezève l: ou gade l anvan."),
    OPTIONS_EMPTY: T("There are no rides at that time. Try another time, or ask the care team.", "No hay vehículos a esa hora. Pruebe otra hora o pida ayuda al equipo de cuidado.", "Pa gen machin nan lè sa a. Eseye yon lòt lè, oswa mande ekip swen an."),
    REVIEW: T("Check the trip. It is booked only when you press the booking button.", "Revise el viaje. Solo se reserva cuando presione el botón de reservar.", "Gade vwayaj la. Li rezève sèlman lè ou peze bouton an."),
    BOOKING: T("I am booking the ride now.", "Estoy reservando el viaje ahora.", "M ap rezève vwayaj la kounye a."),
    BOOKED: T("The ride is booked. You can change it or cancel it from here.", "El viaje está reservado. Puede cambiarlo o cancelarlo desde aquí.", "Vwayaj la rezève. Ou ka chanje l oswa anile l isit la."),
    BOOKING_FAILED: T("The booking did not go through. Nothing was booked and nothing was charged.", "La reserva no se realizó. No se reservó ni se cobró nada.", "Rezèvasyon an pa t pase. Anyen pa rezève e anyen pa chaje."),
    RETURN_OFFER: T("The ride there is booked. Decide whether you also want a ride home.", "El viaje de ida está reservado. Decida si también quiere el regreso.", "Vwayaj ale a rezève. Deside si ou vle retou a tou."),
    RETURN_TIME: T("Choose when the car should come back for you.", "Elija cuándo debe volver el vehículo por usted.", "Chwazi kilè machin nan dwe tounen pou ou."),
    RETURN_BOOKING: T("I am booking the ride home now.", "Estoy reservando el viaje de regreso.", "M ap rezève vwayaj retou a."),
    CANCEL_CONFIRM: T("Confirm whether to cancel the ride, or keep it.", "Confirme si cancela el viaje o lo conserva.", "Konfime si w anile vwayaj la oswa w kenbe l."),
    CANCELED: T("The ride is cancelled. You can arrange another one.", "El viaje está cancelado. Puede coordinar otro.", "Vwayaj la anile. Ou ka òganize yon lòt."),
    DECLINED: T("You said not right now. You can come back to this from the appointment.", "Dijo que no por ahora. Puede volver a esto desde la cita.", "Ou di pa kounye a. Ou ka retounen sou sa nan randevou a."),
    ESCALATED: T("The care team has been asked to arrange this.", "Se pidió al equipo de cuidado que lo organice.", "Nou mande ekip swen an òganize sa.")
  }),
  [BARRIER_TYPES.VIDEO_VISIT]: Object.freeze({
    OFFER: T("Decide whether I should check that your phone is ready for the video visit.", "Decida si debo comprobar que su teléfono está listo para la visita por video.", "Deside si m dwe tcheke si telefòn ou pare pou vizit videyo a."),
    CHECKING: T("I am checking the microphone, the camera, the connection and the visit link.", "Estoy revisando el micrófono, la cámara, la conexión y el enlace de la visita.", "M ap tcheke mikwo, kamera, koneksyon ak lyen vizit la."),
    READY: T("Everything passed. Nothing else is needed for the video visit.", "Todo funcionó. No falta nada para la visita por video.", "Tout bagay pase. Pa gen anyen lòt ki manke."),
    ISSUES: T("Something did not pass. Choose step-by-step help, or ask the care team.", "Algo no funcionó. Elija ayuda paso a paso o pida al equipo de cuidado.", "Yon bagay pa t pase. Chwazi èd etap pa etap, oswa mande ekip swen an."),
    GUIDE: T("Follow the steps, then check again.", "Siga los pasos y vuelva a revisar.", "Swiv etap yo, epi tcheke ankò."),
    DECLINED: T("You said not right now. You can check the device later from the appointment.", "Dijo que no por ahora. Puede revisar el dispositivo después desde la cita.", "Ou di pa kounye a. Ou ka tcheke aparèy la pita nan randevou a."),
    ESCALATED: T("The care team has been asked to help with the video visit.", "Se pidió ayuda al equipo de cuidado para la visita por video.", "Nou mande ekip swen an èd pou vizit videyo a.")
  }),
  [BARRIER_TYPES.COMPANION]: Object.freeze({
    OFFER: T("Say whether there is someone who usually comes with you.", "Diga si hay alguien que normalmente le acompaña.", "Di si gen yon moun ki konn vin avè w."),
    CONTACTS: T("Choose who to ask. Choosing someone does not send anything yet.", "Elija a quién pedírselo. Elegir a alguien todavía no envía nada.", "Chwazi ki moun pou mande. Chwazi yon moun poko voye anyen."),
    NEW_CONTACT: T("Enter the first name, the relationship and the phone number.", "Escriba el nombre, la relación y el número de teléfono.", "Ekri non, relasyon an ak nimewo telefòn."),
    REVIEW: T("Check who will be asked. The message goes only when you send it.", "Revise a quién se le preguntará. El mensaje sale solo cuando lo envíe.", "Gade ki moun n ap mande. Mesaj la ale sèlman lè ou voye l."),
    SENDING: T("I am sending the invitation now.", "Estoy enviando la invitación.", "M ap voye envitasyon an."),
    SENT: T("The invitation was sent and is waiting for an answer.", "La invitación se envió y espera respuesta.", "Envitasyon an voye epi l ap tann yon repons."),
    CONFIRMED: T("They said yes. Nothing else is needed.", "Dijo que sí. No falta nada más.", "Li di wi. Pa gen anyen lòt."),
    DECLINED_BY_CONTACT: T("They cannot come this time. Ask someone else, or ask the care team.", "No puede esta vez. Pídaselo a otra persona o al equipo de cuidado.", "Li pa ka vini fwa sa a. Mande yon lòt moun, oswa ekip swen an."),
    NO_CONTACT: T("There is nobody to ask, so the care team looks at what support is available.", "No hay a quién pedírselo, así que el equipo de cuidado ve qué apoyo hay.", "Pa gen moun pou mande, kidonk ekip swen an ap gade ki sipò ki genyen."),
    DECLINED: T("You said not right now.", "Dijo que no por ahora.", "Ou di pa kounye a."),
    ESCALATED: T("The care team has been asked to help find someone.", "Se pidió al equipo de cuidado ayuda para encontrar a alguien.", "Nou mande ekip swen an ede jwenn yon moun.")
  }),
  [BARRIER_TYPES.RESCHEDULE]: Object.freeze({
    OFFER: T("Decide whether I should look for other times for this appointment.", "Decida si debo buscar otros horarios para esta cita.", "Deside si m dwe chèche lòt lè pou randevou sa a."),
    SEARCHING: T("I am looking for other times. The appointment has not changed.", "Estoy buscando otros horarios. La cita no ha cambiado.", "M ap chèche lòt lè. Randevou a pa chanje."),
    SLOTS: T("Choose a new time. Choosing one does not change the appointment yet.", "Elija un nuevo horario. Elegirlo todavía no cambia la cita.", "Chwazi yon nouvo lè. Chwazi youn poko chanje randevou a."),
    SLOTS_EMPTY: T("This office has no other times right now. The care team can work one out.", "Este consultorio no tiene otros horarios ahora. El equipo de cuidado puede coordinarlo.", "Kabinè sa a pa gen lòt lè kounye a. Ekip swen an ka antann li."),
    REVIEW: T("Check the old time against the new one. It changes only when you confirm.", "Compare la hora anterior con la nueva. Solo cambia cuando confirme.", "Konpare ansyen lè a ak nouvo a. Li chanje sèlman lè ou konfime."),
    CHANGING: T("I am changing the appointment now.", "Estoy cambiando la cita ahora.", "M ap chanje randevou a kounye a."),
    CHANGED: T("The appointment has moved to the new time.", "La cita cambió a la nueva hora.", "Randevou a chanje pou nouvo lè a."),
    CHANGE_FAILED: T("The change did not go through. The appointment is unchanged.", "El cambio no se realizó. La cita no cambió.", "Chanjman an pa t pase. Randevou a pa chanje."),
    DECLINED: T("You said not right now. The appointment is unchanged.", "Dijo que no por ahora. La cita no cambió.", "Ou di pa kounye a. Randevou a pa chanje."),
    ESCALATED: T("The care team has been asked to arrange a new time.", "Se pidió al equipo de cuidado que coordine un nuevo horario.", "Nou mande ekip swen an òganize yon nouvo lè.")
  }),
  [BARRIER_TYPES.OTHER]: Object.freeze({
    DESCRIBE: T("Tell me in your own words what could make the visit hard.", "Cuénteme con sus palabras qué podría dificultar la visita.", "Di m nan mo pa ou kisa ki ka fè vizit la difisil."),
    CLASSIFYING: T("I am working out what I can do about it.", "Estoy viendo qué puedo hacer al respecto.", "M ap wè sa m ka fè sou li."),
    ROUTED: T("I understood what you need. Say yes to open that help.", "Entendí lo que necesita. Diga que sí para abrir esa ayuda.", "Mwen konprann sa ou bezwen. Di wi pou louvri èd sa a."),
    ESCALATE_OFFER: T("I could not work this out myself. The care team can help.", "No pude resolverlo por mi cuenta. El equipo de cuidado puede ayudar.", "Mwen pa t ka regle sa. Ekip swen an ka ede."),
    ESCALATED: T("The care team has been asked to help with this.", "Se pidió ayuda al equipo de cuidado.", "Nou mande ekip swen an ede ak sa.")
  })
});

const FLOW_NAME = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: T("Arranging a ride to the appointment", "Coordinar transporte para la cita", "Òganize transpò pou randevou a"),
  [BARRIER_TYPES.VIDEO_VISIT]: T("Getting the device ready for the video visit", "Preparar el dispositivo para la visita por video", "Prepare aparèy la pou vizit videyo a"),
  [BARRIER_TYPES.COMPANION]: T("Asking someone to come to the appointment", "Pedir a alguien que acompañe a la cita", "Mande yon moun vin nan randevou a"),
  [BARRIER_TYPES.RESCHEDULE]: T("Changing the appointment time", "Cambiar la hora de la cita", "Chanje lè randevou a"),
  [BARRIER_TYPES.OTHER]: T("Working out what is making the visit hard", "Averiguar qué dificulta la visita", "Chèche sa k ap fè vizit la difisil")
});

// The steps a patient walks through, for "which step am I on". The branch and failure steps are
// excluded from the count: telling someone they are on step 9 of 21 when nineteen of those are
// things that will not happen to them is worse than not counting at all.
const MAIN_PATH = Object.freeze({
  [BARRIER_TYPES.TRANSPORTATION]: ["OFFER", "PICKUP", "NEEDS", "TIME", "SEARCHING", "OPTIONS", "REVIEW", "BOOKING", "BOOKED"],
  [BARRIER_TYPES.VIDEO_VISIT]: ["OFFER", "CHECKING", "READY"],
  [BARRIER_TYPES.COMPANION]: ["OFFER", "CONTACTS", "REVIEW", "SENDING", "SENT", "CONFIRMED"],
  [BARRIER_TYPES.RESCHEDULE]: ["OFFER", "SEARCHING", "SLOTS", "REVIEW", "CHANGING", "CHANGED"],
  [BARRIER_TYPES.OTHER]: ["DESCRIBE", "CLASSIFYING", "ROUTED"]
});

// What is really finished, and what is still owed. The single most important function in this
// file: everything EMMI is allowed to call done comes from here, and a selection never reaches it.
function resolutionProgress(resolution, appointment, locale) {
  const data = resolution.data || {};
  const step = resolution.step;
  const completed = [];
  const pending = [];
  const t = (en, es, ht) => L(T(en, es, ht), locale);

  if (resolution.barrierType === BARRIER_TYPES.TRANSPORTATION) {
    if (data.pickupAddress) completed.push({ id: "PICKUP_ADDRESS", label: t("Pickup address confirmed", "Dirección de recogida confirmada", "Adrès pou pran w konfime"), detail: data.pickupAddress.formatted || "" });
    if (Array.isArray(data.needs) && data.needs.length) completed.push({ id: "NEEDS", label: t("Special help for the journey answered", "Ayuda especial para el viaje respondida", "Èd espesyal pou vwayaj la reponn") });
    if (data.pickupAt) completed.push({ id: "PICKUP_TIME", label: t("Pickup time set", "Hora de recogida definida", "Lè pou pran w defini"), detail: clock(data.pickupAt, appointment, locale) });
    if (data.reservation) {
      completed.push({
        id: "RIDE_BOOKED",
        label: t("Ride booked", "Viaje reservado", "Vwayaj rezève"),
        detail: [data.reservation.serviceName, clock(data.reservation.pickupAt, appointment, locale), data.reservation.reservationId].filter(Boolean).join(" · ")
      });
    } else if (data.selectedOptionId) {
      // The distinction the whole contract turns on: chosen, not booked.
      pending.push({ id: "CONFIRM_BOOKING", label: t("The ride is chosen but NOT booked — it needs your confirmation on the review screen", "El viaje está elegido pero NO reservado: falta su confirmación en la pantalla de revisión", "Vwayaj la chwazi men li PA rezève: li bezwen konfimasyon ou nan ekran revizyon an") });
    }
    if (data.returnReservation) completed.push({ id: "RETURN_BOOKED", label: t("Ride home booked", "Viaje de regreso reservado", "Vwayaj retou rezève"), detail: clock(data.returnReservation.pickupAt, appointment, locale) });
    else if (step === "RETURN_OFFER") pending.push({ id: "RETURN_DECISION", label: t("Whether you also want a ride home", "Si también quiere transporte de regreso", "Si ou vle yon machin pou tounen tou") });
    if (data.reservationOutdated) pending.push({ id: "RIDE_OUTDATED", label: t("The booked ride is for the old appointment time and needs updating", "El viaje reservado es para la hora anterior y debe actualizarse", "Vwayaj rezève a se pou ansyen lè a epi li bezwen mete ajou") });
    if (data.returnUnavailable) pending.push({ id: "RETURN_UNAVAILABLE", label: t("No ride home was available at that time", "No había transporte de regreso a esa hora", "Pa t gen machin pou tounen nan lè sa a") });
    if (step === "BOOKING_FAILED") pending.push({ id: "BOOKING_FAILED", label: t("The booking failed — nothing was booked", "La reserva falló: no se reservó nada", "Rezèvasyon an echwe: anyen pa rezève") });
  }

  if (resolution.barrierType === BARRIER_TYPES.VIDEO_VISIT && Array.isArray(data.results) && data.results.length) {
    for (const result of data.results) {
      if (result.passed) completed.push({ id: `CHECK_${result.id}`, label: `${result.label}: ${result.detail}` });
      else pending.push({ id: `CHECK_${result.id}`, label: `${result.label}: ${result.detail}` });
    }
  }

  if (resolution.barrierType === BARRIER_TYPES.COMPANION) {
    if (data.contactName && ["REVIEW", "SENDING"].includes(step)) pending.push({ id: "SEND_INVITE", label: t(`${data.contactName} is chosen but the invitation has NOT been sent yet`, `${data.contactName} está elegida pero la invitación todavía NO se ha enviado`, `${data.contactName} chwazi men envitasyon an POKO voye`) });
    if (data.invitation && step === "SENT") { completed.push({ id: "INVITE_SENT", label: t(`Invitation sent to ${data.contactName || ""}`, `Invitación enviada a ${data.contactName || ""}`, `Envitasyon voye bay ${data.contactName || ""}`) }); pending.push({ id: "INVITE_ANSWER", label: t("They have not answered yet", "Todavía no ha respondido", "Li poko reponn") }); }
    if (step === "CONFIRMED") completed.push({ id: "COMPANION_CONFIRMED", label: t(`${data.contactName || ""} said yes and will come with you`, `${data.contactName || ""} dijo que sí y le acompañará`, `${data.contactName || ""} di wi epi l ap vin avè w`) });
    if (step === "DECLINED_BY_CONTACT") pending.push({ id: "COMPANION_DECLINED", label: t(`${data.contactName || ""} cannot come this time`, `${data.contactName || ""} no puede esta vez`, `${data.contactName || ""} pa ka vini fwa sa a`) });
  }

  if (resolution.barrierType === BARRIER_TYPES.RESCHEDULE) {
    if (data.selectedSlotId && ["REVIEW", "CHANGING"].includes(step)) {
      const slot = (data.slots || []).find(item => item.slotId === data.selectedSlotId);
      pending.push({ id: "CONFIRM_CHANGE", label: t("A new time is chosen but the appointment has NOT changed yet", "Hay un nuevo horario elegido pero la cita todavía NO ha cambiado", "Gen yon nouvo lè chwazi men randevou a POKO chanje"), detail: slot ? `${day(slot.startAt, appointment, locale)} · ${clock(slot.startAt, appointment, locale)}` : "" });
    }
    if (step === "CHANGED") completed.push({ id: "APPOINTMENT_MOVED", label: t("The appointment was moved", "La cita fue cambiada", "Randevou a chanje"), detail: `${day(appointment?.scheduledAt, appointment, locale)} · ${clock(appointment?.scheduledAt, appointment, locale)}` });
    if (data.transportationNeedsUpdate && step === "CHANGED") pending.push({ id: "UPDATE_RIDE", label: t("The ride booked for the old time still needs updating", "El viaje reservado para la hora anterior aún debe actualizarse", "Vwayaj rezève pou ansyen lè a bezwen mete ajou toujou") });
  }

  if (resolution.careTeamTaskId) completed.push({ id: "CARE_TEAM_ASKED", label: t("The care team was asked to help", "Se pidió ayuda al equipo de cuidado", "Nou mande ekip swen an èd") });
  return { completed, pending };
}

// The choosable things on this step, whatever the step is choosing between.
function resolutionOptions(resolution, appointment, locale, extras) {
  const data = resolution.data || {};
  const step = resolution.step;
  const id = resolution.id;
  const t = (en, es, ht) => L(T(en, es, ht), locale);

  if (step === "OPTIONS") {
    return (data.options || []).map(option => ({
      id: option.optionId,
      label: option.serviceName,
      detail: [option.description, option.estimatedCost, clock(option.pickupAt, appointment, locale)].filter(Boolean).join(" · "),
      selected: option.optionId === data.selectedOptionId,
      selector: `[data-action="barrier-option-select"][data-option-id="${option.optionId}"]`,
      // The attributes a patient compares on. Named as questions rather than as fields, because
      // "which has more room" is answered by seats and "which is cheapest" by price.
      attributes: {
        pickupTime: clock(option.pickupAt, appointment, locale),
        arrivesAbout: clock(option.estimatedArrivalAt, appointment, locale),
        estimatedCost: option.estimatedCost || "",
        estimatedCostValue: option.estimatedCostValue ?? null,
        seats: option.seats ?? null,
        wheelchairAccessible: option.accessible === true
      }
    }));
  }

  if (step === "SLOTS") {
    return (data.slots || []).map(slot => ({
      id: slot.slotId,
      label: `${day(slot.startAt, appointment, locale)} · ${clock(slot.startAt, appointment, locale)}`,
      detail: "",
      selected: slot.slotId === data.selectedSlotId,
      selector: `[data-action="barrier-slot-select"][data-slot-id="${slot.slotId}"]`,
      attributes: { date: day(slot.startAt, appointment, locale), time: clock(slot.startAt, appointment, locale), startAt: slot.startAt }
    }));
  }

  if (step === "CONTACTS") {
    return (extras.contacts || []).map(contact => ({
      id: contact.contactId,
      label: contact.firstName,
      detail: contact.relationship || "",
      selected: contact.contactId === data.contactId,
      selector: `[data-action="barrier-companion-select"][data-contact-id="${contact.contactId}"]`,
      attributes: { relationship: contact.relationship || "" }
    }));
  }

  if (step === "NEEDS") {
    return (extras.needOptions || []).map(need => ({
      id: need.id,
      label: need.label,
      detail: "",
      selected: (data.needs || []).includes(need.id),
      selector: `[data-action="barrier-need-toggle"][data-need="${need.id}"]`,
      attributes: {}
    }));
  }

  if (step === "TIME_EDIT") {
    return (extras.pickupChoices || []).map(choice => ({
      id: choice.pickupAt,
      label: clock(choice.pickupAt, appointment, locale),
      detail: choice.label,
      selected: choice.pickupAt === data.pickupAt,
      selector: `[data-action="barrier-time-select"][data-pickup-at="${choice.pickupAt}"]`,
      attributes: {}
    }));
  }

  if (step === "RETURN_TIME") {
    return (extras.returnChoices || []).map(choice => ({
      id: choice.id,
      label: choice.label,
      detail: "",
      selected: choice.id === data.returnChoice,
      selector: `[data-action="barrier-return-select"][data-return-choice="${choice.id}"]`,
      attributes: {}
    }));
  }

  if (step === "PICKUP" && extras.homeAddress) {
    return [{ id: "HOME", label: t("Home", "Casa", "Kay"), detail: extras.homeAddress.formatted || "", selected: true, selector: `[data-action="barrier-pickup-home"]`, attributes: {} }];
  }

  if (step === "ISSUES" || step === "READY" || step === "GUIDE") {
    return (data.results || []).map(result => ({
      id: result.id,
      label: result.label,
      detail: result.detail,
      selected: false,
      selector: "",
      attributes: { passed: result.passed === true }
    }));
  }

  return [];
}

// The controls that exist on this step, named with the same data-action the view emits and the
// kind that decides whether EMMI may press it without being told to in that turn.
function resolutionActions(resolution, locale) {
  const id = resolution.id;
  const step = resolution.step;
  const t = (en, es, ht) => L(T(en, es, ht), locale);
  const on = (name, label, kind, effect = "") => action(name, label, kind, { selector: `[data-action="${name}"][data-resolution-id="${id}"]`, effect });
  const universal = [
    on("barrier-close", t("Back to my appointment", "Volver a mi cita", "Retounen nan randevou m"), "NAVIGATE"),
    on("barrier-escalate", t("Ask the care team for help", "Pedir ayuda al equipo de cuidado", "Mande ekip swen an èd"), "CONFIRM", t("Opens a task for the care team", "Abre una tarea para el equipo de cuidado", "Louvri yon travay pou ekip swen an"))
  ];
  const byStep = {
    OFFER: [
      on("barrier-accept", t("Yes, look for a ride", "Sí, buscar transporte", "Wi, chèche transpò"), "NAVIGATE"),
      on("barrier-video-start", t("Check my device", "Revisar mi dispositivo", "Tcheke aparèy mwen"), "NAVIGATE"),
      on("barrier-reschedule-start", t("Look for other times", "Buscar otros horarios", "Chèche lòt lè"), "NAVIGATE"),
      on("barrier-companion-answer", t("Answer yes or no", "Responder sí o no", "Reponn wi oswa non"), "SELECT"),
      on("barrier-decline", t("Not right now", "No por ahora", "Pa kounye a"), "NAVIGATE")
    ],
    PICKUP: [on("barrier-pickup-home", t("Use the home address", "Usar la dirección de casa", "Sèvi ak adrès kay la"), "SELECT"), on("barrier-pickup-other", t("Use a different address", "Usar otra dirección", "Sèvi ak yon lòt adrès"), "INPUT")],
    PICKUP_EDIT: [on("barrier-pickup-save", t("Save the address typed in the form", "Guardar la dirección escrita en el formulario", "Anrejistre adrès ki nan fòm nan"), "INPUT")],
    NEEDS: [on("barrier-needs-continue", t("Continue", "Continuar", "Kontinye"), "NAVIGATE")],
    TIME: [on("barrier-time-accept", t("Look for rides", "Buscar vehículos", "Chèche machin"), "NAVIGATE"), on("barrier-time-change", t("Choose a different pickup time", "Elegir otra hora de recogida", "Chwazi yon lòt lè"), "NAVIGATE")],
    OPTIONS: [],
    REVIEW: [
      on("barrier-reserve-confirm", t("Book this ride", "Reservar este viaje", "Rezève vwayaj sa a"), "CONFIRM", t("This books the ride", "Esto reserva el viaje", "Sa rezève vwayaj la")),
      on("barrier-companion-send", t("Send the invitation", "Enviar la invitación", "Voye envitasyon an"), "CONFIRM", t("This sends the message", "Esto envía el mensaje", "Sa voye mesaj la")),
      on("barrier-reschedule-confirm", t("Confirm the change", "Confirmar el cambio", "Konfime chanjman an"), "CONFIRM", t("This moves the appointment", "Esto cambia la cita", "Sa chanje randevou a"))
    ],
    BOOKED: [
      on("barrier-ride-change", t("Change the ride", "Cambiar el viaje", "Chanje vwayaj la"), "NAVIGATE"),
      on("barrier-ride-cancel", t("Cancel the ride", "Cancelar el viaje", "Anile vwayaj la"), "DESTRUCTIVE"),
      on("barrier-return-yes", t("Arrange a ride home", "Coordinar el regreso", "Òganize retou a"), "NAVIGATE"),
      on("barrier-return-no", t("No ride home", "Sin viaje de regreso", "Pa gen vwayaj retou"), "NAVIGATE")
    ],
    RETURN_OFFER: [on("barrier-return-yes", t("Yes, arrange a ride home", "Sí, coordinar el regreso", "Wi, òganize retou a"), "NAVIGATE"), on("barrier-return-no", t("No", "No", "Non"), "NAVIGATE")],
    CANCEL_CONFIRM: [on("barrier-ride-cancel-confirm", t("Yes, cancel the ride", "Sí, cancelar el viaje", "Wi, anile vwayaj la"), "DESTRUCTIVE", t("This cancels the booked ride", "Esto cancela el viaje reservado", "Sa anile vwayaj ki rezève a"))],
    ISSUES: [on("barrier-video-guide", t("Walk me through it", "Guíeme paso a paso", "Gide m etap pa etap"), "NAVIGATE")],
    GUIDE: [on("barrier-video-recheck", t("Check again", "Revisar de nuevo", "Tcheke ankò"), "NAVIGATE")],
    CONTACTS: [on("barrier-companion-new", t("Ask someone else", "Otra persona", "Yon lòt moun"), "INPUT")],
    NEW_CONTACT: [on("barrier-companion-save", t("Continue with the contact typed in the form", "Continuar con el contacto escrito en el formulario", "Kontinye ak kontak ki nan fòm nan"), "INPUT")],
    DESCRIBE: [{ ...on("barrier-other-submit", t("Say what is making the visit hard", "Decir qué dificulta la visita", "Di sa k ap fè vizit la difisil"), "INPUT"), inputSelector: "#barrier-describe", inputHint: t("What the patient said is making the visit hard, in their own words", "Lo que el paciente dijo que dificulta la visita, en sus palabras", "Sa pasyan an di k ap fè vizit la difisil, nan mo pa li") }],
    ROUTED: [on("barrier-route", t("Open that help", "Abrir esa ayuda", "Louvri èd sa a"), "NAVIGATE")],
    DECLINED_BY_CONTACT: [on("barrier-companion-another", t("Ask someone else", "Pedírselo a otra persona", "Mande yon lòt moun"), "NAVIGATE")],
    BOOKING_FAILED: [on("barrier-retry", t("Try booking again", "Intentar reservar de nuevo", "Eseye rezève ankò"), "CONFIRM")],
    CHANGED: [on("barrier-transport-update", t("Update the ride", "Actualizar el transporte", "Mete transpò a ajou"), "NAVIGATE")],
    CANCELED: [on("barrier-accept", t("Arrange another ride", "Coordinar otro viaje", "Òganize yon lòt vwayaj"), "NAVIGATE")]
  };
  return [...(byStep[step] || []), ...universal];
}

// The describer for every barrier resolution step. One function for twenty-one steps, because the
// steps differ in their data and not in their shape.
// What the patient has picked, on the steps that no longer show the list they picked it from.
// A review screen shows one ride and no options, so without this EMMI could describe the booking
// it was about to make but not say which ride it was.
function resolutionSelection(resolution, appointment, locale) {
  const data = resolution.data || {};
  if (data.selectedOptionId) {
    const option = (data.options || []).find(item => item.optionId === data.selectedOptionId);
    if (option) return { id: option.optionId, label: option.serviceName, detail: [option.description, option.estimatedCost, clock(option.pickupAt, appointment, locale)].filter(Boolean).join(" · ") };
  }
  if (data.selectedSlotId) {
    const slot = (data.slots || []).find(item => item.slotId === data.selectedSlotId);
    if (slot) return { id: slot.slotId, label: `${day(slot.startAt, appointment, locale)} · ${clock(slot.startAt, appointment, locale)}`, detail: "" };
  }
  if (data.contactId && data.contactName) return { id: data.contactId, label: data.contactName, detail: data.contactRelationship || "" };
  return null;
}

export function describeResolutionView({ resolution, appointment, locale = "en", extras = {} } = {}) {
  if (!resolution) return null;
  const path = MAIN_PATH[resolution.barrierType] || [];
  const position = path.indexOf(resolution.step);
  const task = RESOLUTION_TASK[resolution.barrierType]?.[resolution.step];
  const { completed, pending } = resolutionProgress(resolution, appointment, locale);
  const data = resolution.data || {};
  return {
    viewId: `BARRIER_${String(resolution.barrierType).toUpperCase()}_${resolution.step}`,
    screenId: "APPOINTMENT_DETAIL",
    title: L(FLOW_NAME[resolution.barrierType], locale),
    task: task ? L(task, locale) : "",
    flow: {
      id: String(resolution.barrierType).toUpperCase(),
      name: L(FLOW_NAME[resolution.barrierType], locale),
      step: resolution.step,
      stepNumber: position >= 0 ? position + 1 : null,
      totalSteps: position >= 0 ? path.length : null
    },
    facts: [
      ...appointmentFacts(appointment, locale),
      data.pickupAddress ? { label: L(T("Pickup address", "Dirección de recogida", "Adrès pou pran w"), locale), value: data.pickupAddress.formatted || "" } : null,
      data.pickupAt ? { label: L(T("Pickup time", "Hora de recogida", "Lè pou pran w"), locale), value: clock(data.pickupAt, appointment, locale) } : null,
      data.reservation ? { label: L(T("Booked ride", "Viaje reservado", "Vwayaj rezève"), locale), value: `${data.reservation.serviceName} · ${data.reservation.reservationId}` } : null
    ].filter(Boolean),
    options: resolutionOptions(resolution, appointment, locale, extras),
    selection: resolutionSelection(resolution, appointment, locale),
    completed,
    pending,
    actions: resolutionActions(resolution, locale),
    notes: [
      // The instruction the model needs most often, stated on the step where it matters rather
      // than only in the system prompt, where a long session can summarise it away.
      data.selectedOptionId && !data.reservation
        ? L(T("A ride is selected. It is NOT booked. Never say it is booked.", "Hay un viaje seleccionado. NO está reservado. Nunca diga que está reservado.", "Gen yon vwayaj chwazi. Li PA rezève. Pa janm di li rezève."), locale)
        : "",
      data.selectedSlotId && resolution.step !== "CHANGED"
        ? L(T("A new time is selected. The appointment has NOT changed yet.", "Hay un horario seleccionado. La cita todavía NO ha cambiado.", "Gen yon lè chwazi. Randevou a POKO chanje."), locale)
        : ""
    ].filter(Boolean)
  };
}

/* =========================================================================================
   The appointment views themselves
   ========================================================================================= */

const barrierCheckOptions = (preVisitCheck, appointmentId, barrierStates, locale) =>
  (preVisitCheck?.options || []).map(option => ({
    id: option.reasonKey,
    label: option.label,
    detail: barrierStates?.[option.reasonKey]?.label || "",
    selected: false,
    selector: `[data-action="appointment-barrier-answer"][data-barrier-reason="${option.reasonKey}"]`,
    attributes: barrierStates?.[option.reasonKey] ? { alreadyUnderWay: barrierStates[option.reasonKey].label } : {}
  }));

export function describeAppointmentView({
  screen = "",
  view = "",
  appointment = null,
  appointments = [],
  tab = "",
  schedulingStep = "",
  preVisitCheck = null,
  barrierStates = null,
  readiness = null,
  members = [],
  locale = "en"
} = {}) {
  const t = (en, es, ht) => L(T(en, es, ht), locale);

  if (screen === "MY_APPOINTMENTS") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.LIST,
      screenId: screen,
      title: t("My appointments", "Mis citas", "Randevou mwen yo"),
      task: t("Open an appointment to see it or work on it.", "Abra una cita para verla o trabajar en ella.", "Louvri yon randevou pou wè l oswa travay sou li."),
      facts: [{ label: t("Showing", "Mostrando", "Ap montre"), value: tab || "UPCOMING" }],
      options: appointments.slice(0, 8).map(record => ({
        id: record.id,
        label: [record.providerDisplayName, when(record, locale)].filter(Boolean).join(" · "),
        detail: record.status || "",
        selected: false,
        selector: `[data-action="appointment-open"][data-appointment-id="${record.id}"]`,
        attributes: { status: record.status || "" }
      })),
      actions: [action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")]
    };
  }

  if (screen === "APPOINTMENT_SCHEDULING") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.SCHEDULING,
      screenId: screen,
      title: t("Arranging an appointment", "Coordinar una cita", "Òganize yon randevou"),
      task: t("Answer one question at a time. Nothing is sent until you review and submit it.", "Responda una pregunta a la vez. No se envía nada hasta que lo revise y lo envíe.", "Reponn yon kesyon alafwa. Anyen pa ale jiskaske ou revize epi voye l."),
      flow: { id: "SCHEDULING", name: t("Arranging an appointment", "Coordinar una cita", "Òganize yon randevou"), step: schedulingStep || "PROVIDER" },
      facts: appointmentFacts(appointment, locale),
      completed: appointment?.status === "REQUEST_SENT" ? [{ id: "REQUEST_SENT", label: t("The request was sent to the office", "La solicitud se envió al consultorio", "Demann nan voye bay kabinè a") }] : [],
      pending: appointment?.status !== "CONFIRMED" ? [{ id: "NOT_CONFIRMED", label: t("This is not a confirmed appointment yet", "Todavía no es una cita confirmada", "Sa poko yon randevou konfime") }] : [],
      actions: [action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")]
    };
  }

  if (screen !== "APPOINTMENT_DETAIL" || !appointment) return null;
  const id = appointment.id;
  const confirmed = appointment.status === "CONFIRMED" && Boolean(appointment.scheduledAt);

  if (view === "BARRIER") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.BARRIER_CHECK,
      screenId: screen,
      title: preVisitCheck?.question || t("Anything making this hard?", "¿Algo se lo dificulta?", "Gen anyen k ap fè sa difisil?"),
      task: t("Choose whatever could make it hard to get to this visit, and I will try to solve it with you.", "Elija lo que pueda dificultar llegar a esta visita y trataré de resolverlo con usted.", "Chwazi sa ki ka fè li difisil pou rive nan vizit sa a, epi m ap eseye regle l avè w."),
      facts: appointmentFacts(appointment, locale),
      options: barrierCheckOptions(preVisitCheck, id, barrierStates, locale),
      actions: [action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")]
    };
  }

  if (view === "PREP") {
    const topics = (appointment.prep?.topics || []).filter(Boolean);
    const medications = (appointment.prep?.medications || []).filter(item => item?.name);
    return {
      viewId: APPOINTMENT_VIEW_IDS.PREP,
      screenId: screen,
      title: t("Things I want to discuss", "Lo que quiero conversar", "Bagay mwen vle pale sou yo"),
      task: t("Add anything you want to talk about at this visit. I can add a topic for you if you tell me what it is.", "Agregue lo que quiera conversar en esta visita. Puedo agregar un tema si me dice cuál es.", "Ajoute sa ou vle pale sou li nan vizit sa a. Mwen ka ajoute yon sijè si ou di m kisa li ye."),
      facts: appointmentFacts(appointment, locale),
      options: topics.map((topic, index) => ({
        id: String(index),
        label: topic,
        detail: "",
        selected: false,
        selector: `[data-action="appointment-remove-prep-topic"][data-topic-index="${index}"]`,
        attributes: { kind: "TOPIC" }
      })),
      completed: [
        ...topics.map((topic, index) => ({ id: `TOPIC_${index}`, label: topic })),
        ...medications.map(item => ({ id: `MED_${item.medicationId}`, label: `${t("Medication", "Medicamento", "Medikaman")}: ${item.name}` }))
      ],
      pending: topics.length || medications.length ? [] : [{ id: "NO_TOPICS", label: t("Nothing has been written down yet", "Todavía no hay nada anotado", "Poko gen anyen ekri") }],
      // The rule that decides what happens when a patient dictates a topic that names a symptom.
      // It lives here rather than in the system prompt because this view is re-sent on every
      // change and a prompt paragraph is the first thing a long session summarises away — and
      // because it is only true on this screen. Writing a question down decides nothing and
      // advises nothing, so it is never an alternative to the safety path: it is both.
      notes: [
        t(
          "Writing a topic here records a question for the clinician. It is not a clinical action, changes no record and gives no advice. If the patient names a symptom, write it down AND follow the clinical safety rules in the same turn — never instead of writing it down.",
          "Anotar un tema aquí registra una pregunta para el profesional clínico. No es una acción clínica, no cambia ningún registro y no da consejo. Si el paciente menciona un síntoma, anótelo Y siga las reglas de seguridad clínica en el mismo turno, nunca en lugar de anotarlo.",
          "Ekri yon sijè isit la anrejistre yon kesyon pou pwofesyonèl klinik la. Se pa yon aksyon klinik, li pa chanje okenn dosye epi li pa bay konsèy. Si pasyan an mansyone yon sentòm, ekri l EPI swiv règ sekirite klinik yo nan menm tou a, pa janm nan plas ekri l."
        )
      ],
      actions: [
        action("appointment-add-prep-topic", t("Add a topic to the visit list", "Agregar un tema a la lista de la cita", "Ajoute yon sijè nan lis vizit la"), "INPUT", {
          effect: t("Saves it on this appointment's list", "Lo guarda en la lista de esta cita", "Anrejistre l nan lis randevou sa a"),
          inputSelector: "#appointment-prep-topic",
          inputHint: t("The topic in the patient's own words", "El tema en las palabras del paciente", "Sijè a nan mo pasyan an")
        }),
        action("appointment-open-brief", t("See my list", "Ver mi lista", "Gade lis mwen"), "NAVIGATE"),
        action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")
      ]
    };
  }

  if (view === "BRIEF") {
    const topics = (appointment.prep?.topics || []).filter(Boolean);
    return {
      viewId: APPOINTMENT_VIEW_IDS.BRIEF,
      screenId: screen,
      title: t("Things I want to discuss", "Lo que quiero conversar", "Bagay mwen vle pale sou yo"),
      task: t("This is the list for the visit. You can edit it, or share it with your care team.", "Esta es la lista para la cita. Puede editarla o compartirla con su equipo de cuidado.", "Sa a se lis pou vizit la. Ou ka modifye l oswa pataje l ak ekip swen ou."),
      facts: appointmentFacts(appointment, locale),
      completed: topics.map((topic, index) => ({ id: `TOPIC_${index}`, label: topic })),
      pending: appointment.prep?.sharedWithProvider ? [] : [{ id: "NOT_SHARED", label: t("The list has not been shared with the care team", "La lista no se ha compartido con el equipo de cuidado", "Lis la pa pataje ak ekip swen an") }],
      actions: [
        action("appointment-open-prep", t("Edit the list", "Editar la lista", "Modifye lis la"), "NAVIGATE"),
        action("appointment-share-brief", t("Share it with my care team", "Compartirla con mi equipo", "Pataje l ak ekip mwen"), "CONFIRM"),
        action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")
      ]
    };
  }

  if (view === "SHARE") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.SHARE,
      screenId: screen,
      title: t("Share this appointment", "Compartir esta cita", "Pataje randevou sa a"),
      task: t("Choose who in your Care Circle to share the date, time and place with.", "Elija con quién de su Círculo de cuidado compartir la fecha, la hora y el lugar.", "Chwazi ak ki moun nan Sèk swen ou pou pataje dat, lè ak kote a."),
      facts: appointmentFacts(appointment, locale),
      options: (members || []).map(member => ({
        id: member.inviteId,
        label: member.firstName || "",
        detail: member.relationship || "",
        selected: false,
        selector: `[data-action="appointment-share-with-member"][data-invite-id="${member.inviteId}"]`,
        attributes: {}
      })),
      actions: [action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")]
    };
  }

  if (view === "REMINDER") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.REMINDER,
      screenId: screen,
      title: t("When should I remind you?", "¿Cuándo le recuerdo?", "Kilè pou m fè w sonje?"),
      task: t("Choose when the reminder should appear. Reminders appear inside ITERA only.", "Elija cuándo debe aparecer el recordatorio. Los recordatorios solo aparecen dentro de ITERA.", "Chwazi kilè rapèl la dwe parèt. Rapèl yo parèt sèlman nan ITERA."),
      facts: appointmentFacts(appointment, locale),
      completed: appointment.reminder ? [{ id: "REMINDER", label: t("A reminder is saved", "Hay un recordatorio guardado", "Gen yon rapèl anrejistre") }] : [],
      actions: [action("appointment-open", t("Back to the appointment", "Volver a la cita", "Retounen nan randevou a"), "NAVIGATE", "")]
    };
  }

  if (view === "CANCEL_CONFIRM") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.CANCEL_CONFIRM,
      screenId: screen,
      title: t("Cancel this appointment?", "¿Cancelar esta cita?", "Anile randevou sa a?"),
      task: t("Confirm whether to cancel, or keep the appointment.", "Confirme si cancela o conserva la cita.", "Konfime si w anile oswa w kenbe randevou a."),
      facts: appointmentFacts(appointment, locale),
      pending: [{ id: "NOT_CANCELLED", label: t("The appointment has NOT been cancelled yet", "La cita todavía NO ha sido cancelada", "Randevou a POKO anile") }],
      actions: [
        action("appointment-confirm-cancel", t("Yes, cancel it", "Sí, cancelarla", "Wi, anile l"), "DESTRUCTIVE", t("This cancels the appointment", "Esto cancela la cita", "Sa anile randevou a")),
        action("appointment-open", t("Keep the appointment", "Conservar la cita", "Kenbe randevou a"), "NAVIGATE")
      ]
    };
  }

  if (view === "FOLLOW_UP") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.FOLLOW_UP,
      screenId: screen,
      title: t("After the visit", "Después de la visita", "Apre vizit la"),
      task: t("Say whether you were able to get to the appointment.", "Diga si pudo asistir a la cita.", "Di si ou te ka ale nan randevou a."),
      facts: appointmentFacts(appointment, locale),
      actions: [action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")]
    };
  }

  if (view === "ALL_SET") {
    return {
      viewId: APPOINTMENT_VIEW_IDS.ALL_SET,
      screenId: screen,
      title: t("Ready for the visit", "Listo para la visita", "Pare pou vizit la"),
      task: t("You said nothing is making this visit hard. Nothing else is needed here.", "Dijo que nada dificulta esta visita. No hace falta nada más aquí.", "Ou di anyen pa fè vizit sa a difisil. Pa gen anyen lòt isit la."),
      facts: appointmentFacts(appointment, locale),
      completed: [{ id: "READY", label: t("You confirmed you are all set for this visit", "Confirmó que todo está listo para esta visita", "Ou konfime tout bagay pare pou vizit sa a") }],
      actions: [action("barrier-close", t("Back to my appointment", "Volver a mi cita", "Retounen nan randevou m"), "NAVIGATE")]
    };
  }

  // The appointment itself.
  return {
    viewId: confirmed ? APPOINTMENT_VIEW_IDS.DETAIL_CONFIRMED : APPOINTMENT_VIEW_IDS.DETAIL_REQUEST,
    screenId: screen,
    title: confirmed ? t("Appointment confirmed", "Cita confirmada", "Randevou konfime") : t("Your request", "Su solicitud", "Demann ou"),
    task: confirmed
      ? t("This visit is confirmed. From here you can prepare for it, get help getting there, change it or cancel it.", "Esta visita está confirmada. Desde aquí puede prepararse, pedir ayuda para llegar, cambiarla o cancelarla.", "Vizit sa a konfime. Isit la ou ka prepare w, mande èd pou rive, chanje l oswa anile l.")
      : t("This is a request, not a confirmed visit. The office still has to answer it.", "Esta es una solicitud, no una visita confirmada. El consultorio todavía debe responder.", "Sa a se yon demann, se pa yon vizit konfime. Kabinè a dwe reponn toujou."),
    facts: appointmentFacts(appointment, locale),
    completed: [
      confirmed ? { id: "CONFIRMED", label: t("The appointment is confirmed", "La cita está confirmada", "Randevou a konfime"), detail: when(appointment, locale) } : null,
      ...(readiness?.items || []).filter(item => item.state === "READY").map(item => ({ id: item.id, label: item.label, detail: item.detail || "" }))
    ].filter(Boolean),
    pending: [
      confirmed ? null : { id: "NOT_CONFIRMED", label: t("This is not a confirmed appointment yet", "Todavía no es una cita confirmada", "Sa poko yon randevou konfime") },
      ...(readiness?.items || []).filter(item => item.state !== "READY" && item.state !== "NOT_NEEDED").map(item => ({ id: item.id, label: item.label }))
    ].filter(Boolean),
    actions: [
      action("appointment-open-prep", t("Prepare topics for the visit", "Preparar temas para la visita", "Prepare sijè pou vizit la"), "NAVIGATE"),
      action("appointment-open-brief", t("See my list of topics", "Ver mi lista de temas", "Gade lis sijè mwen"), "NAVIGATE"),
      action("appointment-open-barrier", t("Something is making this hard", "Algo lo dificulta", "Yon bagay ap fè sa difisil"), "NAVIGATE"),
      action("appointment-open-reminder", t("Remind me in the app", "Recordármelo en la aplicación", "Fè m sonje nan aplikasyon an"), "NAVIGATE"),
      action("appointment-open-share", t("Share with my Care Circle", "Compartir con mi Círculo de cuidado", "Pataje ak Sèk swen mwen"), "NAVIGATE"),
      action("appointment-get-directions", t("Get directions", "Cómo llegar", "Jwenn direksyon"), "NAVIGATE"),
      action("appointment-request-reschedule", t("Change the time", "Cambiar la hora", "Chanje lè a"), "CONFIRM"),
      action("appointment-request-cancel", t("Cancel the appointment", "Cancelar la cita", "Anile randevou a"), "DESTRUCTIVE"),
      action("appointment-back", t("Back to My Care", "Volver a Mi cuidado", "Retounen nan Swen mwen"), "NAVIGATE")
    ],
    notes: readiness && !readiness.ready ? [readiness.summary] : []
  };
}
