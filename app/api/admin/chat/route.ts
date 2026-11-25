import { startChat } from "@/lib/chat-route";
import { adminChatWorkflow } from "@/lib/workflows/admin-chat-flow";

// Gated by `proxy.ts` (admin cookie required for /api/admin/*).
export const POST = (req: Request) => startChat(req, adminChatWorkflow);
