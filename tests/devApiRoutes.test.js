import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every serverless function under api/ must also be mounted on the Vite dev server. When the two
// drift apart the route simply 404s in development and the failure is silent: screen narration went
// unspoken locally for as long as /api/emmi/tts was missing here.
describe("dev server API routes", () => {
  it("mounts every api/emmi function on the dev server", () => {
    const functions = readdirSync("api/emmi").filter(name => name.endsWith(".js")).map(name => name.replace(/\.js$/, ""));
    const config = readFileSync("vite.config.js", "utf8");
    expect(functions.length).toBeGreaterThan(0);
    for (const route of functions) {
      expect(config, `/api/emmi/${route} is a Vercel function but is not mounted on the dev server`).toContain(`server.middlewares.use("/api/emmi/${route}"`);
    }
  });
});
