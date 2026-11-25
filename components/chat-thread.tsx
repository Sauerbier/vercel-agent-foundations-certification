"use client";

import type { ChatStatus, UIMessage } from "ai";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

type Part = UIMessage["parts"][number];

export function ChatThread<M extends UIMessage>({
  messages,
  status,
  error,
  onRetry,
  renderTool,
  empty,
}: {
  messages: M[];
  status: ChatStatus;
  error: Error | undefined;
  onRetry: () => void;
  renderTool: (part: Part) => ReactNode;
  empty: ReactNode;
}) {
  const last = messages.at(-1);
  const thinking =
    status === "submitted" || (status === "streaming" && last?.role !== "assistant");

  return (
    <Conversation className="flex-1" aria-label="Conversation">
      <ConversationContent className="gap-6">
        {messages.length === 0 && <ConversationEmptyState>{empty}</ConversationEmptyState>}
        {messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent className="w-full">
              <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
              {message.parts.map((part, i) => {
                const key = `${message.id}-${i}`;
                if (part.type === "text") {
                  return message.role === "user" ? (
                    <p key={key} className="whitespace-pre-wrap break-words">
                      {part.text}
                    </p>
                  ) : (
                    <MessageResponse key={key}>{part.text}</MessageResponse>
                  );
                }
                if (part.type.startsWith("tool-")) {
                  return <div key={key}>{renderTool(part)}</div>;
                }
                return null;
              })}
            </MessageContent>
          </Message>
        ))}
        {thinking && (
          <div role="status">
            <Shimmer className="text-sm">Thinking…</Shimmer>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-medium">Something went wrong.</p>
              <p className="text-muted-foreground">The assistant couldn&apos;t finish that reply.</p>
            </div>
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}
      </ConversationContent>
      <ConversationScrollButton aria-label="Scroll to latest message" />
    </Conversation>
  );
}

export function ChatComposer({
  status,
  onSend,
  onStop,
  placeholder,
  children,
}: {
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  placeholder: string;
  children?: ReactNode;
}) {
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";

  const handleSubmit = ({ text }: PromptInputMessage) => {
    const trimmed = text?.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-3 border-t p-3">
      {children}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            placeholder={placeholder}
            aria-label={placeholder}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit
            status={status}
            onStop={onStop}
            disabled={!busy && !input.trim()}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export function ToolError({ message }: { message?: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <p>{message?.replace(/^\w*Error:\s*/, "") || "That lookup failed."}</p>
    </div>
  );
}
