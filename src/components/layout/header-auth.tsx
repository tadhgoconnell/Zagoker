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
        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href={routes.login} variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href={routes.register} size="sm">
            Sign up free
          </ButtonLink>
        </div>
        <MobileNav user={null} />
      </>
    );
  }

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <Link
          href={routes.profile}
          title="Your virtual chips"
          className="flex h-9 items-center gap-1.5 rounded-full border border-gold-500/30 bg-ink-800/70 px-3 text-sm font-semibold text-gold-200 tabular-nums hover:border-gold-400"
        >
          <Chip className="size-4" />
          {formatChips(user.chips)}
        </Link>
        <Link
          href={routes.profile}
          className="flex h-9 items-center gap-2 rounded-full pr-3 pl-1 text-sm font-medium text-cream hover:bg-white/5"
        >
          <Avatar avatar={user.avatar} size="sm" className="size-7" />
          {user.username}
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            aria-label="Log out"
            title="Log out"
            className="grid size-9 place-items-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-cream"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <MobileNav
        user={{ username: user.username, avatar: user.avatar, chips: user.chips }}
      />
    </>
  );
}

/** Shown for the instant before the session has been read. */
export function HeaderAuthFallback() {
  return (
    <>
      <div className="hidden h-9 w-44 animate-pulse rounded-full bg-white/5 md:block" />
      <MobileNav user={null} />
    </>
  );
}
