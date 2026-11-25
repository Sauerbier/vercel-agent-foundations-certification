/**
 * Shopping agent tools. Each `execute` is a durable workflow step: transient
 * failures (network, 5xx) throw and are retried; client errors (404, 400)
 * throw `FatalError` so the agent gets a clear message without retries.
 *
 * Admin-only tools live in `lib/admin-tools.ts` and are never imported here.
 */
import { tool, type InferUITools } from "ai";
import { FatalError } from "workflow";
import { HookConflictError } from "workflow/errors";
import { start } from "workflow/api";
import { z } from "zod";
import {
  ApiRequestError,
  getCategories,
  getOrder,
  getProductById,
  getProductStock,
  getProducts,
} from "./api";
import { formatPrice } from "./format";
import type { Product } from "./types";
import { returnOrderWorkflow } from "./workflows/return-flow";

// 4xx = the request itself is wrong (missing record, bad input): retrying won't help.
export function toStepError(err: unknown, notFound?: string): never {
  if (err instanceof ApiRequestError && err.status >= 400 && err.status < 500) {
    throw new FatalError(
      err.status === 404 && notFound ? notFound : `Store API rejected the request: ${err.message}`,
    );
  }
  throw err;
}

function summarize(p: Product) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category,
    price: p.price,
    currency: p.currency,
    priceFormatted: formatPrice(p.price, p.currency),
    image: p.images[0] ?? null,
    url: `/products/${p.id}`,
  };
}

export type ProductSummary = ReturnType<typeof summarize>;

async function searchProducts({
  query,
  category,
  page,
  limit,
}: {
  query?: string;
  category?: string;
  page: number;
  limit: number;
}) {
  "use step";
  try {
    const products = await getProducts({
      search: query?.trim() || undefined,
      category: category || undefined,
      page,
      limit,
    });
    return {
      query: query ?? null,
      category: category ?? null,
      page,
      count: products.length,
      // A full page suggests there may be more; the API doesn't return totals here.
      mayHaveMore: products.length === limit,
      products: products.map(summarize),
    };
  } catch (err) {
    toStepError(err);
  }
}

async function getAllCategories() {
  "use step";
  try {
    const categories = await getCategories();
    return { categories };
  } catch (err) {
    toStepError(err);
  }
}

async function getProductDetails({ product }: { product: string }) {
  "use step";
  const [details, stock] = await Promise.allSettled([
    getProductById(product),
    getProductStock(product),
  ]);
  if (details.status === "rejected") {
    toStepError(details.reason, `No product found for "${product}".`);
  }
  const p = details.value;
  return {
    product: p,
    priceFormatted: formatPrice(p.price, p.currency),
    url: `/products/${p.id}`,
    // Stock is live and may be unavailable even when the product exists.
    stock:
      stock.status === "fulfilled"
        ? { known: true as const, ...stock.value }
        : { known: false as const },
  };
}

async function returnOrder({ orderId, reason }: { orderId: string; reason: string }) {
  "use step";
  let order;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    toStepError(err, `No order found with ID "${orderId}". Please double-check the order number.`);
  }
  if (order.status === "cancelled") {
    throw new FatalError(`Order ${orderId} was cancelled, so there is nothing to return.`);
  }
  const items = order.items.map(({ productId, quantity }) => ({ productId, quantity }));

  // One return per order: the hook token makes a duplicate (or a retry of this
  // step after the run already started) resolve to the existing run.
  try {
    const run = await start(returnOrderWorkflow, [{ orderId, reason, items }], {
      experimental_hook: { token: `return:${orderId}`, experimental_minRetention: "30 days" },
    });
    return { status: "filed" as const, orderId, reason, items, referenceId: run.runId };
  } catch (err) {
    if (!HookConflictError.is(err)) throw err;
    return {
      status: "already-filed" as const,
      orderId,
      reason,
      items,
      referenceId: err.conflictingRunId,
    };
  }
}

export const shopTools = {
  searchProducts: tool({
    description:
      "Search the product catalog. Omit query and category to browse everything. Returns product cards (id, name, price, image, link).",
    inputSchema: z.object({
      query: z.string().max(100).optional().describe("Free-text search, e.g. 'black hoodie'"),
      category: z
        .string()
        .max(50)
        .optional()
        .describe("Category slug from getAllCategories, e.g. 'hoodies'"),
      page: z.number().int().min(1).max(20).default(1),
      limit: z.number().int().min(1).max(24).default(8),
    }),
    execute: searchProducts,
  }),
  getAllCategories: tool({
    description: "List the store's current product categories (slug, name, product count).",
    inputSchema: z.object({}),
    execute: getAllCategories,
  }),
  getProductDetails: tool({
    description:
      "Get full details for one product by id or slug: description, price, images, tags and live stock.",
    inputSchema: z.object({
      product: z.string().min(1).max(120).describe("Product id (e.g. 'hoodie_001') or slug"),
    }),
    execute: getProductDetails,
  }),
  returnOrder: tool({
    description:
      "File a return for a customer's order. Looks up the order, then starts the return: email notification, refund pre-authorization, and filing the return.",
    inputSchema: z.object({
      orderId: z.string().trim().min(1).max(40).regex(/^[\w-]+$/, "Order IDs are letters, digits, - or _"),
      reason: z.string().trim().min(3).max(500),
    }),
    execute: returnOrder,
  }),
};

export type ShopUITools = InferUITools<typeof shopTools>;
