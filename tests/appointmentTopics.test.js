import { describe, expect, it } from "vitest";
import { parseAppointmentTopicCommands } from "../src/emmi/appointmentTopics.js";

const prep = { appointmentId: "APPT-1", topics: ["Mareos", "Presión arterial"] };

describe("appointment topic language", () => {
  it.each([
    "muéstrame la lista",
    "enséñamela",
    "quiero ver mis preguntas"
  ])("opens the real list for %s", phrase => {
    expect(parseAppointmentTopicCommands({ question: phrase, appointmentPrep: prep })).toEqual([{ operation: "OPEN" }]);
  });

  it.each([
    ["qué tengo apuntado", { operation: "LIST" }],
    ["cuál era el primero", { operation: "READ_ITEM", index: 0 }],
    ["quita lo de la presión", { operation: "REMOVE", target: "presión", index: null }],
    ["cambia el primero para que diga Dolor de cabeza", { operation: "UPDATE", target: "primero", index: 0, value: "Dolor de cabeza" }],
    ["pon lo de la presión primero", { operation: "MOVE", target: "presión", index: null, position: 0 }],
    ["agrega preguntas sobre el sueño", { operation: "ADD", value: "preguntas sobre el sueño" }],
    ["Quiero hablar con el doctor sobre mis mareos", { operation: "ADD", value: "mis mareos" }],
    ["También mi presión de 150 con 90", { operation: "ADD", value: "mi presión de 150 con 90" }]
  ])("maps %s to a structured operation", (phrase, command) => {
    expect(parseAppointmentTopicCommands({ question: phrase, appointmentPrep: prep })).toEqual([command]);
  });

  it("keeps multi-intent operations in spoken order", () => {
    expect(parseAppointmentTopicCommands({ question: "muéstrame la lista y después pon lo de la presión primero", appointmentPrep: prep })).toEqual([
      { operation: "OPEN" },
      { operation: "MOVE", target: "presión", index: null, position: 0 }
    ]);
  });

  it("does not create appointment commands without an active appointment", () => {
    expect(parseAppointmentTopicCommands({ question: "muéstrame la lista", appointmentPrep: null })).toEqual([]);
  });
});
