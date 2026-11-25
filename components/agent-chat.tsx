"use client";

import { Bot, SquarePen, X } from "lucide-react";
import { ChatComposer, ChatThread } from "@/components/chat-thread";
import { ShopToolPart, type ShopMessage } from "@/components/shop-tool-parts";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { SidebarHeader, useSidebar } from "@/components/ui/sidebar";
import { type SavedChat, useSavedChat, useWorkflowChat } from "@/hooks/use-workflow-chat";

const STORAGE_KEY = "ship-it-shop:shop-chat";

const SUGGESTIONS = [
  "Show me all categories",
  "Find a black hoodie",
  "I'd like to return an order",
];

export function AgentChat() {
  const { saved, reset } = useSavedChat<ShopMessage>(STORAGE_KEY);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarHeader className="flex-row items-center justify-between border-b">
        <h2 className="px-2 py-1.5 text-sm font-semibold">Ship It Shop Agent</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={reset}>
            <SquarePen className="size-4" aria-hidden="true" />
            New chat
          </Button>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpenMobile(false)}
              aria-label="Close shopping assistant"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </SidebarHeader>
      {saved && <ShopChat key={saved.version} saved={saved} />}
    </div>
  );
}

function ShopChat({ saved }: { saved: SavedChat<ShopMessage> }) {
  const { messages, status, error, sendMessage, regenerate, stop } =
    useWorkflowChat<ShopMessage>({ api: "/api/chat", storageKey: STORAGE_KEY, saved });
  const send = (text: string) => sendMessage({ text });

  return (
    <>
      <ChatThread
        messages={messages}
        status={status}
        error={error}
        onRetry={() => regenerate()}
        renderTool={(part) => <ShopToolPart part={part as Parameters<typeof ShopToolPart>[0]["part"]} />}
        empty={
          <div className="space-y-2">
            <Bot className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">How can I help you shop?</p>
            <p className="text-sm text-muted-foreground">
              Ask about products, sizes and stock, or start a return.
            </p>
          </div>
        }
      />
      <ChatComposer status={status} onSend={send} onStop={stop} placeholder="Ask the shopping assistant">
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
