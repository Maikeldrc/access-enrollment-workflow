import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import { handleEmmiLiveToken } from "./server/emmiLiveToken.js";
import { handleEmmiKnowledge } from "./server/emmiKnowledge.js";
import { handleEmmiChat } from "./server/emmiChat.js";
import { handleEmmiTts } from "./server/emmiTts.js";

const asBoolean = (value, fallback) => value == null ? fallback : String(value).toLowerCase() === "true";

// A git worktree under .claude/worktrees carries no node_modules of its own. Node still finds the
// packages by walking up to the main checkout, so the app builds and the tests run, but Vite's dev
// server refuses to serve a file outside its own root: the @fontsource faces come back 403 and every
// screen silently renders in the fallback system face. Manrope runs about 12% wider than that
// fallback, so any layout measured in a worktree is quietly wrong. Serve the fonts from wherever the
// packages actually live.
const dependencyRoot = resolve(dirname(createRequire(import.meta.url).resolve("@fontsource/manrope/700.css")), "../..");

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
    server: { fs: { allow: [process.cwd(), dependencyRoot] } },
    plugins: [{
      name: "emmi-live-token-dev-route",
      configureServer(server) {
        server.middlewares.use("/api/emmi/live-token", (req, res) => handleEmmiLiveToken(req, res, env));
        // Knowledge retrieval stays server side: the Markdown is never bundled or served statically.
        server.middlewares.use("/api/emmi/knowledge", (req, res) => handleEmmiKnowledge(req, res));
        server.middlewares.use("/api/emmi/chat", (req, res) => handleEmmiChat(req, res, env));
        // liveClient falls back to this endpoint whenever the live socket returns no audio. Without it
        // the dev server answers 404 and EMMI goes silent locally while staying audible on Vercel.
        server.middlewares.use("/api/emmi/tts", (req, res) => handleEmmiTts(req, res, env));
      }
    }]
  };
});
