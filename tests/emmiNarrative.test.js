import { describe, expect, it } from "vitest";
import { NARRATION_SECONDS, NARRATIVE_OBJECTIVES, buildHomeNarration, buildNarration, narratedScreens } from "../src/emmi/narrative.js";

const LOCALES = ["EN", "ES", "KR"];
const KOREAN = /[가-힯ᄀ-ᇿ]/;
const words = text => text.trim().split(/\s+/).length;

describe("narrative quality", () => {
  it("gives meaning rather than reading the screen", () => {
    const medications = buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN" }).narrationText;
    // The old message was "Review your medications." — the narration must add purpose,
    // benefit and reassurance on top of the instruction.
    expect(medications).toMatch(/helps your care team understand what you are actually taking/i);
    expect(medications).toMatch(/coordinate your care more safely/i);
    expect(medications).toMatch(/do not need to remember everything perfectly/i);
    expect(medications).toMatch(/telling you to start or stop a medicine/i);
    expect(words(medications)).toBeGreaterThan(45);
  });

  it("makes the goals screen about the patient, not about numbers", () => {
    const goals = buildNarration({ screen: "GOALS", locale: "EN" }).narrationText;
    expect(goals).toMatch(/what matters to you/i);
    expect(goals).toMatch(/not only about medical numbers/i);
    expect(goals).toMatch(/you can change them later/i);
  });

  it("covers orient, benefit, reassurance and action on every narrated screen", () => {
    for (const screen of narratedScreens()) {
      const spec = NARRATIVE_OBJECTIVES[screen];
      for (const part of ["purpose", "benefit", "reassurance", "action"]) {
        for (const locale of ["en", "es", "ht"]) {
          expect(spec[part][locale], `${screen}.${part}.${locale}`).toBeTruthy();
        }
      }
      const narration = buildNarration({ screen, locale: "EN" });
      // Enough substance to answer "why does this matter?", never a bare instruction.
      expect(words(narration.narrationText), screen).toBeGreaterThan(25);
    }
  });

  it("never pressures the patient or overpromises", () => {
    const forbidden = /you should enroll|don'?t miss|best choice|amazing|transform your health|act now|guaranteed/i;
    for (const screen of narratedScreens()) {
      for (const locale of LOCALES) {
        expect(buildNarration({ screen, locale }).narrationText, `${screen}/${locale}`).not.toMatch(forbidden);
      }
    }
    for (const program of ["ACCESS", "CCM", "RPM"]) {
      expect(buildHomeNarration({ locale: "EN", program }).narrationText).not.toMatch(forbidden);
    }
  });

  it("sizes narration to the weight of the screen", () => {
    expect(buildNarration({ screen: "IDENTITY_VERIFICATION", locale: "EN" }).estimatedSeconds).toEqual(NARRATION_SECONDS.SIMPLE_TASK);
    expect(buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN" }).estimatedSeconds).toEqual(NARRATION_SECONDS.CONCEPTUAL);
    expect(buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "EN" }).estimatedSeconds).toEqual(NARRATION_SECONDS.TRANSITION);
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS" }).estimatedSeconds).toEqual(NARRATION_SECONDS.PROGRAM_INTRODUCTION);
  });

  it("keeps the welcome to one bounded provider turn", () => {
    for (const locale of LOCALES) {
      const welcome = buildHomeNarration({ locale, program: "ACCESS" });
      expect(welcome.segments).toEqual([welcome.narrationText]);
      expect(words(welcome.narrationText), locale).toBeLessThanOrEqual(70);
      expect(welcome.narrationText.match(/\?/g) || [], locale).toHaveLength(0);
    }
  });
});

describe("program-aware home narration", () => {
  it("introduces the patient's own program and no other", () => {
    const access = buildHomeNarration({ locale: "EN", program: "ACCESS" }).narrationText;
    expect(access).toMatch(/ACCESS/);
    expect(access).toMatch(/not to replace your doctors/i);
    const ccm = buildHomeNarration({ locale: "EN", program: "CCM" }).narrationText;
    expect(ccm).toMatch(/ongoing health conditions/i);
    // ACCESS terminology must not leak into another program (§58).
    expect(ccm).not.toMatch(/\bACCESS\b/);
    // Non-device programs do not talk about monitors.
    expect(ccm).not.toMatch(/monitor/i);
    expect(buildHomeNarration({ locale: "EN", program: "PCM" }).narrationText).not.toMatch(/monitor/i);
  });

  it("tells a combined program as one story", () => {
    const combined = buildHomeNarration({ locale: "EN", program: "CCM_RPM" }).narrationText;
    expect(combined).toMatch(/two kinds of support that work as one/i);
    expect(combined).toMatch(/monitor/i);
    expect(combined).not.toMatch(/CCM_RPM/);
  });

  it("names the physician only for a provider referral that has a name", () => {
    const referral = buildHomeNarration({ locale: "EN", program: "ACCESS", providerReferral: true, physicianDisplayName: "Dr. Fresner" }).narrationText;
    expect(referral).toMatch(/Dr\. Fresner's care team invited you/);
    expect(referral).toMatch(/Your doctor remains part of your care/i);
    // Direct outreach must never imply a referring physician.
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS" }).narrationText).not.toMatch(/Fresner|your doctor's care team/i);
    // A referral without a resolved name must not produce an empty placeholder either.
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS", providerReferral: true }).narrationText).not.toMatch(/undefined|'s care team/);
  });

  it("falls back to the configured display name instead of inventing a description", () => {
    const asm = buildHomeNarration({ locale: "EN", program: "ASM", programDisplayName: "Advanced Specialty Management (ASM)" }).narrationText;
    expect(asm).toContain("Advanced Specialty Management (ASM)");
    expect(asm).not.toMatch(/monitor|ACCESS/);
  });

  it("keeps participation voluntary and defers the decision", () => {
    for (const locale of LOCALES) {
      const home = buildHomeNarration({ locale, program: "ACCESS" }).narrationText;
      expect(home.length, locale).toBeGreaterThan(200);
    }
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS" }).narrationText).toMatch(/your choice/i);
  });
});

describe("runtime facts", () => {
  it("speaks a dynamic fact only when the runtime supplies it", () => {
    const withCount = buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN", runtime: { medicationCount: 4 } }).narrationText;
    expect(withCount).toMatch(/We have 4 on file/);
    const withoutCount = buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN" }).narrationText;
    expect(withoutCount).not.toMatch(/We have \d+ on file/);
    expect(withoutCount).not.toMatch(/undefined|null|NaN/);
  });

  it("never invents a device vendor, a duration or a next step", () => {
    const device = buildNarration({ screen: "ACCESS_BP_DEVICE_RESULT", locale: "EN" }).narrationText;
    expect(device).not.toMatch(/Tenovi|Pylo/);
    expect(buildNarration({ screen: "ACCESS_BP_DEVICE_RESULT", locale: "EN", runtime: { deviceVendor: "Tenovi" } }).narrationText).toMatch(/Tenovi monitor/);
    const confirmed = buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "EN" }).narrationText;
    expect(confirmed).not.toMatch(/about\s+(undefined|null)|minutes/i);
    expect(confirmed).toMatch(/congratulations.*welcome/i);
    expect(buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "ES" }).narrationText).toMatch(/felicidades.*bienvenido/i);
    expect(buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "KR" }).narrationText).toMatch(/felisitasyon.*byenveni/i);
    expect(buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "EN", runtime: { estimatedDuration: "a few minutes", nextStepLabel: "Start my health check" } }).narrationText)
      .toMatch(/about a few minutes.*Start my health check/s);
  });

  it("reports which runtime fields the narration actually used", () => {
    const trace = buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN", runtime: { medicationCount: 2 } }).objective;
    expect(trace.dynamicUsed).toEqual(["medicationCount"]);
    expect(buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "EN" }).objective.dynamicUsed).toEqual([]);
  });
});

describe("language", () => {
  it("renders every narration natively in EN, ES and Kreyòl, never Korean", () => {
    for (const screen of narratedScreens()) {
      const en = buildNarration({ screen, locale: "EN" }).narrationText;
      const es = buildNarration({ screen, locale: "ES" }).narrationText;
      const kr = buildNarration({ screen, locale: "KR" }).narrationText;
      expect(es, screen).not.toBe(en);
      expect(kr, screen).not.toBe(en);
      expect(kr, screen).not.toMatch(KOREAN);
      for (const text of [en, es, kr]) expect(text.trim(), screen).not.toBe("");
    }
  });

  it("localizes the home narration and its dynamic sentences", () => {
    expect(buildHomeNarration({ locale: "ES", program: "ACCESS" }).narrationText).toMatch(/Hola, soy EMMI/);
    expect(buildHomeNarration({ locale: "KR", program: "ACCESS" }).narrationText).toMatch(/Bonjou, mwen se EMMI/);
    expect(buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "ES", runtime: { medicationCount: 3 } }).narrationText).toMatch(/Tenemos 3 registrados/);
    expect(buildNarration({ screen: "MEDICATIONS_REVIEW", locale: "KR", runtime: { medicationCount: 3 } }).narrationText).toMatch(/Nou gen 3 nan dosye/);
  });

  it("never repeats the Home greeting when continuity disables it", () => {
    expect(buildHomeNarration({ locale: "EN", program: "ACCESS", allowGreeting: false }).narrationText).not.toMatch(/^(Hi|Hello)/i);
    expect(buildHomeNarration({ locale: "ES", program: "ACCESS", allowGreeting: false }).narrationText).not.toMatch(/^Hola/i);
    expect(buildHomeNarration({ locale: "KR", program: "ACCESS", allowGreeting: false }).narrationText).not.toMatch(/^Bonjou/i);
  });

  it("returns nothing for a screen with no narrative objective", () => {
    expect(buildNarration({ screen: "SOME_UNNARRATED_SCREEN", locale: "EN" })).toBeNull();
  });
});

describe("EMMI on the ACCESS care activation screens", () => {
  const access = screen => buildNarration({ screen, locale: "EN", runtime: { program: "ACCESS" } });

  // The same screen means different things on different pathways. CCM asks the patient to choose
  // goals; ACCESS assigns them. EMMI describing the wrong one is worse than saying nothing.
  it("explains assigned goals on ACCESS and the chooser everywhere else", () => {
    expect(access("GOALS").narrationText).toMatch(/not choosing them|already/i);
    expect(buildNarration({ screen: "GOALS", locale: "EN", runtime: { program: "CCM" } }).narrationText).toMatch(/choose/i);
  });

  // The care plan exists before this screen. EMMI must never describe it as being created here.
  it("never says the care plan is being created during the barrier step", () => {
    const narration = access("ACCESS_SUPPORT_NEEDS").narrationText;
    expect(narration).toMatch(/already exists|already in place/i);
    expect(narration).not.toMatch(/creating your care plan|build your care plan|set up your care plan/i);
  });

  it("does not promise a shipment on the device screen", () => {
    const narration = access("ACCESS_BP_DEVICE_INFO").narrationText;
    expect(narration).toMatch(/cuff size|address/i);
    // What section 26 forbids is inventing fulfillment facts. Promising not to claim a shipment is
    // the opposite of claiming one, so the check targets the fabrications themselves.
    expect(narration).not.toMatch(/tracking number|carrier|arrives on|will arrive|estimated delivery/i);
  });

  it("closes on the two tasks actually completed", () => {
    const narration = access("ONBOARDING_COMPLETE").narrationText;
    expect(narration).toMatch(/monitor information.*medication reconciliation/i);
    expect(narration).not.toMatch(/goals|care plan|preferences/i);
    expect(narration).toMatch(/nothing else to do.*close this window/i);
    expect(narration).not.toMatch(/My Care/i);
  });

  it("tells an ACCESS patient exactly what follows enrollment and how to proceed or stop", () => {
    const confirmed = buildNarration({ screen: "ENROLLMENT_CONFIRMED", locale: "EN", runtime: { program: "ACCESS" } }).narrationText;
    expect(confirmed).toMatch(/enrollment is complete/i);
    expect(confirmed).toMatch(/blood pressure monitor.*medicines/i);
    expect(confirmed).toMatch(/progress will be saved/i);
    expect(confirmed).toMatch(/Set up my care.*I’ll do this later/i);
  });

  it("ends identity and an eligible ACCESS result with the next visible action", () => {
    expect(buildNarration({ screen: "IDENTITY_VERIFICATION", locale: "EN" }).narrationText)
      .toMatch(/date of birth and ZIP code.*choose Continue/i);
    expect(buildNarration({ screen: "ACCESS_ELIGIBILITY_RESULT", locale: "EN", runtime: { program: "ACCESS" } }).narrationText)
      .toMatch(/If this screen says you can continue, choose Continue/i);
  });

  // The health check screens are gone; a narration for them would be describing nothing.
  it("has no objective left for the removed health check screens", () => {
    expect(buildNarration({ screen: "ACCESS_BASELINE", locale: "EN", runtime: {} })).toBeNull();
    expect(buildNarration({ screen: "ACCESS_MEASURE", locale: "EN", runtime: {} })).toBeNull();
  });
});

// EMMI does not go quiet in the middle of a flow she narrates on both sides.
//
// The delivery address and the request confirmation had no objective at all, so buildNarration
// returned null and a patient with voice guidance on heard nothing between the monitor screen and
// their goals — including on the step that actually places the request.
describe("every screen of ACCESS care activation is narrated", () => {
  const ACTIVATION = [
    "ACCESS_BP_DEVICE_INFO",
    "ACCESS_BP_SHIPPING_ADDRESS",
    "ACCESS_BP_FULFILLMENT_CONFIRMED",
    "MEDICATIONS_REVIEW",
    "ONBOARDING_COMPLETE"
  ];

  for (const screen of ACTIVATION) {
    for (const locale of ["EN", "ES", "KR"]) {
      it(`says something on ${screen} in ${locale}`, () => {
        const narration = buildNarration({ screen, locale, runtime: { program: "ACCESS" } });
        expect(narration, `${screen} in ${locale} has no narration`).toBeTruthy();
        expect((narration.narrationText || "").trim().length).toBeGreaterThan(20);
      });
    }
  }

  it("tells the patient the address step is the one that commits the request", () => {
    const narration = buildNarration({ screen: "ACCESS_BP_SHIPPING_ADDRESS", locale: "EN", runtime: { program: "ACCESS" } });
    expect(narration.narrationText).toMatch(/places the request|Nothing is requested until you confirm/i);
  });

  it("never claims a shipment on the confirmation screen", () => {
    for (const locale of ["EN", "ES", "KR"]) {
      const narration = buildNarration({ screen: "ACCESS_BP_FULFILLMENT_CONFIRMED", locale, runtime: { program: "ACCESS" } });
      expect(narration.narrationText).not.toMatch(/has shipped\b(?! until)|ya fue enviado|arrives on|llega el/i);
    }
  });
});
