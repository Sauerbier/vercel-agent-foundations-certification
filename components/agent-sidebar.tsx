"use client";

import { AgentChat } from "@/components/agent-chat";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

export function AgentSidebar() {
  return (
    <Sidebar side="right" collapsible="offcanvas" aria-label="Shopping assistant">
      <SidebarContent className="overflow-hidden p-0">
        <AgentChat />
      </SidebarContent>
    </Sidebar>
  );
}
