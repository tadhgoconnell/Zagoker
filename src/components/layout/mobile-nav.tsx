"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { mainNav, routes } from "@/config/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  // Close on Escape, and stop the page scrolling behind the open menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-full text-cream transition-colors hover:bg-white/5"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      {/* Absolute, not fixed: the header has a backdrop filter, which would
          confine a fixed child to the header box. */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] animate-fade-up overflow-y-auto border-t border-white/6 bg-ink-950 px-4 py-6"
        >
          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="rounded-xl px-4 py-3.5 text-lg font-medium text-cream hover:bg-white/5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3 border-t border-white/6 pt-6">
            <Link
              href={routes.register}
              onClick={close}
              className={buttonStyles({ size: "lg" })}
            >
              Sign up free
            </Link>
            <Link
              href={routes.login}
              onClick={close}
              className={buttonStyles({ variant: "secondary", size: "lg" })}
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
