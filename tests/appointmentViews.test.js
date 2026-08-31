import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_PREFERENCE_STEPS,
  APPOINTMENT_VIEW_ACTIONS,
  appointmentBarrierCheckView,
  appointmentBriefView,
  appointmentDetailView,
  appointmentFollowUpView,
  appointmentPrepConversationOpening,
  appointmentPrepView,
  appointmentPreferenceView,
  appointmentShareView,
  appointmentsListScreen,
  bookingConfirmationView,
  needAnAppointmentCard,
  requestConfirmationView,
  slotPickerView,
  upcomingCareSection
} from "../src/appointmentViews.js";

// The real helpers app.js passes in. escapeHtml is copied verbatim from src/app.js:3868 — note
// that it does NOT escape "'", which is why every attribute in the views is double-quoted.
const escapeHtml = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const icon = (name, extra = "") => `<i data-icon="${name}" class="${extra}"></i>`;
const base = { locale: "en", icon, escapeHtml };
const NOW = new Date("2026-09-06T15:00:00.000Z");

const confirmed = {
  id: "appt-1",
  status: "CONFIRMED",
  providerDisplayName: "Dr. Pedro Martinez",
  requestedSpecialty: "Cardiology",
  practiceName: "Coral Gables Cardiology Associates",
  scheduledAt: "2026-09-08T14:30:00.000Z",
  timezone: "UTC",
  modality: "IN_PERSON",
  locationName: "Coral Gables",
  reasonCategory: "ROUTINE_FOLLOW_UP",
  prep: { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" }
};
const request = {
  id: "appt-2",
  status: "WAITING_FOR_OFFICE",
  providerDisplayName: "Dr. Pedro Martinez",
  requestedSpecialty: "Cardiology",
  preferredTimeOfDay: "MORNING",
  preferredModality: "IN_PERSON",
  reasonCategory: "MEDICATION_RENEWAL",
  scheduledAt: "",
  prep: { topics: [], notes: "", sharedWithProvider: false, updatedAt: "" }
};
const slots = [
  { slotId: "s1", startAt: "2026-09-07T14:30:00.000Z", modality: "IN_PERSON", locationName: "Coral Gables" },
  { slotId: "s2", startAt: "2026-09-08T18:00:00.000Z", modality: "IN_PERSON", locationName: "Coral Gables" },
  { slotId: "s3", startAt: "2026-09-10T13:15:00.000Z", modality: "IN_PERSON", locationName: "Coral Gables" },
  { slotId: "s4", startAt: "2026-09-11T13:15:00.000Z", modality: "IN_PERSON", locationName: "Coral Gables" },
  { slotId: "s5", startAt: "2026-09-14T13:15:00.000Z", modality: "IN_PERSON", locationName: "Coral Gables" }
];

// Every view, rendered with the props its contract names, so whole-surface invariants can be
// asserted in one sweep rather than one view at a time.
const everyView = (overrides = {}) => {
  const props = { ...base, now: NOW, ...overrides };
  return {
    upcomingCareSection: upcomingCareSection({ ...props, appointments: [confirmed, request] }),
    needAnAppointmentCard: needAnAppointmentCard(props),
    appointmentsListScreen: appointmentsListScreen({ ...props, appointments: [confirmed, request], tab: "UPCOMING" }),
    appointmentDetailView: appointmentDetailView({ ...props, appointment: confirmed }),
    appointmentDetailViewRequest: appointmentDetailView({ ...props, appointment: request }),
    slotPickerView: slotPickerView({ ...props, appointment: confirmed, slots }),
    bookingConfirmationView: bookingConfirmationView({ ...props, appointment: confirmed }),
    requestConfirmationView: requestConfirmationView({ ...props, appointment: request }),
    appointmentPrepView: appointmentPrepView({ ...props, appointment: { ...confirmed, prep: { topics: ["My blood pressure"], sharedWithProvider: false } } }),
    appointmentBriefView: appointmentBriefView({ ...props, appointment: { ...confirmed, prep: { topics: ["My blood pressure"], sharedWithProvider: false } } }),
    appointmentBarrierCheckView: appointmentBarrierCheckView({ ...props, appointment: confirmed }),
    appointmentShareView: appointmentShareView({ ...props, appointment: confirmed, members: [{ inviteId: "inv-1", firstName: "Ana", relationship: "Daughter" }] }),
    appointmentFollowUpView: appointmentFollowUpView({ ...props, appointment: confirmed }),
    appointmentPreferenceView: appointmentPreferenceView({ ...props, draft: { id: "need-1", providerDisplayName: "Dr. Pedro Martinez" }, step: "TIME_OF_DAY" })
  };
};

describe("appointment views — request is never a confirmed appointment (§7, §18, §35, §105)", () => {
  it("keeps confirmed language out of the request confirmation screen", () => {
    const html = requestConfirmationView({ ...base, appointment: request });
    expect(html).toContain("Request sent");
    expect(html).not.toMatch(/Appointment confirmed/);
    expect(html).not.toMatch(/data-tone="CONFIRMED"/);
    expect(html).not.toMatch(/data-icon="check"/);
    expect(html).toContain('data-kind="request"');
    expect(html).toContain("Nothing is scheduled yet");
  });

  it("keeps confirmed language out of a pending request detail view", () => {
    const html = appointmentDetailView({ ...base, appointment: request, now: NOW });
    expect(html).toContain('data-kind="request"');
    expect(html).not.toMatch(/Appointment confirmed/);
    expect(html).not.toMatch(/data-tone="CONFIRMED"/);
    expect(html).not.toMatch(/data-icon="check"/);
    expect(html).toContain("This is a request, not a scheduled visit");
  });

  it("refuses to render a booking confirmation for a record that is not confirmed", () => {
    const html = bookingConfirmationView({ ...base, appointment: request });
    expect(html).not.toMatch(/Appointment confirmed/);
    expect(html).toContain("Request sent");
    expect(html).toContain('data-kind="request"');
  });

  it("refuses to render a booking confirmation for a CONFIRMED record with no time", () => {
    const html = bookingConfirmationView({ ...base, appointment: { ...confirmed, scheduledAt: "" } });
    expect(html).toContain('data-kind="request"');
    expect(html).not.toMatch(/data-icon="check"/);
  });

  it("gives requests and appointments visually distinct cards", () => {
    const html = upcomingCareSection({ ...base, appointments: [confirmed, request], now: NOW });
    expect(html).toContain('data-kind="appointment"');
    expect(html).toContain('data-kind="request"');
    // A request card carries no date headline: there is no time to state yet.
    const requestCard = html.slice(html.indexOf('data-kind="request"'));
    expect(requestCard).not.toContain("appointment-card-when");
    expect(requestCard).toContain("View request");
  });

  it("renders a real confirmation with confirmed formatting", () => {
    const html = bookingConfirmationView({ ...base, appointment: confirmed });
    expect(html).toContain('data-kind="appointment"');
    expect(html).toContain('data-tone="CONFIRMED"');
    expect(html).toContain('data-icon="check"');
    expect(html).toContain("Tuesday, September 8");
    expect(html).toContain("2:30 PM");
  });
});

describe("appointment views — honesty guards on join, directions and calendar (§58, §59, §60)", () => {
  it("omits Join visit and Get directions when the record carries neither", () => {
    const html = appointmentDetailView({ ...base, appointment: confirmed, now: NOW });
    expect(html).not.toContain("appointment-join-visit");
    expect(html).not.toContain("Join visit");
    expect(html).not.toContain("appointment-get-directions");
    expect(html).not.toContain("Get directions");
  });

  it("renders Join visit only for a real https join link", () => {
    const withLink = appointmentDetailView({ ...base, now: NOW, appointment: { ...confirmed, modality: "TELEHEALTH", joinUrl: "https://visit.example.org/room/abc" } });
    expect(withLink).toContain('data-action="appointment-join-visit"');
    expect(withLink).toContain('href="https://visit.example.org/room/abc"');
  });

  it("drops a join link that is not https, including a javascript: scheme", () => {
    for (const joinUrl of ["javascript:alert(1)", "http://visit.example.org/room", "  ", "not-a-url"]) {
      const html = appointmentDetailView({ ...base, now: NOW, appointment: { ...confirmed, modality: "TELEHEALTH", joinUrl } });
      expect(html).not.toContain("appointment-join-visit");
      expect(html).not.toContain("javascript:");
    }
  });

  it("renders Get directions only when a location address exists", () => {
    const html = appointmentDetailView({ ...base, now: NOW, appointment: { ...confirmed, locationAddress: "1 Alhambra Plaza, Coral Gables" } });
    expect(html).toContain('data-action="appointment-get-directions"');
    expect(html).toContain("1 Alhambra Plaza, Coral Gables");
  });

  it("never offers add to calendar anywhere", () => {
    for (const [name, html] of Object.entries(everyView())) {
      expect(html, name).not.toMatch(/add to calendar/i);
      expect(html, name).not.toMatch(/\.ics/i);
      expect(html, name).not.toMatch(/data-action="appointment-add-to-calendar"/);
    }
  });
});

describe("appointment views — no dense calendar anywhere (§32, §100, §154)", () => {
  it("emits no table, no month grid and no day-of-month grid", () => {
    for (const [name, html] of Object.entries(everyView())) {
      expect(html, name).not.toMatch(/<table/i);
      expect(html, name).not.toMatch(/<tbody|<thead|<td|<th[\s>]/i);
      expect(html, name).not.toMatch(/repeat\(7/);
      expect(html, name).not.toMatch(/calendar-grid|month-grid|day-grid/i);
    }
  });

  it("opens availability at three slot cards plus a way to see more", () => {
    const html = slotPickerView({ ...base, appointment: confirmed, slots });
    const cards = html.match(/data-action="appointment-select-slot"/g) || [];
    expect(cards).toHaveLength(3);
    expect(html).toContain('data-action="appointment-more-times"');
    expect(html).toContain("See more times");
    expect(html).toContain('data-action="appointment-change-preferences"');
    expect(html).toContain("Choose another day");
  });

  it("shows more slots only once the patient asks for them", () => {
    const html = slotPickerView({ ...base, appointment: confirmed, slots, expanded: true });
    const cards = html.match(/data-action="appointment-select-slot"/g) || [];
    expect(cards).toHaveLength(5);
    expect(html).not.toContain('data-action="appointment-more-times"');
  });

  it("says so honestly when there is nothing to show rather than inventing times", () => {
    const html = slotPickerView({ ...base, appointment: confirmed, slots: [] });
    expect(html).not.toContain('data-action="appointment-select-slot"');
    expect(html).toContain("No times are available to show right now");
  });

  it("says a booking failed in plain language and never leaks the error code (§123, §124)", () => {
    const gone = slotPickerView({ ...base, appointment: confirmed, slots, error: "SLOT_UNAVAILABLE" });
    expect(gone).toContain("That time was just taken.");
    expect(gone).not.toContain("SLOT_UNAVAILABLE");
    const unknown = slotPickerView({ ...base, appointment: confirmed, slots, error: "SOME_INTERNAL_CODE" });
    expect(unknown).toContain("We could not finish that just now. Nothing was booked.");
    expect(unknown).not.toContain("SOME_INTERNAL_CODE");
    const clean = slotPickerView({ ...base, appointment: confirmed, slots, error: "" });
    expect(clean).not.toContain("Nothing was booked");
  });

  it("carries each slot's own id and the appointment it belongs to", () => {
    const html = slotPickerView({ ...base, appointment: confirmed, slots });
    expect(html).toContain('data-slot-id="s1"');
    expect(html).toContain('data-appointment-id="appt-1"');
    expect(html).toContain("Monday, September 7");
  });
});

describe("appointment views — one question at a time (§26)", () => {
  it("renders exactly one question per preference step", () => {
    for (const step of APPOINTMENT_PREFERENCE_STEPS) {
      const html = appointmentPreferenceView({ ...base, step, draft: { id: "need-1", providerDisplayName: "Dr. Pedro Martinez", reasonCategory: "ROUTINE_FOLLOW_UP" }, supportedModalities: ["IN_PERSON", "TELEHEALTH"], careTeam: [] });
      const titles = html.match(/class="appointment-screen-title"/g) || [];
      expect(titles, step).toHaveLength(1);
      expect(html, step).toContain(`data-step="${step}"`);
    }
  });

  it("keeps the provider question free of modality, time and reason questions", () => {
    const html = appointmentPreferenceView({ ...base, step: "PROVIDER", draft: { id: "need-1", providerDisplayName: "Dr. Pedro Martinez" } });
    expect(html).toContain("Is this for Dr. Pedro Martinez?");
    expect(html).not.toMatch(/mornings or afternoons/i);
    expect(html).not.toMatch(/How would you like this visit to happen/i);
    expect(html).not.toMatch(/What would you like to be seen for/i);
  });

  it("offers only the modalities the provider actually supports (§30)", () => {
    const html = appointmentPreferenceView({ ...base, step: "MODALITY", draft: { id: "need-1" }, supportedModalities: ["IN_PERSON"] });
    expect(html).toContain("Office visit");
    expect(html).not.toContain("Video visit");
    expect(html).not.toContain("Phone call");
  });

  it("reads modalities from a resolved capability and ignores the bare enum object (§30)", () => {
    const fromCapability = appointmentPreferenceView({ ...base, step: "MODALITY", draft: { id: "need-1" }, capability: { capability: "DIRECT_BOOKING", supportedModalities: ["IN_PERSON", "TELEHEALTH"] } });
    expect(fromCapability).toContain("Office visit");
    expect(fromCapability).toContain("Video visit");
    expect(fromCapability).not.toContain("Phone call");
    // An enum object is a vocabulary, not a capability: it must not become a list of offers.
    const fromEnum = appointmentPreferenceView({ ...base, step: "MODALITY", draft: { id: "need-1" }, modalities: { IN_PERSON: "IN_PERSON", TELEHEALTH: "TELEHEALTH", PHONE: "PHONE", NO_PREFERENCE: "NO_PREFERENCE" } });
    expect(fromEnum).not.toContain("Office visit");
    expect(fromEnum).not.toContain("Video visit");
    expect(fromEnum).toContain("Your care team will confirm how this visit can happen.");
  });

  it("keeps the time question to morning, afternoon, no preference and a way out (§29)", () => {
    const html = appointmentPreferenceView({ ...base, step: "TIME_OF_DAY", draft: { id: "need-1" } });
    const answers = html.match(/data-action="appointment-preference-answer"/g) || [];
    expect(answers).toHaveLength(3);
    expect(html).toContain('data-action="appointment-preference-other-time"');
    expect(html).not.toMatch(/<input[^>]*type="time"/);
  });

  it("gates the submit button on the draft instead of submitting for the patient (§80, §127)", () => {
    const blocked = appointmentPreferenceView({ ...base, step: "REVIEW", appointment: { id: "need-1" }, draft: { id: "appointment_draft_x" }, submittable: { ok: false, missing: ["reasonCategory"] } });
    expect(blocked).toContain('data-action="appointment-submit-request"');
    expect(blocked).toMatch(/data-need-id="need-1"[^>]*disabled/);
    expect(blocked).toContain("what you want to be seen for");
    const ready = appointmentPreferenceView({ ...base, step: "REVIEW", appointment: { id: "need-1" }, draft: { id: "appointment_draft_x", reasonCategory: "ROUTINE_FOLLOW_UP" }, submittable: { ok: true, missing: [] } });
    expect(ready).not.toMatch(/appointment-submit-request[^>]*disabled/);
    expect(ready).toContain("Nothing is scheduled yet");
  });
});

describe("appointment views — status is text plus icon plus colour (§107)", () => {
  it("pairs every tone with an icon and a readable sentence", () => {
    const tones = {
      CONFIRMED: ["CONFIRMED", "check"],
      WAITING_FOR_OFFICE: ["WAITING", "clock"],
      SLOTS_AVAILABLE: ["ACTION_NEEDED", "calendarClock"],
      CANCELED: ["CLOSED", "info"],
      UNABLE_TO_SCHEDULE: ["PROBLEM", "alert"]
    };
    for (const [status, [tone, glyph]] of Object.entries(tones)) {
      const html = appointmentDetailView({ ...base, now: NOW, appointment: { ...confirmed, status, scheduledAt: status === "CONFIRMED" ? confirmed.scheduledAt : "" } });
      expect(html, status).toContain(`data-tone="${tone}"`);
      expect(html, status).toContain(`data-icon="${glyph}"`);
      expect(html, status).toMatch(/<span>[^<]+<\/span>/);
    }
  });

  it("keeps closed records out of Upcoming care entirely", () => {
    for (const status of ["CANCELED", "COMPLETED", "NO_SHOW", "DECLINED", "UNABLE_TO_SCHEDULE"]) {
      const html = upcomingCareSection({ ...base, now: NOW, appointments: [{ ...confirmed, status }] });
      expect(html, status).toContain("Nothing is scheduled right now.");
    }
  });

  it("never renders an internal status string to the patient (§20, §36)", () => {
    for (const [name, html] of Object.entries(everyView())) {
      expect(html, name).not.toMatch(/WAITING_FOR_OFFICE|PENDING_PATIENT_SELECTION|SEARCHING_AVAILABILITY|NEED_IDENTIFIED/);
    }
  });
});

describe("appointment views — long provider and practice names (§102, §103)", () => {
  const long = {
    ...confirmed,
    providerDisplayName: "Dr. Alexander Rodriguez-Martinez",
    practiceName: "Coral Gables Comprehensive Cardiovascular and Preventive Medicine Associates"
  };

  it("renders the whole provider and practice name without truncating", () => {
    for (const html of [
      appointmentDetailView({ ...base, appointment: long, now: NOW }),
      bookingConfirmationView({ ...base, appointment: long }),
      upcomingCareSection({ ...base, appointments: [long], now: NOW }),
      slotPickerView({ ...base, appointment: long, slots })
    ]) {
      expect(html).toContain("Dr. Alexander Rodriguez-Martinez");
      expect(html).toContain("Coral Gables Comprehensive Cardiovascular and Preventive Medicine Associates");
      expect(html).not.toContain("…");
      expect(html).not.toMatch(/text-overflow|ellipsis|white-space:\s*nowrap/);
    }
  });

  it("wraps identity in the stylesheet rather than clipping it", () => {
    expect(css).toMatch(/\.appointment-provider\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.appointment-practice\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).not.toMatch(/text-overflow\s*:\s*ellipsis/);
  });
});

describe("appointment views — three real locales (§en, §es, §ht)", () => {
  it("renders distinct Spanish and Haitian Creole for every view", () => {
    const en = everyView({ locale: "en" });
    const es = everyView({ locale: "es" });
    const ht = everyView({ locale: "ht" });
    for (const name of Object.keys(en)) {
      expect(es[name], name).not.toEqual(en[name]);
      expect(ht[name], name).not.toEqual(en[name]);
      expect(ht[name], name).not.toEqual(es[name]);
    }
  });

  it("renders Haitian Creole, never Korean", () => {
    const ht = everyView({ locale: "ht" });
    for (const [name, html] of Object.entries(ht)) {
      expect(html, name).not.toMatch(/[가-힯ᄀ-ᇿ㄰-㆏]/);
    }
    expect(ht.upcomingCareSection).toContain("Pwochen randevou");
    expect(ht.needAnAppointmentCard).toContain("Ou bezwen yon randevou?");
    expect(ht.requestConfirmationView).toContain("Demann voye");
  });

  it("groups the Need an appointment icon and title in one heading row", () => {
    const html = needAnAppointmentCard(base);
    expect(html).toMatch(/appointment-need-heading[\s\S]*appointment-need-icon[\s\S]*appointment-need-title/);
    expect(html).toContain('class="appointment-action secondary"');
  });

  it("localises dates and times rather than leaving them English", () => {
    expect(bookingConfirmationView({ ...base, locale: "es", appointment: confirmed })).toContain("martes, 8 de septiembre");
    expect(bookingConfirmationView({ ...base, locale: "ht", appointment: confirmed })).toContain("madi, 8 septanm");
    expect(bookingConfirmationView({ ...base, locale: "es", appointment: confirmed })).toContain("2:30 p. m.");
  });

  it("falls back to English for an unknown locale rather than rendering blanks", () => {
    const html = needAnAppointmentCard({ ...base, locale: "fr" });
    expect(html).toContain("Need an appointment?");
  });
});

describe("appointment views — escaping (every interpolated value)", () => {
  const hostile = {
    id: 'appt"><img src=x onerror=alert(1)>',
    status: "CONFIRMED",
    providerDisplayName: '<script>alert("provider")</script>Dr. Evil',
    requestedSpecialty: '<img src=x onerror="alert(2)">',
    practiceName: "<b>Practice & Co</b>",
    scheduledAt: "2026-09-08T14:30:00.000Z",
    timezone: "UTC",
    modality: "TELEHEALTH",
    joinUrl: 'https://visit.example.org/a"onmouseover="alert(3)',
    locationName: '<svg onload="alert(4)">',
    locationAddress: '"><script>alert(5)</script>',
    confirmationNumber: "<b>123</b>",
    reasonSummary: "<script>alert(6)</script>",
    prep: { topics: ['<script>alert(7)</script>'], sharedWithProvider: false }
  };

  it("escapes hostile values in every view that takes a record", () => {
    const views = [
      upcomingCareSection({ ...base, appointments: [hostile], now: NOW }),
      appointmentsListScreen({ ...base, appointments: [hostile], now: NOW }),
      appointmentDetailView({ ...base, appointment: hostile, now: NOW }),
      slotPickerView({ ...base, appointment: hostile, slots: [{ slotId: '"><script>alert(8)</script>', startAt: "2026-09-07T14:30:00.000Z", modality: "IN_PERSON", locationName: "<i>x</i>" }] }),
      bookingConfirmationView({ ...base, appointment: hostile }),
      requestConfirmationView({ ...base, appointment: { ...hostile, status: "WAITING_FOR_OFFICE" } }),
      appointmentPrepView({ ...base, appointment: hostile, now: NOW }),
      appointmentBriefView({ ...base, appointment: hostile }),
      appointmentBarrierCheckView({ ...base, appointment: hostile, now: NOW }),
      appointmentShareView({ ...base, appointment: hostile, members: [{ inviteId: '"><script>alert(9)</script>', firstName: "<b>Ana</b>", relationship: "<i>Daughter</i>" }] }),
      appointmentFollowUpView({ ...base, appointment: hostile }),
      appointmentPreferenceView({ ...base, step: "REVIEW", draft: { id: '"><script>alert(10)</script>', providerDisplayName: hostile.providerDisplayName, reasonCategory: "OTHER" } })
    ];
    // The invariant is that no hostile value ever survives verbatim: every "<", ">" and quote
    // it carried has been neutralised, so it can only ever land as visible text.
    const raw = ['<script>alert("provider")</script>Dr. Evil', '<img src=x onerror="alert(2)">', "<b>Practice & Co</b>",
      '<svg onload="alert(4)">', '"><script>alert(5)</script>', "<b>123</b>", '<script>alert(7)</script>',
      'appt"><img src=x onerror=alert(1)>', '"><script>alert(8)</script>', '"><script>alert(9)</script>', '"><script>alert(10)</script>'];
    for (const [index, html] of views.entries()) {
      expect(html, `view ${index}`).not.toMatch(/<\s*(script|img|svg|iframe|object|embed|style)/i);
      for (const value of raw) expect(html, `view ${index}: ${value}`).not.toContain(value);
    }
  });

  it("escapes the provider name into visible text rather than markup", () => {
    const html = appointmentDetailView({ ...base, appointment: hostile, now: NOW });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Dr. Evil");
  });

  it("actually calls the escapeHtml passed in props", () => {
    const marker = value => `«${String(value ?? "")}»`;
    const html = upcomingCareSection({ ...base, escapeHtml: marker, appointments: [confirmed], now: NOW });
    expect(html).toContain("«Dr. Pedro Martinez»");
    expect(html).toContain("«Cardiology»");
  });

  it("escapes even when app.js forgets to pass escapeHtml", () => {
    const html = appointmentDetailView({ locale: "en", icon, appointment: hostile, now: NOW });
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("appointment views — preparation, brief and sharing (§43-§47, §114)", () => {
  it("opens EMMI from the appointment and prep topics in every supported language", () => {
    const appointment = { ...confirmed, prep: { topics: ["readings", "medicamentos"] } };
    expect(appointmentPrepConversationOpening({ locale: "en", appointment })).toBe("Let’s prepare for your appointment with Dr. Pedro Martinez. You wanted to discuss “readings”, “medicamentos”. Which topic would you like to start with?");
    expect(appointmentPrepConversationOpening({ locale: "es", appointment })).toBe("Preparémonos para su cita con Dr. Pedro Martinez. Quería conversar sobre “readings”, “medicamentos”. ¿Con cuál tema le gustaría empezar?");
    expect(appointmentPrepConversationOpening({ locale: "ht", appointment })).toBe("Ann prepare pou randevou ou ak Dr. Pedro Martinez. Ou te vle pale sou “readings”, “medicamentos”. Ak ki sijè ou ta renmen kòmanse?");
  });

  it("asks what to prepare when the patient has not added a topic yet", () => {
    const opening = appointmentPrepConversationOpening({ locale: "en", appointment: confirmed });
    expect(opening).toContain("Let’s prepare for your appointment with Dr. Pedro Martinez.");
    expect(opening).toContain("What would you like help getting ready to discuss?");
  });

  it("starts the only saved topic instead of asking the patient to select it again", () => {
    const appointment = { ...confirmed, prep: { topics: ["BP readings"] } };
    const opening = appointmentPrepConversationOpening({ locale: "es", appointment });
    expect(opening).toContain("Quería conversar sobre “BP readings”");
    expect(opening).toContain("empezaremos por ese tema");
    expect(opening).not.toMatch(/cu[aá]l tema|con cu[aá]l/i);
  });

  it("lists what the patient wanted to discuss and lets them add and remove topics", () => {
    const html = appointmentPrepView({ ...base, now: NOW, appointment: { ...confirmed, prep: { topics: ["My blood pressure", "A medication question"], sharedWithProvider: false } } });
    expect(html).toContain("My blood pressure");
    expect(html).toContain("A medication question");
    expect(html).toContain('data-action="appointment-remove-prep-topic"');
    expect(html).toContain('data-topic-index="1"');
    expect(html).toContain('id="appointment-prep-form"');
    expect(html).toContain('name="prepTopic"');
  });

  it("says the appointment is tomorrow when it is tomorrow (§112)", () => {
    const html = appointmentPrepView({ ...base, now: new Date("2026-09-07T12:00:00.000Z"), appointment: confirmed });
    expect(html).toContain("Your appointment is tomorrow");
  });

  it("never claims the brief was shared until the record says it was (§47)", () => {
    const unshared = appointmentBriefView({ ...base, appointment: { ...confirmed, prep: { topics: ["My blood pressure"], sharedWithProvider: false } } });
    expect(unshared).toContain("Not shared yet");
    expect(unshared).toContain('data-action="appointment-share-brief"');
    const shared = appointmentBriefView({ ...base, appointment: { ...confirmed, prep: { topics: ["My blood pressure"], sharedWithProvider: true } } });
    expect(shared).toContain("Shared with your care team");
    expect(shared).not.toContain('data-action="appointment-share-brief"');
  });

  it("spells out that sharing is not full access (§55, §114)", () => {
    const html = appointmentShareView({ ...base, appointment: confirmed, members: [{ inviteId: "inv-1", firstName: "Ana", relationship: "Daughter" }] });
    expect(html).toContain("They will receive");
    expect(html).toContain("They will not receive");
    expect(html).toContain("Your medical records");
    expect(html).toContain('data-action="appointment-share-with-member"');
    expect(html).toContain('data-invite-id="inv-1"');
  });

  it("offers no sharing control when no Care Circle member is eligible (§54, §56)", () => {
    const html = appointmentShareView({ ...base, appointment: confirmed, members: [] });
    expect(html).not.toContain('data-action="appointment-share-with-member"');
    expect(html).toContain("Sharing is available once someone in your Care Circle");
  });

  it("obeys careCircleSharingOptions rather than the member list alone", () => {
    const denied = appointmentShareView({ ...base, appointment: confirmed, members: [{ inviteId: "inv-1", firstName: "Ana" }], sharing: { allowed: false, reason: "PERMISSION_NOT_GRANTED", eligibleMembers: [] } });
    expect(denied).not.toContain('data-action="appointment-share-with-member"');
    const allowed = appointmentShareView({ ...base, appointment: confirmed, members: [{ inviteId: "inv-1", firstName: "Ana" }], sharing: { allowed: true }, scope: { limits: "Sharing does not give access to your health record." } });
    expect(allowed).toContain('data-action="appointment-share-with-member"');
    expect(allowed).toContain("Sharing does not give access to your health record.");
  });
});

describe("appointment views — pre-visit check and follow-up (§51, §65-§68, §113)", () => {
  it("asks about attendance difficulty with barrier reasons, not barrier categories", () => {
    const html = appointmentBarrierCheckView({ ...base, appointment: confirmed, now: new Date("2026-09-07T12:00:00.000Z") });
    expect(html).toContain("Your appointment with Dr. Pedro Martinez is tomorrow at 2:30 PM.");
    for (const reason of ["ALL_SET", "TRANSPORTATION", "CAREGIVER_AVAILABILITY", "TIME_CONFLICT", "LOCATION_UNCLEAR", "OTHER"]) {
      expect(html, reason).toContain(`data-barrier-reason="${reason}"`);
    }
    expect(html).not.toContain('data-barrier-reason="TECHNOLOGY_TELEHEALTH"');
  });

  it("prefers the question and reason keys appointmentSupport supplies", () => {
    const html = appointmentBarrierCheckView({
      ...base,
      appointment: confirmed,
      now: NOW,
      preVisitCheck: { question: "Is anything in the way?", options: [{ reasonKey: "ALL_SET", label: "All set" }, { reasonKey: "MOBILITY", label: "Getting around is hard" }] }
    });
    expect(html).toContain("Is anything in the way?");
    expect(html).toContain('data-barrier-reason="MOBILITY"');
    expect(html).toContain("Getting around is hard");
    expect(html).not.toContain('data-barrier-reason="LOCATION_UNCLEAR"');
  });

  it("swaps the location question for the video question on a telehealth visit", () => {
    const html = appointmentBarrierCheckView({ ...base, appointment: { ...confirmed, modality: "TELEHEALTH" }, now: NOW });
    expect(html).toContain('data-barrier-reason="TECHNOLOGY_TELEHEALTH"');
    expect(html).not.toContain('data-barrier-reason="LOCATION_UNCLEAR"');
  });

  it("asks whether the patient was able to attend, never accuses them (§68)", () => {
    const html = appointmentFollowUpView({ ...base, appointment: confirmed });
    expect(html).toContain("Were you able to attend your appointment with Dr. Pedro Martinez?");
    expect(html).not.toMatch(/you missed/i);
    expect(html).not.toMatch(/no.?show/i);
    for (const outcome of ["ATTENDED", "MISSED", "RESCHEDULED"]) {
      expect(html).toContain(`data-outcome="${outcome}"`);
    }
  });

  it("offers help rather than judgement when the visit did not happen (§67)", () => {
    const html = appointmentFollowUpView({ ...base, appointment: confirmed, step: "MISSED" });
    expect(html).toContain("Would you like help finding another time?");
    expect(html).toContain('data-answer="YES"');
    expect(html).toContain('data-answer="NOT_NOW"');
    expect(html).not.toMatch(/you missed/i);
  });

  it("asks what the patient needs after they attended (§66)", () => {
    const html = appointmentFollowUpView({ ...base, appointment: confirmed, step: "ATTENDED" });
    for (const need of ["NEXT_STEPS", "MEDICATION", "FOLLOW_UP", "GOAL", "NOTHING"]) {
      expect(html).toContain(`data-need="${need}"`);
    }
  });
});

describe("appointment views — My Care and the appointments list (§38, §39, §40)", () => {
  it("shows Upcoming care with a view control and stays honest when empty", () => {
    const filled = upcomingCareSection({ ...base, appointments: [confirmed], now: NOW });
    expect(filled).toContain("Upcoming care");
    expect(filled).toContain("Tue, Sep 8 · 2:30 PM");
    expect(filled).toContain('data-action="appointment-open"');
    expect(filled).toContain('data-appointment-id="appt-1"');
    const empty = upcomingCareSection({ ...base, appointments: [], now: NOW });
    expect(empty).toContain("Upcoming care");
    expect(empty).toContain("Nothing is scheduled right now.");
    expect(empty).not.toContain('data-action="appointment-open"');
  });

  it("leaves closed appointments out of Upcoming care", () => {
    const html = upcomingCareSection({ ...base, now: NOW, appointments: [{ ...confirmed, status: "CANCELED" }, { ...confirmed, id: "appt-9", status: "COMPLETED", scheduledAt: "2026-08-01T14:30:00.000Z" }] });
    expect(html).toContain("Nothing is scheduled right now.");
  });

  it("offers the EMMI entry point rather than a scheduling module (§39)", () => {
    const html = needAnAppointmentCard(base);
    expect(html).toContain("Need an appointment?");
    expect(html).toContain("EMMI can help you coordinate with your care team.");
    expect(html).toContain('data-action="appointment-ask-emmi"');
  });

  it("splits the list into upcoming, requests and past", () => {
    const past = { ...confirmed, id: "appt-3", status: "COMPLETED", scheduledAt: "2026-08-01T14:30:00.000Z" };
    const appointments = [confirmed, request, past];
    const upcoming = appointmentsListScreen({ ...base, appointments, now: NOW, tab: "UPCOMING" });
    expect(upcoming).toContain('data-appointment-id="appt-1"');
    expect(upcoming).not.toContain('data-appointment-id="appt-3"');
    const requests = appointmentsListScreen({ ...base, appointments, now: NOW, tab: "REQUESTS" });
    expect(requests).toContain('data-appointment-id="appt-2"');
    expect(requests).not.toContain('data-appointment-id="appt-1"');
    const pastTab = appointmentsListScreen({ ...base, appointments, now: NOW, tab: "PAST" });
    expect(pastTab).toContain('data-appointment-id="appt-3"');
    expect(pastTab).toContain('aria-pressed="true"');
  });

  it("defaults to the upcoming tab for an unknown tab value", () => {
    const html = appointmentsListScreen({ ...base, appointments: [confirmed], now: NOW, tab: "NONSENSE" });
    expect(html).toMatch(/data-tab="UPCOMING" aria-pressed="true"/);
  });
});

describe("appointment views — the data-action contract the lead wires", () => {
  it("emits only actions declared in APPOINTMENT_VIEW_ACTIONS, all appointment-prefixed", () => {
    const emitted = new Set();
    const props = { ...base, now: NOW };
    const html = [
      ...Object.values(everyView()),
      appointmentPreferenceView({ ...props, step: "PROVIDER", draft: { id: "n" }, careTeam: [{ id: "dr-1", displayName: "Dr. One" }] }),
      appointmentPreferenceView({ ...props, step: "REASON", draft: { id: "n" } }),
      appointmentPreferenceView({ ...props, step: "MODALITY", draft: { id: "n" }, supportedModalities: ["IN_PERSON"] }),
      appointmentPreferenceView({ ...props, step: "REVIEW", draft: { id: "n" } }),
      appointmentFollowUpView({ ...props, appointment: confirmed, step: "ATTENDED" }),
      appointmentFollowUpView({ ...props, appointment: confirmed, step: "MISSED" }),
      appointmentDetailView({ ...props, appointment: { ...confirmed, modality: "TELEHEALTH", joinUrl: "https://visit.example.org/x", locationAddress: "1 Alhambra Plaza" } }),
      slotPickerView({ ...props, appointment: confirmed, slots, expanded: false })
    ].join("");
    for (const match of html.matchAll(/data-action="([^"]+)"/g)) emitted.add(match[1]);
    for (const action of emitted) {
      expect(action.startsWith("appointment-"), action).toBe(true);
      expect(APPOINTMENT_VIEW_ACTIONS, action).toContain(action);
    }
    expect(emitted.size).toBeGreaterThan(20);
  });

  it("declares no action it never emits", () => {
    const html = [
      ...Object.values(everyView()),
      appointmentPreferenceView({ ...base, step: "PROVIDER", draft: { id: "n" } }),
      appointmentPreferenceView({ ...base, step: "REASON", draft: { id: "n" } }),
      appointmentPreferenceView({ ...base, step: "MODALITY", draft: { id: "n" }, supportedModalities: ["IN_PERSON"] }),
      appointmentPreferenceView({ ...base, step: "REVIEW", draft: { id: "n" } }),
      appointmentFollowUpView({ ...base, appointment: confirmed, step: "ATTENDED" }),
      appointmentFollowUpView({ ...base, appointment: confirmed, step: "MISSED" }),
      appointmentDetailView({ ...base, now: NOW, appointment: { ...confirmed, modality: "TELEHEALTH", joinUrl: "https://visit.example.org/x", locationAddress: "1 Alhambra Plaza" } }),
      appointmentShareView({ ...base, appointment: confirmed, members: [{ inviteId: "inv-1", firstName: "Ana" }] })
    ].join("");
    for (const action of APPOINTMENT_VIEW_ACTIONS) {
      expect(html, action).toContain(`data-action="${action}"`);
    }
  });
});

const css = readFileSync(fileURLToPath(new URL("../src/appointments.css", import.meta.url)), "utf8");
// Comments quote spec pixel figures ("44px", "384px"); only real declarations are under test.
const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");
const ruleBlocks = [...cssRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(match => ({ selector: match[1].trim(), body: match[2] }));

describe("appointments.css — mobile-first and font-scale safe (§97, §98, §99, §153)", () => {
  it("sizes everything in rem so 125% and 150% scaling reflows rather than clips", () => {
    // Media-query breakpoints are viewport pixels and do not scale with text, so they are
    // excluded. Everything a glyph or a line of text sits inside must be rem.
    const declarations = ruleBlocks.map(rule => rule.body).join(" ");
    const oversized = [...declarations.matchAll(/(-?\d*\.?\d+)px/g)].map(match => Math.abs(Number(match[1]))).filter(value => value > 1);
    expect(oversized).toEqual([]);
  });

  it("gives every tap target at least 44px (2.75rem)", () => {
    const minHeights = [...css.matchAll(/min-height:\s*([\d.]+)rem/g)].map(match => Number(match[1]));
    expect(minHeights.length).toBeGreaterThan(4);
    for (const value of minHeights) expect(value).toBeGreaterThanOrEqual(2.75);
    expect(css).toMatch(/\.appointment-slot\s*\{[^}]*min-height:\s*5rem/);
    expect(css).toMatch(/\.appointment-topic-remove\s*\{[^}]*height:\s*2\.75rem/);
  });

  it("makes slot cards full-width and stacked rather than a column grid", () => {
    expect(css).toMatch(/\.appointment-slot\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.appointment-slots\s*\{[^}]*display:\s*grid/);
    expect(css).not.toMatch(/grid-template-columns:\s*repeat\(/);
  });

  it("keeps every card free of a fixed height (§103)", () => {
    // Glyph containers are deliberately square; the containers that hold text are not.
    const cards = ruleBlocks.filter(rule => /card|hero|panel|slot|member|choice|need|topics|context|summary|list\b/.test(rule.selector) && !/icon/.test(rule.selector));
    expect(cards.length).toBeGreaterThan(8);
    for (const rule of cards) expect(rule.body, rule.selector).not.toMatch(/(^|;)\s*height:/);
  });

  it("carries a distinct tone for each status without relying on colour alone", () => {
    for (const tone of ["CONFIRMED", "WAITING", "ACTION_NEEDED", "CLOSED", "PROBLEM"]) {
      expect(css, tone).toContain(`.appointment-status[data-tone="${tone}"]`);
    }
  });

  it("prefixes every class with .appointment-", () => {
    const classes = new Set([...cssRules.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => match[1]));
    // .icon is styles.css's shared glyph, always overridden from inside an .appointment- rule;
    // .primary and .secondary only ever appear compounded onto .appointment-action.
    for (const shared of ["icon", "primary", "secondary"]) classes.delete(shared);
    for (const name of classes) expect(name.startsWith("appointment-"), name).toBe(true);
    // Every selector is rooted in this module's namespace, so nothing here can reach a
    // shared class such as .icon or .primary outside an .appointment- context.
    for (const rule of ruleBlocks) {
      for (const part of rule.selector.split(",").map(value => value.trim()).filter(Boolean)) {
        expect(part.startsWith(".appointment-") || part.startsWith(":root"), part).toBe(true);
      }
    }
  });
});
