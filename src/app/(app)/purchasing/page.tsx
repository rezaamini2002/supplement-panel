"use client";

import { useMemo, useState } from "react";
import { useProfile } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { ProductCard } from "@/components/ProductCard";
import { QuoteForm } from "@/components/QuoteForm";
import { compareQuotes } from "@/lib/compare";
import { formatNumber } from "@/lib/format";
import { groupQuotes, loadOverview } from "@/lib/queries";
import type { Product } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";

type TabKey = "all" | "needs_quote" | "awaiting" | "approved" | "rejected" | "purchased";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "همه محصولات" },
  { key: "needs_quote", label: "نیازمند استعلام" },
  { key: "awaiting", label: "منتظر تصمیم کارفرما" },
  { key: "approved", label: "تأییدشده برای خرید" },
  { key: "rejected", label: "عدم نیاز به خرید" },
  { key: "purchased", label: "خریداری‌شده" },
];

export default function PurchasingPage() {
  const { role } = useProfile();
  const { data, error, loading, reload } = useLoad(loadOverview);
  const [tab, setTab] = useState<TabKey>("needs_quote");
  const [quoting, setQuoting] = useState<Product | null>(null);

  const byProduct = useMemo(() => groupQuotes(data?.quotes ?? []), [data]);

  const buckets = useMemo(() => {
    const empty: Record<TabKey, Product[]> = {
      all: [],
      needs_quote: [],
      awaiting: [],
      approved: [],
      rejected: [],
      purchased: [],
    };
    if (!data) return empty;
    for (const p of data.products) {
      if (p.is_archived) continue;
      empty.all.push(p);
      if (p.fulfillment_status === "purchased") {
        empty.purchased.push(p);
        continue;
      }
      if (p.decision === "rejected") {
        empty.rejected.push(p);
        continue;
      }
      if (p.decision === "pending") empty.awaiting.push(p);
      if (p.decision === "approved") empty.approved.push(p);
      const v = compareQuotes(byProduct.get(p.id) ?? [], p.target_price, p.quantity_needed).verdict;
      if (v === "no_offer" || v === "stale") empty.needs_quote.push(p);
    }
    return empty;
  }, [data, byProduct]);

  const list = buckets[tab];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">لیست خرید</h1>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`btn whitespace-nowrap border ${
                tab === t.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${tab === t.key ? "bg-white/20" : "bg-slate-100"}`}>
                {formatNumber(buckets[t.key].length)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-8 text-center text-slate-500">در حال بارگذاری…</p>}
      {error && <p className="py-8 text-center text-red-700">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="py-8 text-center text-slate-500">موردی در این بخش نیست.</p>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} quotes={byProduct.get(p.id) ?? []} role={role} onQuote={setQuoting} onChanged={reload} />
        ))}
      </div>

      {quoting && data && (
        <Modal title="ثبت استعلام" onClose={() => setQuoting(null)}>
          <QuoteForm
            product={quoting}
            vendors={data.vendors}
            quotes={byProduct.get(quoting.id) ?? []}
            onDone={() => {
              setQuoting(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
