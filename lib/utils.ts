import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function calculateNetProfit(order: {
  revenue: number;
  discounts: number;
  refunds: number;
  supplierCost: number;
  shippingCost: number;
  fees: number;
  adSpend: number;
}): number {
  return (
    order.revenue -
    order.discounts -
    order.refunds -
    order.supplierCost -
    order.shippingCost -
    order.fees -
    order.adSpend
  );
}

export function calculateROAS(revenue: number, adSpend: number): number {
  if (adSpend === 0) return 0;
  return revenue / adSpend;
}

export function calculateCAC(adSpend: number, orders: number): number {
  if (orders === 0) return 0;
  return adSpend / orders;
}
