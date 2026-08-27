import { handleEmmiChat } from "../../server/emmiChat.js";

export default function handler(req, res) {
  return handleEmmiChat(req, res, process.env);
}
