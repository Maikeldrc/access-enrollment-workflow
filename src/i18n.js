export const LOCALES = Object.freeze({
  en: { code: "EN", language: "English", htmlLang: "en" },
  es: { code: "ES", language: "Español", htmlLang: "es" },
  ht: { code: "KR", language: "Kreyòl", htmlLang: "ht" }
});

export const COMMON_MESSAGES = Object.freeze({
  back: { en: "Back", es: "Atrás", ht: "Retounen" },
  continue: { en: "Continue", es: "Continuar", ht: "Kontinye" },
  help: { en: "Help", es: "Ayuda", ht: "Èd" },
  secure: { en: "Your information is secure", es: "Su información está segura", ht: "Enfòmasyon ou an sekirite" },
  saved: { en: "Progress saved", es: "Progreso guardado", ht: "Pwogrè anrejistre" },
  call: { en: "Call our care team", es: "Llame a nuestro equipo de cuidado", ht: "Rele ekip swen nou an" }
});

// Copy supplied by the resolved program/offer. Keeping this catalog here prevents
// configuration data from leaking English into an otherwise translated journey.
export const OFFER_MESSAGES = Object.freeze({
  "Regular health check-ins": { es: "Controles de salud periódicos", ht: "Tcheke sante regilyèman" },
  "Ongoing support between visits": { es: "Apoyo continuo entre visitas", ht: "Sipò kontinyèl ant vizit yo" },
  "Support between visits": { es: "Apoyo entre visitas", ht: "Sipò ant vizit yo" },
  "Ongoing support": { es: "Apoyo continuo", ht: "Sipò kontinyèl" },
  "Regular support based on your health needs.": { es: "Apoyo regular basado en sus necesidades de salud.", ht: "Sipò regilye selon bezwen sante ou." },
  "Regular follow-up based on your care needs": { es: "Seguimiento regular según sus necesidades de cuidado", ht: "Suivi regilye selon bezwen swen ou" },
  "Regular check-ins between office visits": { es: "Controles periódicos entre visitas al consultorio", ht: "Tcheke regilyèman ant vizit nan klinik la" },
  "A personalized care plan": { es: "Un plan de cuidado personalizado", ht: "Yon plan swen pèsonalize" },
  "Goals and next steps for your health.": { es: "Objetivos y próximos pasos para su salud.", ht: "Objektif ak pwochen etap pou sante ou." },
  "Medication support": { es: "Apoyo con los medicamentos", ht: "Sipò pou medikaman" },
  "Help keeping treatment on track.": { es: "Ayuda para mantener su tratamiento al día.", ht: "Èd pou kontinye suiv tretman ou." },
  "Treatment plan support": { es: "Apoyo con el plan de tratamiento", ht: "Sipò pou plan tretman" },
  "Help staying on track with medications and next steps": { es: "Ayuda para seguir sus medicamentos y próximos pasos", ht: "Èd pou suiv medikaman ou ak pwochen etap yo" },
  "Help staying on track with medications and goals": { es: "Ayuda para seguir sus medicamentos y objetivos", ht: "Èd pou suiv medikaman ou ak objektif ou" },
  "Care coordination": { es: "Coordinación del cuidado", ht: "Kowòdinasyon swen" },
  "Connected care team": { es: "Equipo de cuidado conectado", ht: "Ekip swen ki konekte" },
  "Specialty care coordination": { es: "Coordinación del cuidado especializado", ht: "Kowòdinasyon swen espesyalize" },
  "Comprehensive care coordination": { es: "Coordinación integral del cuidado", ht: "Kowòdinasyon swen konplè" },
  "Support aligned with your specialist’s treatment plan": { es: "Apoyo alineado con el plan de tratamiento de su especialista", ht: "Sipò ki mache ak plan tretman espesyalis ou" },
  "Your care team helps connect your health needs": { es: "Su equipo ayuda a coordinar sus necesidades de salud", ht: "Ekip swen ou ede konekte bezwen sante ou" },
  "Important updates are shared with your doctors": { es: "Las actualizaciones importantes se comparten con sus médicos", ht: "Nou pataje mizajou enpòtan ak doktè ou yo" },
  "Your doctor stays involved": { es: "Su médico sigue involucrado", ht: "Doktè ou toujou patisipe" },
  "Important updates are coordinated with your physician": { es: "Las actualizaciones importantes se coordinan con su médico", ht: "Nou kowòdone mizajou enpòtan ak doktè ou" },
  "Home health monitoring": { es: "Monitoreo de salud desde el hogar", ht: "Siveyans sante lakay" },
  "A connected monitor securely shares your readings.": { es: "Un monitor conectado comparte sus mediciones de forma segura.", ht: "Yon monitè konekte pataje mezi ou yo an sekirite." },
  "A connected device may be used to support your ACCESS care. Your care team will explain what is required.": { es: "Puede utilizarse un dispositivo conectado para apoyar su cuidado ACCESS. Su equipo le explicará lo necesario.", ht: "Yo ka itilize yon aparèy konekte pou sipòte swen ACCESS ou. Ekip swen ou pral eksplike sa ki nesesè." },
  "Reading review": { es: "Revisión de mediciones", ht: "Revizyon mezi yo" },
  "Your care team checks for important changes.": { es: "Su equipo revisa cambios importantes.", ht: "Ekip swen ou tcheke chanjman enpòtan yo." },
  "Support when readings need attention": { es: "Apoyo cuando una medición necesita atención", ht: "Sipò lè yon mezi bezwen atansyon" },
  "Get help when a reading needs follow-up.": { es: "Reciba ayuda cuando una medición necesite seguimiento.", ht: "Jwenn èd lè yon mezi bezwen suivi." },
  "Focused support for your main condition": { es: "Apoyo enfocado en su condición principal", ht: "Sipò ki konsantre sou pwoblèm sante prensipal ou" },
  "Connected readings help your care team follow changes.": { es: "Las mediciones conectadas ayudan a su equipo a seguir los cambios.", ht: "Mezi konekte yo ede ekip swen ou suiv chanjman yo." },
  "ITERA works with your care team to coordinate your care.": { es: "ITERA trabaja con su equipo para coordinar su cuidado.", ht: "ITERA travay avèk ekip swen ou pou kowòdone swen ou." },
  "ITERA HEALTH provides this care in coordination with {physicianDisplayName}.": { es: "ITERA HEALTH brinda este cuidado en coordinación con {physicianDisplayName}.", ht: "ITERA HEALTH bay swen sa a an kowòdinasyon avèk {physicianDisplayName}." },
  "ITERA HEALTH provides connected home monitoring in coordination with {physicianDisplayName}.": { es: "ITERA HEALTH brinda monitoreo conectado en el hogar en coordinación con {physicianDisplayName}.", ht: "ITERA HEALTH bay siveyans konekte lakay an kowòdinasyon avèk {physicianDisplayName}." },
  "ITERA HEALTH coordinates ongoing specialty support with your physician and care team.": { es: "ITERA HEALTH coordina apoyo especializado continuo con su médico y equipo de cuidado.", ht: "ITERA HEALTH kowòdone sipò espesyalize kontinyèl ak doktè ou ak ekip swen ou." },
  "ITERA HEALTH coordinates comprehensive primary care support with your physician and care team.": { es: "ITERA HEALTH coordina apoyo integral de atención primaria con su médico y equipo de cuidado.", ht: "ITERA HEALTH kowòdone sipò swen prensipal konplè ak doktè ou ak ekip swen ou." },
  "ITERA HEALTH provides focused support for the condition that matters most right now.": { es: "ITERA HEALTH brinda apoyo enfocado en la condición más importante en este momento.", ht: "ITERA HEALTH bay sipò ki konsantre sou pwoblèm sante ki pi enpòtan kounye a." },
  "One coordinated experience combines ongoing care support with monitoring from home.": { es: "Una experiencia coordinada combina apoyo continuo con monitoreo desde el hogar.", ht: "Yon sèl eksperyans kowòdone mete sipò swen kontinyèl ansanm ak siveyans lakay." },
  "One coordinated experience combines condition-focused care with monitoring from home.": { es: "Una experiencia coordinada combina cuidado enfocado con monitoreo desde el hogar.", ht: "Yon sèl eksperyans kowòdone mete swen ki konsantre sou kondisyon an ansanm ak siveyans lakay." },
  "ITERA HEALTH coordinates this care with your existing doctors.": { es: "ITERA HEALTH coordina este cuidado con sus médicos actuales.", ht: "ITERA HEALTH kowòdone swen sa a ak doktè ou deja genyen yo." },
  "Ongoing care support (CCM)": { es: "Apoyo de cuidado continuo (CCM)", ht: "Sipò swen kontinyèl (CCM)" },
  "Home monitoring (RPM)": { es: "Monitoreo desde el hogar (RPM)", ht: "Siveyans lakay (RPM)" },
  "Advanced specialty management (ASM)": { es: "Manejo especializado avanzado (ASM)", ht: "Jesyon espesyalize avanse (ASM)" },
  "Advanced primary care management (APCM)": { es: "Manejo avanzado de atención primaria (APCM)", ht: "Jesyon swen prensipal avanse (APCM)" },
  "ACCESS care for high blood pressure": { es: "Cuidado ACCESS para la presión arterial alta", ht: "Swen ACCESS pou tansyon wo" },
  "Condition-focused care (PCM)": { es: "Cuidado enfocado en una condición (PCM)", ht: "Swen ki konsantre sou yon kondisyon (PCM)" },
  "Medicare cost-sharing may apply. Your care team can help you understand your coverage.": { es: "Puede aplicarse el costo compartido de Medicare. Su equipo puede ayudarle a entender su cobertura.", ht: "Pataj depans Medicare ka aplike. Ekip swen ou ka ede w konprann kouvèti ou." },
  "Medicare cost-sharing may apply for home monitoring services.": { es: "Puede aplicarse el costo compartido de Medicare a los servicios de monitoreo en el hogar.", ht: "Pataj depans Medicare ka aplike pou sèvis siveyans lakay." },
  "Medicare cost-sharing may apply for ongoing care and home monitoring services.": { es: "Puede aplicarse el costo compartido de Medicare al apoyo continuo y monitoreo en el hogar.", ht: "Pataj depans Medicare ka aplike pou sipò swen kontinyèl ak siveyans lakay." },
  "Medicare cost-sharing may apply for condition-focused care and home monitoring services.": { es: "Puede aplicarse el costo compartido de Medicare al cuidado enfocado y monitoreo en el hogar.", ht: "Pataj depans Medicare ka aplike pou swen ki konsantre sou kondisyon an ak siveyans lakay." },
  "Your regular Medicare benefits and cost-sharing continue to apply to covered care.": { es: "Sus beneficios y costos compartidos habituales de Medicare continúan aplicándose al cuidado cubierto.", ht: "Benefis ak pataj depans Medicare ou nòmalman genyen yo kontinye aplike pou swen ki kouvri." },
  "Participation is voluntary": { es: "La participación es voluntaria", ht: "Patisipasyon an volontè" },
  "Joining is voluntary": { es: "Participar es voluntario", ht: "Patisipasyon an volontè" },
  "You may stop this service at any time": { es: "Puede detener este servicio en cualquier momento", ht: "Ou ka sispann sèvis sa a nenpòt lè" },
  "You may stop these services at any time": { es: "Puede detener estos servicios en cualquier momento", ht: "Ou ka sispann sèvis sa yo nenpòt lè" },
  "You may stop monitoring at any time": { es: "Puede detener el monitoreo en cualquier momento", ht: "Ou ka sispann siveyans lan nenpòt lè" },
  "You may stop participating at any time": { es: "Puede dejar de participar en cualquier momento", ht: "Ou ka sispann patisipe nenpòt lè" },
  "Your regular Medicare benefits do not change": { es: "Sus beneficios habituales de Medicare no cambian", ht: "Benefis Medicare ou nòmalman genyen yo pa chanje" },
  "Your Medicare benefits do not change": { es: "Sus beneficios de Medicare no cambian", ht: "Benefis Medicare ou yo pa chanje" },
  "This service is not for emergencies": { es: "Este servicio no es para emergencias", ht: "Sèvis sa a pa pou ijans" },
  "Home monitoring is not for emergencies": { es: "El monitoreo en el hogar no es para emergencias", ht: "Siveyans lakay pa pou ijans" },
  "Only one practitioner can provide and bill for CCM in the same month": { es: "Solo un profesional puede brindar y facturar CCM en el mismo mes", ht: "Se yon sèl pwofesyonèl ki ka bay epi faktire CCM nan menm mwa a" }
});

const reportedMissing = new Set();
export function localize(locale, translations, key = "inline") {
  const resolvedLocale = LOCALES[locale] ? locale : "en";
  const value = translations?.[resolvedLocale];
  if (typeof value === "string" && value.trim()) return value;
  const signature = `${resolvedLocale}:${key}`;
  if (!reportedMissing.has(signature)) {
    reportedMissing.add(signature);
    console.error(`[i18n] Missing ${resolvedLocale} translation for: ${key}`);
  }
  return `⟦${resolvedLocale}:${key}⟧`;
}

export const commonMessagesFor = locale => Object.fromEntries(
  Object.entries(COMMON_MESSAGES).map(([key, translations]) => [key, localize(locale, translations, `common.${key}`)])
);

export function localizeOfferText(locale, source, variables = {}) {
  if (typeof source !== "string" || !source.trim()) return source || "";
  const translations = OFFER_MESSAGES[source];
  const template = locale === "en" ? source : localize(locale, translations, `offer.${source}`);
  return template.replace(/\{([^}]+)\}/g, (match, name) => Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match);
}

export const localeCode = locale => (LOCALES[locale] || LOCALES.en).code;
export const htmlLanguage = locale => (LOCALES[locale] || LOCALES.en).htmlLang;
