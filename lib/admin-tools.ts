/**
 * Admin agent tools: read-only back-office data, catalog lookup, sandbox bash
 * and persistent memory. Never imported by the shopping agent.
 *
 * Each back-office tool saves its complete result to `data/<tool>-<hash>.json`
 * in the admin sandbox (same args -> same file, so re-fetching refreshes it)
 * and returns a preview plus the file path, so the agent computes over the
 * full data with `bash` instead of guessing from a truncated list.
 */
import { createHash } from "node:crypto";
import { tool, type InferUITools } from "ai";
import { z } from "zod";
import {
  getBackOfficeReturns,
  getBackOfficeSales,
  getBackOfficeStock,
  getBackOfficeSupportTickets,
} from "./api";
import { appendMemory, runBash, saveDataFile } from "./sandbox";
import { shopTools, toStepError } from "./tools";

const PREVIEW_ROWS = 25;

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/, "Use YYYY-MM-DD or an ISO 8601 datetime")
  .optional();

async function saveAndPreview<T, M>(
  name: string,
  args: object,
  { data, meta }: { data: T[]; meta: M },
) {
  const hash = createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 8);
  const file = await saveDataFile(`data/${name}-${hash}.json`, {
    fetchedAt: new Date().toISOString(),
    args,
    meta,
    data,
  });
  return {
    file,
    fileFormat: "JSON object { fetchedAt, args, meta, data } where data is the array of ALL rows",
    meta,
    rowCount: data.length,
    rowsShown: Math.min(data.length, PREVIEW_ROWS),
    rows: data.slice(0, PREVIEW_ROWS),
  };
}

type TicketArgs = Parameters<typeof getBackOfficeSupportTickets>[0] & {};
async function getSupportTickets(args: TicketArgs) {
  "use step";
  try {
    return await saveAndPreview("support-tickets", args, await getBackOfficeSupportTickets(args));
  } catch (err) {
    toStepError(err);
  }
}

type ReturnsArgs = Parameters<typeof getBackOfficeReturns>[0] & {};
async function getReturnsHistory(args: ReturnsArgs) {
  "use step";
  try {
    return await saveAndPreview("returns", args, await getBackOfficeReturns(args));
  } catch (err) {
    toStepError(err);
  }
}

type StockArgs = Parameters<typeof getBackOfficeStock>[0] & {};
async function getInventoryStock(args: StockArgs) {
  "use step";
  try {
    return await saveAndPreview("inventory", args, await getBackOfficeStock(args));
  } catch (err) {
    toStepError(err);
  }
}

type SalesArgs = Parameters<typeof getBackOfficeSales>[0] & {};
async function getSalesAnalytics(args: SalesArgs) {
  "use step";
  try {
    return await saveAndPreview("sales", args, await getBackOfficeSales(args));
  } catch (err) {
    toStepError(err, `No product found with ID "${args.productId}".`);
  }
}

async function bash({ command }: { command: string }) {
  "use step";
  return runBash(command);
}

async function saveMemory({ kind, note }: { kind: string; note: string }) {
  "use step";
  const entry = `- [${new Date().toISOString().slice(0, 10)}] (${kind}) ${note.replace(/\s+/g, " ").trim()}`;
  await appendMemory(entry);
  return { saved: entry };
}

export const adminTools = {
  searchProducts: shopTools.searchProducts,
  getAllCategories: shopTools.getAllCategories,
  getSupportTickets: tool({
    description:
      "Read support tickets, filtered by date window, status, priority, category and assignee. Read-only.",
    inputSchema: z.object({
      from: date,
      to: date,
      status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      category: z
        .enum(["shipping", "returns", "product_quality", "sizing", "billing", "payment", "account", "other"])
        .optional(),
      assignee: z.string().max(50).optional().describe("Staff username, e.g. 'alex'. Excludes unassigned."),
      limit: z.number().int().min(1).max(500).optional().describe("Default 25"),
    }),
    execute: getSupportTickets,
  }),
  getReturnsHistory: tool({
    description:
      "Read historical returns with their order and refund info, filtered by date window, status and decision. Read-only.",
    inputSchema: z.object({
      from: date,
      to: date,
      status: z.enum(["pending", "processing", "completed"]).optional(),
      decision: z.enum(["approved", "rejected", "needs_info"]).optional(),
      limit: z.number().int().min(1).max(500).optional().describe("Default 25"),
    }),
    execute: getReturnsHistory,
  }),
  getInventoryStock: tool({
    description:
      "Read inventory levels. Filter by product IDs, lowStock (1-5 units) and inStock. Paginated; check meta.pagination. Read-only.",
    inputSchema: z.object({
      productIds: z.array(z.string().max(120)).max(100).optional(),
      lowStock: z.boolean().optional(),
      inStock: z.boolean().optional(),
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(200).optional().describe("Default 50"),
    }),
    execute: getInventoryStock,
  }),
  getSalesAnalytics: tool({
    description:
      "Read units sold, order count and revenue (integer cents) per product for a date window, optionally for one product. Read-only.",
    inputSchema: z.object({
      from: date,
      to: date,
      productId: z.string().max(120).optional(),
    }),
    execute: getSalesAnalytics,
  }),
  bash: tool({
    description:
      "Run a bash command in the isolated admin sandbox (no network). Use python3 or jq over data/*.json for any arithmetic, joins, rankings or aggregates. memory.md holds saved memory.",
    inputSchema: z.object({
      command: z.string().min(1).max(8000),
    }),
    execute: bash,
  }),
  saveMemory: tool({
    description:
      "Save one durable note for future admin conversations: an employee preference, a correction, or business context. Not for raw store data.",
    inputSchema: z.object({
      kind: z.enum(["preference", "correction", "business_context"]),
      note: z.string().trim().min(3).max(500),
    }),
    execute: saveMemory,
  }),
};

export type AdminUITools = InferUITools<typeof adminTools>;
