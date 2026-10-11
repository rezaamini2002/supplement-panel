"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { createClient } from "@/lib/supabase/client";
import { dbErrorMessage, VENDOR_COLS } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { firstError, vendorSchema } from "@/lib/validation";
import type { Vendor } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";

async function loadVendors(): Promise<Vendor[]> {
  const { data, error } = await createClient().from("vendors").select(VENDOR_COLS).order("name");
  if (error) throw new Error("خطا در دریافت همکاران");
  return (data ?? []) as Vendor[];
}

function VendorForm({ vendor, onDone }: { vendor?: Vendor; onDone: () => void }) {
  const [name, setName] = useState(vendor?.name ?? "");
  const [phone, setPhone] = useState(vendor?.phone ?? "");
  const [notes, setNotes] = useState(vendor?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = vendorSchema.safeParse({ name, phone, notes });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error: dbErr } = vendor
      ? await supabase.from("vendors").update(parsed.data).eq("id", vendor.id)
      : await supabase.from("vendors").insert(parsed.data);
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
        <label className="label" htmlFor="v-name">نام همکار</label>
        <input id="v-name" className="field" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </div>
      <div>
        <label className="label" htmlFor="v-phone">شماره تماس (اختیاری)</label>
        <input id="v-phone" className="field" dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
      </div>
      <div>
        <label className="label" htmlFor="v-notes">توضیحات</label>
        <textarea id="v-notes" rows={3} className="field" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "در حال ذخیره…" : vendor ? "ذخیره تغییرات" : "افزودن همکار"}
      </button>
    </form>
  );
}

export default function VendorsPage() {
  const { data, error, loading, reload } = useLoad(loadVendors);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (data ?? []).filter((v) => {
      if (!showInactive && !v.is_active) return false;
      if (!s) return true;
      return v.name.toLowerCase().includes(s) || (v.phone ?? "").includes(s);
    });
  }, [data, search, showInactive]);

  async function toggleActive(v: Vendor) {
    setActionError(null);
    const { error: e } = await createClient().from("vendors").update({ is_active: !v.is_active }).eq("id", v.id);
    if (e) setActionError(dbErrorMessage(e.message));
    else reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">دفترچه همکاران</h1>
        <button className="btn-primary" onClick={() => setEditing("new")}>
          + همکار جدید
        </button>
      </div>

      <div className="card space-y-2">
        <input className="field" placeholder="جست‌وجو در نام یا شماره…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="جست‌وجو" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          نمایش غیرفعال‌ها
        </label>
      </div>

      {loading && <p className="py-8 text-center text-slate-500">در حال بارگذاری…</p>}
      {error && <p className="py-8 text-center text-red-700">{error}</p>}
      {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
      {!loading && !error && rows.length === 0 && <p className="py-8 text-center text-slate-500">همکاری پیدا نشد.</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((v) => (
          <div key={v.id} className={`card space-y-1 ${v.is_active ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold">{v.name}</div>
              {!v.is_active && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs">غیرفعال</span>}
            </div>
            {v.phone && (
              <a href={`tel:${v.phone}`} dir="ltr" className="block text-right text-sm text-emerald-700">
                {v.phone}
              </a>
            )}
            {v.notes && <p className="text-sm text-slate-600">{v.notes}</p>}
            <p className="text-xs text-slate-400">آخرین تغییر: {formatDateTime(v.updated_at)}</p>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setEditing(v)}>
                ویرایش
              </button>
              <button className="btn-ghost flex-1" onClick={() => toggleActive(v)}>
                {v.is_active ? "غیرفعال کردن" : "فعال کردن"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "همکار جدید" : "ویرایش همکار"} onClose={() => setEditing(null)}>
          <VendorForm
            vendor={editing === "new" ? undefined : editing}
            onDone={() => {
              setEditing(null);
              reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
