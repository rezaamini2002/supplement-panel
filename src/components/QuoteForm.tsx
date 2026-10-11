"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/queries";
import { firstError, quoteSchema } from "@/lib/validation";
import { STOCK_LABEL, type Product, type Quote, type StockStatus, type Vendor } from "@/lib/types";
import { formatDateTime, formatToman } from "@/lib/format";

interface Props {
  product: Product;
  vendors: Vendor[];
  /** استعلام‌های موجود همین محصول (برای تشخیص استعلام قبلی همان فروشنده) */
  quotes: Quote[];
  /** اگر مقدار داشته باشد، همین استعلام ویرایش می‌شود */
  editing?: Quote;
  onDone: () => void;
}

const STOCKS: StockStatus[] = ["in_stock", "out_of_stock", "unknown"];

export function QuoteForm({ product, vendors, quotes, editing, onDone }: Props) {
  const [vendorId, setVendorId] = useState(editing?.vendor_id ?? "");
  const [price, setPrice] = useState(editing ? String(editing.price) : "");
  const [stock, setStock] = useState<StockStatus>(editing?.stock_status ?? "in_stock");
  const [qty, setQty] = useState(editing?.available_qty != null ? String(editing.available_qty) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [mode, setMode] = useState<"new" | "update">("new");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectable = useMemo(
    () => vendors.filter((v) => v.is_active || v.id === editing?.vendor_id),
    [vendors, editing],
  );

  // آخرین استعلام قبلی همین فروشنده برای همین محصول
  const previous = useMemo(() => {
    if (editing || !vendorId) return null;
    return (
      quotes
        .filter((q) => q.vendor_id === vendorId)
        .sort((a, b) => new Date(b.quoted_at).getTime() - new Date(a.quoted_at).getTime())[0] ?? null
    );
  }, [quotes, vendorId, editing]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = quoteSchema.safeParse({
      product_id: product.id,
      vendor_id: vendorId,
      price,
      stock_status: stock,
      available_qty: qty,
      notes,
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    const v = parsed.data;

    setSaving(true);
    const supabase = createClient();
    const updateId = editing?.id ?? (mode === "update" ? previous?.id : undefined);

    const { error: dbErr } = updateId
      ? await supabase
          .from("quotes")
          .update({
            price: v.price,
            stock_status: v.stock_status,
            available_qty: v.available_qty,
            notes: v.notes,
            quoted_at: new Date().toISOString(),
          })
          .eq("id", updateId)
      : await supabase.from("quotes").insert({
          product_id: v.product_id,
          vendor_id: v.vendor_id,
          price: v.price,
          stock_status: v.stock_status,
          available_qty: v.available_qty,
          notes: v.notes,
        });
    setSaving(false);

    if (dbErr) {
      setError(dbErrorMessage(dbErr.message));
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-slate-600">
        {product.name}
        {product.brand ? ` · ${product.brand}` : ""} — قیمت هدف: {formatToman(product.target_price)}
      </p>

      <div>
        <label className="label" htmlFor="vendor">همکار / فروشنده</label>
        <select
          id="vendor"
          className="field"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          disabled={!!editing}
          required
        >
          <option value="">انتخاب کنید…</option>
          {selectable.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.is_active ? "" : " (غیرفعال)"}
            </option>
          ))}
        </select>
        {selectable.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">ابتدا از بخش «همکاران» یک فروشنده اضافه کنید.</p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="price">قیمت (تومان)</label>
        <input
          id="price"
          className="field"
          inputMode="numeric"
          dir="ltr"
          placeholder="مثلاً 1250000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="label">وضعیت موجودی</span>
        <div className="grid grid-cols-3 gap-2">
          {STOCKS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStock(s)}
              aria-pressed={stock === s}
              className={`btn border ${
                stock === s
                  ? s === "in_stock"
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : s === "out_of_stock"
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-slate-700 bg-slate-700 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {STOCK_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="qty">تعداد قابل تأمین (اختیاری)</label>
        <input
          id="qty"
          className="field"
          inputMode="numeric"
          dir="ltr"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="notes">توضیحات (اختیاری)</label>
        <textarea id="notes" rows={2} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {previous && (
        <fieldset className="rounded-lg border border-slate-200 p-3 text-sm">
          <legend className="px-1 text-slate-600">
            از این همکار قبلاً استعلام گرفته‌اید ({formatToman(previous.price)} — {formatDateTime(previous.quoted_at)})
          </legend>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
            ثبت استعلام جدید (تاریخچه قبلی حفظ می‌شود)
          </label>
          <label className="flex items-center gap-2 py-1">
            <input type="radio" checked={mode === "update"} onChange={() => setMode("update")} />
            به‌روزرسانی استعلام قبلی
          </label>
        </fieldset>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={saving} className="btn-green w-full">
        {saving ? "در حال ذخیره…" : editing ? "ذخیره تغییرات" : "ثبت استعلام"}
      </button>
    </form>
  );
}
