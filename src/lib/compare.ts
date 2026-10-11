import type { Quote } from "./types";

/** استعلام قدیمی‌تر از این مقدار (ساعت) «قدیمی» حساب می‌شود و گزینه قطعی خرید نیست */
export const STALE_AFTER_HOURS = 48;

export type Verdict =
  | "no_offer" // هیچ استعلام موجودی وجود ندارد
  | "good" // موجود، تازه و ≤ قیمت هدف
  | "above_target" // موجود، تازه ولی گران‌تر از هدف
  | "stale"; // ارزان‌ترین موجود، اما اطلاعاتش قدیمی است

export interface Comparison {
  best: Quote | null;
  verdict: Verdict;
  /** اختلاف با قیمت هدف (مثبت = گران‌تر از هدف) */
  diff: number | null;
  /** تعداد قابل تأمین کمتر از نیاز است */
  partial: boolean;
}

export function isStale(quote: Quote, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(quote.quoted_at).getTime();
  return ageMs > STALE_AFTER_HOURS * 3600 * 1000;
}

/** آخرین استعلام هر فروشنده؛ استعلام‌های قبلی تاریخچه‌اند و در مقایسه شرکت نمی‌کنند */
export function latestPerVendor(quotes: Quote[]): Quote[] {
  const map = new Map<string, Quote>();
  for (const q of quotes) {
    const prev = map.get(q.vendor_id);
    if (!prev || new Date(q.quoted_at).getTime() > new Date(prev.quoted_at).getTime()) {
      map.set(q.vendor_id, q);
    }
  }
  return [...map.values()];
}

export function compareQuotes(
  quotes: Quote[],
  targetPrice: number,
  quantityNeeded: number,
  now: Date = new Date(),
): Comparison {
  // فقط استعلام‌های «موجود» شرکت می‌کنند
  const inStock = latestPerVendor(quotes).filter((q) => q.stock_status === "in_stock");
  if (inStock.length === 0) {
    return { best: null, verdict: "no_offer", diff: null, partial: false };
  }

  const best = inStock.reduce((a, b) => (b.price < a.price ? b : a));
  const diff = best.price - targetPrice;
  const partial = best.available_qty !== null && best.available_qty < quantityNeeded;

  // اطلاعات قدیمی را گزینه قطعی معرفی نمی‌کنیم
  if (isStale(best, now)) {
    return { best, verdict: "stale", diff, partial };
  }
  return { best, verdict: diff <= 0 ? "good" : "above_target", diff, partial };
}
