import { resumeChat } from "@/lib/chat-route";
import { shopChatWorkflow } from "@/lib/workflows/chat-flow";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return resumeChat(req, id, shopChatWorkflow);
}
