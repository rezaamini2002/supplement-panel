"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useProfile } from "@/components/AppShell";
import { BestPrice } from "@/components/Badges";
import { compareQuotes } from "@/lib/compare";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { groupQuotes, loadOverview } from "@/lib/queries";
import { useLoad } from "@/lib/useLoad";

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "amber" | "red" }) {
  const color =
    tone === "green" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${color}`}>{formatNumber(value)}</div>
    </div>
  );
}

export default function DashboardPage() {
  const profile = useProfile();
  const { data, error, loading } = useLoad(loadOverview);

  const stats = useMemo(() => {
    if (!data) return null;
    const active = data.products.filter((p) => !p.is_archived);
    const byProduct = groupQuotes(data.quotes);
    const needsQuote = active.filter((p) => {
      if (p.decision === "rejected" || p.fulfillment_status === "purchased") return false;
      const v = compareQuotes(byProduct.get(p.id) ?? [], p.target_price, p.quantity_needed).verdict;
      return v === "no_offer" || v === "stale";
    });
    const approvedOpen = active.filter((p) => p.decision === "approved" && p.fulfillment_status === "open");
    const awaiting = active.filter((p) => p.decision === "pending");
    const purchased = active.filter((p) => p.fulfillment_status === "purchased");
    return { active, byProduct, needsQuote, approvedOpen, awaiting, purchased };
  }, [data]);

  if (loading) return <p className="py-10 text-center text-slate-500">در حال بارگذاری…</p>;
  if (error || !data || !stats) return <p className="py-10 text-center text-red-700">{error ?? "خطا در دریافت اطلاعات"}</p>;

  const focus = profile.role === "owner" ? stats.awaiting : stats.needsQuote;
  const focusTitle = profile.role === "owner" ? "منتظر تصمیم شما" : "نیازمند استعلام";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">داشبورد</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="محصولات فعال" value={stats.active.length} />
        <Stat label="کل استعلام‌ها" value={data.quotes.length} />
        <Stat label="تأییدشده برای خرید" value={stats.approvedOpen.length} tone="green" />
        <Stat label="باقی‌مانده (منتظر تصمیم)" value={stats.awaiting.length} tone="amber" />
        {profile.role === "buyer" && <Stat label="نیازمند استعلام" value={stats.needsQuote.length} tone="red" />}
        <Stat label="خریداری‌شده" value={stats.purchased.length} />
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">{focusTitle}</h2>
          <Link href={profile.role === "owner" ? "/products" : "/purchasing"} className="text-sm text-emerald-700 hover:underline">
            مشاهده همه
          </Link>
        </div>
        {focus.length === 0 ? (
          <p className="text-sm text-slate-500">موردی وجود ندارد.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {focus.slice(0, 8).map((p) => {
              const cmp = compareQuotes(stats.byProduct.get(p.id) ?? [], p.target_price, p.quantity_needed);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/product?id=${p.id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      هدف: {formatToman(p.target_price)} · {formatDateTime(p.updated_at)}
                    </div>
                  </div>
                  <BestPrice cmp={cmp} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
