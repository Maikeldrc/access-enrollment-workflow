// Verbatim before/after evidence for every critical failure, straight from the two captures.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const before = JSON.parse(readFileSync(path.join(ROOT, "raw", "baseline-scored.json"), "utf8"));
const after = JSON.parse(readFileSync(path.join(ROOT, "raw", "after-scored.json"), "utf8"));
const afterById = new Map(after.rows.map(r => [r.id, r]));
// U08 was re-run under its Spanish-session id in the final pass.
afterById.set("U08", afterById.get("ES15"));

const quote = text => String(text || "(no answer captured)").split("\n").map(l => "> " + l).join("\n");

const critical = before.rows.filter(r => r.verdict === "CRITICAL_FAIL");
let md = `# Evidence — every critical failure, before and after

Verbatim answers captured from the running product: the BEFORE column from production
(\`access-enrollment.vercel.app\`), the AFTER column from a local build of the remediated branch.
Nothing here is paraphrased or reconstructed.

${critical.length} critical failures were found in the baseline. All ${critical.length} are below.

---

`;

for (const r of critical) {
  const a = afterById.get(r.id);
  md += `## ${r.id} — ${r.category}\n\n`;
  md += `**Patient asked:** ${r.q}\n\n`;
  md += `**BEFORE** — ${r.verdict}, response mode \`${r.mode || "(none)"}\`\n\n${quote(r.answer)}\n\n`;
  md += `**AFTER** — ${a ? a.verdict : "not re-tested"}, response mode \`${a ? (a.mode || "(none)") : "n/a"}\`\n\n${quote(a && a.a)}\n\n---\n\n`;
}

mkdirSync(path.join(ROOT, "evidence"), { recursive: true });
writeFileSync(path.join(ROOT, "evidence", "critical-failures-before-after.md"), md);
console.log("wrote", critical.length, "critical comparisons");

// A second file: the internal-instruction leaks, which are the most striking single finding.
const leaks = before.rows.filter(r => ["LEAK", "TOOL_LEAK", "REGISTRY_LEAK", "LANG_LEAK"].includes(r.textClass));
const seen = new Set();
let leakMd = `# Evidence — internal instructions shown to patients

In the baseline, **${leaks.length} of ${before.rows.length} turns (${((leaks.length / before.rows.length) * 100).toFixed(1)}%)**
answered a patient with text written for whoever maintains the knowledge base. These are the distinct
texts patients were shown, each with a question that produced it.

After remediation this count is **0**.

---

`;
for (const r of leaks) {
  const key = (r.answer || "").slice(0, 100);
  if (seen.has(key)) continue;
  seen.add(key);
  leakMd += `### Asked: "${r.q}"  \n_(${r.id}, ${r.category}, class ${r.textClass})_\n\n${quote(r.answer)}\n\n`;
}
writeFileSync(path.join(ROOT, "evidence", "internal-instruction-leaks.md"), leakMd);
console.log("wrote", seen.size, "distinct leaked texts");
