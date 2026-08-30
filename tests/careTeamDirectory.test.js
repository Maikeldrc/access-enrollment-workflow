import { describe, expect, it } from "vitest";
import {
  CARE_TEAM_SOURCES,
  PROFESSIONAL_TYPES,
  SUBSTITUTABLE_PROVIDER_ID,
  SUBSTITUTABLE_PROVIDER_NAME,
  buildCareTeam,
  fold,
  localCareTeamText,
  professionalNotFoundPlan,
  resolveRequestedProfessional
} from "../src/careTeamDirectory.js";

// The literal at src/config.js:57. src/config.js:288 spreads it and replaces only `name`, which is
// the §11 violation this module exists to stop repeating.
const FIXTURE_REFERRING_PROVIDER = {
  id: SUBSTITUTABLE_PROVIDER_ID,
  name: SUBSTITUTABLE_PROVIDER_NAME,
  specialty: "Primary Care",
  practiceName: "Fresner Medical Group",
  verifiedPhotoUrl: "/assets/doctor-portrait-v2.png"
};

const PARTICIPANT_PROVIDER = { id: "itera", legalName: "ITERA HEALTH LLC", displayName: "ITERA HEALTH", supportPhone: "(305) 394-8070" };

const medications = [
  { id: "med-lisinopril", name: "Lisinopril", prescriber: { id: "dr-fresner", name: "Dr. Fresner" }, pharmacy: { id: "pharm-cvs", name: "CVS Pharmacy" } },
  { id: "med-atorvastatin", name: "Atorvastatin", prescriber: { id: "dr-fresner", name: "Dr. Fresner" }, pharmacy: { id: "pharm-cvs", name: "CVS Pharmacy" } }
];

// What createOffer() produces: the fixture identity, unmodified.
const fixtureOffer = {
  referringProvider: FIXTURE_REFERRING_PROVIDER,
  physician: { id: FIXTURE_REFERRING_PROVIDER.id, displayName: FIXTURE_REFERRING_PROVIDER.name },
  participantProvider: PARTICIPANT_PROVIDER
};

// What createPrototypeOffer() produces when a physician display name was configured: the fixture
// record wearing somebody else's name.
const substitutedOffer = {
  referringProvider: { ...FIXTURE_REFERRING_PROVIDER, name: "Dr. Ana Ruiz" },
  physician: { id: "dr-ana-ruiz", displayName: "Dr. Ana Ruiz" },
  participantProvider: PARTICIPANT_PROVIDER
};

const find = (team, id) => team.find(member => member.id === id);

describe("building the care team", () => {
  it("keeps specialty and practice when the record really is that provider", () => {
    const team = buildCareTeam({ offer: fixtureOffer, medications, locale: "en" });
    expect(find(team, "dr-fresner")).toMatchObject({
      displayName: "Dr. Fresner",
      professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE,
      specialty: "Primary Care",
      practiceName: "Fresner Medical Group",
      source: CARE_TEAM_SOURCES.REFERRING_PROVIDER,
      verified: true
    });
  });

  // §11 DO NOT INVENT PROVIDER, as a test rather than a comment.
  it("never lends the fixture's specialty and practice to a substituted physician name", () => {
    const team = buildCareTeam({ offer: substitutedOffer, medications: [], locale: "en" });
    const physician = find(team, "dr-ana-ruiz");
    expect(physician).toMatchObject({
      displayName: "Dr. Ana Ruiz",
      professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE,
      specialty: "",
      practiceName: "",
      verified: false
    });
    // And the fixture's id does not follow the new name around either.
    expect(find(team, SUBSTITUTABLE_PROVIDER_ID)).toBeUndefined();
    expect(JSON.stringify(team)).not.toContain("Fresner Medical Group");
  });

  it("spots the substitution from the offer's physician even when the name was left alone", () => {
    const team = buildCareTeam({ offer: { referringProvider: FIXTURE_REFERRING_PROVIDER, physician: { id: "dr-ana-ruiz", displayName: "Dr. Ana Ruiz" } } });
    expect(team[0]).toMatchObject({ specialty: "", practiceName: "", verified: false });
  });

  it("gives a configured display name with no record behind it nothing but the name", () => {
    const team = buildCareTeam({ offer: { physician: { id: "dr-ana-ruiz", displayName: "Dr. Ana Ruiz" } } });
    expect(team).toEqual([{
      id: "dr-ana-ruiz",
      displayName: "Dr. Ana Ruiz",
      professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE,
      specialty: "",
      practiceName: "",
      source: CARE_TEAM_SOURCES.OFFER_PHYSICIAN,
      verified: false
    }]);
  });

  it("derives an id from the display name when the offer carries none, and never marks it verified", () => {
    const team = buildCareTeam({ offer: { referringProvider: { name: "Dr. Ana Ruiz" } } });
    expect(team[0]).toMatchObject({ id: "dr-ana-ruiz", verified: false, specialty: "", practiceName: "" });
  });

  it("adds prescribers and pharmacies from the medication list without duplicating anyone", () => {
    const team = buildCareTeam({ offer: fixtureOffer, medications, locale: "en" });
    expect(team.filter(member => member.id === "dr-fresner")).toHaveLength(1);
    expect(find(team, "pharm-cvs")).toMatchObject({
      displayName: "CVS Pharmacy",
      professionalType: PROFESSIONAL_TYPES.PHARMACIST,
      source: CARE_TEAM_SOURCES.MEDICATION_PHARMACY,
      verified: false
    });
    expect(team.filter(member => member.id === "pharm-cvs")).toHaveLength(1);
  });

  it("says a prescriber prescribes and does not guess what they specialise in", () => {
    const team = buildCareTeam({ medications: [{ prescriber: { id: "dr-oyelaran", name: "Dr. Oyelaran" } }] });
    expect(team[0]).toMatchObject({
      id: "dr-oyelaran",
      professionalType: PROFESSIONAL_TYPES.UNKNOWN,
      specialty: "",
      practiceName: "",
      source: CARE_TEAM_SOURCES.MEDICATION_PRESCRIBER,
      verified: false
    });
  });

  // The care manager is a person the patient can ask for by name. The organization stays on the
  // card as the practice behind them rather than standing in for a human being.
  it("names the care manager and keeps the program as the practice behind them", () => {
    const team = buildCareTeam({ offer: fixtureOffer, medications: [], locale: "es" });
    expect(find(team, "itera-care-manager")).toMatchObject({
      displayName: "Alicia Ramírez, RN",
      practiceName: "ITERA HEALTH",
      professionalType: PROFESSIONAL_TYPES.CARE_MANAGER,
      source: CARE_TEAM_SOURCES.PROGRAM,
      verified: true
    });
    // A real assignment on the offer replaces the prototype default rather than being ignored.
    const assigned = buildCareTeam({ offer: { ...fixtureOffer, careManager: { id: "cm-7", name: "Bernard Toussaint", credential: "LCSW" } }, locale: "en" });
    expect(find(assigned, "cm-7").displayName).toBe("Bernard Toussaint, LCSW");
    expect(buildCareTeam({ offer: { participantProvider: { id: "itera" } }, locale: "ht" })[0].practiceName).toBe("Ekip ITERA ou");
  });

  it("returns nothing rather than a placeholder when there is nothing to show", () => {
    expect(buildCareTeam({})).toEqual([]);
    expect(buildCareTeam()).toEqual([]);
    expect(buildCareTeam({ offer: { referringProvider: { id: "x" } }, medications: [{ prescriber: { id: "y" } }, { pharmacy: { name: "no id" } }] })).toEqual([]);
  });

  it("gives every entry the same shape", () => {
    buildCareTeam({ offer: fixtureOffer, medications, locale: "en" }).forEach(member => {
      expect(Object.keys(member).sort()).toEqual(["displayName", "id", "practiceName", "professionalType", "source", "specialty", "verified"]);
      expect(PROFESSIONAL_TYPES[member.professionalType]).toBe(member.professionalType);
      expect(typeof member.verified).toBe("boolean");
    });
  });
});

describe("resolving who the patient means", () => {
  const team = buildCareTeam({
    offer: { referringProvider: FIXTURE_REFERRING_PROVIDER, physician: fixtureOffer.physician, participantProvider: PARTICIPANT_PROVIDER },
    medications,
    locale: "en"
  });
  const withCardiologist = [...team, { id: "dr-martinez-cardiology", displayName: "Dr. Pedro Martinez", professionalType: PROFESSIONAL_TYPES.SPECIALIST, specialty: "Cardiology", practiceName: "", source: CARE_TEAM_SOURCES.REFERRING_PROVIDER, verified: true }];

  it("resolves a provider the patient named", () => {
    const resolved = resolveRequestedProfessional(withCardiologist, { text: "I need to see Dr. Martinez" });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.match.id).toBe("dr-martinez-cardiology");
  });

  it("resolves a specialty the patient named, in every language", () => {
    [
      { text: "I need to see my cardiologist", locale: "en" },
      { text: "Necesito ver a mi cardiólogo", locale: "es" },
      { text: "Mwen bezwen wè kadyolog mwen an", locale: "ht" }
    ].forEach(({ text, locale }) => {
      const resolved = resolveRequestedProfessional(withCardiologist, { text, locale });
      expect({ text, id: resolved.match?.id }).toEqual({ text, id: "dr-martinez-cardiology" });
    });
  });

  it("resolves from a specialty or a professional type given directly", () => {
    expect(resolveRequestedProfessional(withCardiologist, { specialty: "Cardiology" }).match.id).toBe("dr-martinez-cardiology");
    expect(resolveRequestedProfessional(withCardiologist, { professionalType: PROFESSIONAL_TYPES.PHARMACIST }).match.id).toBe("pharm-cvs");
    expect(resolveRequestedProfessional(withCardiologist, { professionalType: PROFESSIONAL_TYPES.CARE_MANAGER }).match.id).toBe("itera-care-manager");
  });

  it("hands the choice back to the patient when more than one person fits", () => {
    const twoCardiologists = [...withCardiologist, { id: "dr-lin", displayName: "Dr. Lin", professionalType: PROFESSIONAL_TYPES.SPECIALIST, specialty: "Cardiology", practiceName: "", source: CARE_TEAM_SOURCES.REFERRING_PROVIDER, verified: true }];
    const resolved = resolveRequestedProfessional(twoCardiologists, { text: "my cardiologist" });
    expect(resolved.status).toBe("AMBIGUOUS");
    expect(resolved.match).toBeNull();
    expect(resolved.candidates.map(member => member.id).sort()).toEqual(["dr-lin", "dr-martinez-cardiology"]);
  });

  it("says NOT_FOUND rather than offering somebody else's doctor", () => {
    const resolved = resolveRequestedProfessional(team, { text: "I need to see my cardiologist" });
    expect(resolved).toEqual({ status: "NOT_FOUND", match: null, candidates: [] });
    expect(resolveRequestedProfessional([], { text: "my cardiologist" }).status).toBe("NOT_FOUND");
    expect(resolveRequestedProfessional(withCardiologist, { text: "I need to see my podiatrist" }).status).toBe("NOT_FOUND");
  });

  it("answers nothing when it was asked nothing", () => {
    expect(resolveRequestedProfessional(withCardiologist, {})).toEqual({ status: "NOT_FOUND", match: null, candidates: [] });
    expect(resolveRequestedProfessional(withCardiologist)).toEqual({ status: "NOT_FOUND", match: null, candidates: [] });
    expect(resolveRequestedProfessional()).toEqual({ status: "NOT_FOUND", match: null, candidates: [] });
  });

  it("reads an accented or apostrophed name the same as a plain one", () => {
    expect(fold("Cardiólogo")).toBe("cardiologo");
    expect(fold("doktè")).toBe("dokte");
    expect(fold("I’m")).toBe("im");
    expect(resolveRequestedProfessional(withCardiologist, { text: "quiero ver al Dr. Martínez" }).match?.id).toBe("dr-martinez-cardiology");
  });

  it("does not match a name fragment inside an unrelated word", () => {
    const team2 = [{ id: "dr-lin", displayName: "Dr. Lin", professionalType: PROFESSIONAL_TYPES.SPECIALIST, specialty: "Cardiology", practiceName: "", source: CARE_TEAM_SOURCES.REFERRING_PROVIDER, verified: false }];
    expect(resolveRequestedProfessional(team2, { text: "I need a refill of my lisinopril" }).status).toBe("NOT_FOUND");
  });

  it("prefers the specialist over everyone else when the patient named a specialty", () => {
    const resolved = resolveRequestedProfessional(withCardiologist, { text: "I want to talk to my cardiologist about my pharmacy" });
    expect(resolved.match?.id).toBe("dr-martinez-cardiology");
  });
});

describe("when the professional is not in the care team", () => {
  it("routes to the Care Team workflow instead of a directory we do not have", () => {
    const plan = professionalNotFoundPlan({ requestedSpecialty: "cardiologist", locale: "en" });
    expect(plan).toEqual({
      action: "CARE_TEAM_TASK",
      taskType: "CARE_TEAM_MEMBER_REQUEST",
      message: "I don’t see a cardiologist in your care team yet. Your ITERA care team can help you add them."
    });
  });

  it("speaks all three languages and never leaves a placeholder in the message", () => {
    ["en", "es", "ht"].forEach(locale => {
      const withSpecialty = professionalNotFoundPlan({ requestedSpecialty: "cardiólogo", locale });
      const generic = professionalNotFoundPlan({ locale });
      expect(withSpecialty.message).toContain("cardiólogo");
      expect(withSpecialty.message).not.toContain("{specialty}");
      expect(generic.message).not.toContain("{specialty}");
      expect(generic.message).toBeTruthy();
    });
    expect(professionalNotFoundPlan({ locale: "es" }).message).not.toBe(professionalNotFoundPlan({ locale: "ht" }).message);
  });

  it("falls back through locale rather than showing nothing", () => {
    expect(localCareTeamText({ en: "Care team" }, "ht")).toBe("Care team");
    expect(localCareTeamText("plain", "es")).toBe("plain");
    expect(localCareTeamText(undefined, "en")).toBe("");
  });
});
