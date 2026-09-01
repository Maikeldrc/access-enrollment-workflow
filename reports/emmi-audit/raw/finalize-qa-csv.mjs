// Fills the columns of emmi-qa-results.csv that could only be known after remediation:
// the retest result, the recommended fix, and a one-line expected-answer summary.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const before = JSON.parse(readFileSync(path.join(ROOT, "raw", "baseline-scored.json"), "utf8"));
const after = JSON.parse(readFileSync(path.join(ROOT, "raw", "after-scored.json"), "utf8"));
const afterById = new Map(after.rows.map(r => [r.id, r]));
afterById.set("U08", afterById.get("ES15"));

// One recommended fix per root cause, so the column says what was actually done.
const FIX = {
  "KB_AUTHORING_VOICE+GENERATION_LAYER_DOWN": "CHANGE-01 bind fetch; CHANGE-02 English patient answer + authoring-voice filter",
  "LANGUAGE+GENERATION_LAYER_DOWN": "CHANGE-01 bind fetch; CHANGE-02 English patient answer",
  "LOW_RECALL/MISSING_KNOWLEDGE": "CHANGE-03 retrieval + keyword coverage; new knowledge page where one was missing",
  "INTENT_CLASSIFICATION (SCREEN_HELP over-capture)": "CHANGE-07 anchor the generic screen-help phrases",
  "LANGUAGE_ROUTER_PRECEDES_SAFETY": "CHANGE-05 skip the language interstitial for any safety turn",
  "RETRIEVAL_FAILURE (wrong chunk) + GENERATION_LAYER_DOWN": "CHANGE-01 bind fetch; CHANGE-03 keyword phrases, stopwords, relevance floor",
  "TOOL_RESULT_INCOMPLETE_FOR_MULTI_INTENT": "Open — compound intent decomposition not implemented",
  OTHER: "See emmi-kb-changelog.md"
};

const esc = v => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const SCORE = { PASS: [5,5,5,5,5,5,5], PARTIAL: [3,2,3,3,4,3,2], FAIL: [1,1,2,2,3,1,1], CRITICAL_FAIL: [1,1,1,1,1,1,1] };
const header = ["test_id","category","subcategory","language","question_type","patient_question","conversation_context",
  "actual_answer","expected_answer_summary","result","severity","accuracy_score","completeness_score","clarity_score",
  "patient_friendliness_score","safety_score","groundedness_score","actionability_score","root_cause","source_required",
  "recommended_fix","retest_result","notes"];

const rows = [header.join(",")];
for (const r of before.rows) {
  const s = SCORE[r.verdict];
  const sev = r.verdict === "CRITICAL_FAIL" ? "P0"
    : r.verdict === "FAIL" ? (/COST|ELIG|EMERG|CLIN|MED|PRIVACY|IDENTITY/.test(r.category) ? "P1" : "P2")
      : r.verdict === "PARTIAL" ? "P3" : "-";
  const a = afterById.get(r.id);
  const retest = !a ? "not re-tested"
    : ["FAIL", "CRITICAL_FAIL", "PARTIAL"].includes(r.verdict)
      ? `${r.verdict} → ${a.verdict}`
      : `${r.verdict} → ${a.verdict} (regression check)`;
  rows.push([
    r.id, r.category, r.textClass,
    /^(U0|U1|CMP16|CMP37|CMP43|CMP50|J12)/.test(r.id) ? "ES/KR" : "EN",
    /^MT/.test(r.id) ? "multi-turn" : /^CMP/.test(r.id) ? "compound" : /^INJ/.test(r.id) ? "injection" : /^CON/.test(r.id) ? "contradiction" : "single",
    r.q, /^MT/.test(r.id) ? `conversation ${r.id.split(".")[0]}` : "",
    r.answer, "", r.verdict, sev, ...s, r.rootCause,
    /COST|ELIG|OVERLAP|INSUR|PRIVACY/.test(r.category) ? "CMS.gov / Medicare.gov — see research-findings.md" : "",
    FIX[r.rootCause] || FIX.OTHER, retest,
    a && a.a ? `after: ${a.a.slice(0, 220)}` : ""
  ].map(esc).join(","));
}
writeFileSync(path.join(ROOT, "emmi-qa-results.csv"), rows.join("\n") + "\n");

const moved = before.rows.filter(r => {
  const a = afterById.get(r.id);
  return a && ["FAIL", "CRITICAL_FAIL"].includes(r.verdict) && ["PASS", "PARTIAL"].includes(a.verdict);
});
const regressed = before.rows.filter(r => {
  const a = afterById.get(r.id);
  return a && r.verdict === "PASS" && ["FAIL", "CRITICAL_FAIL"].includes(a.verdict);
});
console.log("rows:", before.rows.length);
console.log("failing → improved:", moved.length);
console.log("previously passing that regressed:", regressed.length, regressed.map(r => r.id).join(", "));
