import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Flat raised surface used for cards, forms and list containers. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-ink-600 bg-ink-900", className)} {...props} />;
}
