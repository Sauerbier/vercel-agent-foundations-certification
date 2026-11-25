"use client";

import type { UIDataTypes, UIMessage } from "ai";
import { Brain, Terminal } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { ToolError } from "@/components/chat-thread";
import { cn } from "@/lib/utils";
import type { AdminUITools } from "@/lib/admin-tools";

export type AdminMessage = UIMessage<unknown, UIDataTypes, AdminUITools>;
type AdminToolPart = Extract<AdminMessage["parts"][number], { type: `tool-${string}` }>;

const LABELS: Record<AdminToolPart["type"], string> = {
  "tool-searchProducts": "Catalog search",
  "tool-getAllCategories": "Categories",
  "tool-getSupportTickets": "Support tickets",
  "tool-getReturnsHistory": "Returns history",
  "tool-getInventoryStock": "Inventory",
  "tool-getSalesAnalytics": "Sales analytics",
  "tool-bash": "Sandbox command",
  "tool-saveMemory": "Memory",
};

const day = (iso: string) => iso.slice(0, 10);

function summary(part: AdminToolPart & { state: "output-available" }): string {
  switch (part.type) {
    case "tool-searchProducts":
      return `${part.output.count} products`;
    case "tool-getAllCategories":
      return `${part.output.categories.length} categories`;
    case "tool-getInventoryStock": {
      const p = part.output.meta.pagination;
      return `${part.output.rowCount} of ${p.total} products · page ${p.page}/${p.totalPages}`;
    }
    case "tool-getSupportTickets":
    case "tool-getReturnsHistory":
    case "tool-getSalesAnalytics":
      return `${part.output.rowCount} rows · ${day(part.output.meta.from)} – ${day(part.output.meta.to)}`;
    default:
      return "";
  }
}

export function AdminToolPart({ part }: { part: AdminToolPart }) {
  if (part.type === "tool-bash") return <BashPart part={part} />;

  if (part.type === "tool-saveMemory") {
    if (part.state === "output-error") return <ToolError message={part.errorText} />;
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground" role="status">
        <Brain className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {part.state === "output-available"
          ? `Saved to memory: ${part.input.note}`
          : "Saving to memory…"}
      </p>
    );
  }

  const done = part.state === "output-available";
  const title = done ? `${LABELS[part.type]} · ${summary(part)}` : LABELS[part.type];
  return (
    <Tool className="mb-0">
      <ToolHeader type={part.type} state={part.state} title={title} />
      <ToolContent>
        {part.input !== undefined && <ToolInput input={part.input} />}
        <ToolOutput
          output={done ? part.output : undefined}
          errorText={part.state === "output-error" ? part.errorText : undefined}
        />
      </ToolContent>
    </Tool>
  );
}

function BashPart({ part }: { part: Extract<AdminToolPart, { type: "tool-bash" }> }) {
  const failed =
    part.state === "output-error" || (part.state === "output-available" && part.output.exitCode !== 0);

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border bg-neutral-950 text-neutral-100",
        failed ? "border-destructive/60" : "border-border",
      )}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          <Terminal className="size-3.5" aria-hidden="true" />
          Sandbox
        </span>
        <span role="status">
          {part.state === "output-available" ? (
            `exit ${part.output.exitCode} · ${(part.output.durationMs / 1000).toFixed(1)}s`
          ) : part.state === "output-error" ? (
            <span className="text-red-400">failed</span>
          ) : (
            <Shimmer as="span" className="text-xs">
              Running…
            </Shimmer>
          )}
        </span>
      </figcaption>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {part.input?.command && (
          <code className="block whitespace-pre-wrap text-neutral-400">$ {part.input.command}</code>
        )}
        {part.state === "output-available" && (
          <>
            {part.output.stdout && <code className="block whitespace-pre-wrap">{part.output.stdout}</code>}
            {part.output.stderr && (
              <code className="block whitespace-pre-wrap text-red-400">{part.output.stderr}</code>
            )}
          </>
        )}
        {part.state === "output-error" && (
          <code className="block whitespace-pre-wrap text-red-400">{part.errorText}</code>
        )}
      </pre>
    </figure>
  );
}
