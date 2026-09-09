import type { Request, Response } from "express";
import { requireAuthContext } from "@common/http/requestHelpers";
import { chatRequestSchema } from "@modules/ai/ai.schema";
import { chatWithAssistant } from "@modules/ai/ai.service";

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const { organizationId, userId, role } = requireAuthContext(req);
  const input = chatRequestSchema.parse(req.body);
  const reply = await chatWithAssistant(organizationId, { userId, role }, input.message, input.history);
  res.json({ success: true, data: { reply } });
}
