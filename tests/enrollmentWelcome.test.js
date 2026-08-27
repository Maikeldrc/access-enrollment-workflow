import { describe, expect, it } from "vitest";
import { enrollmentWelcomeConfig, enrollmentWelcomeFor } from "../src/enrollmentWelcome.js";

const programs = ["ACCESS", "CCM", "RPM", "CCM_RPM", "PCM", "PCM_RPM", "ASM", "APCM"];

describe("shared enrollment welcome configuration", () => {
  it("defines localized, actionable content for every supported program", () => {
    for (const program of programs) {
      const config = enrollmentWelcomeFor(program);
      expect(config).toBe(enrollmentWelcomeConfig[program]);
      expect(config.nextSteps).toHaveLength(3);
      expect(config.nextRoute).toMatch(/^(ACCESS_BASELINE|RPM_DEVICE_PATH|ONBOARDING)$/);
      for (const entry of [config.supportingCopy, config.primaryCTA, config.emmiWelcome, ...config.nextSteps]) {
        expect(entry.en).toBeTruthy();
        expect(entry.es).toBeTruthy();
        expect(entry.ht).toBeTruthy();
      }
      if (!config.useProgramDisplayName) {
        expect(config.title.en).toBeTruthy();
        expect(config.title.es).toBeTruthy();
        expect(config.title.ht).toBeTruthy();
      }
    }
  });

  it("routes monitoring programs to device setup and ACCESS to baseline", () => {
    expect(enrollmentWelcomeFor("ACCESS").nextRoute).toBe("ACCESS_BASELINE");
    for (const program of ["RPM", "CCM_RPM", "PCM_RPM"]) {
      expect(enrollmentWelcomeFor(program).nextRoute).toBe("RPM_DEVICE_PATH");
    }
    for (const program of ["CCM", "PCM", "ASM", "APCM"]) {
      expect(enrollmentWelcomeFor(program).nextRoute).toBe("ONBOARDING");
    }
  });

  it("provides a future-program fallback without inventing program terminology", () => {
    const fallback = enrollmentWelcomeFor("FUTURE_PROGRAM");
    expect(fallback.useProgramDisplayName).toBe(true);
    expect(fallback.primaryCTA.en).toBe("Go to my care");
    expect(fallback.nextRoute).toBe("ONBOARDING");
  });
});
