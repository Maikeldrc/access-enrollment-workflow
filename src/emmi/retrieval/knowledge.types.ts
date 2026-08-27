export type LocaleCode = "EN" | "ES" | "KR";

export type KnowledgeMetadata = {
  id: string;
  title: string;
  category: string;
  program?: string;
  risk_level?: "low" | "medium" | "high";
  requires_patient_context?: boolean;
  requires_tool_when_personalized?: boolean;
  version?: string;
  last_reviewed?: string;
};

export type KnowledgeChunk = {
  id: string;
  text: string;
  sourcePath: string;
  metadata: KnowledgeMetadata;
};

export type RetrievalRequest = {
  query: string;
  locale: LocaleCode;
  program?: string;
  categories?: string[];
  topK?: number;
};
