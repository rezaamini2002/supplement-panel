export type Role = "owner" | "buyer";
export type Decision = "pending" | "approved" | "rejected";
export type Fulfillment = "open" | "purchased";
export type StockStatus = "in_stock" | "out_of_stock" | "unknown";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  variant: string | null;
  quantity_needed: number;
  target_price: number;
  suggested_vendors: string | null;
  description: string | null;
  decision: Decision;
  decision_at: string | null;
  fulfillment_status: Fulfillment;
  purchased_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  product_id: string;
  vendor_id: string;
  price: number;
  stock_status: StockStatus;
  available_qty: number | null;
  quoted_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppNotification {
  id: string;
  kind: "new_product" | "new_quote" | "decision";
  message: string;
  product_id: string | null;
  created_at: string;
  read_at: string | null;
}

export const DECISION_LABEL: Record<Decision, string> = {
  pending: "در انتظار تصمیم",
  approved: "تأیید خرید",
  rejected: "عدم نیاز به خرید",
};

export const STOCK_LABEL: Record<StockStatus, string> = {
  in_stock: "موجود",
  out_of_stock: "ناموجود",
  unknown: "نامشخص",
};
