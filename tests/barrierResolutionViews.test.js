import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  BARRIER_VIEW_ACTIONS, allSetConfirmation, appointmentReadinessPanel, barrierResolutionScreen
} from "../src/barrierResolutionViews.js";
import {
  BARRIER_TYPES, RESOLUTION_STEPS, advanceResolution, appointmentReadiness, createResolution
} from "../src/barrierResolution.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
const icon = name => `<span class="icon" data-icon="${name}" aria-hidden="true"></span>`;

const appointment = (overrides = {}) => ({
  id: "appt-1",
  status: "CONFIRMED",
  scheduledAt: "2026-09-02T18:45:00.000Z",
  scheduledEndAt: "2026-09-02T19:15:00.000Z",
  timezone: "UTC",
  providerDisplayName: "Dr. Fresner Lee",
  practiceName: "Fresner Medical Group",
  locationName: "Fresner Medical Group",
  locationAddress: "800 Ponce de Leon Blvd",
  modality: "IN_PERSON",
  ...overrides
});

const home = { label: "HOME", line1: "123 Oak Avenue", city: "Miami", state: "FL", zip: "33176", formatted: "123 Oak Avenue · Miami, FL 33176" };

const rideOption = (overrides = {}) => ({
  optionId: "STANDARD_1",
  rideType: "STANDARD",
  serviceName: "UberX",
  description: "Standard car",
  icon: "car",
  seats: 3,
  accessible: false,
  pickupAt: "2026-09-02T18:00:00.000Z",
  estimatedArrivalAt: "2026-09-02T18:25:00.000Z",
  estimatedCost: "$18.40",
  ...overrides
});

const slot = (overrides = {}) => ({
  slotId: "apt|dr-fresner|1|30|IN_PERSON|2|OPEN",
  startAt: "2026-09-04T17:30:00.000Z",
  endAt: "2026-09-04T18:00:00.000Z",
  modality: "IN_PERSON",
  expiresAt: "2099-01-01T00:00:00.000Z",
  ...overrides
});

const reservation = (overrides = {}) => ({
  reservationId: "UB-48291",
  tripType: "OUTBOUND",
  status: "CONFIRMED",
  rideType: "STANDARD",
  serviceName: "UberX",
  pickupAt: "2026-09-02T18:00:00.000Z",
  estimatedArrivalAt: "2026-09-02T18:25:00.000Z",
  estimatedCost: "$18.40",
  pickupFormatted: home.formatted,
  destinationName: "Fresner Medical Group",
  ...overrides
});

const screen = (barrierType, step, data = {}, extra = {}) => {
  const resolution = advanceResolution(createResolution({ appointmentId: "appt-1", barrierType }), step, data);
  return barrierResolutionScreen({
    locale: "en", icon, escapeHtml, now: new Date("2026-09-01T12:00:00.000Z"),
    resolution, appointment: appointment(), timezone: "UTC", homeAddress: home,
    destination: { name: "Fresner Medical Group", formatted: "800 Ponce de Leon Blvd" },
    options: data.options || [], slots: data.slots || [],
    contacts: [{ contactId: "demo-maria", firstName: "Maria", relationship: "Daughter" }],
    ...extra
  });
};

const dom = html => new JSDOM(`<body>${html}</body>`).window.document;

// Every step of every playbook, rendered once. The screens below assert what specific ones say;
// this list is what makes "no step renders nothing" and "no step is a dead end" provable.
const EVERY_STEP = Object.entries(RESOLUTION_STEPS).flatMap(([barrierType, steps]) => steps.map(step => [barrierType, step]));

// The steps that are legitimately terminal-and-quiet: the world is finished with them.
const DATA_FOR = (barrierType, step) => {
  const base = {};
  if (barrierType === BARRIER_TYPES.TRANSPORTATION) {
    Object.assign(base, {
      pickupAddress: home, pickupAt: "2026-09-02T18:00:00.000Z", recommendedPickupAt: "2026-09-02T18:00:00.000Z",
      arriveByAt: "2026-09-02T18:30:00.000Z", travelMinutes: 24, needs: ["NONE"],
      options: [rideOption()], selectedOptionId: "STANDARD_1"
    });
    if (["BOOKED", "RETURN_OFFER", "RETURN_TIME", "CANCEL_CONFIRM"].includes(step)) base.reservation = reservation();
  }
  if (barrierType === BARRIER_TYPES.VIDEO_VISIT) {
    base.results = [
      { id: "MICROPHONE", passed: false, label: "Microphone", detail: "I couldn’t detect your microphone.", guide: ["Open settings"] },
      { id: "CAMERA", passed: true, label: "Camera", detail: "Working", guide: [] }
    ];
  }
  if (barrierType === BARRIER_TYPES.COMPANION) {
    Object.assign(base, { contactId: "demo-maria", contactName: "Maria", contactRelationship: "Daughter" });
  }
  if (barrierType === BARRIER_TYPES.RESCHEDULE) {
    Object.assign(base, { slots: [slot()], selectedSlotId: slot().slotId });
  }
  if (barrierType === BARRIER_TYPES.OTHER) {
    Object.assign(base, { text: "no tengo carro", routedTo: BARRIER_TYPES.TRANSPORTATION, confidence: 0.75 });
  }
  return base;
};

describe("every step renders, and none is a dead end", () => {
  it("draws something for every step of every playbook", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      const html = screen(barrierType, step, DATA_FOR(barrierType, step));
      expect(html, `${barrierType}:${step}`).toContain("barrier-screen");
      expect(dom(html).body.textContent.trim().length, `${barrierType}:${step}`).toBeGreaterThan(20);
    }
  });

  it("always leaves the patient a way onward — §24 has no dead ends", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      const document = dom(screen(barrierType, step, DATA_FOR(barrierType, step)));
      const controls = document.querySelectorAll("button[data-action], a[data-action]");
      // A step that is genuinely working has nothing to press; every other step must offer
      // at least one control, or the patient is stranded.
      if (["SEARCHING", "CHECKING", "BOOKING", "RETURN_BOOKING", "SENDING", "CHANGING", "CLASSIFYING"].includes(step)) {
        expect(document.body.textContent, `${barrierType}:${step}`).toMatch(/…/);
        continue;
      }
      expect(controls.length, `${barrierType}:${step}`).toBeGreaterThan(0);
    }
  });

  it("emits only actions the shell declares a handler for", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      for (const control of dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll("[data-action]")) {
        expect(BARRIER_VIEW_ACTIONS, `${barrierType}:${step}:${control.dataset.action}`).toContain(control.dataset.action);
      }
    }
  });

  it("carries the resolution id on every control that acts on one", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      for (const control of dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll("[data-action]")) {
        expect(control.dataset.resolutionId, `${barrierType}:${step}:${control.dataset.action}`).toBeTruthy();
      }
    }
  });

  it("renders in Spanish and Kreyòl without falling back to an enum", () => {
    for (const locale of ["es", "ht"]) {
      for (const [barrierType, step] of EVERY_STEP) {
        const resolution = advanceResolution(createResolution({ appointmentId: "appt-1", barrierType }), step, DATA_FOR(barrierType, step));
        const html = barrierResolutionScreen({
          locale, icon, escapeHtml, resolution, appointment: appointment(), timezone: "UTC", homeAddress: home,
          options: DATA_FOR(barrierType, step).options || [], slots: DATA_FOR(barrierType, step).slots || [],
          contacts: [{ contactId: "demo-maria", firstName: "Maria", relationship: "Hija" }]
        });
        const title = dom(html).querySelector(".appointment-screen-title");
        expect(title, `${locale}:${barrierType}:${step}`).not.toBeNull();
        expect(title.textContent, `${locale}:${barrierType}:${step}`).not.toMatch(/^[A-Z_]+$/);
      }
    }
  });
});

describe("nothing acts before the patient confirms (§12)", () => {
  it("puts the booking control only on the review step, never on the list of rides", () => {
    const options = dom(screen(BARRIER_TYPES.TRANSPORTATION, "OPTIONS", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "OPTIONS")));
    expect(options.querySelector('[data-action="barrier-reserve-confirm"]')).toBeNull();
    expect(options.querySelectorAll('[data-action="barrier-option-select"]').length).toBeGreaterThan(0);
    const review = dom(screen(BARRIER_TYPES.TRANSPORTATION, "REVIEW", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "REVIEW")));
    expect(review.querySelector('[data-action="barrier-reserve-confirm"]')).not.toBeNull();
  });

  it("puts the reschedule control only on the review step, never on the list of times", () => {
    const slots = dom(screen(BARRIER_TYPES.RESCHEDULE, "SLOTS", DATA_FOR(BARRIER_TYPES.RESCHEDULE, "SLOTS")));
    expect(slots.querySelector('[data-action="barrier-reschedule-confirm"]')).toBeNull();
    const review = dom(screen(BARRIER_TYPES.RESCHEDULE, "REVIEW", DATA_FOR(BARRIER_TYPES.RESCHEDULE, "REVIEW")));
    expect(review.querySelector('[data-action="barrier-reschedule-confirm"]')).not.toBeNull();
  });

  it("puts the invitation control only on the review step, never on the list of people", () => {
    const contacts = dom(screen(BARRIER_TYPES.COMPANION, "CONTACTS", DATA_FOR(BARRIER_TYPES.COMPANION, "CONTACTS")));
    expect(contacts.querySelector('[data-action="barrier-companion-send"]')).toBeNull();
    const review = dom(screen(BARRIER_TYPES.COMPANION, "REVIEW", DATA_FOR(BARRIER_TYPES.COMPANION, "REVIEW")));
    expect(review.querySelector('[data-action="barrier-companion-send"]')).not.toBeNull();
  });

  it("asks a second time before cancelling a booked ride", () => {
    const booked = dom(screen(BARRIER_TYPES.TRANSPORTATION, "BOOKED", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "BOOKED")));
    expect(booked.querySelector('[data-action="barrier-ride-cancel"]')).not.toBeNull();
    expect(booked.querySelector('[data-action="barrier-ride-cancel-confirm"]')).toBeNull();
    const confirm = dom(screen(BARRIER_TYPES.TRANSPORTATION, "CANCEL_CONFIRM", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "CANCEL_CONFIRM")));
    expect(confirm.querySelector('[data-action="barrier-ride-cancel-confirm"]')).not.toBeNull();
  });

  it("shows everything about to happen before it happens", () => {
    const review = dom(screen(BARRIER_TYPES.TRANSPORTATION, "REVIEW", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "REVIEW")));
    const text = review.body.textContent;
    for (const fact of ["123 Oak Avenue", "Fresner Medical Group", "UberX", "$18.40"]) expect(text, fact).toContain(fact);
    // The pickup time, the arrival estimate and the date all appear as formatted times, not ISO.
    expect(text).toMatch(/6:00 PM/);
    expect(text).not.toMatch(/2026-09-02T/);
  });
});

describe("structured UI, not a chat log (§17)", () => {
  it("never stacks more than two lines of EMMI on one screen", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      const lines = dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll(".barrier-emmi-line");
      expect(lines.length, `${barrierType}:${step}`).toBeLessThanOrEqual(2);
    }
  });

  it("never renders an EMMI line with nothing in it", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      for (const line of dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll(".barrier-emmi-line")) {
        expect(line.textContent.trim().length, `${barrierType}:${step}`).toBeGreaterThan(0);
      }
    }
  });

  it("chooses a ride, a time and a person through components rather than through typing", () => {
    expect(dom(screen(BARRIER_TYPES.TRANSPORTATION, "OPTIONS", DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "OPTIONS"))).querySelectorAll(".barrier-option").length).toBe(1);
    expect(dom(screen(BARRIER_TYPES.RESCHEDULE, "SLOTS", DATA_FOR(BARRIER_TYPES.RESCHEDULE, "SLOTS"))).querySelectorAll(".barrier-slot").length).toBe(1);
    expect(dom(screen(BARRIER_TYPES.COMPANION, "CONTACTS", DATA_FOR(BARRIER_TYPES.COMPANION, "CONTACTS"))).querySelectorAll(".barrier-person").length).toBe(1);
  });

  it("asks for free text in exactly one place, and it is 'Something else'", () => {
    const typing = EVERY_STEP.filter(([barrierType, step]) => {
      const document = dom(screen(barrierType, step, DATA_FOR(barrierType, step)));
      return document.querySelector("textarea") !== null;
    });
    expect(typing).toEqual([[BARRIER_TYPES.OTHER, "DESCRIBE"]]);
  });
});

describe("accessibility", () => {
  it("uses real buttons, never a clickable div", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      for (const control of dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll("[data-action]")) {
        expect(["BUTTON", "A"], `${barrierType}:${step}:${control.dataset.action}`).toContain(control.tagName);
        if (control.tagName === "BUTTON") expect(control.getAttribute("type"), `${barrierType}:${step}`).toBe("button");
      }
    }
  });

  it("says what is selected with aria-pressed rather than with colour alone", () => {
    const chosen = dom(screen(BARRIER_TYPES.TRANSPORTATION, "OPTIONS", { ...DATA_FOR(BARRIER_TYPES.TRANSPORTATION, "OPTIONS"), selectedOptionId: "STANDARD_1" }));
    expect(chosen.querySelector(".barrier-option").getAttribute("aria-pressed")).toBe("true");
    const needs = dom(screen(BARRIER_TYPES.TRANSPORTATION, "NEEDS", { needs: ["WHEELCHAIR"] }));
    const pressed = [...needs.querySelectorAll(".barrier-toggle")].filter(button => button.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].dataset.need).toBe("WHEELCHAIR");
  });

  it("gives every screen exactly one h1", () => {
    for (const [barrierType, step] of EVERY_STEP) {
      expect(dom(screen(barrierType, step, DATA_FOR(barrierType, step))).querySelectorAll("h1").length, `${barrierType}:${step}`).toBe(1);
    }
  });

  it("labels every input the patient has to fill in", () => {
    for (const step of ["PICKUP_EDIT"]) {
      const document = dom(screen(BARRIER_TYPES.TRANSPORTATION, step, DATA_FOR(BARRIER_TYPES.TRANSPORTATION, step)));
      for (const field of document.querySelectorAll("input, textarea")) {
        expect(document.querySelector(`label[for="${field.id}"]`), `${step}:${field.name}`).not.toBeNull();
      }
    }
    const contact = dom(screen(BARRIER_TYPES.COMPANION, "NEW_CONTACT", {}));
    for (const field of contact.querySelectorAll("input")) expect(contact.querySelector(`label[for="${field.id}"]`), field.name).not.toBeNull();
    const describe = dom(screen(BARRIER_TYPES.OTHER, "DESCRIBE", {}));
    expect(describe.querySelector('label[for="barrier-describe"]')).not.toBeNull();
  });

  it("announces the states that change while the patient waits", () => {
    expect(dom(screen(BARRIER_TYPES.TRANSPORTATION, "SEARCHING", {})).querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(dom(screen(BARRIER_TYPES.COMPANION, "SENT", DATA_FOR(BARRIER_TYPES.COMPANION, "SENT"))).querySelector('[aria-live="polite"]')).not.toBeNull();
  });
});

describe("escaping", () => {
  it("escapes a provider name, an address and a contact name that carry markup", () => {
    const nasty = "<img src=x onerror=alert(1)>";
    const html = barrierResolutionScreen({
      locale: "en", icon, escapeHtml,
      resolution: advanceResolution(createResolution({ appointmentId: "appt-1", barrierType: BARRIER_TYPES.COMPANION }), "REVIEW", { contactName: nasty, contactRelationship: nasty }),
      appointment: appointment({ providerDisplayName: nasty, locationName: nasty }),
      contacts: []
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  it("escapes an address the patient typed into the pickup form", () => {
    const html = screen(BARRIER_TYPES.TRANSPORTATION, "PICKUP_EDIT", { addressDraft: { line1: '" onfocus="alert(1)', city: "Miami" } });
    expect(html).not.toMatch(/value="" onfocus=/);
    expect(html).toContain("&quot; onfocus=");
  });
});

describe("the readiness panel and the all-set answer", () => {
  const panel = resolutions => appointmentReadinessPanel({
    locale: "en", icon, escapeHtml,
    readiness: appointmentReadiness({ appointment: appointment(), resolutions, locale: "en" })
  });

  it("renders nothing when there is no readiness to show", () => {
    expect(appointmentReadinessPanel({ locale: "en", icon, escapeHtml })).toBe("");
    expect(appointmentReadinessPanel({ locale: "en", icon, escapeHtml, readiness: { items: [] } })).toBe("");
  });

  it("lists one line per item and one summary, with an icon on each", () => {
    const ride = advanceResolution(createResolution({ appointmentId: "appt-1", barrierType: BARRIER_TYPES.TRANSPORTATION }), "BOOKED", { reservation: { serviceName: "UberX", pickupLabel: "2:00 PM" } });
    const document = dom(panel([ride]));
    const items = document.querySelectorAll(".barrier-readiness-list li");
    expect(items).toHaveLength(2);
    for (const item of items) expect(item.querySelector(".icon")).not.toBeNull();
    expect(document.body.textContent).toContain("UberX · 2:00 PM");
    expect(document.body.textContent).toMatch(/Ready for your appointment/);
  });

  it("says how much is left without alarming language", () => {
    const searching = advanceResolution(createResolution({ appointmentId: "appt-1", barrierType: BARRIER_TYPES.TRANSPORTATION }), "OPTIONS");
    const text = dom(panel([searching])).body.textContent;
    expect(text).toMatch(/1 thing left/);
    expect(text).not.toMatch(/urgent|failed|error|problem/i);
  });

  it("answers 'I am all set' in one sentence and offers the way back", () => {
    const document = dom(allSetConfirmation({ locale: "es", icon, escapeHtml }));
    expect(document.querySelector('[data-tone="CONFIRMED"]')).not.toBeNull();
    expect(document.body.textContent).toMatch(/Perfecto/);
    expect(document.querySelector('[data-action="barrier-close"]')).not.toBeNull();
    expect(dom(allSetConfirmation({ locale: "en", icon, escapeHtml, hideAction: true })).querySelector("[data-action]")).toBeNull();
  });
});

describe("barrierResolution.css — mobile-first and namespaced", () => {
  const css = readFileSync(new URL("../src/barrierResolution.css", import.meta.url), "utf8");
  const cssRules = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const ruleBlocks = [...cssRules.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(match => ({ selector: match[1].trim(), body: match[2].trim() }))
    .filter(rule => !rule.selector.startsWith("@") && !/^(from|to|\d+%)$/.test(rule.selector));

  it("owns the .barrier- namespace and nothing else", () => {
    for (const rule of ruleBlocks) {
      for (const part of rule.selector.split(",").map(value => value.trim()).filter(Boolean)) {
        expect(part.startsWith(".barrier-"), part).toBe(true);
      }
    }
  });

  it("sizes everything in rem, so 125% and 150% text reflows rather than clips", () => {
    for (const rule of ruleBlocks) {
      // Hairlines and a 200% shimmer gradient are the only px/% values that do not scale with text.
      const pixels = [...rule.body.matchAll(/(\d*\.?\d+)px/g)].map(match => Number(match[1]));
      for (const value of pixels) expect(value, `${rule.selector}: ${rule.body}`).toBeLessThanOrEqual(1);
    }
  });

  it("gives no card a fixed height", () => {
    // Glyph containers — the round check badge, the success mark, the shimmer placeholder — are
    // deliberately square. Everything that holds text is not.
    const cards = ruleBlocks.filter(rule => /card|option|reservation|review|person|guide|readiness|change/.test(rule.selector)
      && !/icon|skeleton|selected|mark|check/.test(rule.selector));
    expect(cards.length).toBeGreaterThan(6);
    for (const rule of cards) expect(rule.body, rule.selector).not.toMatch(/(^|;)\s*height:/);
  });

  it("lets long text wrap rather than overflow at 320px", () => {
    // A long provider name, a Kreyòl label at 150% text or a pasted address has to reflow rather
    // than push the card sideways. A rule that sizes text satisfies that in one of three ways: it
    // wraps its own text, it is a row that flex-wraps its children, or the element that actually
    // holds the text is a descendant with its own wrap rule.
    const wraps = ruleBlocks.filter(rule => /overflow-wrap:anywhere/.test(rule.body)).map(rule => rule.selector);
    const handled = rule => /overflow-wrap:anywhere|flex-wrap:wrap|text-transform/.test(rule.body)
      || wraps.some(selector => selector.startsWith(`${rule.selector} `) || selector.startsWith(`${rule.selector}>`));
    const textual = ruleBlocks.filter(rule => /font-size:/.test(rule.body) && !/\.icon/.test(rule.selector));
    expect(textual.length).toBeGreaterThan(10);
    for (const rule of textual) expect(handled(rule), `${rule.selector}: ${rule.body}`).toBe(true);
  });

  it("keeps every touch target at 44px or more", () => {
    for (const selector of [".barrier-option", ".barrier-slot", ".barrier-person"]) {
      const rule = ruleBlocks.find(item => item.selector === selector);
      expect(rule, selector).toBeTruthy();
      expect(rule.body, selector).toMatch(/min-height:(3|4|5)[\d.]*rem/);
    }
  });

  it("respects a patient who asked for less motion", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)/);
    expect(css).toMatch(/animation:none/);
  });

  it("survives forced colours", () => {
    expect(css).toMatch(/@media \(forced-colors:active\)/);
  });
});
