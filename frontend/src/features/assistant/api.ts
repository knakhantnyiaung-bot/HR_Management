import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { ChatMessage } from "@/features/assistant/types";

export interface SendChatMessageInput {
  message: string;
  history: ChatMessage[];
}

export async function sendChatMessage(input: SendChatMessageInput): Promise<string> {
  const res = await apiClient.post<ApiSuccess<{ reply: string }>>("/ai/chat", input);
  return res.data.data.reply;
}
