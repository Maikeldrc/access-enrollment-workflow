import { defineConfig, devices } from "@playwright/test";

// A second harness for the appointment specs. The default config binds 4174, and a concurrent
// session already holds it; this one uses its own port and reuses a running server so several
// QA passes can share one dev server instead of fighting over one socket.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4191",
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }
  },
  webServer: { command: "npm run dev -- --port 4191 --strictPort", port: 4191, reuseExistingServer: true },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 5"] } }]
});
