const clean = value => String(value || "").replace(/\s+/g, " ").trim();
const folded = value => clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const ordinal = value => {
  const text = folded(value);
  if (/\b(primero|primera|lo primero|first)\b/.test(text)) return 0;
  if (/\b(segundo|segunda|lo segundo|second)\b/.test(text)) return 1;
  if (/\b(tercero|tercera|lo tercero|third)\b/.test(text)) return 2;
  if (/\b(ultimo|ultima|last)\b/.test(text)) return -1;
  return null;
};

const stripTarget = value => clean(value)
  .replace(/^(?:lo\s+de|el\s+tema\s+de|la\s+pregunta\s+de|el|la|lo|los|las)\s+/i, "")
  .replace(/^(?:el|la|los|las)\s+/i, "")
  .replace(/^(?:tema|punto|pregunta)\s+(?:de\s+)?/i, "")
  .replace(/[.!?]+$/g, "");

const splitCommands = value => clean(value).split(/\s*(?:;|,?\s+y\s+(?:despu[eé]s|luego)|,?\s+(?:despu[eé]s|luego))\s*/i).filter(Boolean);

export const parseAppointmentTopicCommands = ({ question, appointmentPrep } = {}) => {
  if (!appointmentPrep) return [];
  const commands = [];
  for (const clause of splitCommands(question)) {
    const text = folded(clause);
    let match;
    if ((/\b(muestra|muestrame|abre|quiero ver|ver mis|show|open)\b/.test(text) && /\b(lista|agenda|preguntas?|apuntado|cita|topics?)\b/.test(text))
      || /^(muestrala|muestramela|ensenamela|abrela|show it|open it)[.! ]*$/.test(text)) {
      commands.push({ operation: "OPEN" });
      continue;
    }
    if (/\b(que tengo apuntado|que hemos puesto|que pusimos|que tengo para hablar|cuales son mis preguntas|read my list|what is on my list)\b/.test(text)) {
      commands.push({ operation: "LIST" });
      continue;
    }
    if (/\b(cual|que)\b.*\b(primero|segundo|tercero|ultimo)\b|\bwhat(?:'s| is) the (first|second|third|last)\b/.test(text)) {
      commands.push({ operation: "READ_ITEM", index: ordinal(clause) });
      continue;
    }
    match = clause.match(/^(?:quita|elimina|borra|remove|delete)\s+(.+)$/i);
    if (match) {
      commands.push({ operation: "REMOVE", target: stripTarget(match[1]), index: ordinal(match[1]) });
      continue;
    }
    match = clause.match(/^(?:pon|mueve|move)\s+(.+?)\s+(?:de\s+)?(?:primero|al principio|first)$/i);
    if (match) {
      commands.push({ operation: "MOVE", target: stripTarget(match[1]), index: null, position: 0 });
      continue;
    }
    match = clause.match(/^(?:cambia|actualiza|change|update)\s+(.+?)\s+(?:para que diga|por|a|to)\s+(.+)$/i);
    if (match) {
      commands.push({ operation: "UPDATE", target: stripTarget(match[1]), index: ordinal(match[1]), value: clean(match[2]).replace(/[.!?]+$/g, "") });
      continue;
    }
    match = clause.match(/^(?:pon|anota)\s+que\s+(.+?)\s+(?:son|es|ocurre|pasa)\s+(.+)$/i);
    if (match) {
      commands.push({ operation: "UPDATE_DETAIL", target: stripTarget(match[1]), detail: clean(match[2]).replace(/[.!?]+$/g, "") });
      continue;
    }
    match = clause.match(/^(?:agrega|anade|añade|anota|incluye|add|include)\s+(.+)$/i);
    if (match) {
      commands.push({ operation: "ADD", value: clean(match[1]).replace(/^(?:que|lo de)\s+/i, "").replace(/[.!?]+$/g, "") });
      continue;
    }
    match = clause.match(/^(?:quiero|quisiera)\s+hablar\s+(?:con\s+(?:el|la)\s+(?:doctor|doctora|medico|médico)\s+)?sobre\s+(.+)$/i);
    if (match) {
      commands.push({ operation: "ADD", value: clean(match[1]).replace(/[.!?]+$/g, "") });
      continue;
    }
    match = clause.match(/^(?:tambien|también|ademas|además)\s+(.+)$/i);
    if (match) commands.push({ operation: "ADD", value: clean(match[1]).replace(/[.!?]+$/g, "") });
  }
  return commands;
};

export const appointmentTopicListText = (topics, locale = "ES") => {
  const items = (topics || []).map(clean).filter(Boolean);
  if (!items.length) return String(locale).toUpperCase() === "ES" ? "Su lista para la cita está vacía." : "Your appointment list is empty.";
  const list = items.map((item, index) => `${index + 1}. ${item}`).join(" ");
  return String(locale).toUpperCase() === "ES" ? `Esto es lo que tiene para conversar en la cita: ${list}` : `Here is what you have for the appointment: ${list}`;
};
