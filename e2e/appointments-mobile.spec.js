import { expect, test } from "@playwright/test";
import { scaleTextAndSettle } from "./layout.js";
import {
  DIRECT_BOOKING_PROVIDER,
  STRUCTURED_REQUEST_PROVIDER,
  acceptedInvite,
  appointment,
  inDays,
  seedAppointments,
  seedCareCircle
} from "./appointmentSurfaces.js";

// Phase 4 QA — Agent 3. Mobile, responsive, typography, accessibility (§97-§114, §152-§154).
//
// Everything here measures the rendered screen rather than the HTML string: §99 is about pixels a
// thumb can hit, §102/§103 are about what a wrapped line actually does inside its card, and §153
// is about what 150% browser text scaling does to a layout that claims to be in rem.
//
// Every surface is reached the way a patient reaches it — by tapping — so a screen that stops
// being navigable fails this suite rather than quietly dropping out of its coverage.

const PRIMARY = { width: 384, height: 824 };
const WIDTHS = [360, 375, 384, 390, 393, 412, 430];
const SWEEP_HEIGHT = 824;
const SCALES = [1, 1.25, 1.5];
const MIN_TOUCH = 44;
const SHOTS = "qa-shots/appointments";

// §102/§103. Long enough to force a wrap at 360px and long enough that a fixed-height card or an
// ellipsis would be unmistakable.
const LONG_PROVIDER = "Dr. Alexander Maximiliano Rodriguez-Martinez";
const LONG_PRACTICE = "Coral Gables Comprehensive Cardiovascular and Preventive Medicine Associates";

// Two prescribers so buildCareTeam() offers both a direct-booking and a request-only provider on
// the §26 "who would you like to see?" step.
const MEDICATIONS = [
  { id: "med-lisinopril", name: "Lisinopril", details: "10 mg · Once daily", active: true, prescriber: { id: DIRECT_BOOKING_PROVIDER, name: "Dr. Fresner" } },
  { id: "med-metoprolol", name: "Metoprolol", details: "25 mg · Twice daily", active: true, prescriber: { id: STRUCTURED_REQUEST_PROVIDER, name: "Dr. Pedro Martinez" } }
];

const CONFIRMED = appointment({
  id: "appt-confirmed",
  providerDisplayName: "Dr. Pedro Martinez",
  requestedSpecialty: "Cardiology",
  practiceName: "Coral Gables Cardiology",
  locationName: "Coral Gables Cardiology",
  locationAddress: "2100 Ponce de Leon Blvd, Coral Gables, FL 33134",
  status: "CONFIRMED",
  scheduledAt: inDays(7),
  scheduledEndAt: inDays(7, 11),
  confirmationNumber: "ITERA-4821",
  prep: { topics: ["My recent blood pressure trend", "A medication question"], notes: "", sharedWithProvider: false, updatedAt: "" }
});

const PENDING = appointment({
  id: "appt-request",
  requestedProfessionalId: STRUCTURED_REQUEST_PROVIDER,
  providerDisplayName: "Dr. Pedro Martinez",
  requestedSpecialty: "Cardiology",
  schedulingCapability: "STRUCTURED_REQUEST",
  status: "WAITING_FOR_OFFICE",
  preferredTimeOfDay: "MORNING",
  preferredModality: "IN_PERSON",
  scheduledAt: "",
  scheduledEndAt: "",
  confirmedAt: "",
  confirmationNumber: "",
  requestSentAt: new Date().toISOString()
});

const NEEDS_ACTION = appointment({
  id: "appt-action",
  providerDisplayName: "Dr. Fresner",
  requestedSpecialty: "Primary Care",
  status: "PROPOSED_TIME",
  scheduledAt: "",
  scheduledEndAt: "",
  confirmedAt: "",
  confirmationNumber: ""
});

const PROBLEM = appointment({
  id: "appt-problem",
  providerDisplayName: "Dr. Fresner",
  status: "NO_SHOW",
  scheduledAt: inDays(-21),
  scheduledEndAt: inDays(-21, 11),
  confirmationNumber: ""
});

const CLOSED = appointment({
  id: "appt-past",
  providerDisplayName: "Dr. Ana Delgado",
  requestedSpecialty: "Primary Care",
  status: "COMPLETED",
  scheduledAt: inDays(-14),
  scheduledEndAt: inDays(-14, 11),
  confirmationNumber: ""
});

// §65: confirmed, already over, never asked about — appointmentFollowUpDue() opens the detail
// screen on the attendance question (src/app.js:3824).
const FOLLOW_UP_DUE = appointment({
  id: "appt-followup",
  providerDisplayName: "Dr. Fresner",
  requestedSpecialty: "Primary Care",
  status: "CONFIRMED",
  scheduledAt: inDays(-3),
  scheduledEndAt: inDays(-3, 11),
  confirmationNumber: "ITERA-1109"
});

const SCHEDULING_NEED = appointment({
  id: "appt-new",
  requestedProfessionalId: "",
  providerDisplayName: "",
  status: "COLLECTING_PREFERENCES",
  schedulingCapability: "",
  scheduledAt: "",
  scheduledEndAt: "",
  confirmedAt: "",
  confirmationNumber: ""
});

const ALL = [CONFIRMED, PENDING, NEEDS_ACTION, PROBLEM, CLOSED, FOLLOW_UP_DUE];

/* ------------------------------------------------------------------ seeding + navigation -- */

const DRAFT_KEY = "itera.enrollment.safe-draft.v2";

// appointmentFlow is deliberately never persisted (src/app.js:7556), but `screen` and
// `activeAppointmentId` are — seeding those two is the only supported way into
// APPOINTMENT_SCHEDULING without walking the medication refill flow.
const openScreen = async (page, { screen = "MY_CARE", activeAppointmentId = "", careCircle = null, ...options } = {}) => {
  await page.goto("/?scenario=access-happy");
  // The app writes its own draft during boot; seeding before that settles lets it clobber the seed.
  await page.waitForSelector(".shell", { state: "attached", timeout: 30000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await seedAppointments(page, { screen, careMedications: MEDICATIONS, ...options });
  // The care-circle store's real shape is { invites: [] } (src/growth.js:20); seedCareCircle
  // writes whatever it is handed, so it is handed the store, not a bare list.
  if (careCircle) await seedCareCircle(page, careCircle);
  if (activeAppointmentId) {
    await page.evaluate(({ key, id }) => {
      const saved = JSON.parse(localStorage.getItem(key));
      saved.activeAppointmentId = id;
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key: DRAFT_KEY, id: activeAppointmentId });
  }
  await page.reload();
  await expect(page.locator("#screen-content")).toBeVisible({ timeout: 30000 });
};

const tap = async (page, selector) => {
  const control = page.locator(selector).first();
  await expect(control).toBeVisible();
  await control.click();
};

// Walks the §26 preference flow from the provider question to the review step. Every step is a
// real tap on a real control, so the flow's own integrity is part of every layout measurement.
const walkPreferences = async (page, providerId) => {
  await SURFACES.PREFERENCE_PROVIDER.open(page);
  await tap(page, `[data-action="appointment-preference-answer"][data-value="${providerId}"]`);
  await tap(page, '[data-value="ROUTINE_FOLLOW_UP"]');
  await tap(page, '[data-field="preferredModality"]');
  await tap(page, '[data-value="MORNING"]');
};

// Every appointment surface. `open` leaves the page on that screen; `check` proves it arrived.
const SURFACES = {
  MY_CARE: {
    check: ".appointment-upcoming-care",
    open: page => openScreen(page, { appointments: ALL })
  },
  LIST_UPCOMING: {
    check: '.appointment-tab[data-tab="UPCOMING"][aria-pressed="true"]',
    open: async page => {
      await openScreen(page, { appointments: ALL });
      await tap(page, '[data-action="appointment-open-list"]');
    }
  },
  LIST_REQUESTS: {
    check: '.appointment-tab[data-tab="REQUESTS"][aria-pressed="true"]',
    open: async page => {
      await SURFACES.LIST_UPCOMING.open(page);
      await tap(page, '.appointment-tab[data-tab="REQUESTS"]');
    }
  },
  LIST_PAST: {
    check: '.appointment-tab[data-tab="PAST"][aria-pressed="true"]',
    open: async page => {
      await SURFACES.LIST_UPCOMING.open(page);
      await tap(page, '.appointment-tab[data-tab="PAST"]');
    }
  },
  DETAIL_CONFIRMED: {
    check: '.appointment-detail-screen[data-kind="appointment"]',
    open: async page => {
      await openScreen(page, { appointments: ALL });
      await tap(page, '.appointment-card[data-kind="appointment"] [data-action="appointment-open"]');
    }
  },
  DETAIL_REQUEST: {
    check: '.appointment-detail-screen[data-kind="request"]',
    open: async page => {
      await openScreen(page, { appointments: ALL });
      await tap(page, '[data-action="appointment-open"][data-appointment-id="appt-request"]');
    }
  },
  PREP: {
    check: ".appointment-prep-screen",
    open: async page => {
      await SURFACES.DETAIL_CONFIRMED.open(page);
      await tap(page, '[data-action="appointment-open-prep"]');
    }
  },
  BRIEF: {
    check: ".appointment-brief-screen",
    open: async page => {
      await SURFACES.PREP.open(page);
      await tap(page, '[data-action="appointment-open-brief"]');
    }
  },
  SHARE: {
    check: ".appointment-share-screen",
    open: async page => {
      await openScreen(page, {
        appointments: ALL,
        careCirclePermissions: { receiveReminders: true, helpWithDeviceSetup: false, helpWithAppointments: true, receiveCareTasks: false, viewLimitedCareProgress: true },
        careCircle: { invites: [acceptedInvite()] }
      });
      await tap(page, '.appointment-card[data-kind="appointment"] [data-action="appointment-open"]');
      await tap(page, '[data-action="appointment-open-share"]');
    }
  },
  REMINDER: {
    check: ".appointment-reminder-choices",
    open: async page => {
      await SURFACES.DETAIL_CONFIRMED.open(page);
      await tap(page, '[data-action="appointment-open-reminder"]');
    }
  },
  CANCEL_CONFIRM: {
    check: '[data-action="appointment-confirm-cancel"]',
    open: async page => {
      await SURFACES.DETAIL_CONFIRMED.open(page);
      await tap(page, '[data-action="appointment-request-cancel"]');
    }
  },
  PREFERENCE_PROVIDER: {
    check: '.appointment-preference-screen[data-step="PROVIDER"]',
    open: page => openScreen(page, { appointments: [SCHEDULING_NEED], screen: "APPOINTMENT_SCHEDULING", activeAppointmentId: "appt-new" })
  },
  PREFERENCE_REASON: {
    check: '.appointment-preference-screen[data-step="REASON"]',
    open: async page => {
      await SURFACES.PREFERENCE_PROVIDER.open(page);
      await tap(page, `[data-action="appointment-preference-answer"][data-value="${DIRECT_BOOKING_PROVIDER}"]`);
    }
  },
  PREFERENCE_MODALITY: {
    check: '.appointment-preference-screen[data-step="MODALITY"]',
    open: async page => {
      await SURFACES.PREFERENCE_REASON.open(page);
      await tap(page, '[data-value="ROUTINE_FOLLOW_UP"]');
    }
  },
  PREFERENCE_TIME_OF_DAY: {
    check: '.appointment-preference-screen[data-step="TIME_OF_DAY"]',
    open: async page => {
      await SURFACES.PREFERENCE_MODALITY.open(page);
      await tap(page, '[data-field="preferredModality"]');
    }
  },
  PREFERENCE_REVIEW: {
    check: '.appointment-preference-screen[data-step="REVIEW"]',
    open: async page => {
      await SURFACES.PREFERENCE_TIME_OF_DAY.open(page);
      await tap(page, '[data-value="MORNING"]');
    }
  },
  // §17: a direct-booking provider lands on real times; a request-only provider lands on a sent
  // request. The same four taps produce both, which is the point.
  SLOTS: {
    check: ".appointment-slot-screen",
    open: async page => {
      await walkPreferences(page, DIRECT_BOOKING_PROVIDER);
      await tap(page, '[data-action="appointment-submit-request"]');
    }
  },
  BOOKED: {
    check: ".appointment-confirmation-screen",
    open: async page => {
      await SURFACES.SLOTS.open(page);
      // The designated §124 fixture slot is always last, so the first card always books.
      await tap(page, ".appointment-slot");
    }
  },
  REQUEST_SENT: {
    check: ".appointment-request-screen",
    open: async page => {
      await walkPreferences(page, STRUCTURED_REQUEST_PROVIDER);
      await tap(page, '[data-action="appointment-submit-request"]');
    }
  },
  BARRIER_CHECK: {
    check: ".appointment-barrier-screen",
    open: async page => {
      await SURFACES.DETAIL_CONFIRMED.open(page);
      await tap(page, '[data-action="appointment-open-barrier"]');
    }
  },
  // §65: a confirmed visit whose time has passed opens on the attendance question rather than on
  // a detail screen that still talks about it in the future tense (src/app.js:3824).
  FOLLOW_UP: {
    check: ".appointment-followup-screen",
    open: async page => {
      await SURFACES.LIST_PAST.open(page);
      await tap(page, '[data-action="appointment-open"][data-appointment-id="appt-followup"]');
    }
  }
};

const SURFACE_NAMES = Object.keys(SURFACES);

// One retry, because the EMMI guidance bar mounts at the top of #screen-content on a timer and
// shifts every control below it — a tap aimed before it lands can miss. That displacement is
// reported as an observation; the retry keeps this suite's layout findings deterministic.
const openSurface = async (page, name) => {
  await SURFACES[name].open(page);
  const arrived = page.locator(SURFACES[name].check).first();
  if (!(await arrived.isVisible().catch(() => false))) await SURFACES[name].open(page);
  await expect(arrived, `${name} did not render`).toBeVisible();
};

/* --------------------------------------------------------------------------- measuring --- */

// One frame is not enough: the style change schedules a layout and the app re-renders on the frame
// after that, so a single wait can measure the pre-render geometry. Two frames is the wait the EMMI
// surface helper already uses for the same reason.
const setScale = async (page, scale) => scaleTextAndSettle(page, scale);

const resetScale = page => page.evaluate(() => { document.documentElement.style.fontSize = ""; });

// One pass over the rendered screen. Everything the §97-§114 checks need comes from here, so a
// failure can name the element, the number, and the viewport it happened at.
const auditScreen = page => page.evaluate(minTouch => {
  const root = document.querySelector("#screen-content");
  const shown = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const describe = el => `${el.tagName.toLowerCase()}${[...el.classList].map(name => `.${name}`).join("")}${el.dataset.action ? `[data-action="${el.dataset.action}"]` : ""}`;
  const height = el => Math.round(el.getBoundingClientRect().height * 10) / 10;
  const label = el => {
    const aria = (el.getAttribute("aria-label") || "").trim();
    if (aria) return aria;
    const by = el.getAttribute("aria-labelledby");
    const target = by ? document.getElementById(by) : null;
    if (target && target.textContent.trim()) return target.textContent.trim();
    const own = (el.innerText || el.textContent || "").trim();
    if (own) return own;
    const title = (el.getAttribute("title") || "").trim();
    if (title) return title;
    const associated = el.id ? root.querySelector(`label[for="${el.id}"]`) : null;
    if (associated && associated.textContent.trim()) return associated.textContent.trim();
    const wrapping = el.closest("label");
    if (wrapping && wrapping.textContent.trim()) return wrapping.textContent.trim();
    return (el.getAttribute("placeholder") || "").trim();
  };

  const controls = [...root.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')].filter(shown);
  // .appointment-visually-hidden is a deliberate 1x1 screen-reader label, not clipped UI.
  const blocks = [...root.querySelectorAll("*")].filter(shown)
    .filter(el => getComputedStyle(el).display !== "inline")
    .filter(el => !el.closest(".appointment-visually-hidden"));
  const clips = el => {
    const style = getComputedStyle(el);
    const hidden = value => value !== "visible" && value !== "";
    return (el.scrollWidth > el.clientWidth + 1 && hidden(style.overflowX))
      || (el.scrollHeight > el.clientHeight + 1 && hidden(style.overflowY));
  };

  return {
    documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    h1Count: root.querySelectorAll("h1").length,
    h1Text: [...root.querySelectorAll("h1")].map(el => (el.innerText || "").trim()),
    h1Top: root.querySelector("h1") ? Math.round(root.querySelector("h1").getBoundingClientRect().top) : null,
    h1InView: [...root.querySelectorAll("h1")].every(el => {
      const box = el.getBoundingClientRect();
      return box.top >= -1 && box.top < innerHeight;
    }),
    controlCount: controls.length,
    smallTargets: controls.filter(el => height(el) < minTouch)
      .map(el => ({ selector: describe(el), height: height(el), text: (el.innerText || "").trim().slice(0, 44) })),
    unnamedControls: controls.filter(el => !label(el)).map(describe),
    fakeControls: [...root.querySelectorAll("[data-action]")].filter(shown)
      .filter(el => !["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName))
      .map(describe),
    clipped: blocks.filter(clips).map(el => ({
      selector: describe(el),
      content: `${el.scrollWidth}x${el.scrollHeight}`,
      box: `${el.clientWidth}x${el.clientHeight}`
    })),
    ellipsised: blocks.filter(el => {
      const style = getComputedStyle(el);
      return style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
    }).map(describe),
    escaping: blocks.filter(el => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1);
    }).map(el => {
      const box = el.getBoundingClientRect();
      return { selector: describe(el), left: Math.round(box.left), right: Math.round(box.right) };
    }),
    // §100 / §154 — no table, no month grid, no seven-column anything.
    tables: root.querySelectorAll("table").length,
    gridRoles: root.querySelectorAll('[role="grid"], [role="gridcell"], [role="row"], [role="columnheader"]').length,
    calendarish: [...root.querySelectorAll("[class]")]
      .filter(el => typeof el.className === "string" && /calendar|month|day-grid|weekgrid/i.test(el.className))
      .map(describe),
    wideGrids: blocks.filter(el => {
      const style = getComputedStyle(el);
      return style.display.includes("grid") && style.gridTemplateColumns.split(/\s+/).filter(Boolean).length >= 7;
    }).map(el => ({ selector: describe(el), columns: getComputedStyle(el).gridTemplateColumns })),
    // §106 / §107 — every status carries text and an icon, not only a colour.
    statuses: [...root.querySelectorAll(".appointment-status")].filter(shown).map(el => ({
      tone: el.dataset.tone || "",
      text: (el.innerText || "").trim(),
      icons: el.querySelectorAll(".icon, svg").length,
      colour: getComputedStyle(el).color
    }))
  };
}, MIN_TOUCH);

// Tab through the screen and record what the focus ring on each control actually looks like.
const focusRingAudit = async (page, steps = 26) => {
  await page.evaluate(() => document.body.focus());
  const seen = [];
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press("Tab");
    const entry = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || !document.querySelector("#screen-content")?.contains(el)) return null;
      const style = getComputedStyle(el);
      return {
        selector: `${el.tagName.toLowerCase()}${[...el.classList].map(name => `.${name}`).join("")}`,
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow
      };
    });
    if (entry) seen.push(entry);
  }
  return seen;
};

// Phase 4 runs while four other agents edit src/, and a Vite full reload mid-measurement tears
// down the execution context. That is the harness losing the page, not the page failing, so the
// surface is re-opened (and any text scale re-applied) and measured once more.
const auditSurface = async (page, name, restore = null) => {
  try {
    return await auditScreen(page);
  } catch (error) {
    if (!/Execution context was destroyed|Target closed|Target page/.test(error.message)) throw error;
    await openSurface(page, name);
    if (restore) await restore();
    return auditScreen(page);
  }
};

const report = failures => expect(failures, `\n${failures.join("\n")}\n`).toEqual([]);

/* ------------------------------------------------------------------------------ tests ---- */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(PRIMARY);
});

// §97 / §152. The one that has to hold everywhere: nothing on any appointment screen may push the
// document sideways, or escape the viewport, at any supported width.
test("no appointment screen overflows horizontally at any supported width", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: SWEEP_HEIGHT });
      const layout = await auditSurface(page, name);
      if (layout.documentOverflow > 1) failures.push(`${name} @ ${width}px: document overflows by ${layout.documentOverflow}px`);
      for (const escapee of layout.escaping) failures.push(`${name} @ ${width}px: ${escapee.selector} spans ${escapee.left}-${escapee.right}, outside 0-${width}`);
    }
    await page.setViewportSize(PRIMARY);
  }
  report(failures);
});

// §99. 44px is the floor, and it is a floor for links and inputs too, not only for buttons.
test("every control on every appointment screen meets the 44px touch minimum", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: SWEEP_HEIGHT });
      const layout = await auditSurface(page, name);
      expect(layout.controlCount, `${name} @ ${width}px rendered no controls at all`).toBeGreaterThan(0);
      for (const target of layout.smallTargets) {
        failures.push(`${name} @ ${width}px: ${target.selector} is ${target.height}px tall (min ${MIN_TOUCH}) — "${target.text}"`);
      }
    }
    await page.setViewportSize(PRIMARY);
  }
  report(failures);
});

// §153 / acceptance criterion 25. Font scaling is the test the "everything is in rem" claim has to
// survive: nothing clips, nothing truncates, and nothing collapses under 44px.
test("125% and 150% text scaling never clips an appointment screen or shrinks a target", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    for (const scale of SCALES) {
      await setScale(page, scale);
      const layout = await auditSurface(page, name, () => setScale(page, scale));
      if (layout.documentOverflow > 1) failures.push(`${name} @ ${scale}x: document overflows by ${layout.documentOverflow}px`);
      for (const target of layout.smallTargets) failures.push(`${name} @ ${scale}x: ${target.selector} is ${target.height}px tall — "${target.text}"`);
      for (const clip of layout.clipped) failures.push(`${name} @ ${scale}x: ${clip.selector} clips (content ${clip.content} inside ${clip.box})`);
      for (const cut of layout.ellipsised) failures.push(`${name} @ ${scale}x: ${cut} truncates with an ellipsis`);
    }
    await resetScale(page);
  }
  report(failures);
});

// §98. A screen title must stay a screen title when the patient turns their text size up. Pinned
// in px it stops growing and the body copy overtakes it.
test("appointment headings scale with the patient's text size", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of ["MY_CARE", "LIST_UPCOMING", "DETAIL_CONFIRMED", "SLOTS", "PREFERENCE_REASON"]) {
    await openSurface(page, name);
    const sizes = {};
    for (const scale of SCALES) {
      await setScale(page, scale);
      sizes[scale] = await page.evaluate(() => {
        const root = document.querySelector("#screen-content");
        const size = selector => {
          const el = root.querySelector(selector);
          return el ? Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10 : null;
        };
        // Only appointment-owned headings. My Care's own h1 comes from the shared titleBlock and is
        // pinned by the app-wide px type scale in styles.css — a pre-existing issue on every screen
        // in the product, reported separately rather than fixed inside this capability.
        return {
          h1: size(".appointment-screen-title"),
          h2: size(".appointment-section-title, .appointment-need-title, .appointment-question"),
          body: size(".appointment-lead, .appointment-meta, .appointment-next-step, .appointment-specialty")
        };
      });
    }
    await resetScale(page);
    for (const scale of [1.25, 1.5]) {
      if (sizes[scale].h1 !== null && sizes[scale].h1 <= sizes[1].h1 + 0.5) {
        failures.push(`${name}: h1 is ${sizes[1].h1}px at 100% and still ${sizes[scale].h1}px at ${scale * 100}% — screen titles do not scale`);
      }
      if (sizes[scale].h2 !== null && sizes[scale].h2 <= sizes[1].h2 + 0.5) {
        failures.push(`${name}: h2 is ${sizes[1].h2}px at 100% and still ${sizes[scale].h2}px at ${scale * 100}% — section titles do not scale`);
      }
      if (sizes[scale].h1 !== null && sizes[scale].body !== null && sizes[scale].h1 < sizes[scale].body) {
        failures.push(`${name}: at ${scale * 100}% the h1 (${sizes[scale].h1}px) is smaller than body copy (${sizes[scale].body}px)`);
      }
    }
  }
  report(failures);
});

// §98 read off the sheet as well as off the screen: a px font-size is exactly what defeats browser
// text scaling, and a fixed height is what clips a wrapped practice name (§103).
test("the appointment stylesheet declares no fixed px font sizes and no fixed card heights", async ({ page }) => {
  const sheet = await page.request.get("/src/appointments.css");
  expect(sheet.ok()).toBe(true);
  const css = await sheet.text();
  const pxFonts = css.match(/font(?:-size)?\s*:[^;}]*\d\s*px/gi) || [];
  report(pxFonts.map(rule => `px font size in src/appointments.css: ${rule.trim()}`));
  // Container rules only — an icon inside a card is allowed a fixed box; the card is not.
  const cardRules = (css.match(/[^{}]*\.appointment-(?:card|hero|request-panel|need-card|slot|share-member)[^{}]*\{[^}]*\}/g) || [])
    .filter(block => !/\.icon|-go\b|-icon\b/.test(block.split("{")[0]));
  const fixed = cardRules.filter(block => /[;{\s]height\s*:\s*(?!auto)/.test(block));
  report(fixed.map(block => `fixed height on an appointment card: ${block.split("{")[0].trim()}`));
});

// §100 / §154. The prohibition is structural, so assert on structure, not on a class name.
test("no appointment screen renders a table, a month grid, or a seven-column layout", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    const layout = await auditSurface(page, name);
    if (layout.tables) failures.push(`${name}: ${layout.tables} <table> element(s)`);
    if (layout.gridRoles) failures.push(`${name}: ${layout.gridRoles} ARIA grid role(s)`);
    for (const node of layout.calendarish) failures.push(`${name}: calendar-shaped class on ${node}`);
    for (const grid of layout.wideGrids) failures.push(`${name}: ${grid.selector} lays out ${grid.columns}`);
  }
  report(failures);
});

// §32 / §101. Availability opens small — three cards and a way to widen the search — and each card
// stacks its date over its time rather than squeezing them into columns at 384px.
test("availability opens with at most three slot cards and a see-more control", async ({ page }) => {
  await openSurface(page, "SLOTS");
  await expect(page.locator(".appointment-slot")).toHaveCount(3);
  await expect(page.locator('[data-action="appointment-more-times"]')).toBeVisible();

  const geometry = await page.locator(".appointment-slot").first().evaluate(card => {
    const when = card.querySelector(".appointment-slot-when").getBoundingClientRect();
    const time = card.querySelector(".appointment-slot-time").getBoundingClientRect();
    const box = card.getBoundingClientRect();
    return { stacked: time.top >= when.bottom - 1, width: box.width, height: box.height, viewport: innerWidth };
  });
  expect(geometry.stacked, "§101: the slot date and time must stack, not sit in columns").toBe(true);
  expect(geometry.width, "§101: a slot card must be full width at 384px").toBeGreaterThan(geometry.viewport * 0.8);
  expect(geometry.height).toBeGreaterThanOrEqual(MIN_TOUCH);

  // Widening the search is the escape hatch §32 asks for, not a calendar.
  await tap(page, '[data-action="appointment-more-times"]');
  await expect(page.locator(".appointment-slot").first()).toBeVisible();
  expect(await page.locator(".appointment-slot").count()).toBeGreaterThan(3);
  const expanded = await auditScreen(page);
  expect(expanded.tables + expanded.gridRoles + expanded.wideGrids.length, "§154: widening the search must not produce a grid").toBe(0);
});

test("Need an appointment keeps its icon and title aligned in one compact row at 384px", async ({ page }) => {
  await openSurface(page, "MY_CARE");
  await page.setViewportSize(PRIMARY);
  const card = page.locator(".appointment-need-card");
  await expect(card).toBeVisible();
  const geometry = await card.evaluate(node => {
    const heading = node.querySelector(".appointment-need-heading");
    const icon = node.querySelector(".appointment-need-icon");
    const title = node.querySelector(".appointment-need-title");
    const action = node.querySelector(".appointment-action");
    const box = element => element.getBoundingClientRect();
    const style = element => getComputedStyle(element);
    return {
      cardWidth: box(node).width,
      headingDisplay: style(heading).display,
      headingAligned: Math.abs((box(icon).top + box(icon).height / 2) - (box(title).top + box(title).height / 2)) <= 1,
      iconShrink: style(icon).flexShrink,
      titleMinWidth: style(title).minWidth,
      actionWidth: box(action).width,
      actionHeight: box(action).height,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });
  expect(geometry.headingDisplay).toBe("flex");
  expect(geometry.headingAligned).toBe(true);
  expect(geometry.iconShrink).toBe("0");
  expect(geometry.titleMinWidth).toBe("0px");
  expect(geometry.actionWidth).toBeGreaterThanOrEqual(geometry.cardWidth - 34);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(MIN_TOUCH);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
});

// §102 / §103. Identity is never abbreviated, never clipped, and never inside a fixed-height box.
test("a long provider name and a long practice name wrap instead of truncating", async ({ page }) => {
  test.setTimeout(120000);
  const long = appointment({
    id: "appt-long",
    providerDisplayName: LONG_PROVIDER,
    requestedSpecialty: "Interventional Cardiology and Electrophysiology",
    practiceName: LONG_PRACTICE,
    locationName: LONG_PRACTICE,
    status: "CONFIRMED",
    scheduledAt: inDays(5),
    scheduledEndAt: inDays(5, 11)
  });
  const failures = [];
  await openScreen(page, { appointments: [long] });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: SWEEP_HEIGHT });
    for (const scale of [1, 1.5]) {
      await setScale(page, scale);
      const identity = await page.evaluate(() => {
        const card = document.querySelector(".appointment-card");
        const providerEl = card.querySelector(".appointment-provider");
        const practiceEl = card.querySelector(".appointment-practice");
        const style = el => getComputedStyle(el);
        const box = el => el.getBoundingClientRect();
        const lines = el => Math.round(box(el).height / parseFloat(style(el).lineHeight));
        const truncates = el => style(el).textOverflow === "ellipsis" || style(el).webkitLineClamp !== "none";
        const clipped = el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
        return {
          providerText: providerEl.textContent.trim(),
          practiceText: practiceEl.textContent.trim(),
          providerTruncates: truncates(providerEl),
          practiceTruncates: truncates(practiceEl),
          providerClipped: clipped(providerEl),
          practiceClipped: clipped(practiceEl),
          providerLines: lines(providerEl),
          practiceLines: lines(practiceEl),
          providerInsideCard: box(providerEl).right <= box(card).right + 1,
          practiceInsideCard: box(practiceEl).right <= box(card).right + 1,
          cardFixedHeight: style(card).height === style(card).maxHeight && style(card).maxHeight !== "none",
          cardFits: card.scrollHeight <= card.clientHeight + 1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        };
      });
      const at = `${width}px @ ${scale}x`;
      if (identity.providerText !== LONG_PROVIDER) failures.push(`${at}: provider rendered as "${identity.providerText}"`);
      if (identity.practiceText !== LONG_PRACTICE) failures.push(`${at}: practice rendered as "${identity.practiceText}"`);
      if (identity.providerTruncates) failures.push(`${at}: .appointment-provider truncates with an ellipsis`);
      if (identity.practiceTruncates) failures.push(`${at}: .appointment-practice truncates with an ellipsis`);
      if (identity.providerClipped) failures.push(`${at}: .appointment-provider is clipped`);
      if (identity.practiceClipped) failures.push(`${at}: .appointment-practice is clipped`);
      if (identity.providerLines < 2) failures.push(`${at}: the long provider name did not wrap (${identity.providerLines} line)`);
      if (identity.practiceLines < 2) failures.push(`${at}: the long practice name did not wrap (${identity.practiceLines} line)`);
      if (!identity.providerInsideCard) failures.push(`${at}: .appointment-provider overflows its card`);
      if (!identity.practiceInsideCard) failures.push(`${at}: .appointment-practice overflows its card`);
      if (identity.cardFixedHeight) failures.push(`${at}: .appointment-card has a fixed height`);
      if (!identity.cardFits) failures.push(`${at}: .appointment-card clips its own content`);
      if (identity.overflow > 1) failures.push(`${at}: document overflows by ${identity.overflow}px`);
    }
    await resetScale(page);
  }
  report(failures);
});

// §106 / §107. Remove the colour and the meaning has to survive, for every tone the machine emits.
test("every status carries text and an icon, in every tone", async ({ page }) => {
  test.setTimeout(120000);
  const tones = new Map();
  const failures = [];
  for (const name of ["MY_CARE", "LIST_UPCOMING", "LIST_REQUESTS", "LIST_PAST", "DETAIL_CONFIRMED", "DETAIL_REQUEST", "BRIEF", "REQUEST_SENT", "BOOKED"]) {
    await openSurface(page, name);
    const layout = await auditSurface(page, name);
    for (const status of layout.statuses) {
      if (!status.text) failures.push(`${name}: a "${status.tone}" status rendered with no text`);
      if (!status.icons) failures.push(`${name}: the "${status.tone}" status "${status.text}" rendered with no icon`);
      if (!tones.has(status.tone)) tones.set(status.tone, status.colour);
    }
  }
  for (const tone of ["CONFIRMED", "WAITING", "ACTION_NEEDED", "CLOSED", "PROBLEM"]) {
    if (!tones.has(tone)) failures.push(`no ${tone} status was rendered on any surface — §107 cannot be proven for it`);
  }
  if (new Set(tones.values()).size < 2) failures.push(`all status tones share one colour: ${[...tones.values()][0]}`);
  report(failures);
});

// Accessibility floor: one h1, an accessible name on every control, real elements, a visible ring.
test("every appointment screen is announceable and operable by keyboard", async ({ page }) => {
  test.setTimeout(120000);
  const failures = [];
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    const layout = await auditSurface(page, name);
    if (layout.h1Count !== 1) failures.push(`${name}: ${layout.h1Count} <h1> element(s) — ${layout.h1Text.join(" | ") || "none"}`);
    if (!layout.h1InView) failures.push(`${name}: after navigation the screen heading sits at y=${layout.h1Top}, outside the 0-${SWEEP_HEIGHT} viewport — the patient lands mid-screen`);
    for (const control of layout.unnamedControls) failures.push(`${name}: ${control} has no accessible name`);
    for (const fake of layout.fakeControls) failures.push(`${name}: ${fake} carries an action on a non-interactive element`);

    const focusable = await focusRingAudit(page);
    if (!focusable.length) failures.push(`${name}: no control inside #screen-content is reachable by Tab`);
    for (const entry of focusable) {
      const ring = entry.outlineWidth > 0 && entry.outlineStyle !== "none";
      const shadow = entry.boxShadow && entry.boxShadow !== "none";
      if (!ring && !shadow) failures.push(`${name}: ${entry.selector} shows no focus indicator (outline ${entry.outlineWidth}px ${entry.outlineStyle})`);
    }
  }
  report(failures);
});

// §105 / §111. The two card shapes have to be distinguishable without reading a word.
test("a pending request is not drawn as a confirmed appointment", async ({ page }) => {
  await openSurface(page, "MY_CARE");
  const shapes = await page.evaluate(() => {
    const read = kind => {
      const card = document.querySelector(`.appointment-card[data-kind="${kind}"]`);
      if (!card) return null;
      const style = getComputedStyle(card);
      return {
        background: style.backgroundColor,
        borderLeftWidth: parseFloat(style.borderLeftWidth),
        hasDateHeadline: Boolean(card.querySelector(".appointment-card-when"))
      };
    };
    return { appointment: read("appointment"), request: read("request") };
  });
  expect(shapes.appointment, "no confirmed card on My Care").not.toBeNull();
  expect(shapes.request, "no request card on My Care").not.toBeNull();
  expect(shapes.request.hasDateHeadline, "§35: a request must not show a date headline").toBe(false);
  expect(shapes.appointment.hasDateHeadline).toBe(true);
  expect(
    shapes.request.background !== shapes.appointment.background || shapes.request.borderLeftWidth > shapes.appointment.borderLeftWidth,
    "§105: the request and appointment cards are visually identical"
  ).toBe(true);
});

// §26. One question, one answer, one step forward. This is the regression that proves the flow is
// walkable at all — the slot picker and both confirmation screens sit downstream of it.
//
// It exists because the flow was, for a while, not walkable: appointmentPreferenceView derived
// `needId = draft.id`, "needId" is not in APPOINTMENT_DRAFT_FIELDS (src/appointments.js:462) so a
// draft never carried one, and every control emitted data-need-id="appointment_draft_…".
// src/app.js resolves the appointment record from that same attribute, got null, and redirected to
// MY_APPOINTMENTS on the second answer. The fix reads props.appointment.id first
// (src/appointmentViews.js:880); this test pins it so a future draft-shaped id cannot undo it.
test("answering a preference question keeps the patient in the preference flow", async ({ page }) => {
  await openSurface(page, "PREFERENCE_PROVIDER");
  await tap(page, `[data-action="appointment-preference-answer"][data-value="${DIRECT_BOOKING_PROVIDER}"]`);
  await expect(page.locator('.appointment-preference-screen[data-step="REASON"]')).toBeVisible();

  const needIds = await page.evaluate(() => [...new Set([...document.querySelectorAll("[data-need-id]")].map(el => el.dataset.needId))]);
  const activeId = await page.evaluate(() => JSON.parse(localStorage.getItem("itera.enrollment.safe-draft.v2")).activeAppointmentId);
  expect(needIds, "data-need-id must carry the appointment id, not the draft id").toEqual([activeId]);

  await tap(page, '[data-value="ROUTINE_FOLLOW_UP"]');
  await expect(
    page.locator('.appointment-preference-screen[data-step="MODALITY"]'),
    "the second answer dropped the patient out of the scheduling flow"
  ).toBeVisible();
});

// Evidence for the lead: every surface at the primary QA viewport, plus the two that matter most
// at 150% text.
test("capture 384x824 evidence for every appointment screen", async ({ page }) => {
  // Longer than the sweeps: twenty-one screens, each walked to and each written to disk.
  test.setTimeout(240000);
  const file = name => `${SHOTS}/${name.toLowerCase().replace(/_/g, "-")}.png`;
  for (const name of SURFACE_NAMES) {
    await openSurface(page, name);
    await page.screenshot({ path: file(name), fullPage: true });
  }
  for (const name of ["DETAIL_CONFIRMED", "SLOTS"]) {
    await openSurface(page, name);
    await setScale(page, 1.5);
    await page.screenshot({ path: `${SHOTS}/${name.toLowerCase().replace(/_/g, "-")}-150.png`, fullPage: true });
    await resetScale(page);
  }
});
