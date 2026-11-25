"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow/client";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useState } from "react";

// localStorage can throw (private mode, blocked storage); the chat still works without it.
const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export interface SavedChat<M extends UIMessage> {
  messages: M[];
  activeRunId: string | null;
}

/**
 * Reads the saved conversation after mount (null until then, so server and
 * client render the same thing). `reset` starts a new conversation.
 */
export function useSavedChat<M extends UIMessage>(storageKey: string) {
  const [saved, setSaved] = useState<(SavedChat<M> & { version: number }) | null>(null);

  useEffect(() => {
    let messages: M[] = [];
    try {
      const parsed = JSON.parse(storage.get(storageKey) ?? "[]");
      if (Array.isArray(parsed)) messages = parsed;
    } catch {}
    setSaved({ messages, activeRunId: storage.get(`${storageKey}:run`), version: 0 });
  }, [storageKey]);

  const reset = useCallback(() => {
    storage.remove(storageKey);
    storage.remove(`${storageKey}:run`);
    setSaved((s) => ({ messages: [], activeRunId: null, version: (s?.version ?? 0) + 1 }));
  }, [storageKey]);

  return { saved, reset };
}

/**
 * `useChat` over a durable workflow run. If the connection drops or the page
 * reloads mid-answer, it reconnects to the same run and continues from where
 * it left off instead of starting a new one.
 */
export function useWorkflowChat<M extends UIMessage>({
  api,
  storageKey,
  saved,
}: {
  api: string;
  storageKey: string;
  saved: SavedChat<M>;
}) {
  const runKey = `${storageKey}:run`;

  const transport = useMemo(
    () =>
      new WorkflowChatTransport<M>({
        api,
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) storage.set(runKey, runId);
        },
        onChatEnd: () => storage.remove(runKey),
        prepareReconnectToStreamRequest: ({ api: _defaultApi, ...rest }) => {
          const runId = storage.get(runKey);
          if (!runId) throw new Error("No active chat to reconnect to.");
          return { ...rest, api: `${api}/${encodeURIComponent(runId)}/stream` };
        },
      }),
    [api, runKey],
  );

  const chat = useChat<M>({
    messages: saved.messages,
    transport,
    resume: Boolean(saved.activeRunId),
    // A stale or failed run shouldn't be retried on every reload.
    onError: () => storage.remove(runKey),
  });

  const { messages, status } = chat;
  useEffect(() => {
    // While an answer streams, keep the last saved state (ending in the user's
    // message). On reload, the resumed stream rebuilds the answer once, with
    // no duplicate partial copy.
    const busy = status === "submitted" || status === "streaming";
    if (busy && messages.at(-1)?.role === "assistant") return;
    storage.set(storageKey, JSON.stringify(messages));
  }, [messages, status, storageKey]);

  const stop = useCallback(() => {
    storage.remove(runKey);
    chat.stop();
  }, [chat, runKey]);

  return { ...chat, stop };
}
