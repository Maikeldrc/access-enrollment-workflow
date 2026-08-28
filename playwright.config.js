import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Every worker drives the same dev server, and the heaviest tests walk seven viewports across
  // three text scales and three languages. At Playwright's default worker count those tests were
  // timing out under contention rather than failing an assertion: a serial run of the same suite
  // passed seven tests that a parallel run failed. Capping the workers fixes the cause; giving
  // the tests longer timeouts would only have hidden it.
  workers: 4,
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    // EMMI voice guidance calls getUserMedia before requesting a live token, so the browser
    // needs a fake capture device or the connect attempt never reaches the network.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }
  }, webServer: { command: "npm run dev -- --port 4174", port: 4174, reuseExistingServer: false }, projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 5"] } }] });
