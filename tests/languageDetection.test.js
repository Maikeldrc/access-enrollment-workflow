import { describe, expect, it } from "vitest";
import { detectPatientLanguage, isLanguageOfferAccepted, isLanguageOfferDeclined, resolveLanguageIntent } from "../src/emmi/languageDetection.js";

// Offering to change language is friendly once and irritating every time after, so most of what
// matters here is what the detector refuses to decide.

describe("detecting the language a patient is using", () => {
  it("recognises each of the three languages the product speaks", () => {
    expect(detectPatientLanguage("What is ACCESS and how does it help me?")).toBe("en");
    expect(detectPatientLanguage("¿Qué es ACCESS y cómo me ayuda?")).toBe("es");
    expect(detectPatientLanguage("Kisa ACCESS ye epi kijan li ede m?")).toBe("ht");
  });

  it("says nothing about a message that carries no evidence", () => {
    for (const text of ["ok", "yes", "wi", "120/80", "Dr. Fresner", "Lisinopril 10 mg", "", "   "]) {
      expect(detectPatientLanguage(text), `"${text}" should not decide a language`).toBeNull();
    }
  });

  it("does not decide on the strength of a word two of the languages share", () => {
    // "no" is Spanish and English; "sa" is Creole and nothing decisive on its own.
    expect(detectPatientLanguage("no no no")).toBeNull();
  });

  it("treats spelling as the strong evidence it is", () => {
    expect(detectPatientLanguage("mi presión está alta")).toBe("es");
    expect(detectPatientLanguage("tansyon mwen wo anpil")).toBe("ht");
  });

  it("never returns Korean, because KR here is Haitian Creole", () => {
    expect(detectPatientLanguage("Mwen bezwen èd ak tansyon mwen")).toBe("ht");
    expect(["en", "es", "ht"]).toContain(detectPatientLanguage("Bonjou, mwen vle pale ak doktè mwen"));
  });
});

describe("deciding what to do about it", () => {
  it("accepts natural punctuated confirmations from speech transcription", () => {
    for (const answer of ["Sí.", "Sí, por favor!", "YES.", "Wi, tanpri."]) expect(isLanguageOfferAccepted(answer)).toBe(true);
    for (const answer of ["No.", "No, gracias.", "Non, mèsi."]) expect(isLanguageOfferDeclined(answer)).toBe(true);
  });
  it("does nothing when the patient is already writing in EMMI's language", () => {
    expect(resolveLanguageIntent({ text: "What is ACCESS and how does it help me?", activeLocale: "en" }).action).toBeNull();
  });

  it("offers once the first time another language appears", () => {
    const intent = resolveLanguageIntent({ text: "¿Qué es ACCESS y cómo me ayuda?", activeLocale: "en" });
    expect(intent).toEqual({ detected: "es", action: "offer" });
  });

  it("treats carrying on in that language as the answer", () => {
    const answered = resolveLanguageIntent({ text: "Necesito ayuda con mi presión", activeLocale: "en", offeredLocale: "es" });
    expect(answered.action).toBe("switch");
    const persisted = resolveLanguageIntent({ text: "Necesito ayuda con mi presión", activeLocale: "en", consecutiveMatches: 1 });
    expect(persisted.action).toBe("switch");
  });

  it("offers a move to a third language rather than assuming the second one still holds", () => {
    const intent = resolveLanguageIntent({ text: "Mwen bezwen èd ak tansyon mwen", activeLocale: "es", offeredLocale: "" });
    expect(intent).toEqual({ detected: "ht", action: "offer" });
  });
});

describe("answering the offer in words", () => {
  it("accepts a yes in any of the three languages", () => {
    for (const yes of ["yes", "Yes please", "sí", "si", "claro", "wi", "dakò", "ok"]) expect(isLanguageOfferAccepted(yes), yes).toBe(true);
  });

  it("hears a no", () => {
    for (const no of ["no", "no thanks", "no gracias", "non", "non mèsi"]) expect(isLanguageOfferDeclined(no), no).toBe(true);
  });

  it("does not mistake a real question for an answer about language", () => {
    expect(isLanguageOfferAccepted("yes but what does it cost?")).toBe(false);
    expect(isLanguageOfferDeclined("no one has called me")).toBe(false);
  });
});
