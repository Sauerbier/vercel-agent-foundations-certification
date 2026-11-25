import { resumeChat } from "@/lib/chat-route";
import { adminChatWorkflow } from "@/lib/workflows/admin-chat-flow";

// Gated by `proxy.ts` (admin cookie required for /api/admin/*).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return resumeChat(req, id, adminChatWorkflow);
}
