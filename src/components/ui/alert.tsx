import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-danger/40 bg-danger/10 text-[#ffb4b6]"
          : "border-felt-400/40 bg-felt-600/15 text-[#a9e9cd]",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
