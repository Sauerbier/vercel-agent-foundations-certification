"use client";

import { Bot, SquarePen } from "lucide-react";
import { AdminToolPart, type AdminMessage } from "@/components/admin-tool-parts";
import { ChatComposer, ChatThread } from "@/components/chat-thread";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { type SavedChat, useSavedChat, useWorkflowChat } from "@/hooks/use-workflow-chat";

const STORAGE_KEY = "ship-it-shop:admin-chat";

const SUGGESTIONS = [
  "Which products have the highest return rate this month?",
  "Which low-stock items are top sellers?",
  "Summarize this week's revenue",
  "How many urgent support tickets are still open?",
];

export function AdminAgentChat() {
  const { saved, reset } = useSavedChat<AdminMessage>(STORAGE_KEY);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-medium text-muted-foreground">Operations chat</h2>
        <Button variant="ghost" size="sm" onClick={reset}>
          <SquarePen className="size-4" aria-hidden="true" />
          New chat
        </Button>
      </div>
      {saved && <AdminChat key={saved.version} saved={saved} />}
    </div>
  );
}

function AdminChat({ saved }: { saved: SavedChat<AdminMessage> }) {
  const { messages, status, error, sendMessage, regenerate, stop } =
    useWorkflowChat<AdminMessage>({ api: "/api/admin/chat", storageKey: STORAGE_KEY, saved });
  const send = (text: string) => sendMessage({ text });

  return (
    <>
      <ChatThread
        messages={messages}
        status={status}
        error={error}
        onRetry={() => regenerate()}
        renderTool={(part) => <AdminToolPart part={part as Parameters<typeof AdminToolPart>[0]["part"]} />}
        empty={
          <div className="space-y-2">
            <Bot className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Investigate store operations</p>
            <p className="text-sm text-muted-foreground">
              Ask about support, returns, inventory or sales. Results are computed in a sandbox,
              and preferences you share are remembered for next time.
            </p>
          </div>
        }
      />
      <ChatComposer status={status} onSend={send} onStop={stop} placeholder="Ask the admin agent…">
        {messages.length === 0 && (
          <Suggestions>
            {SUGGESTIONS.map((s) => (
              <Suggestion key={s} suggestion={s} onClick={send} />
            ))}
          </Suggestions>
        )}
      </ChatComposer>
    </>
  );
}
