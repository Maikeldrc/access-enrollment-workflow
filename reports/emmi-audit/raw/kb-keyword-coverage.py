# -*- coding: utf-8 -*-
"""Keyword coverage for questions that were answered with "I don't have enough approved information"
even though the page that answers them exists. Each phrase below is one a patient actually typed
during the audit, or an obvious near-neighbour of one."""
import io, re, os

ADD = {
"care/privacy-and-data.md": [
  "can my doctor see what i write", "does my doctor see what i tell you", "what data do you collect",
  "what information do you collect", "do you record what i say", "do you keep my conversations",
  "can i get a copy of my information", "who has access to my record", "is my data safe",
  "mi medico puede ver lo que escribo", "mi médico puede ver lo que escribo", "que datos recogen",
  "qué datos recogen", "graban lo que digo", "es segura mi informacion", "es segura mi información",
],
"core/human-help-and-complaints.md": [
  "how do i contact someone", "how do i reach someone", "who do i contact", "who answers if i have a problem",
  "who can help me", "i need help from a person", "get someone to call me", "have someone call me",
  "como contacto a alguien", "cómo contacto a alguien", "quien me puede ayudar", "quién me puede ayudar",
  "necesito ayuda de una persona", "que alguien me llame",
],
"enrollment/consent.md": [
  "what am i authorizing", "what am i agreeing to", "what did i agree to", "what did i sign",
  "can i get a copy of what i signed", "copy of my consent", "why do you need my consent",
  "what happens if i do not sign", "que estoy autorizando", "qué estoy autorizando", "que firme",
  "que acepte", "copia de lo que firme", "copia de lo que firmé", "por que necesitan mi consentimiento",
  "por qué necesitan mi consentimiento",
],
"programs/access-cost-sharing.md": [
  "who bills me", "who sends me the bill", "who charges me", "will my doctor charge me",
  "will itera charge me", "quien me cobra", "quién me cobra", "quien me manda la factura",
  "quién me manda la factura",
],
"care/getting-to-appointments.md": [
  "no way for me to get to the clinic", "no way to get to my appointment", "cannot get to the clinic",
  "i have no way to get there", "problem getting to appointments",
],
"programs/access-eligibility.md": [
  "why am i here", "why are you contacting me", "why did you contact me", "does my doctor know i am here",
  "how did you get my information", "who told you about me",
  "por que estoy aqui", "por qué estoy aquí", "por que me contactan", "por qué me contactan",
  "mi medico sabe que estoy aqui", "mi médico sabe que estoy aquí",
],
"core/using-the-app.md": [
  "the screen is blank", "i cannot hear you", "i cannot hear anything", "how do i go back",
  "how do i change the language", "la pantalla esta en blanco", "la pantalla está en blanco",
  "no lo escucho", "como vuelvo atras", "cómo vuelvo atrás",
],
"care/access-outcome-measures.md": [
  "what are we trying to improve", "how do you know if i am getting better", "how do you measure progress",
  "what if i do not improve", "what if i get better quickly", "que estamos tratando de mejorar",
  "qué estamos tratando de mejorar", "como saben si estoy mejor", "cómo saben si estoy mejor",
],
}


def extend(path, phrases):
    full = os.path.join("src/emmi/Knowledge", path)
    s = io.open(full, encoding="utf-8").read()
    m = re.search(r'^keywords:(.*)$', s, re.M)
    if not m:
        return "NO KEYWORDS " + path
    existing = [k.strip() for k in m.group(1).split(",") if k.strip()]
    for p in phrases:
        if p not in existing:
            existing.append(p)
    line = "keywords: " + ", ".join(existing)
    s = s[:m.start()] + line + s[m.end():]
    io.open(full, "w", encoding="utf-8").write(s)
    return "ok %-46s (+%d)" % (path, len(phrases))


for p, ks in ADD.items():
    print(extend(p, ks))
