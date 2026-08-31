import { describe, expect, it } from "vitest";
import { parseContactCard } from "../src/contactCard.js";

describe("vCard contact import", () => {
  it("reads a name and multiple labeled phone numbers", () => {
    expect(parseContactCard("BEGIN:VCARD\r\nVERSION:3.0\r\nFN:María Rivera\r\nTEL;TYPE=CELL:3055550199\r\nTEL;TYPE=HOME:7865550102\r\nEND:VCARD")).toEqual({
      name: "María Rivera",
      tel: [
        { value: "3055550199", type: ["cell"] },
        { value: "7865550102", type: ["home"] }
      ]
    });
  });

  it("supports structured names, folded lines and encoded tel URIs", () => {
    const parsed = parseContactCard("BEGIN:VCARD\nVERSION:4.0\nN:Rivera;María;;;\nTEL;TYPE=mobile:tel:%2B1-305-555-0199\nNOTE:line one\n line two\nEND:VCARD");
    expect(parsed.name).toBe("María Rivera");
    expect(parsed.tel).toEqual([{ value: "+1-305-555-0199", type: ["mobile"] }]);
  });

  it("returns an editable empty contact for an invalid card", () => {
    expect(parseContactCard("not a contact")).toEqual({ name: "", tel: [] });
  });
});
