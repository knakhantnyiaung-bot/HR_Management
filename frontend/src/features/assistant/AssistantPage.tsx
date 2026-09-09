import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Loader2, Send, User } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";
import { sendChatMessage } from "@/features/assistant/api";
import type { ChatMessage } from "@/features/assistant/types";

// AI-01..05 — read-only Q&A over the asking employee's own HR data (Sprint
// 3 HLD Appendix A). No backend persistence: the whole conversation lives
// in this component's state and is resent as `history` with every message.
const HISTORY_LIMIT = 20;

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: sendChatMessage,
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mutation.isPending]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || mutation.isPending) return;

    const history = messages.slice(-HISTORY_LIMIT);
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    mutation.mutate(
      { message: trimmed, history },
      {
        onSuccess: (reply) => {
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        },
      },
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">HR Assistant</h1>
        <p className="page-subtitle">
          Ask about your own leave balance, attendance, payslips, expenses, assets, reviews, or courses.
          The assistant only sees your data and can't take actions on your behalf.
        </p>
      </div>

      <div className="card flex h-[60vh] flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
              <Bot className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true" />
              <p>Try asking &ldquo;What&apos;s my current leave balance?&rdquo; or &ldquo;Do I have any pending expense claims?&rdquo;</p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Bot className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}

          {mutation.isPending && (
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3.5 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Thinking…
              </div>
            </div>
          )}

          {mutation.isError && (
            <p className="rounded-md bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-500/10 dark:text-danger-400">
              {getApiErrorMessage(mutation.error, "Could not reach the assistant. Try again.")}
            </p>
          )}

          <div ref={scrollRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
            placeholder="Ask about your leave, attendance, payslips, expenses..."
            rows={1}
            className="input-field-inset w-full resize-none"
          />
          <button type="submit" className="btn-primary shrink-0" disabled={mutation.isPending || !input.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
