// Aggregates the session transcripts in a folder into one table and overall metrics.
//   node reports/emmi-voice-audit/harness/summarise-sessions.mjs reports/emmi-voice-audit/transcripts/baseline
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { classifyLatency } from "./voice-harness.mjs";

const dir = process.argv[2];
const files = readdirSync(dir).filter(name => name.endsWith(".json")).sort();
const sessions = files.map(name => JSON.parse(readFileSync(join(dir, name), "utf8")));
const percentile = (values, p) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]; };
const speech = sessions.flatMap(s => s.turns.filter(t => t.kind === "speech").map(t => ({ ...t, session: s.session_id })));
const starts = speech.map(t => t.timing?.response_start_latency_ms).filter(v => v != null);
const vad = speech.map(t => t.timing?.provider_vad_window_ms).filter(v => v != null);
const overhead = speech.map(t => t.timing?.app_overhead_first_chunk_to_audible_ms).filter(v => v != null);
const localEnd = speech.map(t => t.timing?.local_speech_end_detected_ms_after_T1).filter(v => v != null);
const bargeIns = speech.filter(t => t.bargeIn);
const stops = bargeIns.map(t => t.interruption?.stop_latency_from_speech_start_ms).filter(v => v != null);
const contextBefore = speech.filter(t => t.conversation_context?.context_envelope_sent_before_answer).length;
const suppressed = speech.filter(t => (t.conversation_context?.app_transcript_suppression_events || []).length);
const problems = sessions.flatMap(s => s.turns.flatMap(t => (t.problem_detected || []).map(p => ({ session: s.session_id, turn: t.turn, p }))));
const navigations = sessions.flatMap(s => s.turns.filter(t => t.kind === "navigation"));
const summary = {
  sessions: sessions.length,
  spoken_turns: speech.length,
  total_turns: sessions.reduce((n, s) => n + s.turns.length, 0),
  long_sessions_15_plus_turns: sessions.filter(s => s.turns.length >= 15).length,
  long_sessions_15_plus_spoken_turns: sessions.filter(s => s.turns.filter(t => t.kind === "speech").length >= 15).length,
  response_start: { p50: percentile(starts, 0.5), p95: percentile(starts, 0.95), min: Math.min(...starts), max: Math.max(...starts), avg: Math.round(starts.reduce((a, b) => a + b, 0) / Math.max(1, starts.length)), perceived_p50: classifyLatency(percentile(starts, 0.5)) },
  provider_vad_window: { p50: percentile(vad, 0.5), p95: percentile(vad, 0.95) },
  app_overhead_first_chunk_to_audible: { p50: percentile(overhead, 0.5), p95: percentile(overhead, 0.95), max: Math.max(...overhead) },
  local_speech_end_after_T1: { p50: percentile(localEnd, 0.5) },
  barge_ins: { count: bargeIns.length, registered_by_app: bargeIns.filter(t => t.interruption?.app_detected_barge_in).length, stop_p50: percentile(stops, 0.5), stop_max: stops.length ? Math.max(...stops) : null, provider_interrupt_p50: percentile(bargeIns.map(t => t.interruption?.provider_interrupted_after_ms).filter(v => v != null), 0.5) },
  spoken_turns_with_context_before_answer: `${contextBefore}/${speech.length}`,
  navigation_taps: { count: navigations.length, with_context_push: navigations.filter(t => t.conversation_context?.context_pushed_to_provider > 0).length, with_tts_narration: navigations.filter(t => t.conversation_context?.tts_narration_started).length },
  turns_suppressed_by_transcript_guard: suppressed.map(t => ({ session: t.session, turn: t.turn, text: t.patient_utterance, events: t.conversation_context.app_transcript_suppression_events })),
  problems
};
const lines = ["| session | profile | lang | turns | spoken | start p50 | start p95 | barge-ins (stop p50) | context before answer | problems |", "|---|---|---|---:|---:|---:|---:|---|---|---|"];
for (const s of sessions) lines.push(`| ${s.session_id} | ${s.patient_profile} | ${s.language} | ${s.turns.length} | ${s.summary.spoken_turns} | ${s.summary.response_start_p50_ms ?? ""} | ${s.summary.response_start_p95_ms ?? ""} | ${s.summary.barge_ins} (${s.summary.barge_in_stop_p50_ms ?? "-"}) | ${s.summary.spoken_turns_with_context_before_answer}/${s.summary.spoken_turns} | ${s.summary.problems.length} |`);
const out = { generatedAt: new Date().toISOString(), dir, summary, table: lines.join("\n") };
writeFileSync(join(dir, "SUMMARY.json"), JSON.stringify(out, null, 2));
writeFileSync(join(dir, "SUMMARY.md"), `# Session summary — ${dir}\n\n${lines.join("\n")}\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`);
console.log(lines.join("\n"));
console.log(JSON.stringify(summary, null, 1));
