"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/queries";
import { compareQuotes } from "@/lib/compare";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import type { Product, Quote, Role } from "@/lib/types";
import { BestPrice, DecisionBadge, FulfillmentBadge } from "./Badges";

interface Props {
  product: Product;
  quotes: Quote[];
  role: Role;
  onQuote: (p: Product) => void;
  onChanged: () => void;
}

export function ProductCard({ product, quotes, role, onQuote, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cmp = compareQuotes(quotes, product.target_price, product.quantity_needed);

  async function markPurchased() {
    if (!window.confirm(`خرید «${product.name}» انجام شد؟`)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await createClient()
      .from("products")
      .update({ fulfillment_status: "purchased" })
      .eq("id", product.id);
    setBusy(false);
    if (e) setError(dbErrorMessage(e.message));
    else onChanged();
  }

  const canQuote = role === "buyer" && !product.is_archived && product.fulfillment_status === "open" && product.decision !== "rejected";
  const canMarkPurchased = role === "buyer" && product.decision === "approved" && product.fulfillment_status === "open";

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/product?id=${product.id}`} className="block truncate text-base font-bold hover:underline">
            {product.name}
          </Link>
          <div className="text-sm text-slate-500">
            {[product.brand, product.variant].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <DecisionBadge decision={product.decision} />
          <FulfillmentBadge status={product.fulfillment_status} />
          {product.is_archived && (
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-700">بایگانی</span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500">تعداد موردنیاز</dt>
        <dd>{formatNumber(product.quantity_needed)}</dd>
        <dt className="text-slate-500">قیمت هدف</dt>
        <dd>{formatToman(product.target_price)}</dd>
        <dt className="text-slate-500">ارزان‌ترین موجود</dt>
        <dd>
          <BestPrice cmp={cmp} />
        </dd>
        <dt className="text-slate-500">آخرین تغییر</dt>
        <dd className="text-xs text-slate-600">{formatDateTime(product.updated_at)}</dd>
      </dl>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {canQuote && (
          <button className="btn-green flex-1" onClick={() => onQuote(product)}>
            + ثبت استعلام
          </button>
        )}
        {canMarkPurchased && (
          <button className="btn-primary flex-1" disabled={busy} onClick={markPurchased}>
            ثبت خریداری‌شده
          </button>
        )}
        <Link href={`/product?id=${product.id}`} className="btn-ghost flex-1">
          جزئیات
        </Link>
      </div>
    </div>
  );
}
