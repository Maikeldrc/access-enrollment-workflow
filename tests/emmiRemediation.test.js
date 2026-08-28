import { describe, expect, it, vi } from "vitest";
import { createSafetyEpisode, detectEmergencyLanguage, safetyResponseFor } from "../src/emmi/safetyPolicy.js";
import { conversationPolicyResponse } from "../src/emmi/conversationPolicy.js";
import { resolveNextBestAction } from "../src/nextBestAction.js";
import { EmmiLiveClient, resample } from "../src/emmi/liveClient.js";
describe("EMMI remediation",()=>{
  it("keeps emergency guidance across follow-ups",()=>{const episode=createSafetyEpisode({now:1});expect(detectEmergencyLanguage("chest pain")).toBe(true);expect(safetyResponseFor({locale:"EN",episode,question:"What is my next step?"}).text).toContain("call 911");});
  it("shares deterministic consent and authority policy",()=>{expect(conversationPolicyResponse("Can you enroll me?","EN").text).toContain("I cannot consent");expect(conversationPolicyResponse("Why verify my phone?","EN").text).toContain("legal authority");});
  it("resolves the visible Home action",()=>expect(resolveNextBestAction({pathway:"ACCESS",currentScreen:"INVITATION",nextRoute:"DECISION_MAKER"})).toMatchObject({actionType:"LEARN_MORE",route:"DECISION_MAKER"}));
  it("attenuates out-of-band audio",()=>{const rate=48000,tone=Float32Array.from({length:4800},(_,i)=>Math.sin(2*Math.PI*12000*i/rate)),out=resample(tone,rate,16000),rms=Math.sqrt(out.reduce((s,v)=>s+v*v,0)/out.length);expect(rms).toBeLessThan(.08);});
  it("allows bounded repeated reconnects and non-throwing provider errors",()=>{vi.useFakeTimers();const onError=vi.fn(),client=new EmmiLiveClient({getContext:()=>({locale:"EN"}),onError,onReconnectNeeded:()=>"resume"});client.sessionResumptionHandle="h";client.connect=vi.fn().mockResolvedValue(true);expect(client.scheduleReconnect("loss")).toBe(true);vi.advanceTimersByTime(250);expect(client.scheduleReconnect("loss")).toBe(true);expect(()=>client.handleProviderError(new Error("failed"))).not.toThrow();vi.useRealTimers();});
});
