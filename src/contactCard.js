const unescapeVCard = value => String(value || "")
  .replace(/\\n/gi, " ")
  .replace(/\\([,;\\])/g, "$1")
  .trim();

const decodedValue = value => {
  const raw = unescapeVCard(value);
  try { return decodeURIComponent(raw.replace(/^tel:/i, "")); }
  catch { return raw.replace(/^tel:/i, ""); }
};

const propertyName = line => String(line || "").split(":", 1)[0].split(";", 1)[0].toUpperCase();

// A cross-browser fallback for devices where the Contact Picker API is unavailable. The patient
// exports one contact card from their address book and chooses that file; parsing it never sends
// anything and returns only the name and phone values needed to prefill the editable invitation.
export function parseContactCard(input = "") {
  const lines = String(input || "").replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const nameLine = lines.find(line => propertyName(line) === "FN");
  const structuredName = lines.find(line => propertyName(line) === "N");
  const nameValue = nameLine?.slice(nameLine.indexOf(":") + 1)
    || structuredName?.slice(structuredName.indexOf(":") + 1).split(";").filter(Boolean).reverse().join(" ")
    || "";
  const phones = lines.filter(line => propertyName(line) === "TEL").map(line => {
    const separator = line.indexOf(":");
    const metadata = line.slice(0, separator);
    const types = [...metadata.matchAll(/(?:TYPE=)?([a-z][a-z0-9-]*)/gi)]
      .map(match => match[1].toLowerCase())
      .filter(type => !["tel", "type", "pref", "voice"].includes(type));
    return { value: decodedValue(line.slice(separator + 1)), type: types };
  }).filter(phone => phone.value);
  return { name: unescapeVCard(nameValue), tel: phones };
}
