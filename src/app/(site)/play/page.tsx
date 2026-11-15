import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { GuestForm } from "@/components/auth/forms";
import { Chip } from "@/components/ui/chip";
import { gameConfig, routes } from "@/config/site";
import { formatChips } from "@/lib/utils";

export const metadata: Metadata = { title: "Play now" };

const linkClass = "font-medium text-gold-300 hover:text-gold-200";

/** Guest entry: no account needed. */
export default function PlayPage() {
  return (
    <AuthCard
      title="Take a seat"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <Chip className="size-4" />
          No account needed. {formatChips(gameConfig.startingChips)} free virtual chips to start.
        </span>
      }
      footer={
        <>
          Have an account? <Link href={routes.login} className={linkClass}>Log in</Link>
          {" · "}
          <Link href={routes.register} className={linkClass}>Create one</Link> to play on any device
        </>
      }
    >
      {/* The form reads ?next= from the URL, which is only known at request time. */}
      <Suspense fallback={<div className="h-40" />}>
        <GuestForm />
      </Suspense>
    </AuthCard>
  );
}
