// Runs the real retriever over every baseline question and reports which document would now
// answer it, so a retrieval change can be judged against the questions patients actually asked
// rather than against a handful of hand-picked examples.
import { readFileSync } from "node:fs";
import { retrieveKnowledge, resetKnowledgeIndex } from "../../../server/emmiKnowledge.js";

const data = JSON.parse(readFileSync(new URL("./baseline-export.json", import.meta.url), "utf8"));
const scored = JSON.parse(readFileSync(new URL("./baseline-scored.json", import.meta.url), "utf8"));
const verdictOf = new Map(scored.rows.map(r => [r.id, r.verdict]));

resetKnowledgeIndex();
const counts = {};
const perQuestion = [];
for (const [id, q] of data.rec) {
  const r = retrieveKnowledge({ query: q, runtime: { program: "ACCESS", currentScreen: "MY_CARE" }, topK: 4 });
  const top = r.chunks[0];
  const src = top ? top.sourceId : "(none)";
  counts[src] = (counts[src] || 0) + 1;
  perQuestion.push({ id, q, src, score: top?.score ?? 0, intent: r.intent, verdict: verdictOf.get(id) });
}
console.log("Top document per question, across all", data.rec.length, "baseline questions:");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(v).padStart(4), k);
const empty = perQuestion.filter(p => p.src === "(none)").length;
console.log("\nno document matched:", empty);
const weak = perQuestion.filter(p => p.score > 0 && p.score <= Number(process.argv[2] || 6));
console.log(`weakly matched (score <= ${process.argv[2] || 6}):`, weak.length);
console.log("\nExamples of weak matches:");
for (const p of weak.slice(0, 12)) console.log(`  ${String(p.score).padStart(3)}  ${p.src.padEnd(28)} ${p.q.slice(0, 62)}`);
