import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Raised dark surface used for cards, forms and list containers. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/8 bg-linear-to-b from-ink-700/70 to-ink-800/70 shadow-panel backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}
