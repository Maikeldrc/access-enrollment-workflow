# -*- coding: utf-8 -*-
"""Second pass: English patient answers for the safety pages, whose lead sections are written as
rules for the assistant and were being read out to patients verbatim."""
import io, re, os

EN = {
"safety/prohibited-actions.md": "There are things I will not do, and I would rather be clear about them than be vague. I cannot diagnose you or tell you what is wrong. I cannot prescribe anything, or start, stop or change a medicine or a dose. I cannot change what your care team has decided, decide whether you are eligible, tell you what you will be charged without checking your record, or sign or agree to anything for you. Those decisions belong to your clinicians and to you. What I can do is explain things in plain language, look things up in your record, help you get something done, and get a real person from your care team involved whenever you want.",

"safety/clinical-safety.md": "How you are feeling comes first. If you tell me about a symptom, I am not going to try to work out what is causing it, because that is your care team's job and not something I can do safely. What I will do is make sure the right people know. If something might be an emergency, the right thing is to call 911 or go to the nearest emergency room rather than waiting for a reply here. For anything else that is worrying you, I can ask your care team to look at it and get back to you.",

"safety/clinical-escalation.md": "When something you tell me needs a clinician to look at it, I pass it to your care team rather than trying to answer it myself. If you would like, I can create a high-priority note for them so it is seen sooner, and I will tell you when I have done it. If what you are describing might be an emergency, please do not wait for them: call 911 or go to the nearest emergency room now. You can always ask me to get a person involved, at any point, for any reason.",

"programs/access-cost-sharing.md": "Medicare describes ACCESS as available at low or no cost. Most approved organizations charge between $0 and $7 a month, and if one organization is helping you with more than one condition they cannot charge you more than $13 a month in total. Your own amount depends on the coverage that has been verified for you, so it is worked out for your situation rather than being a fixed price, and you are shown it before you decide. That amount covers ACCESS only: your office visits, medicines, hospital care and other services still have their own separate costs. You are never charged for equipment provided as part of your ACCESS care, and there is no cost to you when your own doctor reviews and coordinates your ACCESS care.",
}


def add_en(path, text):
    full = os.path.join("src/emmi/Knowledge", path)
    if not os.path.exists(full):
        return "MISSING " + path
    s = io.open(full, encoding="utf-8").read()
    if re.search(r'^##\s*Patient answer \(EN\)\s*$', s, re.M):
        s = re.sub(r'(^##\s*Patient answer \(EN\)\s*\n\n)(.*?)(?=\n##\s|\Z)',
                   lambda m: m.group(1) + text + "\n\n", s, flags=re.M | re.S)
    else:
        m = re.search(r'^##\s*Patient answer \(ES\)\s*$', s, re.M)
        block = "## Patient answer (EN)\n\n" + text + "\n\n"
        s = (s[:m.start()] + block + s[m.start():]) if m else (s.rstrip() + "\n\n" + block)
    io.open(full, "w", encoding="utf-8").write(s)
    return "ok " + path


for p, t in EN.items():
    print(add_en(p, t))
