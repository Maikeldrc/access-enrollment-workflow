import fs from "node:fs/promises";
import path from "node:path";

export async function loadMarkdownKnowledge(knowledgeRoot: string) {
  const results: Array<{ path: string; text: string }> = [];

  async function walk(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        results.push({ path: full, text: await fs.readFile(full, "utf8") });
      }
    }
  }

  await walk(knowledgeRoot);
  return results;
}
