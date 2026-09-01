# -*- coding: utf-8 -*-
"""Spanish and Creole gaps found in the after-fix run.

The English identity answer denies being a person outright; the Spanish and Creole ones described
EMMI as an assistant without denying it, which is the weaker answer to the question a patient is
actually asking. And the transportation page had no Spanglish: "no tengo ride pal doctor" is what a
patient types, and it reached nothing.
"""
import io, re, os

REPLACE = [
    ("core/about-emmi.md", "ES",
     "Soy EMMI, la asistente de cuidado de ITERA. Soy un programa de computadora, una asistente de "
     "inteligencia artificial: no soy una persona, ni enfermera, ni médica, y no formo parte de su "
     "equipo médico. Puedo explicarle su cuidado y este programa en palabras sencillas, consultar "
     "información que ya está en su expediente como sus citas, medicamentos y metas, ayudarle a hacer "
     "trámites como pedir una consulta o un resurtido, y comunicarle con una persona real de su equipo "
     "de atención cuando usted quiera. No puedo diagnosticarle, recetarle nada, cambiar ni suspender un "
     "medicamento, ni decirle qué tratamiento necesita: eso les corresponde a sus profesionales "
     "clínicos. Si es algo urgente, llame al 911."),
    ("core/about-emmi.md", "KR",
     "Mwen se EMMI, asistan swen ITERA a. Mwen se yon pwogram konpitè, yon asistan entèlijans "
     "atifisyèl: mwen pa yon moun, ni yon enfimyè, ni yon doktè, epi mwen pa fè pati ekip medikal ou. "
     "Mwen ka esplike swen ou ak pwogram sa a an mo senp, gade enfòmasyon ki deja nan dosye ou tankou "
     "randevou, medikaman ak objektif ou yo, ede w fè bagay tankou mande yon vizit oswa yon renouvèlman, "
     "epi konekte w ak yon moun reyèl nan ekip swen ou lè ou vle. Mwen pa ka dyagnostike w, preskri "
     "anyen, chanje oswa sispann yon medikaman, ni di w ki tretman ou bezwen: sa se pou klinisyen ou yo. "
     "Si se yon bagay ijan, rele 911."),
]

KEYWORDS = [
    ("care/getting-to-appointments.md",
     "keywords: transportation, transport, no ride, no car, cannot get there, get to my appointment, "
     "nobody can take me, uber, lyft, taxi, bus, wheelchair, walker, help getting in the vehicle, ride home, "
     "ride, need a ride, get a ride, lift to the clinic, way to get there, "
     "transporte, no tengo carro, no tengo transporte, no tengo ride, ride pal doctor, nadie puede llevarme, "
     "como llego, cómo llego, quien me lleva, quién me lleva, llevarme, no tengo como ir, no tengo cómo ir, "
     "silla de ruedas, andador, viaje de regreso, "
     "transpò, pa gen machin, pa gen mwayen, chèz woulant, ki moun ki pral mennen m"),
]


def replace_section(path, lang, text):
    full = os.path.join("src/emmi/Knowledge", path)
    s = io.open(full, encoding="utf-8").read()
    pattern = r'(^##\s*Patient answer \(' + lang + r'\)\s*\n\n)(.*?)(?=\n##\s|\Z)'
    if not re.search(pattern, s, re.M | re.S):
        return "NO SECTION " + path + " " + lang
    s = re.sub(pattern, lambda m: m.group(1) + text + "\n\n", s, flags=re.M | re.S)
    io.open(full, "w", encoding="utf-8").write(s)
    return "ok " + path + " " + lang


def replace_keywords(path, line):
    full = os.path.join("src/emmi/Knowledge", path)
    s = io.open(full, encoding="utf-8").read()
    s = re.sub(r'^keywords:.*$', line, s, count=1, flags=re.M)
    io.open(full, "w", encoding="utf-8").write(s)
    return "ok keywords " + path


for p, lang, t in REPLACE:
    print(replace_section(p, lang, t))
for p, line in KEYWORDS:
    print(replace_keywords(p, line))
