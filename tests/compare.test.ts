import { describe, expect, it } from "vitest";
import { compareQuotes, latestPerVendor } from "../src/lib/compare";
import { parseDigits } from "../src/lib/format";
import { productSchema, quoteSchema } from "../src/lib/validation";
import type { Quote } from "../src/lib/types";

const NOW = new Date("2026-10-10T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

let n = 0;
function quote(p: Partial<Quote>): Quote {
  n += 1;
  return {
    id: `q${n}`,
    product_id: "p1",
    vendor_id: "v1",
    price: 1_000_000,
    stock_status: "in_stock",
    available_qty: null,
    quoted_at: hoursAgo(1),
    notes: null,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
    ...p,
  };
}

describe("compareQuotes", () => {
  it("بدون استعلام موجود → no_offer", () => {
    const r = compareQuotes([quote({ stock_status: "out_of_stock" }), quote({ vendor_id: "v2", stock_status: "unknown" })], 900_000, 5, NOW);
    expect(r.verdict).toBe("no_offer");
    expect(r.best).toBeNull();
  });

  it("ارزان‌ترین را فقط میان موجودها پیدا می‌کند", () => {
    const cheapButOut = quote({ vendor_id: "v1", price: 500_000, stock_status: "out_of_stock" });
    const cheapButUnknown = quote({ vendor_id: "v2", price: 600_000, stock_status: "unknown" });
    const ok = quote({ vendor_id: "v3", price: 800_000 });
    const r = compareQuotes([cheapButOut, cheapButUnknown, ok], 900_000, 1, NOW);
    expect(r.best?.id).toBe(ok.id);
    expect(r.verdict).toBe("good");
    expect(r.diff).toBe(-100_000);
  });

  it("قیمت بالاتر از هدف → above_target", () => {
    const r = compareQuotes([quote({ price: 1_200_000 })], 1_000_000, 1, NOW);
    expect(r.verdict).toBe("above_target");
    expect(r.diff).toBe(200_000);
  });

  it("قیمت برابر با هدف مناسب است", () => {
    expect(compareQuotes([quote({ price: 1_000_000 })], 1_000_000, 1, NOW).verdict).toBe("good");
  });

  it("اطلاعات قدیمی گزینه قطعی نیست → stale", () => {
    const r = compareQuotes([quote({ price: 700_000, quoted_at: hoursAgo(72) })], 1_000_000, 1, NOW);
    expect(r.verdict).toBe("stale");
  });

  it("فقط آخرین استعلام هر فروشنده شرکت می‌کند", () => {
    const old = quote({ vendor_id: "v1", price: 100_000, quoted_at: hoursAgo(10) });
    const fresh = quote({ vendor_id: "v1", price: 900_000, quoted_at: hoursAgo(1) });
    expect(latestPerVendor([old, fresh])).toHaveLength(1);
    const r = compareQuotes([old, fresh], 1_000_000, 1, NOW);
    expect(r.best?.price).toBe(900_000);
  });

  it("تعداد قابل تأمین کمتر از نیاز → partial", () => {
    const r = compareQuotes([quote({ available_qty: 3 })], 1_000_000, 10, NOW);
    expect(r.partial).toBe(true);
  });
});

describe("validation", () => {
  it("ارقام فارسی و جداکننده را می‌پذیرد", () => {
    expect(parseDigits("۱٬۲۵۰٬۰۰۰")).toBe("1250000");
    const r = productSchema.parse({ name: " وی ", quantity_needed: "۱۰", target_price: "۱,۵۰۰,۰۰۰" });
    expect(r.quantity_needed).toBe(10);
    expect(r.target_price).toBe(1_500_000);
    expect(r.brand).toBeNull();
  });

  it("داده نامعتبر را رد می‌کند", () => {
    expect(productSchema.safeParse({ name: "", quantity_needed: "1", target_price: "10" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "x", quantity_needed: "0", target_price: "10" }).success).toBe(false);
    expect(productSchema.safeParse({ name: "x", quantity_needed: "1", target_price: "-5" }).success).toBe(false);
  });

  it("استعلام معتبر", () => {
    const uuid = "123e4567-e89b-12d3-a456-426614174000";
    const r = quoteSchema.parse({ product_id: uuid, vendor_id: uuid, price: "۲۰۰۰۰۰", stock_status: "in_stock", available_qty: "" });
    expect(r.price).toBe(200000);
    expect(r.available_qty).toBeNull();
    expect(quoteSchema.safeParse({ product_id: uuid, vendor_id: "x", price: "1", stock_status: "in_stock" }).success).toBe(false);
  });
});
