# Auditoría de continuidad conversacional de EMMI

Fecha: 2026-08-27  
Alcance: Patient Enrollment Experience completo, ACCESS y journeys compartidos.

## Diagnóstico de causa raíz

La navegación visual usa una sola aplicación y normalmente no desmontaba EMMI. Sin embargo, la conversación no tenía un ciclo de vida central: la instrucción de Gemini capturaba la pantalla solo al abrir el socket, los cambios de pantalla enviaban narraciones aisladas sin un sobre conversacional persistente, un refresh no restauraba intención/turnos, y el chat escrito previo a activar voz no se incorporaba a la nueva sesión. El modelo podía interpretar cada narración como un comienzo nuevo y generar un saludo improvisado.

No se encontró la frase reportada “Hola María, ¿cómo te sientes hoy?” hardcoded. Es una generación no deseada favorecida por contexto congelado y ausencia de una política estricta de saludo.

## Decisión arquitectónica

- `EmmiConversationManager` es la fuente única de estado conversacional.
- Una navegación normal cambia a `CONTINUATION`; volver usa `BACK_NAVIGATION`; refresh/socket nuevo usa `TECHNICAL_RECONNECT`; cambio de idioma usa `LOCALE_CHANGE`; un regreso real posterior usa `RESUME`.
- `hasGreeted` persiste por paciente/escenario. Solo `INITIAL` permite presentación y saludo.
- Voz y texto registran turnos en el mismo resumen compacto.
- Cada turno Live recibe un `TRUSTED LIVE CONTEXT UPDATE` con pantalla, etapa, objetivo e intención vigentes.
- Gemini Live activa session resumption y context-window compression. Se conserva siempre el handle más reciente.
- No se reproduce audio del cliente por índice al reconectar: el SDK no expone en esta integración una confirmación segura para reconstruir audio parcialmente consumido. Se reanuda semánticamente con el handle y el resumen, evitando duplicar palabras del paciente.
- Un guard de desarrollo bloquea saludos inesperados y emite `EMMI_UNEXPECTED_GREETING`.

## Matriz patient-facing

| Pantalla | Propósito conversacional | Entrada esperada | Saludo | Contexto que debe conservar | Puente / siguiente acción |
|---|---|---|---|---|---|
| INVITATION | Presentar EMMI y la opción de cuidado | INITIAL o RESUME | Solo INITIAL | programa, source, physician | continuar a quién completa |
| DECISION_MAKER | Identificar quién toma decisiones | CONTINUATION | No | invitación, rol aún pendiente | personal representative o identidad |
| PERSONAL_REPRESENTATIVE_DETAILS | Capturar identidad del representante | CONTINUATION | No | rol elegido, paciente objetivo | verificación móvil |
| REPRESENTATIVE_MOBILE_VERIFICATION | Verificar contacto | CONTINUATION | No | representante, teléfono parcial | autoridad |
| REPRESENTATIVE_AUTHORITY_ATTESTATION | Confirmar autoridad | CONTINUATION | No | rol, verificación | identidad del paciente |
| REPRESENTATIVE_AUTHORITY_ESCALATION | Derivar revisión humana | ERROR_RECOVERY | No | razón de revisión | ayuda del care team |
| IDENTITY_VERIFICATION | Confirmar identidad del paciente | CONTINUATION | No | completionRole, DOB/ZIP son del paciente | cuidado disponible |
| CARE_RECOMMENDATION | Explicar qué incluye el cuidado | CONTINUATION | No | condición, source, physician | eligibility |
| HOW_CARE_WORKS | Explicar coordinación | CONTINUATION | No | cuidado explicado, physician | eligibility |
| ACCESS_PRE_ELIGIBILITY_NOTICE | Explicar evaluación CMS | CONTINUATION | No | ACCESS, transparencia previa | Medicare identifier |
| ACCESS_MEDICARE_IDENTIFIER | Recoger dato Medicare | CONTINUATION | No | acknowledgment, identidad | procesar eligibility |
| ACCESS_ELIGIBILITY_PROCESSING | Mantener orientación durante espera | CONTINUATION | No | solicitud en curso | resultado |
| ACCESS_ELIGIBILITY_RESULT | Explicar resultado confirmado | CONTINUATION | No | resultado real del tool | disclosures o outcome |
| DISCLOSURE | Revisar información importante | CONTINUATION | No | eligibility, costo verificado | consentimiento |
| CONSENT_REVIEW | Decisión informada | CONTINUATION | No | disclosures, signing role | procesar enrollment |
| ENROLLMENT_PROCESSING / ACCESS_ALIGNMENT_PROCESSING | Confirmar que se está procesando | CONTINUATION | No | consentimiento guardado | confirmación |
| ENROLLMENT_CONFIRMED | Cerrar enrollment | CONTINUATION | No | enrollment COMPLETED | Getting Started ahora o después |
| ONBOARDING | Presentar setup de cuidado | CONTINUATION / RESUME | No genérico | enrollment completo, progreso | subflujo elegido |
| CLINICAL_VERIFICATION | Revisar información de salud | CONTINUATION | No | condiciones y cambios | volver a setup |
| MEDICATIONS_REVIEW | Revisar medicamentos | CONTINUATION | No | lista y cambios guardados | volver a setup |
| CARE_PREFERENCES | Confirmar preferencias | CONTINUATION | No | idioma/contacto | volver a setup |
| GOALS / MY_GOALS | Descubrir y gestionar metas | CONTINUATION | No | meta primaria/secundaria, plan | siguiente tarea real |
| ACCESS_BASELINE / ACCESS_MEASURE | Iniciar baseline | CONTINUATION | No | meta clínica, estado baseline | ruta de device |
| ACCESS_BP_DEVICE_VERIFICATION | Elegir cómo obtener medición | CONTINUATION | No | BP como objetivo aplicable | lookup/setup/fulfillment |
| ACCESS_BP_DEVICE_RESULT | Confirmar monitor físico | CONTINUATION | No | assigned device, últimos 4 | preparación |
| ACCESS_BP_DEVICE_INFO | Identificar monitor propio | CONTINUATION | No | mismatch/uncertainty | compatibilidad/ayuda |
| ACCESS_BP_SHIPPING_ADDRESS | Confirmar envío | CONTINUATION | No | device needed, cuff | fulfillment |
| ACCESS_BP_FULFILLMENT_CONFIRMED | Confirmar solicitud | CONTINUATION | No | device pendiente | continuar baseline |
| ACCESS_BP_GUIDED_SETUP | Preparar monitor | CONTINUATION | No | device confirmado | medición guiada |
| ACCESS_BP_MEASUREMENT | Obtener medición verificable | CONTINUATION | No | source/device, conteo | resultado o siguiente lectura |
| ACCESS_BP_BASELINE_RESULT | Resumir baseline | CONTINUATION | No | lecturas verificadas | cuidado |
| ACCESS_BP_ESCALATION | Escalación segura | ERROR_RECOVERY | No | regla clínica, acción segura | care team/911 según tool |
| RPM_DEVICE_PATH | Elegir ruta de monitor | CONTINUATION | No | programa y disponibilidad | address/setup |
| RPM_ADDRESS_CONFIRMATION | Confirmar dirección | CONTINUATION | No | device fulfillment | setup |
| RPM_DEVICE_SETUP | Guiar conexión | CONTINUATION | No | vendor/model | primera lectura |
| RPM_FIRST_READING | Confirmar transmisión | CONTINUATION | No | device/source | monitoring ready |
| RPM_MONITORING_READY | Cerrar activación RPM | CONTINUATION | No | transmisión verificada | ongoing care |
| CARE_CIRCLE_INVITE / SENT / PERMISSIONS | Apoyo opcional | CONTINUATION | No | rol no decisor, permisos | volver al punto de origen |
| SHARE_ACCESS | Compartir información pública | CONTINUATION | No | enrollment completo, no PHI | volver al journey |
| ONBOARDING_COMPLETE | Confirmar care setup | CONTINUATION | No | tareas completadas | My Care |
| CALLBACK_CONFIRMED | Confirmar ayuda humana | CONTINUATION | No | request id/intent | continuar o esperar |
| OUTCOME_STOPPED | Explicar cierre seguro | CONTINUATION | No | outcome | opciones disponibles |
| OFFER_INVALID / OFFER_EXPIRED | Explicar error recuperable | ERROR_RECOVERY | No | razón técnica, sin inventar | soporte humano |

## Telemetría

- `EMMI_CONVERSATION_CONTEXT_UPDATED`
- `EMMI_CONVERSATION_TURN_RECORDED`
- `EMMI_SESSION_RESUMPTION_UPDATED`
- `EMMI_TECHNICAL_RECONNECT`
- `EMMI_UNEXPECTED_GREETING`
- eventos existentes de barge-in, voice identity y graceful handoff

No se registran blobs de audio. El contexto persistido se limita a los últimos turnos y un resumen compacto del prototipo.

## Riesgos residuales y controles

- Una sesión Live puede finalizar por límite del proveedor; se usa el handle más reciente y reconstrucción semántica.
- El cambio de idioma inicia una sesión de audio nueva porque la voz y el idioma forman parte de la configuración; se mantiene la conversación, sin un nuevo saludo.
- En Kreyòl la voz Live sigue deshabilitada cuando el proveedor no ofrece la voz canónica aprobada; el texto conserva el mismo contexto.
- Las respuestas deterministas sin voz se incorporan al gestor para que una activación posterior de voz continúe desde ellas.

## Resultado de QA

- Unit/integration: 159 pruebas aprobadas.
- EMMI mobile E2E: 4 escenarios aprobados.
- Build de producción: aprobado.
- `git diff --check`: sin errores de whitespace.
- Navegador local: al abrir EMMI después de una conversación previa muestra “¿Cómo puedo ayudarle?” y no vuelve a presentarse.
- Navegador local tras refresh: conserva el mismo comportamiento de continuación y no registra errores de consola.
