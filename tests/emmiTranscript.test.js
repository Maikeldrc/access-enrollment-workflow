import { describe, expect, it } from "vitest";
import { sanitizeEmmiTranscript } from "../src/emmi/transcript.js";

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
});
