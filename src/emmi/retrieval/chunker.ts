import type { KnowledgeChunk } from "./knowledge.types";

export function chunkMarkdown(
  sourcePath: string,
  text: string,
  targetChars = 3200,
  overlapChars = 400
): KnowledgeChunk[] {
  // Starter implementation. Replace with heading-aware/token-aware chunking.
  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + targetChars);
    chunks.push({
      id: `${sourcePath}#${index++}`,
      text: text.slice(start, end),
      sourcePath,
      metadata: {
        id: sourcePath,
        title: sourcePath,
        category: "unparsed",
      },
    });
    if (end === text.length) break;
    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
