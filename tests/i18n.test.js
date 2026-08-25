import { describe, expect, it, vi } from "vitest";
import { PROTOTYPE_OPTIONS, createPrototypeOffer } from "../src/config.js";
import { htmlLanguage, localeCode, localize, localizeOfferText } from "../src/i18n.js";

describe("patient enrollment internationalization", () => {
  it("maps Kreyòl to the KR UI code and the correct HTML language", () => {
    expect(localeCode("ht")).toBe("KR");
    expect(htmlLanguage("ht")).toBe("ht");
  });

  it("reports missing translations and never silently falls back to English", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(localize("ht", { en: "Continue", es: "Continuar" }, "test.continue")).toBe("⟦ht:test.continue⟧");
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Missing ht translation"));
    error.mockRestore();
  });

  it("has Spanish and Kreyòl translations for every dynamic program message", () => {
    for (const program of PROTOTYPE_OPTIONS.programs) {
      const offer = createPrototypeOffer({
        program,
        source: program === "ACCESS" ? "ITERA Direct Outreach" : "Physician Referral"
      });
      const copy = [
        ...offer.careCapabilities.flatMap(item => [item.title, item.description]),
        ...offer.consent.services,
        offer.consent.costSharingText,
        ...offer.consent.stopRules,
        offer.content.supportTemplate
      ];
      for (const locale of ["es", "ht"]) {
        for (const source of copy) {
          expect(localizeOfferText(locale, source, { physicianDisplayName: "Dr. Fresner" }), `${program}/${locale}: ${source}`).not.toMatch(/^⟦/);
        }
      }
    }
  });
});
