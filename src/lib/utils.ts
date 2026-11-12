import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names, resolving conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const chipFormatter = new Intl.NumberFormat("en-US");

/** 10000 -> "10,000" */
export function formatChips(amount: number): string {
  return chipFormatter.format(Math.trunc(amount));
}

/** 12500 -> "12.5K", 3200000 -> "3.2M". For tight spaces such as seat labels. */
export function formatChipsCompact(amount: number): string {
  const n = Math.trunc(amount);
  if (Math.abs(n) < 10_000) return chipFormatter.format(n);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
