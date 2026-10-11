import { z } from "zod";
import { parseDigits } from "./format";

const trimmed = (max: number) => z.string().trim().max(max);

/** رشته عددی (با ارقام فارسی یا جداکننده) را به عدد صحیح تبدیل می‌کند */
const intFromInput = (opts: { min: number; max: number; label: string }) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? String(v) : parseDigits(v)))
    .refine((s) => /^\d+$/.test(s), { message: `${opts.label} باید یک عدد صحیح باشد` })
    .transform((s) => Number(s))
    .refine((n) => n >= opts.min && n <= opts.max, {
      message: `${opts.label} باید بین ${opts.min} و ${opts.max} باشد`,
    });

const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : null));

export const productSchema = z.object({
  name: trimmed(200).min(1, "نام محصول را وارد کنید"),
  brand: optionalText(100),
  variant: optionalText(150),
  quantity_needed: intFromInput({ min: 1, max: 1_000_000, label: "تعداد" }),
  target_price: intFromInput({ min: 0, max: 100_000_000_000, label: "قیمت هدف" }),
  suggested_vendors: optionalText(500),
  description: optionalText(2000),
});

export const vendorSchema = z.object({
  name: trimmed(120).min(1, "نام همکار را وارد کنید"),
  phone: optionalText(30),
  notes: optionalText(1000),
});

export const quoteSchema = z.object({
  product_id: z.string().uuid("محصول نامعتبر است"),
  vendor_id: z.string().uuid("همکار را انتخاب کنید"),
  price: intFromInput({ min: 0, max: 100_000_000_000, label: "قیمت" }),
  stock_status: z.enum(["in_stock", "out_of_stock", "unknown"]),
  available_qty: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : typeof v === "number" ? String(v) : parseDigits(v)))
    .refine((s) => s === null || /^\d+$/.test(s), { message: "تعداد باید عدد صحیح باشد" })
    .transform((s) => (s === null ? null : Number(s)))
    .refine((n) => n === null || (n >= 0 && n <= 1_000_000), { message: "تعداد نامعتبر است" }),
  notes: optionalText(1000),
});

export type ProductInput = z.output<typeof productSchema>;
export type VendorInput = z.output<typeof vendorSchema>;
export type QuoteInput = z.output<typeof quoteSchema>;

/** اولین پیام خطای فارسی از نتیجه zod */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "ورودی نامعتبر است";
}
