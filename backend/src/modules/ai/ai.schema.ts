import { z } from "zod";

// AI-01..05 — no backend chat-history persistence (Sprint 3 HLD §Appendix
// A): the client resends prior turns with every request, we just validate
// their shape before splicing them into the Claude API call.
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  // Capped well below any realistic conversation so a client can't use this
  // endpoint to smuggle an unbounded prompt into every Claude API call.
  history: z.array(chatMessageSchema).max(20).default([]),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
