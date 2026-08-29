import { describe, expect, it } from "vitest";
import { assessEmmiTranscriptReliability, emmiAsrClarificationInstruction, sanitizeEmmiTranscript } from "../src/emmi/transcript.js";

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

  it("builds a trusted clarification override without presenting it as patient speech", () => {
    const instruction = emmiAsrClarificationInstruction({ expectedLanguage: "en", detectedLanguage: "es" });
    expect(instruction).toContain("TRUSTED ASR SAFETY OVERRIDE");
    expect(instruction).toContain("Do not infer or execute");
    expect(sanitizeEmmiTranscript(instruction)).toBe("");
  });
});
