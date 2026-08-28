Refactoriza e implementa integralmente el concepto de APPOINTMENT COORDINATION dentro del Patient Experience de ITERA HEALTH y de la arquitectura de EMMI.

OBJETIVO

Queremos que EMMI pueda ayudar al paciente a coordinar appointments de forma conversacional, sencilla y segura.

El paciente NO debería tener que entender:

- qué sistema de scheduling utiliza cada oficina;
- qué tipo de cita necesita seleccionar técnicamente;
- si ITERA puede reservar directamente;
- si hay que enviar una solicitud;
- si debe intervenir un Care Manager;
- qué integración existe detrás.

El paciente simplemente debe poder decir cosas como:

“Necesito ver a mi cardiólogo.”

“Quiero hacer una cita con mi médico.”

“¿Cuándo es mi próxima cita?”

“Necesito mover mi cita.”

“No puedo ir el martes.”

“Quiero hablar con alguien sobre mis medicamentos.”

“Necesito ayuda con mi monitor.”

y EMMI debe ayudar a determinar la vía correcta.

El modelo debe ser:

PATIENT NEED
↓
EMMI UNDERSTANDS
↓
SAFETY / TRIAGE
↓
RESOLVE WHO CAN HELP
↓
DETERMINE SCHEDULING CAPABILITY
↓
DIRECT BOOKING
or
APPOINTMENT REQUEST
or
HUMAN COORDINATION
↓
CONFIRMATION
↓
BARRIER CHECK
↓
PREPARATION + REMINDERS
↓
APPOINTMENT
↓
FOLLOW-UP

==================================================
1. PRINCIPIO FUNDAMENTAL
==================================================

No construir simplemente:

A CALENDAR.

Construir:

EMMI APPOINTMENT ORCHESTRATION.

El problema que estamos resolviendo es:

WHAT DOES THE PATIENT NEED?
↓
WHO SHOULD HELP?
↓
HOW CAN ITERA COORDINATE IT?
↓
IS IT REALLY CONFIRMED?
↓
WHAT COULD PREVENT THE PATIENT FROM ATTENDING?
↓
HOW DO WE HELP BEFORE AND AFTER THE VISIT?

==================================================
2. EMMI ROLE
==================================================

EMMI debe poder:

- detectar intención de appointment;
- identificar profesional cuando sea posible;
- consultar Care Team;
- entender preferencias del paciente;
- consultar disponibilidad cuando exista integración;
- presentar slots reales;
- enviar requests cuando booking directo no existe;
- crear Care Team task cuando se necesita intervención humana;
- informar status;
- ayudar con reminders;
- identificar barriers;
- preparar al paciente;
- realizar follow-up.

EMMI NO debe:

- inventar disponibilidad;
- inventar una cita confirmada;
- asumir urgencia clínica;
- tomar decisiones clínicas independientemente;
- decir que una cita está reservada antes de confirmación real.

==================================================
3. SAFETY FIRST
==================================================

Antes de iniciar un normal scheduling flow:

evaluar si el motivo del paciente contiene un posible safety concern.

Ejemplo:

Patient:

“Necesito una cita porque tengo un dolor fuerte en el pecho.”

NO:

“¿Prefiere mañana o tarde?”

Debe pasar primero por:

Clinical Safety Engine.

Conceptualmente:

APPOINTMENT INTENT
↓
SAFETY CHECK
↓
NORMAL
or
CLINICAL SAFETY PATHWAY.

==================================================
4. SAFETY PRIORITY
==================================================

Priority:

CRITICAL CLINICAL SAFETY
>
APPOINTMENT COORDINATION.

No permitir que una solicitud de cita oculte un evento clínico urgente.

==================================================
5. DO NOT LET LLM INVENT URGENCY
==================================================

Usar:

deterministic Clinical Safety Engine

y reglas aprobadas.

EMMI puede recoger contexto, pero no improvisar triage.

==================================================
6. APPOINTMENT NEED
==================================================

Crear/reutilizar entidad conceptual:

AppointmentNeed

Possible fields:

id
patientId
source
reasonCategory
reasonSummary
relatedGoalId optional
relatedBarrierId optional
requestedProfessionalId optional
requestedProfessionalType optional
requestedSpecialty optional
preferredModality optional
preferredTimeOfDay optional
preferredDateRange optional
urgencyClassification
status
createdAt
resolvedAt.

Adaptar al data model real.

==================================================
7. SOURCES
==================================================

Appointment Need puede originarse desde:

PATIENT_DIRECT_REQUEST

EMMI_CONVERSATION

GOAL_BARRIER

CARE_TEAM

FOLLOW_UP

SYSTEM_WORKFLOW.

==================================================
8. INTEGRATION WITH BARRIERS
==================================================

Integrar con el Barrier Engine ya conceptualizado.

Ejemplos:

Barrier:
“I need to see my cardiologist.”

→ Appointment Coordination.

Barrier:
“I don’t have transportation to my visit.”

→ appointment remains relevant
+
transportation barrier.

Barrier:
“I need someone to help me get there.”

→ Care Circle may help.

==================================================
9. APPOINTMENT ≠ ALWAYS DOCTOR VISIT
==================================================

No asumir que todo “I need help” requiere physician appointment.

EMMI debe poder distinguir, según tools/config:

- physician visit;
- specialist visit;
- PCP;
- Care Manager;
- nurse;
- device support;
- care-plan review;
- telehealth;
- office appointment;
- phone call;
- other approved support interaction.

==================================================
10. CARE TEAM INTEGRATION
==================================================

Antes de preguntar al paciente información que ya existe:

consultar:

My Care Team.

Ejemplo:

Patient:

“Necesito ver a mi cardiólogo.”

Runtime:

Dr. Pedro Martinez
Cardiology
Care Team member.

EMMI:

“Puedo ayudarle a coordinar una cita con el Dr. Martinez. ¿Es con él?”

[ Sí ]

[ Otro profesional ]

==================================================
11. DO NOT INVENT PROVIDER
==================================================

Nunca inferir:

doctor name
specialty
practice
location

si runtime no lo confirma.

==================================================
12. PROFESSIONAL NOT FOUND
==================================================

Si paciente dice:

“Mi cardiólogo no aparece.”

ofrecer:

Agregar un profesional de mi cuidado

usando el Care Team workflow ya diseñado.

Esto puede generar:

Care Team growth loop.

==================================================
13. CARE TEAM ORGANIC GROWTH
==================================================

Appointment Coordination debe integrarse con:

Care Team invitation / connection.

Patient:
“I need an appointment with my cardiologist.”

Provider absent from ITERA:
↓
identify professional
↓
search directory
↓
patient reports/adds provider
↓
invite/verification workflow
↓
appointment request can continue according to capability.

No bloquear innecesariamente scheduling mientras provider onboarding ocurre si existe otra forma de coordinar.

==================================================
14. SCHEDULING CAPABILITY MODEL
==================================================

No asumir que todas las oficinas tendrán la misma integración.

Crear capability model.

Conceptualmente:

DIRECT_BOOKING

STRUCTURED_REQUEST

HUMAN_COORDINATION

NO_AVAILABLE_CHANNEL.

==================================================
15. LEVEL A — DIRECT BOOKING
==================================================

Cuando ITERA tiene:

real calendar integration
+
real-time availability
+
booking capability

EMMI puede ofrecer slots reales.

Example:

Dr. Pedro Martinez

Available:

Monday, Sep 7
10:30 AM

Tuesday, Sep 8
2:00 PM

Thursday, Sep 10
9:15 AM.

==================================================
16. REAL AVAILABILITY ONLY
==================================================

Nunca mostrar fabricated slots.

Slots deben venir de:

trusted scheduling integration.

==================================================
17. DIRECT BOOKING FLOW
==================================================

Patient selects slot.

Then:

BOOKING request
↓
provider system confirms
↓
Appointment status = CONFIRMED
↓
patient sees confirmation.

==================================================
18. DO NOT CONFIRM TOO EARLY
==================================================

CRITICAL.

Never say:

“Your appointment is confirmed”

until backend/external scheduling system returns actual confirmation.

==================================================
19. LEVEL B — STRUCTURED APPOINTMENT REQUEST
==================================================

If no direct booking but office accepts appointment requests:

collect minimal preferences.

Send request.

Patient-facing:

“Solicitud enviada”

not:

“Cita confirmada.”

==================================================
20. REQUEST STATUS
==================================================

Patient-facing states:

Solicitud enviada

Esperando confirmación

La oficina propuso una hora

Necesita elegir una opción

Cita confirmada.

==================================================
21. LEVEL C — HUMAN COORDINATION
==================================================

If no calendar/request integration:

EMMI gathers enough information.

Creates Care Team / scheduling task.

Patient-facing:

“Su equipo está ayudando a coordinar esta cita.”

Not:

“Booked.”

==================================================
22. HUMAN COORDINATION TASK
==================================================

Structured context:

Patient
Requested professional
Specialty
Reason category
Preferred modality
Preferred timing
Known barriers
Contact preference

No raw transcript dump.

==================================================
23. LEVEL D — NO AVAILABLE CHANNEL
==================================================

If platform cannot coordinate:

be transparent.

Example:

“No puedo programar esta cita directamente en este momento, pero puedo ayudarle a comunicarse con su equipo.”

Offer real supported next action.

==================================================
24. SCHEDULING CAPABILITY RESOLVER
==================================================

Create/reuse service concept:

resolveSchedulingCapability({
  patientId,
  providerId,
  practiceId,
  appointmentType
})

Returns:

DIRECT_BOOKING

REQUEST

HUMAN_COORDINATION

UNAVAILABLE

plus supported modalities.

==================================================
25. CONVERSATIONAL UX
==================================================

Do NOT open immediately a large form asking:

Provider
Specialty
Reason
Appointment type
Location
Date
Time
Duration
Modality.

Use progressive conversational interaction.

==================================================
26. ONE QUESTION AT A TIME
==================================================

65+ UX:

Patient:

“I need to see my cardiologist.”

EMMI:

“Is this for Dr. Martinez?”

Then:

“Would you prefer an office visit or video visit, if both are available?”

Then:

“Do mornings or afternoons usually work better?”

Then show availability.

==================================================
27. ASK ONLY WHAT IS NEEDED
==================================================

Do not ask patient:

provider name

if Care Team already resolved it.

Do not ask:

practice

if provider relationship already contains it.

Do not ask:

location

if only one verified office exists.

==================================================
28. PATIENT PREFERENCES
==================================================

Possible preferences:

preferredTimeOfDay

preferredDays

preferredModality

preferredLocation

transportationNeeds

languageNeeds

caregiverAvailability.

Do not require all.

==================================================
29. SIMPLE TIME PREFERENCES
==================================================

Initial UX:

Morning

Afternoon

No preference

Choose another time.

Avoid complex time-range UI unless necessary.

==================================================
30. MODALITY
==================================================

When supported:

Office visit

Video visit

Phone call

Do not show unavailable modalities.

==================================================
31. AVAILABILITY UI
==================================================

When direct booking available:

show 2–4 best relevant options initially.

Example:

Choose a time

MON
Sep 7
10:30 AM

TUE
Sep 8
2:00 PM

THU
Sep 10
9:15 AM

[ Show more times ]

Mobile-first.

==================================================
32. DO NOT SHOW DENSE CALENDAR FIRST
==================================================

For Medicare 65+:

prefer:

recommended slots

over:

month calendar + tiny time grid.

Allow:

Choose another day

if patient wants broader search.

==================================================
33. SLOT CARD
==================================================

Each slot:

large date

day

time

location/modality if relevant.

Whole card tappable.

Min touch target 48px.

==================================================
34. BOOKING CONFIRMATION SCREEN
==================================================

After real booking:

CITA CONFIRMADA

Dr. Pedro Martinez

Cardiology

Tuesday, September 8

10:30 AM

Office visit

Coral Gables

✓ Confirmed

Actions if supported:

Get directions

Add to calendar

Reschedule

Cancel appointment

Ask EMMI.

==================================================
35. REQUEST CONFIRMATION SCREEN
==================================================

When NOT actually booked:

SOLICITUD ENVIADA

Dr. Pedro Martinez
Cardiology

Preference:
Morning

“Su solicitud fue enviada. Le avisaremos cuando la oficina confirme una hora.”

Do NOT use green confirmed check implying final appointment.

==================================================
36. PATIENT-FACING STATUS
==================================================

Internal:

WAITING_FOR_OFFICE

Patient:

Esperando confirmación.

Internal:

PENDING_PATIENT_SELECTION

Patient:

Elija una hora.

Internal:

CONFIRMED

Patient:

Cita confirmada.

==================================================
37. APPOINTMENT STATUS MODEL
==================================================

Possible internal states:

NEED_IDENTIFIED

DRAFT

COLLECTING_PREFERENCES

SEARCHING_AVAILABILITY

SLOTS_AVAILABLE

PENDING_PATIENT_SELECTION

BOOKING

REQUEST_SENT

WAITING_FOR_OFFICE

PROPOSED_TIME

CONFIRMED

RESCHEDULE_REQUESTED

CANCEL_REQUESTED

CANCELED

COMPLETED

NO_SHOW

UNABLE_TO_SCHEDULE

DECLINED

Adapt to backend reality.

==================================================
38. MY CARE — UPCOMING CARE
==================================================

Add section to My Care:

UPCOMING CARE

Example:

Tue, Sep 8 · 10:30 AM

Dr. Pedro Martinez

Cardiology

✓ Confirmed

[ View appointment → ]

==================================================
39. NEED AN APPOINTMENT
==================================================

Below Upcoming Care or appropriate My Care location:

Need an appointment?

“EMMI can help you coordinate with your care team.”

[ Ask EMMI → ]

Do not force scheduling module.

==================================================
40. APPOINTMENTS LIST
==================================================

If patient has multiple:

Upcoming

Past

Requests

But keep mobile simple.

Do not build complex calendar unless needed.

==================================================
41. EMMI KNOWLEDGE OF APPOINTMENTS
==================================================

EMMI should answer:

“When is my next appointment?”

“Who is it with?”

“Where is it?”

“Is it confirmed?”

“Can I move it?”

“Can I cancel it?”

“Can I do it by video?”

using runtime.

==================================================
42. RUNTIME-FIRST
==================================================

Appointment-specific patient facts MUST use:

trusted scheduling/runtime data.

Do not answer from model memory.

==================================================
43. APPOINTMENT PREPARATION
==================================================

Create EMMI capability:

PREPARE FOR APPOINTMENT.

Before confirmed appointment:

show:

Get ready for your appointment

“EMMI can help you remember what you want to discuss.”

[ Prepare with EMMI → ]

==================================================
44. PREP QUESTIONS
==================================================

EMMI can ask:

“What would you like to talk about with Dr. Martinez?”

Patient may mention:

BP trend

medication question

device problem

symptoms

goal difficulty.

==================================================
45. APPOINTMENT BRIEF
==================================================

Generate patient-friendly structured summary:

Things I want to discuss

1. My blood pressure has been higher this week.
2. I have a question about my medication.
3. I am having trouble using my monitor.

[ Edit ]

No long transcript.

==================================================
46. PROVIDER / CARE TEAM BRIEF
==================================================

Where permitted and useful:

prepare structured clinical/care coordination context.

Possible:

Reason
Related Goal
Recent trend
Active barrier
Patient question

Do not automatically send PHI outside authorized workflow.

==================================================
47. PATIENT CONTROLS SHARING
==================================================

Do not assume every appointment brief is automatically shared with provider.

Use actual workflow/config.

==================================================
48. REMINDERS
==================================================

Once confirmed:

offer:

Would you like a reminder?

Simple options:

Day before

Morning of appointment

Choose another time

No thanks.

==================================================
49. DO NOT AUTO-SCHEDULE REMINDER
==================================================

Patient must explicitly opt in where required.

Do not silently create notifications.

==================================================
50. REMINDER CAPABILITY
==================================================

Verify:

notification capability

before saying reminder is set.

If permission denied:

offer alternative if supported.

==================================================
51. SMART PRE-VISIT CHECK
==================================================

A useful EMMI follow-up before appointment:

“Your appointment with Dr. Martinez is tomorrow at 10:30 AM. Is there anything that could make it difficult to attend?”

Possible:

I’m all set

Transportation

Need someone to come with me

I need to change the time

I’m not sure where to go

Other.

==================================================
52. BARRIER INTEGRATION
==================================================

Pre-visit difficulties should use Barrier Engine.

Examples:

TRANSPORTATION

CAREGIVER_AVAILABILITY

LOCATION_UNCLEAR

TECHNOLOGY_TELEHEALTH

LANGUAGE

MOBILITY

FINANCIAL

TIME_CONFLICT.

==================================================
53. TRANSPORTATION BARRIER
==================================================

If patient says:

“I don’t have transportation.”

Do not simply cancel appointment.

Use configured resources / Care Team coordination.

If no transport resource:

create Care Team task.

==================================================
54. CARE CIRCLE INTEGRATION
==================================================

If patient has Care Circle member:

possible patient-authorized option:

“Would you like to share this appointment with Ana?”

Only if functionality/permission exists.

==================================================
55. SHARE APPOINTMENT ≠ FULL ACCESS
==================================================

Sharing appointment info with Care Circle does NOT grant:

medical record access

consent authority

clinical decision rights.

Permission scoped to appointment information if configured.

==================================================
56. CARE CIRCLE APPOINTMENT SUPPORT
==================================================

Possible future/useful permissions:

receive appointment reminder

view date/time/location

help with transportation

help with video setup.

Use granular permissions.

==================================================
57. TELEHEALTH PREPARATION
==================================================

For video appointment:

before visit EMMI can help check:

device

internet

link availability

audio

camera

if product supports it.

==================================================
58. JOIN VISIT
==================================================

Show:

Join visit

ONLY if:

real appointment supports telehealth

and a valid join link exists

and timing rules permit.

Never fake.

==================================================
59. GET DIRECTIONS
==================================================

For office visits:

Get directions

using verified address.

No fabricated location.

==================================================
60. ADD TO CALENDAR
==================================================

Allow:

Add to calendar

when technically supported.

Use actual:

date
time
timezone
location
title.

Do not include unnecessary PHI in calendar title/description.

==================================================
61. RESCHEDULE
==================================================

Patient:

“I need to move my appointment.”

Route based on scheduling capability.

DIRECT:
show alternative slots.

REQUEST:
send reschedule request.

HUMAN:
create coordination task.

==================================================
62. RESCHEDULE STATUS
==================================================

Do NOT mark original appointment canceled until external system confirms, unless booking integration does so transactionally.

Keep:

RESCHEDULE_REQUESTED

until confirmed.

==================================================
63. CANCEL APPOINTMENT
==================================================

Use actual scheduling capability.

Require confirmation.

Patient-facing:

“Cancel your appointment with Dr. Martinez on Tuesday at 10:30 AM?”

[ Keep appointment ]

[ Cancel appointment ]

==================================================
64. DO NOT CANCEL BASED ON CHAT TEXT ALONE
==================================================

Require explicit confirmation before destructive appointment cancellation.

==================================================
65. FOLLOW-UP AFTER APPOINTMENT
==================================================

After expected appointment:

EMMI may ask:

“Were you able to attend your appointment with Dr. Martinez?”

Options:

Yes

No

It was rescheduled.

==================================================
66. IF ATTENDED
==================================================

EMMI:

“Is there anything from the visit you need help with?”

Possible:

Understand next steps

Medication question

Schedule follow-up

Update my goal

Nothing right now.

==================================================
67. IF MISSED
==================================================

Patient:

No.

EMMI:

“Would you like help rescheduling it?”

[ Yes ]

[ Not now ]

This may create:

NO_SHOW
+
new AppointmentNeed.

==================================================
68. NO JUDGMENT
==================================================

Never:

“You missed your appointment.”

in accusatory tone.

Prefer:

“Were you able to attend?”

==================================================
69. FOLLOW-UP APPOINTMENT
==================================================

If patient says:

“The doctor wants to see me again in 3 months.”

Do not automatically create actual appointment unless scheduling capability confirms.

Can create:

follow-up need/reminder/request.

==================================================
70. APPOINTMENT + GOALS
==================================================

Appointments can be linked to:

PatientGoal.

Example:

Goal:
Keep BP under control.

Appointment reason:
Review BP trend with cardiologist.

This can influence:

Goal Next Best Action.

==================================================
71. NEXT BEST ACTION
==================================================

Example My Goals:

Active barrier:
Medication concern.

Appointment confirmed:
Cardiology visit Tuesday.

Next step:

Prepare for your appointment with Dr. Martinez.

This is more useful than generic education.

==================================================
72. PRIORITY OF NEXT BEST ACTION
==================================================

Conceptual:

SAFETY
>
URGENT CARE TEAM ACTION
>
APPOINTMENT REQUIRING PATIENT ACTION
>
ACTIVE BARRIER
>
GOAL ACTION
>
EDUCATION.

==================================================
73. APPOINTMENT NOTIFICATION
==================================================

Important events:

appointment requested

time proposed

patient selection needed

confirmed

rescheduled

canceled

upcoming

changed by office.

Patient should be notified according to preferences/config.

==================================================
74. OFFICE CHANGES APPOINTMENT
==================================================

If provider office changes appointment:

patient sees:

“Your appointment time changed.”

Show:

old time if helpful

new proposed/confirmed time

actions.

Do not hide changes.

==================================================
75. PATIENT CHOICE REQUIRED
==================================================

If office proposes time requiring confirmation:

status:

Needs your response.

Prominent CTA:

Review new time →

==================================================
76. CONVERSATION CONTINUITY
==================================================

EMMI must maintain same ongoing conversation.

Example:

Patient:
“I need an appointment.”

EMMI:
“Is this with Dr. Martinez?”

Later on next screen:

Do NOT:
“Hi Maria…”

Continue.

==================================================
77. ONE EMMI
==================================================

Appointment workflows use:

same EMMI

same Knowledge Base

same runtime tools

same Voice Identity

same conversation context.

==================================================
78. BARGE-IN
==================================================

During appointment explanation:

patient can interrupt.

Example:

EMMI:
“The first available appointment is Tuesday…”

Patient:
“I can’t do Tuesdays.”

EMMI stops.

Updates preference.

Searches again.

==================================================
79. TEXT + VOICE
==================================================

Patient may start by voice and finish through tap/text.

Same appointment draft.

Do not create duplicate requests.

==================================================
80. APPOINTMENT DRAFT
==================================================

Maintain persistent draft concept:

AppointmentDraft

selectedProvider
reason
preferences
selectedSlot
modality.

If conversation interrupted:

can resume.

==================================================
81. DO LATER
==================================================

Allow patient to stop before submission.

Example:

“I’ll do this later.”

Save appropriate draft only if product persistence supports it.

Do not submit automatically.

==================================================
82. DUPLICATE APPOINTMENT NEED
==================================================

If patient already has pending request for same provider/reason:

warn gently.

Example:

“You already have a request waiting for Dr. Martinez’s office.”

[ View request ]

[ Start another request ]

if supported/appropriate.

==================================================
83. EXISTING APPOINTMENT
==================================================

If patient requests provider and already has upcoming appointment:

EMMI can say:

“You already have an appointment with Dr. Martinez on September 8 at 10:30 AM. Would you like to view it, change it, or request another appointment?”

Do not blindly create duplicate.

==================================================
84. APPOINTMENT REASON
==================================================

Do not require detailed clinical free text unless needed.

Possible patient-friendly categories:

Follow-up

New concern

Medication question

Review my readings

Device/support issue

Other.

But EMMI can infer intent and confirm.

==================================================
85. REASON FREE TEXT
==================================================

Allow:

Tell EMMI in your own words.

Store concise reason summary.

Do not force patient into category when not appropriate.

==================================================
86. CLINICAL REASON SUMMARY
==================================================

If needed for office request:

generate structured summary grounded in patient words/runtime.

Never invent symptom details.

==================================================
87. PROVIDER DIRECTORY
==================================================

When patient doesn't specify provider:

use:

Care Team
provider directory
program relationships

before asking for broad search.

==================================================
88. “I NEED A DOCTOR”
==================================================

If no provider relationship:

do not randomly choose a doctor.

Route to:

Care Team / provider identification workflow.

==================================================
89. NEW PROVIDER SEARCH
==================================================

If product supports directory:

search by:

specialty
location
network
practice

according to actual verified capabilities.

Do not imply insurance/network coverage unless checked.

==================================================
90. INSURANCE / COVERAGE
==================================================

If appointment/provider selection requires network determination:

use trusted coverage/provider tools.

Do not say provider is covered without confirmation.

==================================================
91. FINANCIAL QUESTIONS
==================================================

Patient:

“Will this appointment cost me anything?”

Use actual benefits/coverage data if available.

Otherwise:

do not promise $0.

==================================================
92. LANGUAGE SUPPORT
==================================================

Appointment preferences may include:

preferredLanguage.

If interpreter/Spanish support capability exists:

display/use actual data.

Do not promise interpreter availability unless confirmed.

==================================================
93. ACCESSIBILITY NEEDS
==================================================

Future-ready for:

mobility/accessibility needs.

Example:

wheelchair access.

Capture when patient volunteers/needs it.

Do not overburden all patients with questionnaire.

==================================================
94. CAREGIVER AVAILABILITY
==================================================

If patient needs Care Circle member present:

appointment availability search could consider preference.

But do not access supporter calendar without authorization/integration.

==================================================
95. TIMEZONE
==================================================

Store appointment timestamps with correct timezone.

Patient display:

local time.

Avoid timezone bugs in reminders.

==================================================
96. DAYLIGHT SAVING
==================================================

Use timezone-aware dates.

No manual UTC arithmetic in UI.

==================================================
97. MOBILE-FIRST UI
==================================================

Primary QA:

384 CSS px

Samsung Galaxy S25 Ultra.

Validate:

360
375
384
390
393
412
430.

==================================================
98. TYPOGRAPHY
==================================================

Senior-friendly:

Screen title:
28–32px

Appointment provider:
20–22px

Date/time:
20–24px where important

Body:
17–18px

Metadata:
16–17px

Buttons:
17–18px.

==================================================
99. TOUCH TARGETS
==================================================

Minimum:

44px

Preferred:

48px.

Slots must be easy to tap.

==================================================
100. NO DENSE CALENDAR
==================================================

Do not start with desktop-style month grid.

Primary UX:

conversational preferences
+
recommended available times.

==================================================
101. SLOT RESPONSIVE
==================================================

At 384px:

slot card should fit date/time naturally.

Allow vertical stacking.

No tiny columns.

==================================================
102. LONG PROVIDER NAME
==================================================

Support:

Dr. Alexander Rodriguez-Martinez

without clipping.

No ellipsis for critical appointment identity.

==================================================
103. LONG PRACTICE NAME
==================================================

Allow wrapping.

No fixed-height cards.

==================================================
104. APPOINTMENT CARD
==================================================

Reusable conceptual:

<AppointmentCard />

Possible content:

provider
specialty
date/time
modality
location
status
primary action.

==================================================
105. REQUEST CARD
==================================================

Reusable:

<AppointmentRequestCard />

Shows:

provider
preferences
status
next action.

Do not make pending request visually identical to confirmed appointment.

==================================================
106. STATUS VISUALS
==================================================

Use:

Clock
CircleCheck
Calendar
TriangleAlert

with text.

No status by color alone.

==================================================
107. COLOR
==================================================

Confirmed:
positive but calm.

Pending:
neutral/blue.

Needs response:
attention without alarm.

Canceled:
muted.

No aggressive traffic-light design.

==================================================
108. MY CARE EXPECTED UI
==================================================

Conceptually:

MY CARE

Upcoming care

┌──────────────────────────────┐
│ 📅 Tue, Sep 8 · 10:30 AM     │
│                              │
│ Dr. Pedro Martinez           │
│ Cardiology                   │
│                              │
│ ✓ Confirmed                  │
│                              │
│ [ View appointment → ]       │
└──────────────────────────────┘

Need an appointment?

EMMI can help you coordinate
with your care team.

[ Ask EMMI → ]

==================================================
109. DIRECT BOOKING UI
==================================================

Conceptually:

Choose a time

Dr. Pedro Martinez
Cardiology

Your preference:
Morning

┌──────────────────────────────┐
│ Monday, Sep 7                │
│ 10:30 AM                     │
│ Office visit                 │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Wednesday, Sep 9             │
│ 9:00 AM                      │
│ Office visit                 │
└──────────────────────────────┘

[ Show more times ]

==================================================
110. CONFIRMED UI
==================================================

CITA CONFIRMADA

✓

Dr. Pedro Martinez
Cardiology

Tuesday, September 8
10:30 AM

Office visit
Coral Gables

[ Get directions ]

[ Add to calendar ]

Reschedule

Cancel appointment

==================================================
111. PENDING REQUEST UI
==================================================

SOLICITUD ENVIADA

⏳

Dr. Pedro Martinez
Cardiology

Preferred:
Morning

“We’ll let you know when the office confirms a time.”

[ View request ]

No fake confirmed appointment formatting.

==================================================
112. PREP UI
==================================================

GET READY

Your appointment is tomorrow.

Dr. Martinez
10:30 AM

Things you wanted to discuss:

• My recent BP trend
• A medication question
• Trouble using my monitor

[ Prepare with EMMI → ]

==================================================
113. BARRIER CHECK UI
==================================================

Before appointment:

Anything making it difficult to attend?

[ I’m all set ]

[ Transportation ]

[ I need someone to come with me ]

[ I need to change the time ]

[ Something else ]

==================================================
114. CARE CIRCLE SHARING UI
==================================================

If supported and patient chooses:

Share appointment with Ana?

Ana Rodríguez
Daughter
Care Circle

She will receive:

✓ Date and time
✓ Location
✓ Appointment reminder

She will NOT automatically receive:
medical records or decision authority.

[ Share appointment ]

==================================================
115. PRIVACY
==================================================

Appointment invitations/notifications should include minimum necessary information.

Do not unnecessarily include:

diagnoses
detailed clinical reason
medications
readings

in SMS/push/calendar.

==================================================
116. AUDIT
==================================================

Record:

appointment need created

provider resolved

availability requested

slot shown

slot selected

booking attempted

request sent

booking confirmed

reschedule

cancellation

reminder created

barrier identified

care-team task created

follow-up outcome.

==================================================
117. NO PHI IN ANALYTICS
==================================================

Growth/product analytics should use non-PHI event metadata where possible.

==================================================
118. EMMI ORCHESTRATOR
==================================================

Appointment intents must go through the same EMMI Orchestrator.

Intent examples:

APPOINTMENT_CREATE

APPOINTMENT_STATUS

APPOINTMENT_RESCHEDULE

APPOINTMENT_CANCEL

APPOINTMENT_PREPARE

APPOINTMENT_REMINDER

APPOINTMENT_LOCATION

APPOINTMENT_PROVIDER

APPOINTMENT_BARRIER.

==================================================
119. RUNTIME TOOLS
==================================================

Inspect current repository first.

Reuse existing tools/endpoints.

Conceptually EMMI may require:

getCareTeam

getUpcomingAppointments

getAppointment

getSchedulingCapability

getProviderAvailability

bookAppointment

createAppointmentRequest

rescheduleAppointment

cancelAppointment

createCareTeamTask

createReminder

getCareCircle

shareAppointment

Do NOT create duplicates if equivalent endpoints exist.

==================================================
120. TOOL-FIRST PATIENT FACTS
==================================================

Questions like:

“When is my appointment?”

must use runtime tool.

Not Knowledge Base.

==================================================
121. KNOWLEDGE BASE
==================================================

Use KB for general questions:

“What is a telehealth visit?”

“How should I prepare for a blood pressure follow-up?”

according to approved content.

==================================================
122. TOOL FAILURE
==================================================

If availability fails:

“No pude consultar los horarios disponibles ahora mismo.”

Offer:

Try again
or
Ask care team.

Do not fabricate availability.

==================================================
123. BOOKING FAILURE
==================================================

If patient selects slot but booking fails:

do not show confirmed.

Say:

“That time could not be confirmed.”

Then retrieve updated availability.

==================================================
124. RACE CONDITION
==================================================

A slot can disappear between display and booking.

Handle gracefully.

Do not blame patient.

==================================================
125. IDEMPOTENCY
==================================================

Booking request should be protected from rapid double tap.

No duplicate appointments.

==================================================
126. CANCEL / RESCHEDULE IDEMPOTENCY
==================================================

Same.

Prevent duplicate destructive operations.

==================================================
127. SESSION PERSISTENCE
==================================================

If patient leaves during draft:

restore appropriate draft if supported.

Do not accidentally submit.

==================================================
128. EMMI COMPACT PATTERN
==================================================

Appointment screens use:

Compact EMMI
→ Floating EMMI
→ Expanded EMMI.

Voice ON:

Ask EMMI
Voice options.

==================================================
129. FLOATING EMMI
==================================================

Must not cover:

appointment slots
confirm button
cancel/reschedule
directions
join visit.

==================================================
130. CONVERSATION EXAMPLE — DIRECT BOOKING
==================================================

Patient:
“I need to see my cardiologist.”

EMMI:
“I see Dr. Martinez on your care team. Is this the doctor you want to see?”

Patient:
“Yes.”

EMMI:
“Would you prefer a morning or afternoon appointment?”

Patient:
“Morning.”

EMMI:
“I found two morning options.”

Show real slots.

Patient selects.

Backend confirms.

EMMI:
“Your appointment with Dr. Martinez is confirmed for Tuesday at 10:30 AM.”

==================================================
131. CONVERSATION EXAMPLE — REQUEST
==================================================

Patient:
“I need to see Dr. Martinez.”

No direct calendar integration.

EMMI:
“I can send a request to the office. Do mornings or afternoons work better?”

Patient:
“Morning.”

Request succeeds.

EMMI:
“Your request has been sent. The appointment is not confirmed yet. I’ll let you know when the office confirms a time.”

==================================================
132. CONVERSATION EXAMPLE — HUMAN COORDINATION
==================================================

Patient:
“I need to see my cardiologist.”

No booking/request channel.

EMMI:
“I can ask your care team to help coordinate this. Do mornings or afternoons usually work better?”

Structured Care Team task created.

EMMI:
“Your care team has your request and will help coordinate the appointment.”

==================================================
133. CONVERSATION EXAMPLE — SAFETY
==================================================

Patient:
“I need a cardiology appointment because I have severe chest pain.”

Expected:

Clinical Safety Engine.

Normal appointment flow does NOT proceed first.

==================================================
134. CONVERSATION EXAMPLE — EXISTING APPOINTMENT
==================================================

Patient:
“I need to see Dr. Martinez.”

Runtime:
existing confirmed appointment next week.

EMMI:

“You already have an appointment with Dr. Martinez next Tuesday at 10:30 AM. Would you like to view it, change it, or request another visit?”

==================================================
135. CONVERSATION EXAMPLE — TRANSPORTATION
==================================================

Patient:
“I can’t go because I don’t have a ride.”

Barrier Engine:

TRANSPORTATION.

EMMI:

recognizes appointment-related barrier
and uses approved resource / Care Team path.

Do not immediately cancel.

==================================================
136. QA — DIRECT BOOKING
==================================================

Real slots → select → backend confirms → confirmed state.

==================================================
137. QA — REQUEST
==================================================

No direct availability → request → WAITING_FOR_OFFICE.

No fake confirmation.

==================================================
138. QA — HUMAN
==================================================

No integration → Care Team task.

Patient sees coordination status.

==================================================
139. QA — SAFETY
==================================================

Clinical-risk statement overrides appointment scheduling.

==================================================
140. QA — EXISTING APPOINTMENT
==================================================

Avoid duplicate request.

==================================================
141. QA — PROVIDER NOT FOUND
==================================================

Use Add Care Team professional workflow.

==================================================
142. QA — LONG NAME
==================================================

No clipping at 384px.

==================================================
143. QA — RESCHEDULE
==================================================

Correct capability path.

==================================================
144. QA — CANCEL
==================================================

Explicit confirmation.

==================================================
145. QA — REMINDER
==================================================

Only show success after reminder actually created.

==================================================
146. QA — BARRIER
==================================================

Transportation/support/time conflicts recognized.

==================================================
147. QA — CARE CIRCLE
==================================================

Share only with explicit patient permission and supported scope.

==================================================
148. QA — FOLLOW-UP
==================================================

Attendance check and rescheduling option.

==================================================
149. QA — CONTINUITY
==================================================

No re-greeting between scheduling steps/screens.

==================================================
150. QA — VOICE
==================================================

Same canonical EMMI voice.

Patient can barge in.

==================================================
151. QA — LANGUAGES
==================================================

EN

ES

KR = Haitian Creole / Kreyòl.

Text and voice according to actual provider capability.

==================================================
152. QA — MOBILE
==================================================

Primary:

384 × 824.

Also:

360
375
390
393
412
430.

==================================================
153. QA — FONT SCALE
==================================================

100%
125%
150%.

No clipped dates/providers/actions.

==================================================
154. DO NOT BUILD A GIANT CALENDAR
==================================================

Avoid scope creep.

Phase 1 should prioritize:

natural-language appointment need
+
Care Team resolution
+
capability routing
+
direct slots when available
+
request/human fallback
+
confirmation
+
barrier awareness
+
preparation
+
follow-up.

==================================================
155. IMPLEMENTATION AUDIT FIRST
==================================================

Before coding, inspect:

Care Team

Care Circle

Barrier Engine

EMMI Orchestrator

Clinical Safety Engine

calendar/scheduling integrations

Google Calendar if used

practice scheduling APIs

existing appointments

notifications

reminders

My Care

patient state

permissions.

Document:

what already exists

what is mock

what must be created.

==================================================
156. PROVIDER CALENDAR VS PATIENT CALENDAR
==================================================

Do not confuse:

provider scheduling availability

with:

patient personal calendar.

Patient calendar can receive confirmed event.

Provider availability must come from authorized scheduling source.

==================================================
157. SECURITY
==================================================

All booking/update/cancel operations must be backend-authorized.

Do not trust frontend role/state alone.

==================================================
158. ROLE / RELATIONSHIP
==================================================

Appointment access should respect:

PATIENT

PERSONAL REPRESENTATIVE

CARE CIRCLE permissions

CARE TEAM

etc.

Care Circle member cannot automatically cancel patient appointments unless explicitly permitted by product/authorization design.

==================================================
159. PERSONAL REPRESENTATIVE
==================================================

If an authorized Personal Representative is acting for patient:

appointment workflow can operate according to verified authority.

Keep audit:

who initiated action.

==================================================
160. AUDIT WHO ACTED
==================================================

Record:

patient

personal representative

Care Team

EMMI-assisted patient action

system.

==================================================
161. FINAL ACCEPTANCE CRITERIA
==================================================

PASS only if:

1. Patient can request appointment conversationally.

2. EMMI checks safety before ordinary scheduling.

3. EMMI resolves provider from Care Team when possible.

4. Missing providers can enter Care Team workflow.

5. Scheduling capability is explicitly resolved.

6. Direct booking only uses real availability.

7. Request flow never claims confirmed appointment.

8. Human coordination exists as fallback.

9. Patient sees clear appointment/request status.

10. Existing appointments prevent accidental duplicates.

11. Reschedule and cancel use explicit workflows.

12. Cancellation requires confirmation.

13. Appointment barriers integrate with Barrier Engine.

14. Care Circle can assist only through explicit scoped permissions.

15. Appointment preparation is available.

16. Patient can review what they want to discuss.

17. Reminders are explicit and verified.

18. Follow-up can detect attended/missed/rescheduled visits.

19. My Care shows Upcoming Care clearly.

20. Runtime facts come from trusted tools.

21. Tool failures never result in fabricated confirmation.

22. Same EMMI voice and conversation persist.

23. Barge-in works.

24. Mobile 384px is excellent.

25. 150% font scaling remains usable.

26. Backend enforces access/security.

==================================================
162. FINAL PRODUCT PRINCIPLE
==================================================

Appointments should not be treated as isolated calendar events.

An appointment is part of the patient's care journey.

The experience should connect:

GOALS
↓
BARRIERS
↓
APPOINTMENT NEED
↓
CARE TEAM
↓
SCHEDULING
↓
PREPARATION
↓
ATTENDANCE
↓
FOLLOW-UP
↓
NEXT CARE ACTION.

EMMI should make this feel simple.

The patient should be able to say:

“I need to see my doctor.”

and ITERA should handle the complexity behind that statement.

The platform determines:

WHO
↓
HOW
↓
WHEN
↓
WHAT IS CONFIRMED
↓
WHAT COULD GET IN THE WAY
↓
WHAT HAPPENS NEXT.

Do not build merely:

BOOK AN APPOINTMENT.

Build:

COORDINATE MY CARE.
