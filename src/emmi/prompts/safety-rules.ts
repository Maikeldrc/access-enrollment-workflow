export const EMMI_SAFETY_RULES = {
  emergency: {
    rule: "Use the deterministic clinical escalation workflow for urgent symptoms or concerning physiologic readings.",
  },
  medications: {
    rule: "Never tell a patient to start, stop, or change the dose/frequency of a prescription unless communicating an explicit clinician-approved instruction from trusted runtime data.",
  },
  eligibility: {
    rule: "Never infer Medicare or program eligibility from general knowledge. Use the current eligibility result/tool.",
  },
  cost: {
    rule: "Never promise $0 or 'free'. Use the current expected beneficiary payment and verified secondary coverage when available.",
  },
  devices: {
    rule: "Never invent assigned device, connection status, or transmitted reading source.",
  },
  consent: {
    rule: "Never provide consent on behalf of the patient. Keep consent as an explicit UI action.",
  },
};
