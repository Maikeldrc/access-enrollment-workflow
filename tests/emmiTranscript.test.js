import { describe, expect, it } from "vitest";
import { assessEmmiTranscriptReliability, detectLanguageRequest, emmiAsrClarificationInstruction, emmiRecoveryLine, mentionsSomeoneElsesLanguage, sanitizeEmmiAssistantTranscript, sanitizeEmmiTranscript } from "../src/emmi/transcript.js";

describe("language requests addressed to EMMI", () => {
  it("recognises the ways patients ask for a language", () => {
    const cases = [
      ["Can we switch to English please?", "en"], ["Prefiero hablar en español. Hable conmigo en español ahora.", "es"],
      ["Mejor hábleme en español, por favor.", "es"], ["¿Puede hablar en inglés?", "en"], ["In English, please.", "en"],
      ["Switch to Spanish.", "es"], ["Pale kreyòl avè m, tanpri.", "ht"], ["Sigamos en inglés.", "en"], ["Do you speak Spanish?", "es"]
    ];
    for (const [text, expected] of cases) expect(detectLanguageRequest(text), text).toBe(expected);
  });
  it("does not read a mention of somebody else's language as a request", () => {
    for (const text of ["Ella habla English, ¿le llega en English?", "Mi hija habla inglés y me ayuda.", "My daughter speaks Spanish at home.", "El doctor habla español.", "Quiero un Uber X", "The invitation goes out in English."]) {
      expect(detectLanguageRequest(text), text).toBe("");
    }
    expect(mentionsSomeoneElsesLanguage("Ella habla English")).toBe(true);
  });
});

describe("short real words after an interruption", () => {
  it("keeps one-word answers a patient gives while EMMI is talking", () => {
    for (const word of ["Ya", "¿Ya?", "Vale", "Dale", "Bien", "Eh", "Sí", "Yeah", "Done", "Wi", "Bon"]) {
      expect(assessEmmiTranscriptReliability(word, { locale: "es", afterInterruption: true }).reliable, word).toBe(true);
    }
  });
  it("still drops a lone phonetic fragment that is not a word in any of EMMI's languages", () => {
    expect(assessEmmiTranscriptReliability("ball", { locale: "en", afterInterruption: true })).toMatchObject({ reliable: false, reason: "low_information_interruption" });
    expect(assessEmmiTranscriptReliability("ball", { locale: "en", afterInterruption: false }).reliable).toBe(true);
  });
});

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
    expect(sanitizeEmmiTranscript('[TRUSTED APP SCREEN UPDATE — do not read aloud: {"viewId":"X"}]')).toBe("");
  });

  // What still gets discarded, and why: a script none of EMMI's languages use, and a lone fragment
  // clipped by an interruption. Both are provider artefacts, never patient speech.
  it("rejects unsupported-script ASR hallucinations in every voice state", () => {
    for (const phrase of ["喂，艾米。", "Привет", "مرحبا", "Γεια"]) {
      expect(assessEmmiTranscriptReliability(phrase, { locale: "en" }), phrase)
        .toMatchObject({ reliable: false, reason: "unsupported_script", confidence: "REJECTED" });
    }
  });

  it("rejects tiny nonsensical barge-in fragments but preserves short valid turns", () => {
    expect(assessEmmiTranscriptReliability("ball", { locale: "en", afterInterruption: true }))
      .toMatchObject({ reliable: false, reason: "low_information_interruption" });
    for (const phrase of ["no", "why", "help", "pain", "fall", "sí", "ayuda", "esa", "espera", "wi", "doulè", "Metformin"]) {
      expect(assessEmmiTranscriptReliability(phrase, { locale: "en", afterInterruption: true }).reliable, phrase).toBe(true);
    }
  });

  // What used to be discarded and no longer is. Every one of these was answered with an English
  // "I'm sorry, I didn't hear that clearly… call 911" before, inside a Spanish session.
  it("keeps ordinary Spanish, Spanglish and English speech that carries little language evidence", () => {
    for (const [locale, phrase] of [
      ["es", "Yo uso walker para caminar"],
      ["es", "Quiero un Uber X"],
      ["es", "Mi doctor dijo que no"],
      ["es", "Pon la primera del jueves"],
      ["es", "Mejor no quiero cambiarla"],
      ["es", "180 sobre 120 y me siento mareado."],
      ["en", "I use a walker"],
      ["en", "Chinese small lantern"],
      ["en", "13 game and access service"]
    ]) {
      const result = assessEmmiTranscriptReliability(phrase, { locale });
      expect(result.reliable, phrase).toBe(true);
      expect(result.reason, phrase).toBe("");
      expect(result.confidence, phrase).toBe("LOW");
    }
    expect(assessEmmiTranscriptReliability("Lisinopril twenty milligrams daily", { locale: "en" })).toMatchObject({ reliable: true, confidence: "NORMAL" });
    expect(assessEmmiTranscriptReliability("Necesito un ride para la cita del jueves", { locale: "es" })).toMatchObject({ reliable: true, confidence: "NORMAL", languageSwitchCandidate: "" });
  });

  it("reports a supported language other than the session's as a switch candidate, not as noise", () => {
    expect(assessEmmiTranscriptReliability("Necesito ayuda con mi presión y mi médico.", { locale: "en" }))
      .toMatchObject({ reliable: true, detectedLanguage: "es", languageSwitchCandidate: "es", reason: "" });
    expect(assessEmmiTranscriptReliability("I want to change my appointment", { locale: "es" }))
      .toMatchObject({ reliable: true, detectedLanguage: "en", languageSwitchCandidate: "en" });
    expect(assessEmmiTranscriptReliability("Mwen bezwen yon machin pou randevou a", { locale: "es" }))
      .toMatchObject({ reliable: true, languageSwitchCandidate: "ht" });
  });

  it("recognises an explicit request to change language in either direction", () => {
    expect(assessEmmiTranscriptReliability("Prefiero hablar en español. Hable conmigo en español ahora.", { locale: "en" }))
      .toMatchObject({ reliable: true, languageRequest: "es" });
    expect(assessEmmiTranscriptReliability("Por favor, cambie a español y continúe conmigo en español", { locale: "en" }).languageRequest).toBe("es");
    expect(assessEmmiTranscriptReliability("Can we switch to English please?", { locale: "es" }).languageRequest).toBe("en");
    expect(assessEmmiTranscriptReliability("Please speak English", { locale: "es" }).languageRequest).toBe("en");
    // Already in that language: nothing to request.
    expect(assessEmmiTranscriptReliability("Prefiero hablar en español", { locale: "es" }).languageRequest).toBe("");
    // Mentioning a language is not asking for it.
    expect(detectLanguageRequest("Mi hija habla inglés")).toBe("");
    expect(detectLanguageRequest("Pale kreyòl avè m tanpri")).toBe("ht");
  });

  it("flags the multilingual corruption reproduced in the English live audit as a language signal, never as a crash", () => {
    const result = assessEmmiTranscriptReliability(
      "Sí, lo bueno. Avanti, tu sei un grande dottore, Fresnedin Baez, il me. Vuoi dire che sei un bravo e un bravo dottore?",
      { locale: "en" }
    );
    expect(result.reliable).toBe(true);
    expect(["LOW", "NORMAL"]).toContain(result.confidence);
  });

  it("speaks its recovery lines in the patient's language and reserves the emergency reminder for a repeat", () => {
    expect(emmiRecoveryLine("didNotCatch", "ES")).toBe("Perdón, no le entendí bien. ¿Me lo puede repetir?");
    expect(emmiRecoveryLine("didNotCatch", "en")).not.toMatch(/911/);
    expect(emmiRecoveryLine("didNotCatchAgain", "es")).toMatch(/911/);
    expect(emmiRecoveryLine("tookTooLong", "KR")).toMatch(/Padon/);
    expect(emmiRecoveryLine("unknown", "es")).toBe(emmiRecoveryLine("didNotCatch", "es"));
  });

  it("builds a trusted clarification override without presenting it as patient speech", () => {
    const instruction = emmiAsrClarificationInstruction({ expectedLanguage: "es", detectedLanguage: "en" });
    expect(instruction).toContain("TRUSTED ASR SAFETY OVERRIDE");
    expect(instruction).toContain("Do not infer or execute");
    expect(instruction).toContain("Perdón, no le entendí bien");
    expect(instruction).not.toMatch(/911/);
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
