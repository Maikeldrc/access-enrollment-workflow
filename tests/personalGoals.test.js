import { describe, expect, it } from "vitest";
import {
  GOAL_STATEMENT_KINDS,
  PERSONAL_GOAL_TEMPLATES,
  STARTER_PERSONAL_GOAL_IDS,
  classifyGoalStatement,
  personalGoalTemplate,
  statementIsUsableAsGoalTitle
} from "../src/personalGoals.js";

const kindOf = statement => classifyGoalStatement(statement).kind;

describe("telling a goal from an action", () => {
  // The sentence the whole feature exists for. It is a schedule, and a schedule is not a goal.
  it.each([
    "Quiero caminar 20 minutos cuatro veces por semana",
    "I want to walk 20 minutes four times a week",
    "caminar 30 minutos todos los días",
    "Quiero comer menos sal",
    "I want to take my medicine every day",
    "beber más agua",
    "Quiero medirme la presión diariamente",
    "hacer ejercicio tres veces por semana",
    "Mwen vle mache 20 minit kat fwa nan semèn nan"
  ])("reads %j as an action", statement => {
    expect(kindOf(statement)).toBe(GOAL_STATEMENT_KINDS.ACTION);
    expect(statementIsUsableAsGoalTitle(statement)).toBe(false);
  });

  // An outcome the patient stated themselves. Their words are kept: proposing our own sentence
  // here would be the app deciding what they meant.
  it.each([
    "Quiero dormir mejor",
    "Quiero poder caminar con mi esposa sin cansarme",
    "Mejorar mi movilidad",
    "I want to feel more confident managing my health",
    "Quiero tener más independencia en mis actividades diarias",
    "Quiero mejorar mis hábitos de alimentación"
  ])("reads %j as a goal", statement => {
    expect(kindOf(statement)).toBe(GOAL_STATEMENT_KINDS.GOAL);
    expect(statementIsUsableAsGoalTitle(statement)).toBe(true);
  });

  it("keeps the patient's own wording when they already stated an outcome", () => {
    const verdict = classifyGoalStatement("Quiero poder caminar con mi esposa sin cansarme");
    expect(verdict.goal.title).toBe("Poder caminar con mi esposa sin cansarme");
    // A template is attached for the icon and for suggested steps, never to replace the sentence.
    expect(verdict.goal.templateId).toBe("WALKING_ENDURANCE");
  });

  it("strips the wanting and keeps the doing when the patient describes a routine", () => {
    const verdict = classifyGoalStatement("Quiero caminar 20 minutos cuatro veces por semana");
    expect(verdict.action).toEqual({ title: "Caminar 20 minutos cuatro veces por semana", frequency: "few-days" });
    expect(verdict.goal.templateId).toBe("WALKING_ENDURANCE");
    expect(verdict.goal.title.es).toBe("Mejorar mi capacidad para caminar sin cansarme tanto");
  });

  it("maps a daily routine onto the frequency vocabulary the plan already speaks", () => {
    expect(classifyGoalStatement("caminar 30 minutos todos los días").action.frequency).toBe("daily");
    expect(classifyGoalStatement("I want to walk every day").action.frequency).toBe("daily");
    expect(classifyGoalStatement("caminar 20 minutos cuatro veces por semana").action.frequency).toBe("few-days");
  });

  it("proposes the outcome an action plausibly serves, per example from the product brief", () => {
    expect(classifyGoalStatement("Quiero comer menos sal").goal.templateId).toBe("EATING_HABITS");
    expect(classifyGoalStatement("Quiero tomar mis medicinas todos los días").goal.templateId).toBe("MEDICATION_MANAGEMENT");
    expect(classifyGoalStatement("hacer ejercicio tres veces por semana").goal.templateId).toBe("MORE_ACTIVE");
  });

  it("asks instead of guessing when a routine matches no outcome we know", () => {
    const verdict = classifyGoalStatement("Quiero hacer eso dos veces por semana");
    expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.ACTION);
    expect(verdict.goal).toBeNull();
    expect(verdict.clarify.es).toContain("¿Qué le gustaría conseguir");
  });
});

describe("vague wishes", () => {
  it.each(["Quiero sentirme mejor", "I want to feel better", "estar mejor", "quiero estar más saludable"])(
    "asks one short question about %j rather than saving it",
    statement => {
      const verdict = classifyGoalStatement(statement);
      expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.VAGUE);
      expect(verdict.goal).toBeNull();
      expect(verdict.action).toBeNull();
      expect(verdict.clarify.es).toBe("¿Qué le gustaría poder hacer o sentir diferente?");
    }
  );

  it("treats an empty statement as nothing to classify, not as a goal", () => {
    expect(kindOf("   ")).toBe(GOAL_STATEMENT_KINDS.EMPTY);
    expect(kindOf(null)).toBe(GOAL_STATEMENT_KINDS.EMPTY);
  });
});

describe("clinical parameters stay with the care team", () => {
  it("never turns a requested blood pressure number into a goal", () => {
    const verdict = classifyGoalStatement("Quiero que mi presión sea 100/60");
    expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.CLINICAL_TARGET);
    expect(verdict.measure).toBe("BLOOD_PRESSURE");
    // The wish becomes an outcome the patient can own. The number is not in it.
    expect(verdict.goal.templateId).toBe("BLOOD_PRESSURE_CONFIDENCE");
    expect(JSON.stringify(verdict.goal.title)).not.toMatch(/100|60/);
    expect(verdict.careTeamTopic.es).toContain("Preguntar");
  });

  it("handles a weight amount the same way, as an outcome without a number", () => {
    const verdict = classifyGoalStatement("Quiero perder 10 libras");
    expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.CLINICAL_TARGET);
    expect(verdict.measure).toBe("WEIGHT");
    expect(verdict.goal.templateId).toBe("HEALTHIER_WEIGHT");
    expect(JSON.stringify(verdict.goal.title)).not.toMatch(/10|libras/);
  });

  it.each([
    ["Quiero que mi azúcar baje a 90", "GLUCOSE"],
    ["I want my A1c to be 6", "GLUCOSE"],
    ["Quiero bajar mi colesterol a 150", "CHOLESTEROL"]
  ])("guards %j", (statement, measure) => {
    const verdict = classifyGoalStatement(statement);
    expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.CLINICAL_TARGET);
    expect(verdict.measure).toBe(measure);
  });
});

describe("medication safety", () => {
  it.each([
    "Quiero dejar mi medicamento",
    "Quiero dejar de tomar mi medicina",
    "I want to stop taking my medication",
    "quiero bajar la dosis de mi pastilla"
  ])("never stores %j as a goal", statement => {
    const verdict = classifyGoalStatement(statement);
    expect(verdict.kind).toBe(GOAL_STATEMENT_KINDS.MEDICATION_CHANGE);
    expect(verdict.goal.templateId).toBe("TREATMENT_CONFIDENCE");
    expect(verdict.action).toBeNull();
    expect(verdict.careTeamTopic.es).toBe("Preguntar si debo continuar con este medicamento");
    expect(statementIsUsableAsGoalTitle(statement)).toBe(false);
  });
});

describe("the personal goal catalogue", () => {
  it("is outcome-shaped and carries no clinical numbers anywhere", () => {
    for (const [id, template] of Object.entries(PERSONAL_GOAL_TEMPLATES)) {
      for (const locale of ["en", "es", "ht"]) {
        expect(template.displayName[locale], `${id} ${locale}`).toBeTruthy();
        expect(template.displayName[locale], `${id} ${locale}`).not.toMatch(/\d/);
      }
      expect(template.suggestedActions.every(action => action.id && action.title.en && action.title.es && action.title.ht)).toBe(true);
      // A template never carries a threshold, a target or a measure: those belong to the care team.
      expect(Object.keys(template)).toEqual(expect.not.arrayContaining(["clinicalTarget", "baseline", "measure"]));
    }
  });

  it("offers a short starter list rather than the whole catalogue", () => {
    expect(STARTER_PERSONAL_GOAL_IDS.length).toBeLessThanOrEqual(6);
    expect(STARTER_PERSONAL_GOAL_IDS.every(id => personalGoalTemplate(id))).toBe(true);
  });

  it("returns null for an unknown template rather than throwing", () => {
    expect(personalGoalTemplate("NOT_A_TEMPLATE")).toBeNull();
    expect(personalGoalTemplate(undefined)).toBeNull();
  });
});
