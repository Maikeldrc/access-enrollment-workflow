# Corrección de voz y conversación de EMMI

Fecha: 2026-08-29

## Resultado del recorrido real

Se completó el flujo simulado en producción desde la invitación hasta la configuración del cuidado. Se probaron preguntas naturales, preguntas de varias partes, seguridad clínica, privacidad e interrupciones mientras EMMI hablaba.

Problemas reproducidos:

- transcripciones visibles `[object` y `[object Object]`;
- etiquetas internas `<speech>` visibles y una etiqueta sin cerrar;
- narración antigua de medicamentos reapareciendo en metas y cierre;
- una pregunta de costo + salida respondió solo la segunda parte;
- pausas normales dividieron una intervención en dos y perdieron la pregunta final;
- una frase española fue transcrita como italiano y EMMI infirió incorrectamente un cambio de medicamento;
- varias interrupciones no fueron capturadas;
- el límite de tokens por IP produjo el estado engañoso de voz temporalmente ocupada durante reconexiones rápidas;
- la respuesta de emergencia para 190/120 con mareo sí fue correcta: indicó llamar al 911 y no esperar.

## Correcciones implementadas

- Se añadió una frontera de saneamiento para transcripciones de Gemini Live.
- Los objetos del SDK y las etiquetas internas ya no pueden entrar en la interfaz ni en el historial.
- Si el proveedor devuelve un sobre de narración, solo se conserva el texto final destinado al paciente.
- La narración de pantalla ya no se guarda como un turno conversacional del modelo.
- Las transcripciones llevan metadatos de generación, pantalla y prioridad para evitar mezclar turnos.
- El prompt de narración dejó de usar etiquetas `<speech>` y prohíbe repetir contenido de pantallas anteriores.
- EMMI debe pedir aclaración ante ASR incoherente, cambio inesperado de idioma o una posible modificación de medicamentos no expresada claramente.
- En identidad, EMMI no debe pedir que fecha de nacimiento o código postal se digan en voz alta.
- Las preguntas con varias partes deben responderse completas; costo + salida tiene una respuesta determinista y usa el runtime de costo.
- La ventana de fin de habla aumentó de 800 ms a 1200 ms para conservar pausas naturales de adultos mayores.
- El límite de tokens de voz aumentó de 10 a 30 por minuto/IP para permitir reconexiones normales y redes clínicas compartidas sin eliminar el límite de abuso.

## Verificación

- Pruebas unitarias: 814 aprobadas.
- Pruebas E2E de conversación y audio en Chrome móvil: 27 aprobadas.
- Captura moderna: AudioWorklet, sin ScriptProcessorNode.
- Alternancia rápida de voz: aprobada, sin tuberías duplicadas ni rechazos no controlados.
- Compilación de producción con Vite: aprobada.

## Estado

Las correcciones observadas están cubiertas por regresiones automatizadas. La validación audible final debe repetirse contra la nueva versión desplegada para confirmar el comportamiento del proveedor real y del ASR, que no puede certificarse únicamente con pruebas locales.

