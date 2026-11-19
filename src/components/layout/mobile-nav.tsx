"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { AvatarKey } from "@/config/avatars";
import { mainNav, routes } from "@/config/site";
import { logoutAction } from "@/lib/auth/actions";
import { crownedNameClass, displayName, isCrowned } from "@/lib/players";
import { formatChips } from "@/lib/utils";

type NavUser = { username: string; avatar: AvatarKey; photo: string | null; chips: number; isGuest: boolean };

export function MobileNav({ user }: { user: NavUser | null }) {
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
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((v) => !v)}
        className="grid size-11 place-items-center rounded-lg text-cream transition-colors hover:bg-ink-700"
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      {/* Absolute, not fixed: the header has a backdrop filter, which would
          confine a fixed child to the header box. */}
      {open && (
        <div
          id="mobile-menu"
          className="absolute inset-x-0 top-16 z-40 h-[calc(100dvh-4rem)] animate-fade-up overflow-y-auto border-t border-ink-700 bg-ink-950 px-4 py-6"
        >
          {user && (
            <Link
              href={routes.profile}
              onClick={close}
              className="mb-4 flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-900 p-4"
            >
              <Avatar avatar={user.avatar} photo={user.photo} crowned={isCrowned(user.username)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-cream">
                  <span className={isCrowned(user.username) ? crownedNameClass : undefined}>{displayName(user.username)}</span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-sm text-cream tabular-nums">
                  <Chip className="size-4" />
                  {formatChips(user.chips)}
                </span>
              </span>
            </Link>
          )}

          <nav aria-label="Mobile" className="flex flex-col gap-1">
            {user && (
              <Link
                href={routes.profile}
                onClick={close}
                className="rounded-xl px-4 py-3.5 text-lg font-medium text-cream hover:bg-ink-700"
              >
                Profile
              </Link>
            )}
            {mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className="rounded-xl px-4 py-3.5 text-lg font-medium text-cream hover:bg-ink-700"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={routes.handRankings}
              onClick={close}
              className="rounded-xl px-4 py-3.5 text-lg font-medium text-cream hover:bg-ink-700"
            >
              Hand rankings
            </Link>
          </nav>

          <div className="mt-6 flex flex-col gap-3 border-t border-ink-700 pt-6">
            {user?.isGuest ? (
              <Link
                href={routes.profile}
                onClick={close}
                className={buttonStyles({ variant: "secondary", size: "lg" })}
              >
                Save account
              </Link>
            ) : user ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className={buttonStyles({
                    variant: "secondary",
                    size: "lg",
                    className: "w-full",
                  })}
                >
                  <LogOut className="size-4" />
                  Log out
                </button>
              </form>
            ) : (
              <>
                <Link
                  href={routes.play}
                  onClick={close}
                  className={buttonStyles({ size: "lg" })}
                >
                  Play now
                </Link>
                <Link
                  href={routes.login}
                  onClick={close}
                  className={buttonStyles({ variant: "secondary", size: "lg" })}
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
