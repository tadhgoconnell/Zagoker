import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type FieldProps = Omit<ComponentProps<"input">, "id"> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

/** Labelled text input with hint and inline error, wired up for screen readers. */
export function Field({ label, name, error, hint, className, ...props }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-cream">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-xl border bg-ink-900/70 px-4 text-base text-cream placeholder:text-slate transition-colors focus:outline-none focus:ring-2 focus:ring-gold-400/40",
          error
            ? "border-danger/70 focus:border-danger"
            : "border-white/10 hover:border-white/20 focus:border-gold-400",
        )}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
