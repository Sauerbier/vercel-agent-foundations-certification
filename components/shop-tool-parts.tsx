"use client";

import type { UIDataTypes, UIMessage } from "ai";
import { CheckCircle2, PackageX, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ToolError } from "@/components/chat-thread";
import { useCart } from "@/components/cart-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShopUITools } from "@/lib/tools";

export type ShopMessage = UIMessage<unknown, UIDataTypes, ShopUITools>;
type ShopToolPart = Extract<ShopMessage["parts"][number], { type: `tool-${string}` }>;

const PENDING: Record<ShopToolPart["type"], string> = {
  "tool-searchProducts": "Searching products…",
  "tool-getAllCategories": "Loading categories…",
  "tool-getProductDetails": "Looking up product…",
  "tool-returnOrder": "Filing your return…",
};

export function ShopToolPart({ part }: { part: ShopToolPart }) {
  if (part.state === "output-error") return <ToolError message={part.errorText} />;
  if (part.state !== "output-available") {
    return (
      <div role="status">
        <Shimmer className="text-sm">{PENDING[part.type]}</Shimmer>
      </div>
    );
  }
  switch (part.type) {
    case "tool-searchProducts":
      return <ProductResults output={part.output} />;
    case "tool-getProductDetails":
      return <ProductDetails output={part.output} />;
    case "tool-getAllCategories":
      return <CategoryChips output={part.output} />;
    case "tool-returnOrder":
      return <ReturnConfirmation output={part.output} />;
  }
}

type Output<T extends ShopToolPart["type"]> = Extract<
  ShopToolPart,
  { type: T; state: "output-available" }
>["output"];

function ProductResults({ output }: { output: Output<"tool-searchProducts"> }) {
  if (output.products.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <PackageX className="size-4 shrink-0" aria-hidden="true" />
        No products matched{output.query ? ` "${output.query}"` : ""}
        {output.category ? ` in ${output.category}` : ""}.
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-2" aria-label="Product results">
      {output.products.map((p) => (
        <li key={p.id}>
          <Link
            href={p.url}
            className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="relative aspect-square overflow-hidden bg-secondary">
              {p.image && (
                <Image
                  src={p.image}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 12rem, 45vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-2.5">
              <p className="line-clamp-2 text-xs font-medium text-foreground">{p.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{p.priceFormatted}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StockBadge({ stock }: { stock: Output<"tool-getProductDetails">["stock"] }) {
  if (!stock.known) return <Badge variant="outline">Stock unavailable</Badge>;
  if (!stock.inStock) return <Badge variant="destructive">Out of stock</Badge>;
  if (stock.lowStock) return <Badge variant="secondary">Only {stock.stock} left</Badge>;
  return <Badge variant="secondary">In stock</Badge>;
}

function ProductDetails({ output }: { output: Output<"tool-getProductDetails"> }) {
  const { product, priceFormatted, url, stock } = output;
  const [active, setActive] = useState(0);
  const { addToCart, openCart } = useCart();
  const [added, setAdded] = useState(false);
  const soldOut = stock.known && !stock.inStock;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card" aria-label={product.name}>
      {product.images[active] && (
        <div className="relative aspect-[4/3] bg-secondary">
          <Image
            src={product.images[active]}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 26rem, 90vw"
            className="object-cover"
          />
        </div>
      )}
      {product.images.length > 1 && (
        <div className="flex gap-2 p-3 pb-0" role="group" aria-label="Product images">
          {product.images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-pressed={i === active}
              className={cn(
                "relative size-12 overflow-hidden rounded-md border bg-secondary",
                i === active ? "border-foreground" : "border-border",
              )}
            >
              <Image src={src} alt="" fill sizes="3rem" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{product.name}</h3>
            <p className="text-sm text-muted-foreground">{priceFormatted}</p>
          </div>
          <StockBadge stock={stock} />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
        {product.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Tags">
            {product.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={soldOut}
            onClick={() => {
              addToCart(product, 1);
              setAdded(true);
              openCart();
            }}
          >
            <ShoppingCart className="size-3.5" aria-hidden="true" />
            {soldOut ? "Sold out" : added ? "Added" : "Add to cart"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={url}>View product page</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function CategoryChips({ output }: { output: Output<"tool-getAllCategories"> }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Categories">
      {output.categories.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/search?category=${encodeURIComponent(c.slug)}`}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs transition-colors hover:bg-secondary"
          >
            {c.name}
            <span className="text-muted-foreground">{c.productCount}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReturnConfirmation({ output }: { output: Output<"tool-returnOrder"> }) {
  const units = output.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm" role="status">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 className="size-4 text-green-600" aria-hidden="true" />
        {output.status === "filed"
          ? `Return filed for order ${output.orderId}`
          : `A return for order ${output.orderId} was already filed`}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
        <dt>Items</dt>
        <dd>
          {units} {units === 1 ? "item" : "items"}
        </dd>
        <dt>Reason</dt>
        <dd>{output.reason}</dd>
        <dt>Reference</dt>
        <dd className="break-all font-mono text-xs">{output.referenceId}</dd>
      </dl>
      {output.status === "filed" && (
        <p className="text-muted-foreground">
          We&apos;re emailing you a confirmation and pre-authorizing your refund.
        </p>
      )}
    </div>
  );
}
