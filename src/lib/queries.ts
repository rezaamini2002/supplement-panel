import { createClient } from "@/lib/supabase/client";
import type { Product, Quote, Vendor } from "@/lib/types";

export const PRODUCT_COLS =
  "id, name, brand, variant, quantity_needed, target_price, suggested_vendors, description, decision, decision_at, fulfillment_status, purchased_at, is_archived, created_at, updated_at";
export const QUOTE_COLS =
  "id, product_id, vendor_id, price, stock_status, available_qty, quoted_at, notes, created_at, updated_at";
export const VENDOR_COLS = "id, name, phone, notes, is_active, created_at, updated_at";

export interface Overview {
  products: Product[];
  quotes: Quote[];
  vendors: Vendor[];
}

export async function loadOverview(): Promise<Overview> {
  const supabase = createClient();
  const [p, q, v] = await Promise.all([
    supabase.from("products").select(PRODUCT_COLS).order("created_at", { ascending: false }),
    supabase.from("quotes").select(QUOTE_COLS).order("quoted_at", { ascending: false }),
    supabase.from("vendors").select(VENDOR_COLS).order("name"),
  ]);
  if (p.error) throw new Error("خطا در دریافت محصولات");
  if (q.error) throw new Error("خطا در دریافت استعلام‌ها");
  if (v.error) throw new Error("خطا در دریافت همکاران");
  return {
    products: (p.data ?? []) as Product[],
    quotes: (q.data ?? []) as Quote[],
    vendors: (v.data ?? []) as Vendor[],
  };
}

export function groupQuotes(quotes: Quote[]): Map<string, Quote[]> {
  const m = new Map<string, Quote[]>();
  for (const q of quotes) {
    const arr = m.get(q.product_id);
    if (arr) arr.push(q);
    else m.set(q.product_id, [q]);
  }
  return m;
}

/** پیام خطای قابل‌فهم از خطای دیتابیس */
export function dbErrorMessage(message: string): string {
  if (/row-level security|permission denied/i.test(message)) return "شما اجازه انجام این کار را ندارید.";
  if (message.includes("مسئول خرید") || message.includes("کارفرما") || message.includes("خریداری")) return message;
  return "ذخیره‌سازی ناموفق بود. دوباره تلاش کنید.";
}
