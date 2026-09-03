import { describe, expect, it } from "vitest";
import { assessEmmiTranscriptReliability, emmiAsrClarificationInstruction, sanitizeEmmiAssistantTranscript, sanitizeEmmiTranscript } from "../src/emmi/transcript.js";

describe("EMMI transcript boundary", () => {
  it("never renders stringified SDK objects", () => {
    expect(sanitizeEmmiTranscript("[object Object]")).toBe("");
    expect(sanitizeEmmiTranscript("[object")).toBe("");
    expect(sanitizeEmmiTranscript({ unexpected: "payload" })).toBe("");
    expect(sanitizeEmmiTranscript({ text: "Buenas noticias." })).toBe("Buenas noticias.");
  });

  it("removes narration markup and retains only the final narrated value", () => {
    expect(sanitizeEmmiTranscript("<speech>Esta parte le ayuda.</speech>")).toBe("Esta parte le ayuda.");
    expect(sanitizeEmmiTranscript("Contexto viejo. <speech>Medicamentos viejos. <speech>Elija una meta.</speech>"))
      .toBe("Elija una meta.");
    expect(sanitizeEmmiTranscript("<speech>Con esto termina esta parte."))
      .toBe("Con esto termina esta parte.");
  });

  it("removes trusted internal context envelopes", () => {
    expect(sanitizeEmmiTranscript('[TRUSTED LIVE CONTEXT UPDATE — do not read aloud: {"currentScreen":"GOALS"}] Continúe.'))
      .toBe("Continúe.");
  });

  it("flags the multilingual corruption reproduced in the English live audit", () => {
    const result = assessEmmiTranscriptReliability(
      "Sí, lo bueno. Avanti, tu sei un grande dottore, Fresnedin Baez, il me. Vuoi dire che sei un bravo e un bravo dottore?",
      { locale: "en" }
    );
    expect(result.reliable).toBe(false);
    expect(["unexpected_language", "low_locale_evidence"]).toContain(result.reason);
  });

  it("flags a clear language mismatch but leaves short clinical phrases alone", () => {
    expect(assessEmmiTranscriptReliability("Necesito ayuda con mi presión y mi médico.", { locale: "en" }))
      .toMatchObject({ reliable: false, detectedLanguage: "es", reason: "unexpected_language" });
    expect(assessEmmiTranscriptReliability("Lisinopril twenty milligrams", { locale: "en" }).reliable).toBe(true);
    expect(assessEmmiTranscriptReliability("Please explain ACCESS in one short sentence.", { locale: "en" }).reliable).toBe(true);
  });

  it("rejects short phonetically corrupted fragments without rejecting structured doses", () => {
    for (const phrase of ["Chinese small lantern", "13 game and access service"]) {
      expect(assessEmmiTranscriptReliability(phrase, { locale: "en" }), phrase)
        .toMatchObject({ reliable: false, reason: "low_locale_evidence" });
    }
    expect(assessEmmiTranscriptReliability("Lisinopril twenty milligrams daily", { locale: "en" }).reliable).toBe(true);
  });

  it("rejects tiny nonsensical barge-in fragments but preserves short valid turns", () => {
    expect(assessEmmiTranscriptReliability("ball", { locale: "en", afterInterruption: true }))
      .toMatchObject({ reliable: false, reason: "low_information_interruption" });
    for (const phrase of ["no", "why", "help", "pain", "fall", "sí", "ayuda", "wi", "doulè", "Metformin"]) {
      expect(assessEmmiTranscriptReliability(phrase, { locale: "en", afterInterruption: true }).reliable, phrase).toBe(true);
    }
  });

  it("rejects unsupported-script ASR hallucinations in every voice state", () => {
    for (const phrase of ["喂，艾米。", "Привет", "مرحبا", "Γεια"]) {
      expect(assessEmmiTranscriptReliability(phrase, { locale: "en" }), phrase)
        .toMatchObject({ reliable: false, reason: "unsupported_script" });
    }
  });

  it("builds a trusted clarification override without presenting it as patient speech", () => {
    const instruction = emmiAsrClarificationInstruction({ expectedLanguage: "en", detectedLanguage: "es" });
    expect(instruction).toContain("TRUSTED ASR SAFETY OVERRIDE");
    expect(instruction).toContain("Do not infer or execute");
    expect(sanitizeEmmiTranscript(instruction)).toBe("");
  });

  it("removes leaked function syntax from assistant-facing transcript text", () => {
    expect(sanitizeEmmiAssistantTranscript("startRefillReview({'medicationId':'this program'}I apologize, I couldn't hear you."))
      .toBe("I apologize, I couldn't hear you.");
    expect(sanitizeEmmiAssistantTranscript("startRefillReview({'medicationId':'x'})")).toBe("");
    expect(sanitizeEmmiAssistantTranscript("ACCESS gives you support between visits.")).toBe("ACCESS gives you support between visits.");
    expect(sanitizeEmmiAssistantTranscript(
      "Based on your verified coverage, your expected payment for ACCESS is $0 per month. " +
      "Would you like to call:saveEnrollmentProgress{currentScreen:ACCESS_PRE_ELIGIBILITY_NOTICE,patientId:DEMO-P0 continue the enrollment process? " +
      "Based on your verified coverage, your expected payment for ACCESS is $0 per month. Would you like to continue the enrollment process?"
    )).toBe(
      "Based on your verified coverage, your expected payment for ACCESS is $0 per month. Would you like to continue the enrollment process?"
    );
  });
});
