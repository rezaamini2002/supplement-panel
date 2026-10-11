"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useProfile } from "@/components/AppShell";
import { BestPrice, DecisionBadge, FulfillmentBadge, StockBadge } from "@/components/Badges";
import { Modal } from "@/components/Modal";
import { ProductForm } from "@/components/ProductForm";
import { QuoteForm } from "@/components/QuoteForm";
import { compareQuotes, isStale, latestPerVendor } from "@/lib/compare";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { dbErrorMessage, PRODUCT_COLS, QUOTE_COLS, VENDOR_COLS } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import { DECISION_LABEL, type Decision, type Product, type Quote, type Vendor } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";

interface AuditRow {
  id: number;
  table_name: string;
  action: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

interface Detail {
  product: Product | null;
  quotes: Quote[];
  vendors: Vendor[];
  audit: AuditRow[];
}

function describeAudit(a: AuditRow): string {
  const subject = a.table_name === "products" ? "محصول" : a.table_name === "quotes" ? "استعلام" : "همکار";
  if (a.action === "INSERT") return `${subject} ثبت شد`;
  if (a.action === "DELETE") return `${subject} حذف شد`;
  if (a.table_name === "products" && a.old_data && a.new_data) {
    if (a.old_data.decision !== a.new_data.decision) {
      return `تصمیم خرید: ${DECISION_LABEL[a.new_data.decision as Decision] ?? ""}`;
    }
    if (a.old_data.fulfillment_status !== a.new_data.fulfillment_status) {
      return a.new_data.fulfillment_status === "purchased" ? "ثبت شد: خریداری‌شده" : "وضعیت خرید بازگردانده شد";
    }
    if (a.old_data.is_archived !== a.new_data.is_archived) {
      return a.new_data.is_archived ? "به بایگانی رفت" : "از بایگانی خارج شد";
    }
  }
  return `${subject} ویرایش شد`;
}

function ProductDetail() {
  const id = useSearchParams().get("id") ?? "";
  const { role } = useProfile();

  const { data, error, loading, reload } = useLoad<Detail>(async () => {
    if (!id) return { product: null, quotes: [], vendors: [], audit: [] };
    const supabase = createClient();
    const [p, q, v] = await Promise.all([
      supabase.from("products").select(PRODUCT_COLS).eq("id", id).maybeSingle(),
      supabase.from("quotes").select(QUOTE_COLS).eq("product_id", id).order("quoted_at", { ascending: false }),
      supabase.from("vendors").select(VENDOR_COLS).order("name"),
    ]);
    if (p.error || q.error || v.error) throw new Error("خطا در دریافت اطلاعات");

    let audit: AuditRow[] = [];
    if (role === "owner") {
      const a = await supabase
        .from("audit_log")
        .select("id, table_name, action, changed_at, old_data, new_data")
        .eq("table_name", "products")
        .eq("record_id", id)
        .order("changed_at", { ascending: false })
        .limit(30);
      audit = (a.data ?? []) as AuditRow[];
    }
    return {
      product: (p.data ?? null) as Product | null,
      quotes: (q.data ?? []) as Quote[],
      vendors: (v.data ?? []) as Vendor[],
      audit,
    };
  });

  const [editing, setEditing] = useState(false);
  const [quoteModal, setQuoteModal] = useState<Quote | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const vendorName = useMemo(() => new Map((data?.vendors ?? []).map((v) => [v.id, v.name])), [data]);
  const currentIds = useMemo(() => new Set(latestPerVendor(data?.quotes ?? []).map((q) => q.id)), [data]);

  if (loading) return <p className="py-10 text-center text-slate-500">در حال بارگذاری…</p>;
  if (error) return <p className="py-10 text-center text-red-700">{error}</p>;
  if (!data || !data.product) {
    return (
      <div className="py-10 text-center">
        <p className="text-slate-600">محصول پیدا نشد.</p>
        <Link href="/products" className="text-emerald-700 hover:underline">
          بازگشت به محصولات
        </Link>
      </div>
    );
  }

  const product = data.product;
  const cmp = compareQuotes(data.quotes, product.target_price, product.quantity_needed);
  const purchased = product.fulfillment_status === "purchased";

  async function update(patch: Record<string, unknown>) {
    setBusy(true);
    setActionError(null);
    const { error: e } = await createClient().from("products").update(patch).eq("id", product.id);
    setBusy(false);
    if (e) setActionError(dbErrorMessage(e.message));
    else reload();
  }

  const decide = (d: Decision) => update({ decision: d });

  async function markPurchased() {
    if (!window.confirm("خرید این محصول انجام شد؟")) return;
    await update({ fulfillment_status: "purchased" });
  }

  const canQuote = role === "buyer" && !product.is_archived && !purchased && product.decision !== "rejected";

  return (
    <div className="space-y-4">
      <Link href="/products" className="text-sm text-slate-500 hover:underline">
        ← محصولات
      </Link>

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">{product.name}</h1>
            <p className="text-sm text-slate-500">{[product.brand, product.variant].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <DecisionBadge decision={product.decision} />
            <FulfillmentBadge status={product.fulfillment_status} />
            {product.is_archived && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs">بایگانی</span>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
          <dt className="text-slate-500">تعداد موردنیاز</dt>
          <dd>{formatNumber(product.quantity_needed)}</dd>
          <dt className="text-slate-500">قیمت هدف</dt>
          <dd>{formatToman(product.target_price)}</dd>
          <dt className="text-slate-500">همکاران پیشنهادی</dt>
          <dd className="col-span-1 sm:col-span-3">{product.suggested_vendors || "—"}</dd>
          <dt className="text-slate-500">ثبت</dt>
          <dd className="text-xs">{formatDateTime(product.created_at)}</dd>
          <dt className="text-slate-500">آخرین تغییر</dt>
          <dd className="text-xs">{formatDateTime(product.updated_at)}</dd>
          {product.decision_at && (
            <>
              <dt className="text-slate-500">زمان تصمیم</dt>
              <dd className="text-xs">{formatDateTime(product.decision_at)}</dd>
            </>
          )}
          {product.purchased_at && (
            <>
              <dt className="text-slate-500">زمان خرید</dt>
              <dd className="text-xs">{formatDateTime(product.purchased_at)}</dd>
            </>
          )}
        </dl>
        {product.description && <p className="whitespace-pre-wrap text-sm text-slate-700">{product.description}</p>}

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="mb-1 text-xs text-slate-500">ارزان‌ترین قیمت (فقط موجود‌ها)</div>
          <BestPrice cmp={cmp} />
          {cmp.best && (
            <div className="mt-1 text-xs text-slate-500">
              {vendorName.get(cmp.best.vendor_id) ?? "—"} · {formatDateTime(cmp.best.quoted_at)}
            </div>
          )}
        </div>

        {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}

        {/* تصمیم خرید: فقط کارفرما */}
        {role === "owner" && (
          <div className="space-y-2">
            <div className="text-sm font-medium">تصمیم خرید</div>
            <div className="grid grid-cols-3 gap-2">
              <button
                className={`btn border ${product.decision === "approved" ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-600 bg-white text-emerald-700"}`}
                disabled={busy || purchased}
                onClick={() => decide("approved")}
              >
                تأیید خرید
              </button>
              <button
                className={`btn border ${product.decision === "rejected" ? "border-red-600 bg-red-600 text-white" : "border-red-600 bg-white text-red-700"}`}
                disabled={busy || purchased}
                onClick={() => decide("rejected")}
              >
                عدم نیاز
              </button>
              <button
                className={`btn border ${product.decision === "pending" ? "border-slate-700 bg-slate-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                disabled={busy || purchased}
                onClick={() => decide("pending")}
              >
                در انتظار
              </button>
            </div>
            {purchased && <p className="text-xs text-slate-500">این محصول خریداری شده و تصمیم آن قابل تغییر نیست.</p>}
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setEditing(true)}>
                ویرایش محصول
              </button>
              <button className="btn-ghost flex-1" disabled={busy} onClick={() => update({ is_archived: !product.is_archived })}>
                {product.is_archived ? "خروج از بایگانی" : "بایگانی"}
              </button>
            </div>
          </div>
        )}

        {/* اجرای خرید: فقط مسئول خرید */}
        {role === "buyer" && product.decision === "approved" && !purchased && (
          <button className="btn-primary w-full" disabled={busy} onClick={markPurchased}>
            ثبت خریداری‌شده
          </button>
        )}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">استعلام‌ها ({formatNumber(data.quotes.length)})</h2>
          {canQuote && (
            <button className="btn-green" onClick={() => setQuoteModal("new")}>
              + ثبت استعلام
            </button>
          )}
        </div>

        {data.quotes.length === 0 ? (
          <p className="text-sm text-slate-500">هنوز استعلامی ثبت نشده است.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.quotes.map((q) => {
              const current = currentIds.has(q.id);
              const stale = current && q.stock_status === "in_stock" && isStale(q);
              return (
                <li key={q.id} className={`space-y-1 py-3 ${current ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{vendorName.get(q.vendor_id) ?? "—"}</div>
                    <div className="flex items-center gap-2">
                      {!current && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">تاریخچه</span>}
                      {stale && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">قدیمی</span>}
                      <StockBadge status={q.stock_status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-4 text-sm">
                    <span className="font-bold">{formatToman(q.price)}</span>
                    {q.available_qty !== null && <span className="text-slate-600">قابل تأمین: {formatNumber(q.available_qty)}</span>}
                    <span className="text-xs text-slate-500">{formatDateTime(q.quoted_at)}</span>
                  </div>
                  {q.notes && <p className="text-sm text-slate-600">{q.notes}</p>}
                  {canQuote && (
                    <button className="text-sm text-emerald-700 hover:underline" onClick={() => setQuoteModal(q)}>
                      ویرایش
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {role === "owner" && (
        <section className="card space-y-2">
          <h2 className="font-bold">تاریخچه تغییرات</h2>
          {data.audit.length === 0 ? (
            <p className="text-sm text-slate-500">موردی ثبت نشده است.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.audit.map((a) => (
                <li key={a.id} className="flex justify-between gap-2 py-2">
                  <span>{describeAudit(a)}</span>
                  <span className="text-xs text-slate-500">{formatDateTime(a.changed_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <Modal title="ویرایش محصول" onClose={() => setEditing(false)}>
          <ProductForm
            product={product}
            onDone={() => {
              setEditing(false);
              reload();
            }}
          />
        </Modal>
      )}

      {quoteModal && (
        <Modal title={quoteModal === "new" ? "ثبت استعلام" : "ویرایش استعلام"} onClose={() => setQuoteModal(null)}>
          <QuoteForm
            product={product}
            vendors={data.vendors}
            quotes={data.quotes}
            editing={quoteModal === "new" ? undefined : quoteModal}
            onDone={() => {
              setQuoteModal(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-slate-500">در حال بارگذاری…</p>}>
      <ProductDetail />
    </Suspense>
  );
}
