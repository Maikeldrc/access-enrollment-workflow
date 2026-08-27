import { EMMS_SYSTEM_PROMPT } from "./prompts/system-prompt";
import { retrieveKnowledge } from "./retrieval/retriever";

export type EmmiRuntimeContext = {
  patientId?: string;
  activeLocale: "EN" | "ES" | "KR";
  program?: string;
  track?: string;
  enrollmentSource?: string;
  physicianDisplayName?: string;
  currentStage?: string;
  currentScreen?: string;
};

export class EmmiService {
  async buildContext(question: string, runtime: EmmiRuntimeContext) {
    const knowledge = await retrieveKnowledge({
      query: question,
      locale: runtime.activeLocale,
      program: runtime.program,
    });

    return {
      systemPrompt: EMMS_SYSTEM_PROMPT,
      runtime,
      knowledge,
    };
  }
}
