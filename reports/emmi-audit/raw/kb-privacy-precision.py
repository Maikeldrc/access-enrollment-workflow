# -*- coding: utf-8 -*-
"""The generation layer, once live, filled a gap in the privacy page with confident invention:
"Yes, your doctor can see what you write to me" and "Yes, your conversations are saved". Neither is
established anywhere in this product, and both are exactly the kind of claim a patient may rely on
when deciding what to type. The page now answers what is known and says plainly that the handling of
the conversation itself is a question for the care team."""
import io, re, os

PATH = "src/emmi/Knowledge/care/privacy-and-data.md"

RULE = """## EMMI response rule

Never promise absolute security, never say data is never shared, and never state a retention or
deletion period as fact. A request to delete information is a rights request and goes to the care
team. Do not describe internal storage, vendors or infrastructure.

Two questions have no answer in this product and must never be answered by inference: whether the
patient's doctor can read what the patient types to EMMI, and whether the conversation itself is
stored and for how long. Both are ITERA operational policy and are not recorded anywhere here. Say
that it cannot be confirmed and offer the care team. Answering either with a plain "yes" tells the
patient something about their own privacy that nobody has established.

"""

EN = """Your information is used to provide and coordinate your care. The people who see it are your ITERA
care team and, where it helps your care, the doctors you already see, who receive updates about your
care so everyone is working from the same picture. Medicare receives the information it needs to run
and evaluate the program. Your health information is protected under HIPAA and ITERA uses
administrative, technical and physical safeguards, though no system can promise to be perfectly
secure. Your information is not sold. Your readings from the monitor go to your care team so they can
follow how you are doing. A family member sees only what you choose to share with them through your
Care Circle, and nothing else. I only hear you when you have started a voice conversation with me; I
am not listening otherwise. What I cannot tell you is exactly how this conversation itself is stored
or who can read it back later — that is not something I can confirm, and I would rather say so than
guess about your privacy. Your care team can answer it, and I can put you in touch with them."""

ES = """Su información se usa para brindar y coordinar su cuidado. Quienes la ven son su equipo de atención
de ITERA y, cuando ayuda a su cuidado, los médicos que usted ya ve, que reciben actualizaciones sobre
su cuidado para que todos trabajen con la misma información. Medicare recibe lo que necesita para
administrar y evaluar el programa. Su información de salud está protegida bajo HIPAA e ITERA aplica
salvaguardas administrativas, técnicas y físicas, aunque ningún sistema puede prometer seguridad
absoluta. Su información no se vende. Sus mediciones del monitor van a su equipo de atención. Un
familiar solo ve lo que usted decida compartir con él a través de su Círculo de cuidado. Solo lo
escucho cuando usted ha iniciado una conversación por voz conmigo. Lo que no puedo decirle es
exactamente cómo se guarda esta conversación ni quién puede leerla después: eso no lo puedo
confirmar, y prefiero decírselo antes que adivinar sobre su privacidad. Su equipo de atención puede
responderlo, y puedo comunicarle con ellos."""

KR = """Enfòmasyon ou sèvi pou bay ak kowòdone swen ou. Moun ki wè l se ekip swen ITERA ou an epi, lè sa ede
swen ou, doktè ou deja wè yo, ki resevwa mizajou sou swen ou pou tout moun travay ak menm enfòmasyon
an. Medicare resevwa sa li bezwen pou dirije epi evalye pwogram nan. Enfòmasyon sante ou pwoteje anba
HIPAA epi ITERA sèvi ak pwoteksyon administratif, teknik ak fizik, menm si okenn sistèm pa ka pwomèt
sekirite konplè. Yo pa vann enfòmasyon ou. Mezi ou yo ale nan ekip swen ou. Yon fanmi wè sèlman sa ou
chwazi pataje avè l nan Sèk swen ou an. Mwen tande w sèlman lè ou te kòmanse yon konvèsasyon vwa avè
m. Sa mwen pa ka di w se egzakteman kijan konvèsasyon sa a estoke oswa kiyès ki ka li l pita — mwen pa
ka konfime sa, epi mwen pito di w sa pase pou m devine sou vi prive ou. Ekip swen ou ka reponn sa, epi
mwen ka mete w an kontak ak yo."""

s = io.open(PATH, encoding="utf-8").read()
s = re.sub(r'^##\s*EMMI response rule\s*\n\n.*?(?=\n##\s)', RULE, s, count=1, flags=re.M | re.S)
for lang, text in (("EN", EN), ("ES", ES), ("KR", KR)):
    s = re.sub(r'(^##\s*Patient answer \(' + lang + r'\)\s*\n\n)(.*?)(?=\n##\s|\Z)',
               lambda m: m.group(1) + text + "\n\n", s, flags=re.M | re.S)
io.open(PATH, "w", encoding="utf-8").write(s)
print("privacy page tightened")
