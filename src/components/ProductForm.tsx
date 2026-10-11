"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage } from "@/lib/queries";
import { firstError, productSchema } from "@/lib/validation";
import type { Product } from "@/lib/types";

export function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [variant, setVariant] = useState(product?.variant ?? "");
  const [qty, setQty] = useState(product ? String(product.quantity_needed) : "1");
  const [target, setTarget] = useState(product ? String(product.target_price) : "");
  const [suggested, setSuggested] = useState(product?.suggested_vendors ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = productSchema.safeParse({
      name,
      brand,
      variant,
      quantity_needed: qty,
      target_price: target,
      suggested_vendors: suggested,
      description,
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: dbErr } = product
      ? await supabase.from("products").update(parsed.data).eq("id", product.id)
      : await supabase.from("products").insert(parsed.data);
    setSaving(false);

    if (dbErr) {
      setError(dbErrorMessage(dbErr.message));
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label" htmlFor="p-name">نام محصول</label>
        <input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-brand">برند</label>
          <input id="p-brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={100} />
        </div>
        <div>
          <label className="label" htmlFor="p-variant">نوع / مدل</label>
          <input id="p-variant" className="field" value={variant} onChange={(e) => setVariant(e.target.value)} maxLength={150} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="p-qty">تعداد موردنیاز</label>
          <input id="p-qty" className="field" inputMode="numeric" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="p-target">قیمت هدف (تومان)</label>
          <input id="p-target" className="field" inputMode="numeric" dir="ltr" value={target} onChange={(e) => setTarget(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="p-sug">همکاران پیشنهادی</label>
        <input id="p-sug" className="field" value={suggested} onChange={(e) => setSuggested(e.target.value)} maxLength={500} />
      </div>

      <div>
        <label className="label" htmlFor="p-desc">توضیحات</label>
        <textarea id="p-desc" rows={3} className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "در حال ذخیره…" : product ? "ذخیره تغییرات" : "ثبت محصول"}
      </button>
    </form>
  );
}
