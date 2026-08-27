import { describe, expect, it } from "vitest";
import { EMMI_LANGUAGES, emmiVoiceIsSupported, getHomeWelcome, resolveEmmiLanguage } from "../src/emmi/messages.js";

const KOREAN = /[가-힯ᄀ-ᇿ㄰-㆏]/;

describe("EMMI language resolution", () => {
  it("maps KR to Haitian Creole and never to Korean", () => {
    expect(resolveEmmiLanguage("KR").languageName).toBe("Haitian Creole (Kreyòl)");
    expect(resolveEmmiLanguage("KR").bcp47).toBe("ht-HT");
    expect(resolveEmmiLanguage("KR").speechLanguage).toBe("ht");
    expect(resolveEmmiLanguage("KR").modelLanguageInstruction).toMatch(/Haitian Creole \(Kreyòl\)/);
    expect(resolveEmmiLanguage("KR").modelLanguageInstruction).not.toMatch(/Speak naturally in Korean/i);
    expect(resolveEmmiLanguage("KR").languageName).not.toMatch(/korean/i);
  });

  it("maps the supported locales to their own language", () => {
    expect(resolveEmmiLanguage("EN").languageName).toBe("English");
    expect(resolveEmmiLanguage("ES").languageName).toBe("Spanish");
    expect(Object.keys(EMMI_LANGUAGES)).toEqual(["EN", "ES", "KR"]);
  });

  it("falls back to English only for a locale it does not know", () => {
    expect(resolveEmmiLanguage("PT").languageName).toBe("English");
    expect(resolveEmmiLanguage("es").languageName).toBe("Spanish");
  });

  it("reports Kreyòl voice as unsupported rather than pretending", () => {
    expect(emmiVoiceIsSupported("EN")).toBe(true);
    expect(emmiVoiceIsSupported("ES")).toBe(true);
    expect(emmiVoiceIsSupported("KR")).toBe(false);
  });
});

describe("EMMI home welcome", () => {
  it("names the referring physician for a provider referral in every locale", () => {
    expect(getHomeWelcome({ locale: "EN", providerReferral: true, physicianDisplayName: "Dr. Fresner" }))
      .toBe("Hi, I’m EMMI. Welcome to ITERA HEALTH. I’m here to help support the care you receive from Dr. Fresner and guide you through each step. You can ask me for help at any time.");
    expect(getHomeWelcome({ locale: "ES", providerReferral: true, physicianDisplayName: "Dr. Fresner" }))
      .toBe("Hola, soy EMMI. Bienvenido a ITERA HEALTH. Estoy aquí para apoyar el cuidado que recibe con Dr. Fresner y guiarle paso a paso. Puede pedirme ayuda en cualquier momento.");
    expect(getHomeWelcome({ locale: "KR", providerReferral: true, physicianDisplayName: "Dr. Fresner" }))
      .toContain("Bonjou, mwen se EMMI.");
  });

  it("never invents physician involvement for direct outreach", () => {
    for (const locale of ["EN", "ES", "KR"]) {
      const welcome = getHomeWelcome({ locale, providerReferral: false, physicianDisplayName: "Dr. Fresner" });
      expect(welcome).not.toContain("Fresner");
      expect(welcome).toContain("ITERA HEALTH");
    }
  });

  it("falls back to the direct outreach welcome when no physician is known", () => {
    expect(getHomeWelcome({ locale: "EN", providerReferral: true, physicianDisplayName: "" }))
      .toBe(getHomeWelcome({ locale: "EN", providerReferral: false }));
  });

  it("keeps each locale in its own language and produces no Korean for KR", () => {
    expect(getHomeWelcome({ locale: "EN" })).toContain("Welcome to ITERA HEALTH");
    expect(getHomeWelcome({ locale: "ES" })).toContain("Bienvenido a ITERA HEALTH");
    expect(getHomeWelcome({ locale: "ES" })).not.toContain("Welcome to");
    const kreyol = getHomeWelcome({ locale: "KR" });
    expect(kreyol).toContain("Byenveni nan ITERA HEALTH");
    expect(kreyol).not.toMatch(KOREAN);
    expect(kreyol).not.toContain("Welcome to");
  });
});
