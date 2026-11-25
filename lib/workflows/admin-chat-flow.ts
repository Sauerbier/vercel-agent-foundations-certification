import { WorkflowAgent } from "@ai-sdk/workflow";
import { stepCountIs, type UIMessage } from "ai";
import { adminInstructions, MODEL } from "@/lib/agent";
import { adminTools } from "@/lib/admin-tools";
import { readMemory } from "@/lib/sandbox";
import { streamAgent } from "./chat-flow";

export async function adminChatWorkflow(messages: UIMessage[]) {
  "use workflow";
  // Re-read on every turn so a brand-new conversation (and later turns) see
  // whatever was saved before, including earlier in this conversation.
  const memory = await loadMemory();
  const agent = new WorkflowAgent({
    model: MODEL,
    instructions: adminInstructions(memory, new Date()),
    tools: adminTools,
    stopWhen: stepCountIs(25),
    // Exponential backoff (2s..32s) rides out provider rate limits and blips.
    maxRetries: 5,
  });
  await streamAgent(agent, messages);
}

async function loadMemory() {
  "use step";
  return readMemory();
}
