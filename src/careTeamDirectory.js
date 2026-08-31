// Who can actually help this patient. Everything in here comes from a record the runtime already
// holds — the offer, the medication list, the program itself — and nothing is inferred from a name.
//
// The rule that shapes this whole module: the product may not state a specialty, a practice or a
// location it does not know. A display name is not a provider record. When a configured physician
// name has been substituted over a fixture, the name is all we have, and the specialty and practice
// come back empty rather than borrowed from whoever the fixture used to be.

const T = (en, es, ht) => Object.freeze({ en, es, ht });
export const localCareTeamText = (value, locale = "en") =>
  (typeof value === "string" ? value : value?.[locale] || value?.en || "");

export const PROFESSIONAL_TYPES = Object.freeze({
  PRIMARY_CARE: "PRIMARY_CARE",
  SPECIALIST: "SPECIALIST",
  CARE_MANAGER: "CARE_MANAGER",
  PHARMACIST: "PHARMACIST",
  NURSE: "NURSE",
  DEVICE_SUPPORT: "DEVICE_SUPPORT",
  UNKNOWN: "UNKNOWN"
});

// Where an entry came from, so a view can decide what it is allowed to show and an audit can say
// why this person appeared in the patient's care team at all.
export const CARE_TEAM_SOURCES = Object.freeze({
  REFERRING_PROVIDER: "REFERRING_PROVIDER",
  OFFER_PHYSICIAN: "OFFER_PHYSICIAN",
  MEDICATION_PRESCRIBER: "MEDICATION_PRESCRIBER",
  MEDICATION_PHARMACY: "MEDICATION_PHARMACY",
  PROGRAM: "PROGRAM",
  PATIENT_REPORTED: "PATIENT_REPORTED",
  CARE_RECORD: "CARE_RECORD"
});

// The fixture identity in src/config.js:57. src/config.js:288 spreads that literal and replaces
// only `name`, so a configured physician display name arrives wearing this provider's id,
// specialty and practice. Recognising the literal is how we refuse to repeat them.
export const SUBSTITUTABLE_PROVIDER_ID = "dr-fresner";
export const SUBSTITUTABLE_PROVIDER_NAME = "Dr. Fresner Lee";

const slug = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Accent- and apostrophe-insensitive, the same way the barrier classifier folds text before it
// matches: "cardiólogo", "cardiologo" and "CARDIOLOGO" are one word to a patient.
export const fold = value => String(value || "")
  .normalize("NFD")
  .replace(/\p{M}/gu, "")
  .replace(/['’`´]/g, "")
  .toLowerCase()
  .trim();

// True when the offer's referring provider is the fixture record wearing somebody else's name.
// Either signal is enough: the literal id carrying a different name, or the offer's own physician
// resolving to an id or display name the referring record does not match.
function identityWasSubstituted(referringProvider, physician) {
  if (!referringProvider) return false;
  const name = referringProvider.name || "";
  if (referringProvider.id === SUBSTITUTABLE_PROVIDER_ID && name && name !== SUBSTITUTABLE_PROVIDER_NAME) return true;
  if (physician?.id && referringProvider.id && physician.id !== referringProvider.id) return true;
  if (physician?.displayName && name && physician.displayName !== name) return true;
  return false;
}

const entry = ({ id, displayName, professionalType, specialty = "", practiceName = "", photoUrl = "", source, verified = false }) => ({
  id,
  displayName,
  professionalType: PROFESSIONAL_TYPES[professionalType] ? professionalType : PROFESSIONAL_TYPES.UNKNOWN,
  specialty,
  practiceName,
  photoUrl,
  source,
  verified: verified === true
});

const CARE_MANAGER_FALLBACK = T("Your ITERA care team", "Su equipo de ITERA", "Ekip ITERA ou");

// A care manager is a person, and the patient meets them by name. The list used to show the
// organization here — "ITERA HEALTH" sitting between their doctor and their pharmacy — which reads
// as an entry nobody can call. This is the prototype's default assignment, the same kind of fixture
// "Dr. Fresner Lee" is, and a real assignment on the offer replaces it. It is deliberately the only
// invented person in this file: everyone else still has to come from a record.
export const PROTOTYPE_CARE_MANAGER = Object.freeze({ id: "itera-care-manager", name: "Alicia Ramírez", credential: "RN", photoUrl: "/images/Care%20Team/care-manager-alicia-v2.png" });

export const careManagerFor = (offer = null) => {
  const assigned = offer?.careManager;
  if (assigned?.name) return Object.freeze({ id: assigned.id || "itera-care-manager", name: assigned.name, credential: assigned.credential || "", photoUrl: assigned.photoUrl || "", assigned: true });
  return Object.freeze({ ...PROTOTYPE_CARE_MANAGER, assigned: false });
};

// The care team as the runtime actually knows it. Order is the order a patient thinks in: the
// doctor who referred them, whoever prescribes their medication, the ITERA team, their pharmacy.
export function buildCareTeam({ offer = null, medications = [], locale = "en" } = {}) {
  const team = [];
  const seen = new Set();
  const add = candidate => {
    if (!candidate?.id || !candidate.displayName || seen.has(candidate.id)) return;
    seen.add(candidate.id);
    team.push(candidate);
  };

  const referring = offer?.referringProvider || null;
  const physician = offer?.physician || null;

  if (referring?.name) {
    const substituted = identityWasSubstituted(referring, physician);
    add(entry({
      // A substituted identity keeps its own id, never the fixture's: two different people must
      // never share one provider id.
      id: substituted ? physician?.id || slug(referring.name) : referring.id || slug(referring.name),
      displayName: referring.name,
      professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE,
      // §11. We were given a name and nothing else. Saying "Primary Care · Fresner Medical Group"
      // here would be the product inventing a fact about a real person.
      specialty: substituted ? "" : referring.specialty || "",
      practiceName: substituted ? "" : referring.practiceName || "",
      photoUrl: substituted ? "" : referring.verifiedPhotoUrl || "",
      source: CARE_TEAM_SOURCES.REFERRING_PROVIDER,
      verified: !substituted && Boolean(referring.id)
    }));
  } else if (physician?.displayName) {
    // No referring record at all — only a configured display name, which is the weakest source
    // there is. Nothing but the name, and never marked verified.
    add(entry({
      id: physician.id || slug(physician.displayName),
      displayName: physician.displayName,
      professionalType: PROFESSIONAL_TYPES.PRIMARY_CARE,
      source: CARE_TEAM_SOURCES.OFFER_PHYSICIAN,
      verified: false
    }));
  }

  (medications || []).forEach(medication => {
    const prescriber = medication?.prescriber;
    if (prescriber?.id && prescriber.name) {
      add(entry({
        id: prescriber.id,
        displayName: prescriber.name,
        // A prescription tells us this person prescribes. It does not tell us what they specialise
        // in, so the type stays unknown rather than being guessed as primary care.
        professionalType: PROFESSIONAL_TYPES.UNKNOWN,
        source: CARE_TEAM_SOURCES.MEDICATION_PRESCRIBER,
        verified: false
      }));
    }
  });

  const program = offer?.participantProvider;
  if (program) {
    const careManager = careManagerFor(offer);
    add(entry({
      id: careManager.id,
      // The person, with the organization behind them as the practice. The patient sees who they
      // are working with; the org is still on the card, just not standing in for a human being.
      displayName: careManager.credential ? `${careManager.name}, ${careManager.credential}` : careManager.name,
      professionalType: PROFESSIONAL_TYPES.CARE_MANAGER,
      practiceName: program.displayName || localCareTeamText(CARE_MANAGER_FALLBACK, locale),
      photoUrl: careManager.photoUrl || "",
      source: CARE_TEAM_SOURCES.PROGRAM,
      // The prototype's default care manager carries the badge too, so the demo reads as a complete
      // care team rather than one member half-registered. A deployment with real assignments gets
      // the same badge from a real record; nothing here decides that a person exists, it decides
      // how the fixture presents.
      verified: true
    }));
  }

  (medications || []).forEach(medication => {
    const pharmacy = medication?.pharmacy;
    if (pharmacy?.id && pharmacy.name) {
      add(entry({
        id: pharmacy.id,
        displayName: pharmacy.name,
        professionalType: PROFESSIONAL_TYPES.PHARMACIST,
        source: CARE_TEAM_SOURCES.MEDICATION_PHARMACY,
        verified: false
      }));
    }
  });

  return team;
}

// ---------------------------------------------------------------------------------------------
// Resolving who the patient means
// ---------------------------------------------------------------------------------------------

// What a patient calls the person they want to see, in all three languages. These map a phrase to
// a kind of professional — never to a specific person, which is the care team's job to decide.
const SPECIALTY_TERMS = Object.freeze([
  { specialty: "Cardiology", type: PROFESSIONAL_TYPES.SPECIALIST, terms: Object.freeze(["cardiologist", "cardiology", "heart doctor", "cardiologo", "cardiologa", "cardiologia", "doctor del corazon", "kadyolog", "kadyoloji", "doktè kè"]) },
  { specialty: "Nephrology", type: PROFESSIONAL_TYPES.SPECIALIST, terms: Object.freeze(["nephrologist", "nephrology", "kidney doctor", "nefrologo", "nefrologa", "nefrologia", "nefwolog"]) },
  { specialty: "Endocrinology", type: PROFESSIONAL_TYPES.SPECIALIST, terms: Object.freeze(["endocrinologist", "endocrinology", "endocrinologo", "endocrinologa", "endokrinolog"]) },
  { specialty: "Primary Care", type: PROFESSIONAL_TYPES.PRIMARY_CARE, terms: Object.freeze(["primary care", "primary care doctor", "family doctor", "my doctor", "doctor", "doctora", "medico", "medica", "medico de cabecera", "medico primario", "doktè", "doktè prensipal", "doktè fanmi"]) },
  { specialty: "", type: PROFESSIONAL_TYPES.PHARMACIST, terms: Object.freeze(["pharmacist", "pharmacy", "farmaceutico", "farmacia", "famasyen", "famasi"]) },
  { specialty: "", type: PROFESSIONAL_TYPES.CARE_MANAGER, terms: Object.freeze(["care manager", "care team", "care coordinator", "coordinador", "coordinadora", "equipo de atencion", "jesyone swen", "ekip swen"]) },
  { specialty: "", type: PROFESSIONAL_TYPES.NURSE, terms: Object.freeze(["nurse", "enfermera", "enfermero", "enfemye", "mis swen"]) },
  { specialty: "", type: PROFESSIONAL_TYPES.DEVICE_SUPPORT, terms: Object.freeze(["device support", "technical support", "soporte tecnico", "ayuda con el equipo", "sipo teknik"]) }
]);

// Titles carry no identity, and neither does the kind of place someone works: "pharmacy" in
// "CVS Pharmacy" is what they do, not who they are. Matching on those words would let "about my
// pharmacy" outrank the cardiologist the patient actually asked for.
const NAME_STOP_TOKENS = Object.freeze([
  "dr", "dra", "doctor", "doctora", "doktè", "dokte", "mr", "mrs", "ms", "md", "the", "de", "la", "el", "and", "y",
  ...new Set(SPECIALTY_TERMS.flatMap(hint => hint.terms).flatMap(term => fold(term).split(/[^a-z0-9]+/)))
]);

const containsTerm = (foldedText, term) => {
  const folded = fold(term);
  if (!folded) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${folded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
  return pattern.test(foldedText);
};

const nameTokens = displayName => fold(displayName)
  .split(/[^a-z0-9]+/)
  .filter(token => token.length >= 3 && !NAME_STOP_TOKENS.includes(token));

const specialtyHints = foldedText => SPECIALTY_TERMS.filter(hint => hint.terms.some(term => containsTerm(foldedText, term)));

// Scored rather than filtered, so "my cardiologist" prefers the cardiologist over everyone else
// but still returns the whole plausible set when the patient's words fit more than one person.
function scoreCandidate(member, { foldedText, foldedSpecialty, wantedType, hints }) {
  let score = 0;
  if (foldedText && nameTokens(member.displayName).some(token => containsTerm(foldedText, token))) score += 4;
  const memberSpecialty = fold(member.specialty);
  if (foldedSpecialty && memberSpecialty && (memberSpecialty.includes(foldedSpecialty) || foldedSpecialty.includes(memberSpecialty))) score += 3;
  if (hints.some(hint => hint.specialty && memberSpecialty && fold(hint.specialty) === memberSpecialty)) score += 2;
  if (hints.some(hint => hint.type === member.professionalType)) score += 2;
  if (wantedType && wantedType === member.professionalType) score += 2;
  return score;
}

// RESOLVED means one person and no doubt. AMBIGUOUS hands the choice back to the patient rather
// than picking for them. NOT_FOUND is a real answer too, and it routes into the Care Team workflow.
// eslint-disable-next-line no-unused-vars
export function resolveRequestedProfessional(careTeam = [], { text = "", specialty = "", professionalType = "", locale = "en" } = {}) {
  const team = (careTeam || []).filter(member => member?.id && member.displayName);
  const foldedText = fold(text);
  const foldedSpecialty = fold(specialty);
  const wantedType = PROFESSIONAL_TYPES[professionalType] || "";
  if (!foldedText && !foldedSpecialty && !wantedType) return { status: "NOT_FOUND", match: null, candidates: [] };
  if (!team.length) return { status: "NOT_FOUND", match: null, candidates: [] };

  const hints = [...specialtyHints(foldedText), ...specialtyHints(foldedSpecialty)];
  const scored = team
    .map(member => ({ member, score: scoreCandidate(member, { foldedText, foldedSpecialty, wantedType, hints }) }))
    .filter(item => item.score > 0);
  if (!scored.length) return { status: "NOT_FOUND", match: null, candidates: [] };

  const best = Math.max(...scored.map(item => item.score));
  const candidates = scored.filter(item => item.score === best).map(item => item.member);
  if (candidates.length === 1) return { status: "RESOLVED", match: candidates[0], candidates };
  return { status: "AMBIGUOUS", match: null, candidates };
}

// §12. Not finding the professional is not a dead end and not a reason to search a directory we do
// not have. It is the start of the Care Team workflow the product already owns.
const NOT_FOUND_MESSAGE = T(
  "I don’t see a {specialty} in your care team yet. Your ITERA care team can help you add them.",
  "Todavía no veo un {specialty} en su equipo de atención. Su equipo de ITERA puede ayudarle a agregarlo.",
  "Mwen poko wè yon {specialty} nan ekip swen ou. Ekip ITERA ou ka ede w ajoute l."
);

const NOT_FOUND_MESSAGE_GENERIC = T(
  "I don’t see that professional in your care team yet. Your ITERA care team can help you add them.",
  "Todavía no veo a ese profesional en su equipo de atención. Su equipo de ITERA puede ayudarle a agregarlo.",
  "Mwen poko wè pwofesyonèl sa a nan ekip swen ou. Ekip ITERA ou ka ede w ajoute l."
);

export function professionalNotFoundPlan({ requestedSpecialty = "", locale = "en" } = {}) {
  const specialty = String(requestedSpecialty || "").trim();
  // The patient's own word for the professional is echoed back. The product does not translate it
  // into a specialty it has decided they meant.
  const message = specialty
    ? localCareTeamText(NOT_FOUND_MESSAGE, locale).replaceAll("{specialty}", specialty)
    : localCareTeamText(NOT_FOUND_MESSAGE_GENERIC, locale);
  return { action: "CARE_TEAM_TASK", taskType: "CARE_TEAM_MEMBER_REQUEST", message };
}
