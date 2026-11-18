"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { gameConfig } from "@/config/site";
import { apiCall } from "@/lib/game/client";
import { formatChips } from "@/lib/utils";

function formatWait(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Daily free chips. `nextAt` comes from the server: null means the bonus can
 * be claimed now. The button only asks; the database decides.
 */
export function DailyBonus({ nextAt }: { nextAt: string | null }) {
  const router = useRouter();
  const [next, setNext] = useState<number | null>(nextAt ? Date.parse(nextAt) : null);
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Tick only while counting down. The first tick also sets the clock after
  // hydration, so server and browser render the same initial HTML.
  useEffect(() => {
    if (next === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [next]);

  const ready = next === null || (now !== null && now >= next);

  const claim = async () => {
    setPending(true);
    setMessage(null);
    const res = await apiCall<{ amount: number; next_at: string }>("/api/bonus", {});
    if (res.ok) {
      setNext(Date.parse(res.data.next_at));
      setMessage(`${formatChips(res.data.amount)} chips added to your balance.`);
    } else {
      setMessage(res.message);
      // Someone (another tab) already claimed: show the countdown rather than the button.
      if (res.code === "bonus_not_ready") setNext(Date.now() + 60_000);
    }
    router.refresh();
    setPending(false);
  };

  return (
    <Panel className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      <Chip className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Daily bonus</h2>
        <p className="mt-0.5 text-sm text-mist" aria-live="polite">
          {message ??
            (ready
              ? `${formatChips(gameConfig.dailyBonus)} free chips are waiting for you.`
              : now === null
                ? "Checking when your next bonus is ready…"
                : `Next bonus in ${formatWait(next! - now)}.`)}
        </p>
      </div>
      <Button onClick={claim} disabled={!ready || pending} className="shrink-0">
        {pending ? "Claiming…" : ready ? `Claim ${formatChips(gameConfig.dailyBonus)}` : "Claimed"}
      </Button>
    </Panel>
  );
}
