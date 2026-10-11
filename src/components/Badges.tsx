import type { Comparison } from "@/lib/compare";
import { DECISION_LABEL, STOCK_LABEL, type Decision, type Fulfillment, type StockStatus } from "@/lib/types";
import { formatToman } from "@/lib/format";

export function DecisionBadge({ decision }: { decision: Decision }) {
  const cls =
    decision === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : decision === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{DECISION_LABEL[decision]}</span>;
}

export function FulfillmentBadge({ status }: { status: Fulfillment }) {
  if (status !== "purchased") return null;
  return <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">خریداری‌شده</span>;
}

export function StockBadge({ status }: { status: StockStatus }) {
  const cls =
    status === "in_stock"
      ? "bg-emerald-100 text-emerald-800"
      : status === "out_of_stock"
        ? "bg-red-100 text-red-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{STOCK_LABEL[status]}</span>;
}

/** نمایش نتیجه مقایسه ارزان‌ترین قیمت با قیمت هدف */
export function BestPrice({ cmp }: { cmp: Comparison }) {
  if (cmp.verdict === "no_offer" || !cmp.best) {
    return <span className="text-sm text-slate-500">بدون استعلام موجود</span>;
  }
  const price = formatToman(cmp.best.price);
  if (cmp.verdict === "good") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-sm font-medium text-emerald-700">
        <span aria-hidden>●</span> {price}
        <span className="text-xs font-normal">(مناسب)</span>
        {cmp.partial && <span className="text-xs font-normal text-amber-700">· تعداد کمتر از نیاز</span>}
      </span>
    );
  }
  if (cmp.verdict === "above_target") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1 text-sm font-medium text-amber-700">
        <span aria-hidden>▲</span> {price}
        <span className="text-xs font-normal">(بالاتر از هدف: {formatToman(cmp.diff ?? 0)})</span>
        {cmp.partial && <span className="text-xs font-normal">· تعداد کمتر از نیاز</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm font-medium text-slate-600">
      <span aria-hidden>⏱</span> {price}
      <span className="text-xs font-normal text-amber-700">(اطلاعات قدیمی؛ نیازمند استعلام مجدد)</span>
    </span>
  );
}
