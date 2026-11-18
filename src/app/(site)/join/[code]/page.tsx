import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { JoinCard } from "@/components/lobby/join-card";
import { ButtonLink } from "@/components/ui/button";
import { routes } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatChips } from "@/lib/utils";

export const metadata: Metadata = { title: "Join table", robots: { index: false } };

/** Landing page for invitation links: /join/ROOMCODE */
export default function JoinPage(props: PageProps<"/join/[code]">) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Join params={props.params} />
    </Suspense>
  );
}

async function Join({ params }: { params: PageProps<"/join/[code]">["params"] }) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase().slice(0, 16);
  const user = await requireUser(`/join/${encodeURIComponent(code)}`);
  const supabase = await createClient();

  const { data: table } = await supabase.rpc("get_table_by_code", { p_room_code: code }).maybeSingle<{
    id: string; name: string; is_private: boolean; max_players: number;
    small_blind: number; big_blind: number; buy_in: number; seated: number;
  }>();

  if (!table) {
    return (
      <AuthCard title="Table not found" subtitle="That room code does not match an open table. Check it with your host.">
        <ButtonLink href={routes.lobby} variant="secondary" className="w-full">
          Back to the lobby
        </ButtonLink>
      </AuthCard>
    );
  }

  // Already seated here, or a public table anyone can open: go straight in.
  const { data: seat } = await supabase.from("table_seats").select("table_id").eq("user_id", user.id).maybeSingle();
  if (seat?.table_id === table.id || !table.is_private) redirect(`/table/${table.id}`);

  return (
    <AuthCard title={table.name} subtitle="You have been invited to a private table.">
      <dl className="mb-6 grid grid-cols-3 gap-3 text-center">
        {[
          ["Blinds", `${formatChips(table.small_blind)}/${formatChips(table.big_blind)}`],
          ["Buy-in", formatChips(table.buy_in)],
          ["Players", `${table.seated}/${table.max_players}`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-ink-700 bg-ink-900/60 px-2 py-3">
            <dt className="text-xs text-mist">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {seat ? (
        <ButtonLink href={`/table/${seat.table_id}`} variant="secondary" className="w-full">
          You are seated at another table. Go there first
        </ButtonLink>
      ) : (
        <JoinCard tableId={table.id} roomCode={code} buyIn={Number(table.buy_in)} full={table.seated >= table.max_players} />
      )}
    </AuthCard>
  );
}
