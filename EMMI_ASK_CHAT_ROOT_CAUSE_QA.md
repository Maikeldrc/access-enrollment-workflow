# Ask EMMI / EMMI Chat — Root Cause y QA

Fecha: 2026-08-27

## Root cause

La base de conocimiento y el retrieval ya existían, y la experiencia de voz podía utilizar `searchKnowledge`. Sin embargo, el chat escrito no pasaba por ese sistema. `Ask EMMI` llamaba a una cadena separada de reglas locales en `src/app.js`; cuando ninguna expresión regular coincidía, devolvía el mismo mensaje genérico de ayuda de pantalla.

Por tanto, la causa exacta era una combinación de:

- el chat de texto nunca llamaba al retrieval para preguntas educativas;
- texto y voz utilizaban rutas conceptualmente distintas;
- el fallback genérico se mostraba como respuesta normal y ocultaba la falta de routing;
- no existía un router explícito que separara conocimiento general, datos runtime, ayuda de pantalla y seguridad clínica.

No era un problema de falta de documentos: los documentos aprobados estaban presentes. Tampoco era necesario atribuir el comportamiento repetido a Gemini: el chat escrito no intentaba usar ni retrieval ni generación grounded en esa ruta.

## Corrección implementada

- Se agregó un `EmmiTextOrchestrator` answer-first.
- Las preguntas patient-specific usan tools runtime, no la base estática.
- Las preguntas educativas consultan el retrieval, con query expansion y continuidad conversacional.
- La seguridad clínica se evalúa antes que knowledge/runtime general.
- Screen help solo se usa cuando la pregunta se refiere realmente a la pantalla.
- La generación grounded de texto utiliza el mismo system prompt y las mismas reglas de EMMI.
- Si el modelo de texto no está configurado localmente, se usa una respuesta determinista basada en chunks aprobados; nunca se sustituye por el antiguo mensaje genérico.
- Si retrieval falla, se informa de forma transparente y se registra el fallo.
- Se agregaron tools para medicamentos, metas, care team y siguiente acción.
- Se agregó metadata de auditoría por turno: sesión, turno, pantalla, intent, chunks, tools, runtime facts, modo de respuesta, modelo y prompt.
- El paciente ficticio permanece estable al cambiar de idioma; solo cambia si cambia el escenario clíico.

## Incidencias adicionales encontradas durante QA

1. `¿Está conectado mi monitor?` no coincidía por el orden de palabras del patrón en español. Corregido y cubierto por regresión.
2. El retrieval de CCM también devolvía documentos de CCM + RPM. El fallback local podía priorizar la combinación o el programa activo ACCESS sobre la pregunta explícita. Corregido: la entidad nombrada por el paciente tiene prioridad y una combinación solo se usa si se pregunta por ella o es el programa activo.
3. Cambiar EN → ES cambiaba el fixture del paciente, alterando datos runtime. Corregido mediante identidad de contexto estable durante la sesión.

## QA realizado

- Preguntas distintas sobre ACCESS, CCM y RPM producen respuestas semánticamente distintas.
- Follow-up `y cuál es la diferencia` resuelve ACCESS vs CCM desde el contexto reciente.
- Costo, elegibilidad, medicamentos registrados, monitor, metas, médico y siguiente paso usan tools runtime.
- Ayuda de pantalla solo se activa para preguntas de UI.
- Preguntas sobre revisión de medicamentos usan knowledge aprobado.
- Dolor fuerte en el pecho activa la ruta de seguridad y muestra acción 911.
- EN, ES y KR/Kreyòl mantienen el idioma activo.
- Se simuló indisponibilidad del retrieval y se verificó el mensaje transparente.
- Se verificó el estado visible `EMMI is thinking…` / traducciones.
- Se verificó en UI local que el monitor conectado conserva el mismo dato al cambiar EN → ES.

## Configuración

- El endpoint de texto usa `GEMINI_TEXT_MODEL` cuando se configura.
- Default: `gemini-2.5-flash`.
- `GEMINI_API_KEY` habilita la redacción generativa grounded en el servidor.
- Sin esa variable en local, la aplicación sigue respondiendo desde conocimiento aprobado mediante el fallback determinista y registra `EMMI_RESPONSE_GENERATION_FAILED` en development.

