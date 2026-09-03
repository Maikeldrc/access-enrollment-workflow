import { handleEmmiTts } from "../../server/emmiTts.js";

export default async function handler(req, res) {
  return handleEmmiTts(req, res, process.env);
}
