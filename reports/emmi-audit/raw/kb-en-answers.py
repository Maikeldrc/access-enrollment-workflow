# -*- coding: utf-8 -*-
"""Adds the English patient answer to each knowledge page.

Every page already states its answer for Spanish and Creole readers in a `Patient answer (…)`
section; English had no equivalent and fell back to the page's lead section, which is written for
whoever maintains the page. This writes the English one in the same place, using only facts checked
against CMS.gov and Medicare.gov (see research-findings.md for the citation trail).
"""
import io, re, os, sys

EN = {
"medicare/medicare-basics.md": "Medicare is the federal health insurance program, mainly for people 65 and older and for some younger people with certain conditions. Original Medicare is the part run directly by the federal government, and it is made up of Part A, which is hospital insurance, and Part B, which is medical insurance for doctor visits, outpatient care and many other services. What you pay depends on Medicare rules for each kind of care and on any extra coverage you have. What you personally have is part of your verified coverage, and your care team can confirm it with you.",

"medicare/original-medicare.md": "Original Medicare is the coverage run directly by the federal Medicare program, and it has two parts. Part A is hospital insurance and covers inpatient hospital care and some other services. Part B is medical insurance and covers doctor visits, outpatient care, preventive services and more. For most Part B services Medicare pays its share after your deductible and you are responsible for the rest, which is usually 20 percent, unless you have other coverage that pays it for you. ACCESS is offered to people with Original Medicare.",

"medicare/coinsurance-deductible-copay.md": "These are the three ways Medicare can leave part of a cost with you. A deductible is the amount you pay before Medicare starts paying. Coinsurance is a share of the cost, usually a percentage: for most Part B services Medicare pays about 80 percent and the remaining 20 percent is coinsurance. A copayment is a set dollar amount for a service. Whether you actually pay any of these depends on your own coverage, because Medicaid, QMB or a Medicare Supplement policy may cover them for you.",

"medicare/medigap.md": "Medicare Supplement Insurance, usually called Medigap, is private insurance you can buy to work alongside Original Medicare. It is designed to help pay costs that Original Medicare leaves to you, such as certain coinsurance, copayments and deductibles. What any particular policy pays depends on that specific policy, so two people who both have Medigap can still owe different amounts. Whether you have one, and what it covers, comes from your verified coverage rather than from a general rule.",

"medicare/coordination-of-benefits.md": "When you have more than one kind of coverage, one of them pays first. The one that pays first is called the primary payer, and coverage that may pay some of what is left is called secondary. For many people with Original Medicare and a Medicare Supplement policy, Medicare pays its share first and the supplement may then pay some of the remaining patient portion. This is why the amount you are expected to pay is worked out from your own verified coverage rather than from a standard price.",

"programs/access-tracks.md": "ACCESS is organised into tracks, and each one covers a group of related conditions. Yours is the early cardio-kidney-metabolic track, usually written eCKM, which is for people managing early heart, kidney and metabolic conditions, most often high blood pressure, before they become more serious. The other tracks cover more advanced cardio-kidney-metabolic conditions, musculoskeletal pain, and behavioural health. Which track you are in comes from your own enrollment record, and your care team can go through it with you.",

"care/access-outcome-measures.md": "ACCESS follows a small number of health measures over time to see whether the support is helping. For blood pressure there are two different numbers and they mean different things. The control target is the program goal of getting systolic blood pressure below 130. The improvement milestone is a step toward it, set at least 15 points below wherever you started. Your own starting point, target and milestone are in your care plan, and I can read them to you from your record.",

"care/access-a1c.md": "Being asked for an A1c does not mean anyone thinks you have diabetes. A1c, also written HbA1c, is a blood test that shows average blood sugar over about three months. It is one of a few measures this track follows for everyone in it, alongside blood pressure, cholesterol and weight, because those things sit together in the same picture of health. What any particular result means for you is a question for your care team, and they will go through it with you.",

"care/care-plan.md": "Your care plan brings together your goals, your health information and your next steps in one place, so you and your care team are working from the same picture. Your care team sets the clinical parts, such as targets, medicines, and when something needs review, and you set what matters to you, what you want to work toward, and what is making things harder. It is not fixed: it is meant to be updated as your care goes on. You can see yours in the app, and I can walk you through it.",

"care/medications.md": "Reviewing your medications helps your care team see what you are actually taking now, what has changed, and where you might need help. Confirming a medicine here does not change a prescription, and neither do I: only the clinician who prescribes it can start, stop or change a medicine or a dose. If something about a medicine is worrying you, such as a missed dose, an extra dose, or feeling unwell after taking it, tell your care team or your pharmacist, and I can help you reach them.",

"care/patient-goals.md": "Your goals are yours. You decide what matters most to you, what you want to work toward, and what is getting in the way, and your care team helps you build a plan around that. They are not the same as clinical targets: a target such as a blood pressure number is set by your care team, while a goal is what you want your daily life to look like. You can change your personal goals later, and telling us what is making something hard is one of the most useful things you can do.",

"care/health-information.md": "When we show you your health information, you have three answers and all three are fine: that everything is correct, that something has changed, or that you are not sure. If you say something has changed, it is recorded as something you told us so your care team can review it, and your medical record is not overwritten automatically. If you are not sure, your care team can go through it with you. Confirming this information is not the same as a clinician confirming it clinically.",

"enrollment/consent.md": "Agreeing to join is something only you can do, or a personal representative with the legal authority to make healthcare decisions for you. I can explain what the agreement says and take you to the screen, but I cannot agree, sign or enroll on your behalf, and neither can a family member who is simply helping you. What you are agreeing to is joining ACCESS with ITERA HEALTH and letting the information needed for your care be shared for that purpose. You can ask for a copy of what you agreed to at any time, and you can change your mind, because taking part stays voluntary.",

"enrollment/personal-representative.md": "A personal representative is someone with the legal authority to make healthcare decisions for you, such as through a healthcare power of attorney. That is different from a family member or caregiver who helps you: being your daughter, son or spouse does not by itself give someone that authority, and verifying a phone number does not either. Someone helping you can support you with reminders, setup and getting to appointments, but only you or a personal representative can agree, sign, or make healthcare decisions.",

"enrollment/care-circle.md": "Your Care Circle is optional support from someone you trust, such as a daughter, son, spouse, another family member or a caregiver. You choose who to invite and what they can see or help with, and nothing is sent until you review the details and send the invitation yourself. They can help with things like reminders, setting up your monitor, and getting to appointments. They cannot agree, sign, or make healthcare decisions for you unless they are your personal representative, and you stay in control of your care.",

"enrollment/enrollment.md": "Enrolling means agreeing to join ACCESS with ITERA HEALTH, and it is your choice. You review the details first, including what you would be expected to pay, and nothing is final until you agree. Enrolling is a separate step from getting set up afterwards, so you can finish the setup steps whenever you are ready and stop partway if you need to. Your progress is saved, and you can pick it up later.",

"billing/expected-patient-payment.md": "An expected patient payment is what you are currently expected to pay for a specific service, worked out from the coverage that has been verified for you. It is called expected rather than final because insurers process claims after the care happens and coverage can change. If your coverage cannot be confirmed, the honest answer is that the amount is not known yet, rather than assuming it is nothing or assuming it is the full amount. An expected payment of $0 means your coverage is expected to take care of it. It does not mean the service is free, and it does not mean your other healthcare is $0 too.",

"company/itera-health.md": "ITERA HEALTH is the organization providing your ACCESS care. Medicare approves organizations to take part in ACCESS, and ITERA is one of them. ITERA is not your doctor and does not replace anyone on your medical team: you keep your primary care provider and your specialists, and ITERA works alongside them, sharing updates so your care stays coordinated. ITERA provides the extra support between your visits, such as check-ins, help with your care plan and medications, and connected monitoring from home.",

"core/itera-health.md": "ITERA HEALTH works with your own doctors to support you between office visits. That support can include checking in on how you are doing, helping you understand your health information, helping with medications and appointments, and passing what matters back to your care team. ITERA does not take over your care and does not replace your primary care provider or your specialists.",

"devices/blood-pressure.md": "Your blood pressure monitor connects on its own and sends your readings to your care team, so there is nothing to plug into a computer. Sit quietly for a few minutes first, rest your arm on a table at about heart height, keep your feet flat on the floor, and stay still and quiet while it measures. Put the cuff on bare skin rather than over a sleeve. If a reading looks unusual, wait a few minutes and take it again. If the monitor will not work, or a reading does not seem to go through, tell me and I can walk you through it or have the device support team call you.",

"devices/rpm-devices.md": "The equipment you are given for your ACCESS care, such as a blood pressure monitor, is provided to you as part of that care. You are never asked to buy, rent or pay out of pocket for it, and you cannot be required to own a device in order to take part. Depending on how it was provided it may be a loan, which means you may be asked to return it when your care period ends or if you leave the program. If you already own a monitor you may be able to use it instead, and your care team can tell you whether yours can be connected.",

"safety/emergencies.md": "If you think you are having an emergency, call 911 or go to the nearest emergency room. Do not wait to hear back from your care team, and do not wait for a message in this app. Signs that need emergency help right away include chest pain or pressure, trouble breathing, fainting or passing out, sudden weakness or numbness on one side of the body, a drooping face, sudden trouble speaking or slurred speech, a seizure, or severe bleeding. I am an assistant in an app and I cannot send help to you, so please call 911 yourself or ask someone with you to call.",
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
