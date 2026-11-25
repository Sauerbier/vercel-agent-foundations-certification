import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { convertToModelMessages, stepCountIs, type ToolSet, type UIMessage } from "ai";
import { getWritable } from "workflow";
import { MODEL, SHOP_INSTRUCTIONS } from "@/lib/agent";
import { shopTools } from "@/lib/tools";

// One run per user turn: the client owns the history and sends it each time.
// Model calls and tool steps are durable, so a crash or redeploy mid-answer
// resumes from the last completed step instead of starting over.
export async function shopChatWorkflow(messages: UIMessage[]) {
  "use workflow";
  const agent = new WorkflowAgent({
    model: MODEL,
    instructions: SHOP_INSTRUCTIONS,
    tools: shopTools,
    stopWhen: stepCountIs(10),
    // Exponential backoff (2s..32s) rides out provider rate limits and blips.
    maxRetries: 5,
  });
  await streamAgent(agent, messages);
}

/**
 * Streams the agent into the run's durable stream. The agent leaves the
 * stream open so that, if the run fails after retries, an explicit error can
 * be written before closing. Otherwise the client would see an empty
 * "successful" reply. The UI transform adds the final `finish` on close.
 */
export async function streamAgent<T extends ToolSet>(agent: WorkflowAgent<T>, messages: UIMessage[]) {
  try {
    await agent.stream({
      messages: await convertToModelMessages(messages),
      writable: getWritable<ModelCallStreamPart>(),
      sendFinish: false,
      preventClose: true,
    });
  } catch (err) {
    await closeStream(true);
    throw err;
  }
  await closeStream(false);
}

async function closeStream(failed: boolean) {
  "use step";
  const writable = getWritable<ModelCallStreamPart>();
  if (failed) {
    const writer = writable.getWriter();
    try {
      // No internal details: the client only learns that this reply failed.
      await writer.write({
        type: "error",
        error: "The assistant is temporarily unavailable. Please try again.",
      } as ModelCallStreamPart);
    } finally {
      writer.releaseLock();
    }
  }
  await writable.close();
}
