"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";

async function loadNotifications(): Promise<AppNotification[]> {
  const { data, error } = await createClient()
    .from("notifications")
    .select("id, kind, message, product_id, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("خطا در دریافت اعلان‌ها");
  return (data ?? []) as AppNotification[];
}

export default function NotificationsPage() {
  const { data, error, loading, reload } = useLoad(loadNotifications);

  async function markAllRead() {
    await createClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    window.dispatchEvent(new Event("notifications-changed"));
    reload();
  }

  async function markRead(id: string) {
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    window.dispatchEvent(new Event("notifications-changed"));
    reload();
  }

  const unread = (data ?? []).filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">اعلان‌ها</h1>
        {unread > 0 && (
          <button className="btn-ghost" onClick={markAllRead}>
            همه را خوانده‌شده کن
          </button>
        )}
      </div>

      {loading && <p className="py-8 text-center text-slate-500">در حال بارگذاری…</p>}
      {error && <p className="py-8 text-center text-red-700">{error}</p>}
      {!loading && !error && (data ?? []).length === 0 && <p className="py-8 text-center text-slate-500">اعلانی وجود ندارد.</p>}

      <ul className="space-y-2">
        {(data ?? []).map((n) => (
          <li key={n.id} className={`card flex items-start justify-between gap-3 ${n.read_at ? "opacity-70" : "border-emerald-300"}`}>
            <div>
              <div className="text-sm font-medium">{n.message}</div>
              <div className="text-xs text-slate-500">{formatDateTime(n.created_at)}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              {n.product_id && (
                <Link href={`/product?id=${n.product_id}`} onClick={() => !n.read_at && markRead(n.id)} className="btn-ghost !min-h-[36px] !px-3">
                  مشاهده
                </Link>
              )}
              {!n.read_at && (
                <button className="btn-ghost !min-h-[36px] !px-3" onClick={() => markRead(n.id)}>
                  خواندم
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
