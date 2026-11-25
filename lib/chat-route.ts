import { createModelCallToUIChunkTransform } from "@ai-sdk/workflow";
import { createUIMessageStreamResponse, validateUIMessages, type UIMessage } from "ai";
import { getRun, start } from "workflow/api";

type ChatWorkflow = (messages: UIMessage[]) => Promise<unknown>;

const MAX_MESSAGES = 100;

// POST: validate the client-owned history and start one durable run per turn.
export async function startChat(req: Request, workflow: ChatWorkflow) {
  let messages: UIMessage[];
  try {
    const body = await req.json();
    messages = await validateUIMessages({ messages: body?.messages });
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const run = await start(workflow, [messages]);
  return createUIMessageStreamResponse({
    stream: run.readable.pipeThrough(createModelCallToUIChunkTransform()),
    headers: { "x-workflow-run-id": run.runId },
  });
}

// GET /[id]/stream: reconnect to a run after a dropped connection or refresh.
// Raw model-call parts and UI chunks don't share indexes, so replay raw from 0
// and let the transform skip the UI chunks the client already has.
export async function resumeChat(req: Request, runId: string, workflow: ChatWorkflow) {
  const uiStartIndex = Number(new URL(req.url).searchParams.get("startIndex") ?? "0");
  if (!Number.isSafeInteger(uiStartIndex) || uiStartIndex < 0) {
    return Response.json({ error: "Invalid startIndex." }, { status: 400 });
  }

  const run = getRun(runId);
  // Only serve runs of this route's own workflow, so one agent's endpoint
  // can never replay the other agent's conversation.
  const owned =
    (await run.exists.catch(() => false)) &&
    (await run.workflowName) === (workflow as unknown as { workflowId?: string }).workflowId;
  if (!owned) return Response.json({ error: "Chat not found." }, { status: 404 });

  return createUIMessageStreamResponse({
    stream: run
      .getReadable({ startIndex: 0 })
      .pipeThrough(createModelCallToUIChunkTransform({ uiStartIndex })),
    headers: { "x-workflow-run-id": runId },
  });
}
