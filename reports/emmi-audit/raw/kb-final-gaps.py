# -*- coding: utf-8 -*-
"""Last round. With the model layer live, three questions were answered with invented policy:
that the monitor is the patient's to keep, that they may not use their own device, and that they can
leave at any time. In each case the page that won the question had nothing to say about it, so the
model filled the gap. The facts come from the CMS ACCESS technical FAQ; the keywords put them in
front of the question that asks for them."""
import io, re, os

KEYWORDS = {
"devices/rpm-devices.md": [
  "give the monitor back", "return the monitor", "send the monitor back", "keep the monitor",
  "is the monitor mine", "who owns the equipment", "who owns the monitor", "do i own the monitor",
  "use my own monitor", "use my own blood pressure monitor", "use my own device", "my own cuff",
  "bring my own device", "devolver el monitor", "quedarme con el monitor", "de quien es el monitor",
  "de quién es el monitor", "usar mi propio monitor", "mi propio aparato",
  "remet aparèy la", "aparèy pa m",
],
"enrollment/leaving-access.md": [
  "how long does this last", "how long does it last", "how long am i committing",
  "is there an end date", "when does it end", "how long do i have to stay",
  "cuanto dura", "cuánto dura", "cuanto tiempo dura", "cuánto tiempo dura", "hay una fecha de fin",
  "konbyen tan sa dire",
],
"core/using-the-app.md": [
  "do the visit from my phone", "from my phone", "on my phone", "i do not have a computer",
  "no computer", "i do not have a smartphone", "puedo hacerlo desde mi telefono",
  "puedo hacerlo desde mi teléfono", "no tengo computadora",
],
"enrollment/care-circle.md": [
  "i do not have anyone", "i have nobody", "no one to help me", "can you let her know",
  "can you tell her", "can you call my son", "can you call my daughter", "let my family know",
  "no tengo a nadie", "puede avisarle", "puede llamar a mi hijo", "puede llamar a mi hija",
  "mwen pa gen pèsonn",
],
"devices/blood-pressure.md": [
  "how many times should i measure", "how often should i measure", "how often do i take my blood pressure",
  "cuantas veces debo medir", "cuántas veces debo medir", "con que frecuencia",
],
}

# The device page owns monitor questions, so the facts about the device itself belong in its answer
# too rather than only on the general RPM page it does not always beat.
DEVICE_TAIL = {
"EN": " The monitor is provided to you as part of your ACCESS care and you are never charged for it. Depending on how it was provided it may be a loan, so you may be asked to return it when your care ends — your care team can tell you which applies to yours. If you already own a monitor, ask them whether yours can be connected, because it has to be one your readings can actually be verified from. How often to measure is set for your care rather than being the same for everyone, so your care team is the one to tell you.",
"ES": " El monitor se le entrega como parte de su cuidado de ACCESS y nunca se le cobra por él. Según cómo se le haya entregado, puede ser en préstamo, así que podrían pedirle que lo devuelva cuando termine su cuidado; su equipo de atención puede decirle cuál es su caso. Si ya tiene un monitor propio, pregúnteles si el suyo se puede conectar, porque debe ser uno del que se puedan verificar sus mediciones. Con qué frecuencia medir se define para su cuidado y no es igual para todos, así que su equipo es quien debe indicárselo.",
"KR": " Yo ba ou aparèy la kòm yon pati nan swen ACCESS ou epi yo pa janm fè w peye pou li. Selon jan yo te ba ou l, li ka yon prè, kidonk yo ka mande w remèt li lè swen ou fini; ekip swen ou ka di w kilès ki aplikab pou ou. Si ou deja gen yon aparèy, mande yo si yo ka konekte pa ou a, paske li dwe youn yo ka verifye mezi ou yo soti ladan. Konbyen fwa pou mezire se yon bagay yo fikse pou swen ou, kidonk se ekip swen ou ki pou di w sa.",
}


def extend_keywords(path, phrases):
    full = os.path.join("src/emmi/Knowledge", path)
    s = io.open(full, encoding="utf-8").read()
    m = re.search(r'^keywords:(.*)$', s, re.M)
    existing = [k.strip() for k in m.group(1).split(",") if k.strip()]
    for p in phrases:
        if p not in existing:
            existing.append(p)
    s = s[:m.start()] + "keywords: " + ", ".join(existing) + s[m.end():]
    io.open(full, "w", encoding="utf-8").write(s)
    return "keywords %-34s (+%d)" % (path, len(phrases))


def append_to_answer(path, lang, tail):
    full = os.path.join("src/emmi/Knowledge", path)
    s = io.open(full, encoding="utf-8").read()
    pattern = r'(^##\s*Patient answer \(' + lang + r'\)\s*\n\n)(.*?)(?=\n##\s|\Z)'
    m = re.search(pattern, s, re.M | re.S)
    if not m:
        return "NO SECTION " + path + " " + lang
    body = m.group(2).rstrip()
    if tail.strip()[:40] in body:
        return "already " + path + " " + lang
    s = s[:m.start(2)] + body + tail + "\n\n" + s[m.end(2):]
    io.open(full, "w", encoding="utf-8").write(s)
    return "answer   %-34s %s" % (path, lang)


for p, ks in KEYWORDS.items():
    print(extend_keywords(p, ks))
for lang, tail in DEVICE_TAIL.items():
    print(append_to_answer("devices/blood-pressure.md", lang, tail))
