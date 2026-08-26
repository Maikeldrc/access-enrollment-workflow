import { handleEmmiLiveToken } from "../../server/emmiLiveToken.js";

export default async function handler(req, res) {
  return handleEmmiLiveToken(req, res, process.env);
}
