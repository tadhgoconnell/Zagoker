import { LogOut } from "lucide-react";
import Link from "next/link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { routes } from "@/config/site";
import { logoutAction } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { formatChips } from "@/lib/utils";

/** Right-hand side of the header. Reads the session, so it streams in. */
export async function HeaderAuth() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink href={routes.login} variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href={routes.play} size="sm">
            Play now
          </ButtonLink>
        </div>
        <MobileNav user={null} />
      </>
    );
  }

  return (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        <Link
          href={routes.profile}
          title="Your virtual chips"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm font-semibold text-cream tabular-nums hover:border-accent-400"
        >
          <Chip className="size-4" />
          {formatChips(user.chips)}
        </Link>
        <Link
          href={routes.profile}
          className="flex h-9 items-center gap-2 rounded-lg pr-3 pl-1 text-sm font-medium text-cream hover:bg-ink-700"
        >
          <Avatar avatar={user.avatar} photo={user.photo} size="sm" className="size-7" />
          {user.username}
        </Link>
        {user.isGuest ? (
          // Logging out would abandon a guest's chips, so offer saving instead.
          <ButtonLink href={routes.profile} variant="secondary" size="sm">
            Save account
          </ButtonLink>
        ) : (
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Log out"
            title="Log out"
            className="grid size-9 place-items-center rounded-lg text-mist transition-colors hover:bg-ink-700 hover:text-cream"
          >
            <LogOut className="size-4" />
          </button>
        </form>
        )}
      </div>
      {/* Below desktop width the balance stays visible next to the menu button. */}
      <Link
        href={routes.profile}
        title="Your virtual chips"
        className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm font-semibold text-cream tabular-nums lg:hidden"
      >
        <Chip className="size-4" />
        {formatChips(user.chips)}
      </Link>
      <MobileNav
        user={{ username: user.username, avatar: user.avatar, photo: user.photo, chips: user.chips, isGuest: user.isGuest }}
      />
    </>
  );
}

/** Shown for the instant before the session has been read. */
export function HeaderAuthFallback() {
  return (
    <>
      <div className="hidden h-9 w-44 animate-pulse rounded-lg bg-ink-800 lg:block" />
      <MobileNav user={null} />
    </>
  );
}
