"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Options = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
};

/**
 * In-app confirmation dialog, used instead of the browser's confirm() box.
 * Built on the native <dialog> element, so focus is trapped, Escape cancels
 * and screen readers announce it as a dialog.
 *
 *   const [dialog, confirm] = useConfirm();
 *   if (await confirm({ title, body, confirmLabel })) { ... }
 *   return <>{dialog}...</>;
 */
export function useConfirm() {
  const [options, setOptions] = useState<Options | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const finish = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (options && el && !el.open) el.showModal();
    if (!options && el?.open) el.close();
  }, [options]);

  const confirm = useCallback((next: Options) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        finish(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) finish(false); // click on the backdrop
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-white/10 bg-ink-800 p-0 text-cream shadow-panel backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-fade-up"
    >
      {options && (
        <div className="p-6">
          <h2 id="confirm-title" className="font-display text-xl font-bold">
            {options.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-mist">{options.body}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => finish(false)} autoFocus>
              {options.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={options.danger ? "danger" : "primary"} onClick={() => finish(true)}>
              {options.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );

  return [dialog, confirm] as const;
}
