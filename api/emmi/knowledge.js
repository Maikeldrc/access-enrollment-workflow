import { handleEmmiKnowledge } from "../../server/emmiKnowledge.js";

export default async function handler(req, res) {
  return handleEmmiKnowledge(req, res);
}
