const faNumber = new Intl.NumberFormat("fa-IR");

/** عدد با جداکننده هزارگان (مثلاً ۱٬۲۵۰٬۰۰۰) */
export function formatNumber(n: number): string {
  return faNumber.format(n);
}

/** قیمت با جداکننده هزارگان و واحد تومان */
export function formatToman(n: number): string {
  return `${faNumber.format(n)} تومان`;
}

const faDateTime = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tehran",
});

/** تاریخ شمسی و ساعت به وقت تهران */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return faDateTime.format(d);
}

/** تبدیل ارقام فارسی/عربی به انگلیسی و حذف جداکننده‌ها؛ برای ورودی قیمت */
export function parseDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[,٬،\s]/g, "");
}
