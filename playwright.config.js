import { defineConfig, devices } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", timeout: 30_000, use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    // EMMI voice guidance calls getUserMedia before requesting a live token, so the browser
    // needs a fake capture device or the connect attempt never reaches the network.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }
  }, webServer: { command: "npm run dev -- --port 4174", port: 4174, reuseExistingServer: false }, projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 5"] } }] });
