import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEmmiTtsRequest, extractEmmiTtsAudio, handleEmmiTts, resetEmmiTtsRateLimits } from "../server/emmiTts.js";

const call = async ({ method = "POST", env = {}, body = {}, generate } = {}) => {
  let raw = "";
  const audioChunks = [];
  const headers = {};
  const res = {
    statusCode: 0,
    setHeader: (name, value) => { headers[name] = value; },
    write: value => { audioChunks.push(Buffer.from(value)); },
    end: value => { if (value) raw = value; },
    get headersSent() { return audioChunks.length > 0; }
  };
  await handleEmmiTts({ method, body, headers: {}, socket: { remoteAddress: "tts-test" } }, res, env, generate);
  const isAudio = String(headers["Content-Type"] || "").startsWith("audio/pcm");
  return { status: res.statusCode, headers, body: isAudio ? Buffer.concat(audioChunks) : JSON.parse(raw) };
};

describe("EMMI deterministic screen narration", () => {
  beforeEach(() => resetEmmiTtsRateLimits());

  it("uses the canonical EMMI voice and explicitly requires exact recitation", () => {
    const request = buildEmmiTtsRequest({ text: "Choose Continue.", locale: "EN", model: "tts-model" });
    expect(request).toMatchObject({
      model: "tts-model",
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } }
      }
    });
    expect(request.contents[0].parts[0].text).toContain("Read only the patient-facing text");
    expect(request.contents[0].parts[0].text).toContain("<script>Choose Continue.</script>");
  });

  it("streams provider PCM without exposing the API key or prompt", async () => {
    const generate = vi.fn().mockResolvedValue({ candidates: [{ content: { parts: [{ inlineData: { data: "AQID", mimeType: "audio/pcm;rate=24000" } }] } }] });
    const result = await call({ env: { EMMI_PROTOTYPE_MODE: "true" }, body: { text: "Choose Continue.", locale: "EN" }, generate });
    expect(result).toMatchObject({ status: 200, headers: { "Content-Type": "audio/pcm;rate=24000" } });
    expect([...result.body]).toEqual([1, 2, 3]);
    expect(generate).toHaveBeenCalledOnce();
    expect(JSON.stringify(result)).not.toContain("GEMINI_API_KEY");
  });

  it("rejects markup, unsupported locales, and unsafe prototype configuration", async () => {
    expect(await call({ body: { text: "<script>bad</script>", locale: "EN" }, generate: vi.fn() })).toMatchObject({ status: 400, body: { error: "invalid_narration" } });
    expect(await call({ body: { text: "Bonjou", locale: "KR" }, generate: vi.fn() })).toMatchObject({ status: 503, body: { error: "VOICE_UNAVAILABLE_FOR_LOCALE" } });
    expect(await call({ env: { EMMI_ALLOW_REAL_PATIENT_DATA: "true" }, body: { text: "Hello", locale: "EN" }, generate: vi.fn() })).toMatchObject({ status: 403, body: { error: "unsafe_prototype_configuration" } });
  });

  it("recognizes only audio parts", () => {
    expect(extractEmmiTtsAudio({ candidates: [{ content: { parts: [{ text: "no audio" }] } }] })).toBeNull();
    expect(extractEmmiTtsAudio({ candidates: [{ content: { parts: [{ inlineData: { data: "AQID", mimeType: "audio/pcm" } }] } }] })).toEqual({ data: "AQID", mimeType: "audio/pcm;rate=24000" });
    expect(extractEmmiTtsAudio({ candidates: [{ content: { parts: [{ inlineData: { data: "AQID", mimeType: "audio/L16;codec=pcm;rate=24000" } }] } }] })).toEqual({ data: "AQID", mimeType: "audio/pcm;rate=24000" });
    expect(extractEmmiTtsAudio({ candidates: [{ content: { parts: [{ inlineData: { data: "AQID", mimeType: "audio/mpeg" } }] } }] })).toBeNull();
  });
});
