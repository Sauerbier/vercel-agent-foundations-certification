import { startChat } from "@/lib/chat-route";
import { shopChatWorkflow } from "@/lib/workflows/chat-flow";

export const POST = (req: Request) => startChat(req, shopChatWorkflow);
