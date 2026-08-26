import { defineConfig, loadEnv } from "vite";
import { handleEmmiLiveToken } from "./server/emmiLiveToken.js";

const asBoolean = (value, fallback) => value == null ? fallback : String(value).toLowerCase() === "true";

export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  const publicConfig = {
    prototypeMode: asBoolean(env.EMMI_PROTOTYPE_MODE, true),
    allowRealPatientData: asBoolean(env.EMMI_ALLOW_REAL_PATIENT_DATA, false),
    enableVoice: asBoolean(env.EMMI_ENABLE_VOICE, true),
    enableText: asBoolean(env.EMMI_ENABLE_TEXT, true),
    enableTools: asBoolean(env.EMMI_ENABLE_TOOLS, true),
    sessionMaxMinutes: Math.max(1, Math.min(12, Number(env.EMMI_SESSION_MAX_MINUTES) || 12)),
    model: env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview"
  };
  return {
    define: { __EMMI_PUBLIC_CONFIG__: JSON.stringify(publicConfig) },
    plugins: [{
      name: "emmi-live-token-dev-route",
      configureServer(server) {
        server.middlewares.use("/api/emmi/live-token", (req, res) => handleEmmiLiveToken(req, res, env));
      }
    }]
  };
});
