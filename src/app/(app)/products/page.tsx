"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useProfile } from "@/components/AppShell";
import { BestPrice, DecisionBadge, FulfillmentBadge } from "@/components/Badges";
import { Modal } from "@/components/Modal";
import { ProductCard } from "@/components/ProductCard";
import { ProductForm } from "@/components/ProductForm";
import { QuoteForm } from "@/components/QuoteForm";
import { compareQuotes } from "@/lib/compare";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { groupQuotes, loadOverview } from "@/lib/queries";
import { DECISION_LABEL, type Decision, type Product } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";

type Sort = "newest" | "name" | "target" | "updated";

export default function ProductsPage() {
  const { role } = useProfile();
  const { data, error, loading, reload } = useLoad(loadOverview);
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"all" | Decision>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [creating, setCreating] = useState(false);
  const [quoting, setQuoting] = useState<Product | null>(null);

  const byProduct = useMemo(() => groupQuotes(data?.quotes ?? []), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.trim().toLowerCase();
    const list = data.products.filter((p) => {
      if (!showArchived && p.is_archived) return false;
      if (decision !== "all" && p.decision !== decision) return false;
      if (!s) return true;
      return p.name.toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s);
    });
    const time = (iso: string) => new Date(iso).getTime();
    list.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name, "fa");
        case "target":
          return b.target_price - a.target_price;
        case "updated":
          return time(b.updated_at) - time(a.updated_at);
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
    return list;
  }, [data, search, decision, showArchived, sort]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">محصولات</h1>
        {role === "owner" && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + محصول جدید
          </button>
        )}
      </div>

      <div className="card grid gap-3 sm:grid-cols-4">
        <input
          className="field sm:col-span-2"
          placeholder="جست‌وجو در نام یا برند…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="جست‌وجو"
        />
        <select className="field" value={decision} onChange={(e) => setDecision(e.target.value as "all" | Decision)} aria-label="فیلتر وضعیت">
          <option value="all">همه وضعیت‌ها</option>
          {(Object.keys(DECISION_LABEL) as Decision[]).map((d) => (
            <option key={d} value={d}>
              {DECISION_LABEL[d]}
            </option>
          ))}
        </select>
        <select className="field" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="مرتب‌سازی">
          <option value="newest">جدیدترین</option>
          <option value="updated">آخرین تغییر</option>
          <option value="name">نام</option>
          <option value="target">بیشترین قیمت هدف</option>
        </select>
        <label className="flex items-center gap-2 text-sm sm:col-span-4">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          نمایش بایگانی‌شده‌ها
        </label>
      </div>

      {loading && <p className="py-8 text-center text-slate-500">در حال بارگذاری…</p>}
      {error && <p className="py-8 text-center text-red-700">{error}</p>}
      {!loading && !error && rows.length === 0 && (
        <p className="py-8 text-center text-slate-500">محصولی پیدا نشد.</p>
      )}

      {/* موبایل: کارت */}
      <div className="grid gap-3 md:hidden">
        {rows.map((p) => (
          <ProductCard key={p.id} product={p} quotes={byProduct.get(p.id) ?? []} role={role} onQuote={setQuoting} onChanged={reload} />
        ))}
      </div>

      {/* دسکتاپ و تبلت: جدول */}
      {rows.length > 0 && (
        <div className="card hidden overflow-x-auto !p-0 md:block">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">محصول</th>
                <th className="px-3 py-2 font-medium">تعداد</th>
                <th className="px-3 py-2 font-medium">قیمت هدف</th>
                <th className="px-3 py-2 font-medium">ارزان‌ترین موجود</th>
                <th className="px-3 py-2 font-medium">وضعیت</th>
                <th className="px-3 py-2 font-medium">آخرین تغییر</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const cmp = compareQuotes(byProduct.get(p.id) ?? [], p.target_price, p.quantity_needed);
                const canQuote = role === "buyer" && !p.is_archived && p.fulfillment_status === "open" && p.decision !== "rejected";
                return (
                  <tr key={p.id} className={p.is_archived ? "opacity-60" : ""}>
                    <td className="px-3 py-2">
                      <Link href={`/product?id=${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-xs text-slate-500">{[p.brand, p.variant].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-3 py-2">{formatNumber(p.quantity_needed)}</td>
                    <td className="px-3 py-2">{formatToman(p.target_price)}</td>
                    <td className="px-3 py-2">
                      <BestPrice cmp={cmp} />
                    </td>
                    <td className="space-y-1 px-3 py-2">
                      <DecisionBadge decision={p.decision} />
                      <div>
                        <FulfillmentBadge status={p.fulfillment_status} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{formatDateTime(p.updated_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {canQuote && (
                          <button className="btn-green !min-h-[36px] !px-3" onClick={() => setQuoting(p)}>
                            استعلام
                          </button>
                        )}
                        <Link href={`/product?id=${p.id}`} className="btn-ghost !min-h-[36px] !px-3">
                          جزئیات
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="محصول جدید" onClose={() => setCreating(false)}>
          <ProductForm
            onDone={() => {
              setCreating(false);
              reload();
            }}
          />
        </Modal>
      )}

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
